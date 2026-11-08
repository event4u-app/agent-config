/**
 * Compaction checkpoint — written at `pre_compact`, observed after, never injected.
 *
 * Injection is deliberately absent: (session key, transcript hash) names the
 * session, not the compaction attempt, so a checkpoint left behind by an
 * aborted compaction would match the next one. Until an attempt-specific
 * signal exists this module only writes and measures.
 *
 * Three facts it records, each the council asked for:
 *
 *   - `orphaned` — a checkpoint still unobserved when the next `pre_compact`
 *     writes. That is the aborted-attempt case; its rate is the evidence the
 *     attempt-identity blocker waits on.
 *   - the post-compaction classification — `match`, `key-mismatch`,
 *     `version-mismatch`, `stale` or `none` — of what an injection WOULD have
 *     met. Nothing is returned to the model on any path.
 *   - `age_ms` between write and observation, so a staleness bound can be set
 *     from readings rather than guessed.
 *
 * The checkpoint body is the deterministic continuity record
 * (`continuity_writer.buildContinuityRecord`): same gates, same forbidden
 * judgement fields. The event log carries counts and ages only — no session
 * id, path or slug — because it outlives the session that wrote it.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { buildContinuityRecord } from './continuity_writer.js';
import { eolSessionKey, eolStateFile, type StoredEolCounters } from './session_eol.js';

/** A classification older than this reads as `stale`. A stated default, set to be revised from `age_ms` readings. */
export const STALE_AFTER_MS = 10 * 60 * 1000;

export type PreCompactOutcome = 'written' | 'skipped';
export type PostCompactOutcome = 'match' | 'key-mismatch' | 'version-mismatch' | 'stale' | 'none';
type EventName = PreCompactOutcome | 'orphaned' | PostCompactOutcome;

export interface CheckpointInput {
    root: string;
    sessionId: string;
    transcriptPath: string;
    slug: string | null;
    version: string | null;
    now?: Date;
}

interface Checkpoint {
    schema_version: 1;
    session_key: string;
    transcript_hash: string;
    package_version: string | null;
    written_at: string;
    observed_at: string | null;
    continuity: Record<string, unknown>;
}

export function checkpointDir(root: string): string {
    return path.join(root, 'agents', 'runtime', 'state', 'compact-checkpoint');
}

export function checkpointFile(root: string, sessionKey: string): string {
    return path.join(checkpointDir(root), `${sessionKey}.json`);
}

export function eventsFile(root: string): string {
    return path.join(checkpointDir(root), 'events.jsonl');
}

export function transcriptHash(transcriptPath: string): string {
    return crypto.createHash('sha256').update(transcriptPath).digest('hex').slice(0, 16);
}

function readCheckpoint(file: string): Checkpoint | null {
    try {
        const cp = JSON.parse(fs.readFileSync(file, 'utf8')) as Checkpoint;
        return cp && cp.schema_version === 1 && typeof cp.written_at === 'string' ? cp : null;
    } catch {
        return null;
    }
}

function writeAtomic(file: string, body: string): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, body);
    fs.renameSync(tmp, file);
}

function logEvent(root: string, event: EventName, now: Date, ageMs?: number): void {
    const row: Record<string, unknown> = { at: now.toISOString(), event };
    if (ageMs !== undefined) row['age_ms'] = ageMs;
    fs.mkdirSync(checkpointDir(root), { recursive: true });
    fs.appendFileSync(eventsFile(root), `${JSON.stringify(row)}\n`);
}

function readCounters(root: string, sessionKey: string): StoredEolCounters | null {
    try {
        const state = JSON.parse(fs.readFileSync(eolStateFile(root, sessionKey), 'utf8')) as { counters?: StoredEolCounters };
        return state.counters ?? null;
    } catch {
        return null;
    }
}

/** `pre_compact`: write this session's checkpoint; an unobserved predecessor is counted as orphaned first. */
export function recordPreCompact(input: CheckpointInput): PreCompactOutcome {
    const now = input.now ?? new Date();
    const key = eolSessionKey(input.sessionId);
    const file = checkpointFile(input.root, key);
    const previous = readCheckpoint(file);
    if (previous !== null && previous.observed_at === null) {
        // Invalidate before deciding whether to write: a skipped write must not
        // leave the previous attempt's checkpoint eligible for this compaction.
        logEvent(input.root, 'orphaned', now);
        fs.rmSync(file, { force: true });
    }

    const decision = buildContinuityRecord({
        root: input.root,
        sessionId: input.sessionId,
        slug: input.slug,
        counters: readCounters(input.root, key),
        now,
    });
    if (decision.record === null) {
        logEvent(input.root, 'skipped', now);
        return 'skipped';
    }
    const cp: Checkpoint = {
        schema_version: 1,
        session_key: key,
        transcript_hash: transcriptHash(input.transcriptPath),
        package_version: input.version,
        written_at: now.toISOString(),
        observed_at: null,
        continuity: decision.record,
    };
    writeAtomic(file, `${JSON.stringify(cp, null, 2)}\n`);
    logEvent(input.root, 'written', now);
    return 'written';
}

/**
 * `session_start(compact)`: classify what an injection would have met, mark the
 * checkpoint observed, and return only the class. Never the checkpoint.
 */
export function observePostCompact(input: CheckpointInput): PostCompactOutcome {
    const now = input.now ?? new Date();
    const file = checkpointFile(input.root, eolSessionKey(input.sessionId));
    const cp = readCheckpoint(file);
    let outcome: PostCompactOutcome;
    let ageMs: number | undefined;
    if (cp === null || cp.observed_at !== null) {
        outcome = 'none';
    } else {
        ageMs = Math.max(0, now.getTime() - Date.parse(cp.written_at));
        if (cp.transcript_hash !== transcriptHash(input.transcriptPath)) outcome = 'key-mismatch';
        else if (cp.package_version !== input.version) outcome = 'version-mismatch';
        else if (ageMs > STALE_AFTER_MS) outcome = 'stale';
        else outcome = 'match';
        writeAtomic(file, `${JSON.stringify({ ...cp, observed_at: now.toISOString() }, null, 2)}\n`);
    }
    logEvent(input.root, outcome, now, ageMs);
    return outcome;
}

/** Event counts from the log, for the evidence file and the step's verify. */
export function readEventTally(root: string): Record<EventName, number> {
    const tally: Record<EventName, number> = {
        written: 0,
        skipped: 0,
        orphaned: 0,
        match: 0,
        'key-mismatch': 0,
        'version-mismatch': 0,
        stale: 0,
        none: 0,
    };
    let text = '';
    try {
        text = fs.readFileSync(eventsFile(root), 'utf8');
    } catch {
        return tally;
    }
    for (const line of text.split('\n')) {
        if (!line) continue;
        try {
            const ev = (JSON.parse(line) as { event?: EventName }).event;
            if (ev !== undefined && ev in tally) tally[ev]++;
        } catch {
            continue;
        }
    }
    return tally;
}
