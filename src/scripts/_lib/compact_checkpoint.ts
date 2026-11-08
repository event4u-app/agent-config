/**
 * Compaction checkpoint — written at `pre_compact`, classified after, never injected.
 *
 * Injection is deliberately absent: (session key, transcript hash) names the
 * session, not the compaction attempt, so a checkpoint left behind by an
 * aborted compaction would match the next one. Until an attempt-specific
 * signal exists this module only writes and measures.
 *
 * What it records:
 *
 *   - `orphaned` — a checkpoint still unclassified when the next `pre_compact`
 *     runs. An aborted compaction produces this, and so does a compaction whose
 *     `session_start` never reached the concern; the count cannot tell them apart.
 *   - the post-compaction class — `match`, `key-mismatch`, `version-mismatch`,
 *     `stale` or `none` — of what an injection WOULD have met. Nothing is
 *     returned to the model on any path.
 *   - `age_ms` between write and classification, so a staleness bound can be
 *     set from readings rather than guessed.
 *
 * The checkpoint body is the deterministic continuity record: same gates, same
 * forbidden judgement fields. The event log carries counts and ages only and is
 * bounded. Writes refuse a symlinked directory or file, because hooks run
 * inside repositories whose contents others can supply.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { buildContinuityRecord } from './continuity_writer.js';
import { eolSessionKey, eolStateFile, type StoredEolCounters } from './session_eol.js';

/** A classification older than this reads as `stale`. A stated default, set to be revised from `age_ms` readings. */
export const STALE_AFTER_MS = 10 * 60 * 1000;

/** The event log keeps at most this many lines; older ones are dropped on the next write. */
export const EVENT_LOG_MAX_LINES = 2000;

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

function isSymlink(p: string): boolean {
    try {
        return fs.lstatSync(p).isSymbolicLink();
    } catch {
        return false;
    }
}

/** The directory, created if absent, or `null` when it or a parent we create into is a symlink. */
function safeDir(root: string): string | null {
    const dir = checkpointDir(root);
    if (isSymlink(dir) || isSymlink(path.dirname(dir))) return null;
    fs.mkdirSync(dir, { recursive: true });
    return isSymlink(dir) ? null : dir;
}

function readCheckpoint(file: string): Checkpoint | null {
    if (isSymlink(file)) return null;
    try {
        const cp = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<Checkpoint>;
        if (
            cp?.schema_version !== 1 ||
            typeof cp.session_key !== 'string' ||
            typeof cp.transcript_hash !== 'string' ||
            typeof cp.written_at !== 'string' ||
            !Number.isFinite(Date.parse(cp.written_at)) ||
            (cp.package_version !== null && typeof cp.package_version !== 'string') ||
            cp.continuity === null ||
            typeof cp.continuity !== 'object'
        ) {
            return null;
        }
        return cp as Checkpoint;
    } catch {
        return null;
    }
}

function writeAtomic(dir: string, file: string, body: string): void {
    if (isSymlink(file)) throw new Error('refusing to write through a symlink');
    const tmp = path.join(dir, `.${path.basename(file)}.${crypto.randomBytes(6).toString('hex')}.tmp`);
    fs.writeFileSync(tmp, body, { flag: 'wx' });
    fs.renameSync(tmp, file);
}

function logEvent(root: string, event: EventName, now: Date, ageMs?: number): void {
    const dir = safeDir(root);
    if (dir === null) return;
    const file = eventsFile(root);
    if (isSymlink(file)) return;
    const row: Record<string, unknown> = { at: now.toISOString(), event };
    if (ageMs !== undefined) row['age_ms'] = ageMs;
    let lines: string[] = [];
    try {
        lines = fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim() !== '');
    } catch {
        lines = [];
    }
    lines.push(JSON.stringify(row));
    writeAtomic(dir, file, `${lines.slice(-EVENT_LOG_MAX_LINES).join('\n')}\n`);
}

function readCounters(root: string, sessionKey: string): StoredEolCounters | null {
    try {
        const state = JSON.parse(fs.readFileSync(eolStateFile(root, sessionKey), 'utf8')) as { counters?: StoredEolCounters };
        return state.counters ?? null;
    } catch {
        return null;
    }
}

/** `pre_compact`: invalidate an unclassified predecessor, then write this attempt's checkpoint. */
export function recordPreCompact(input: CheckpointInput): PreCompactOutcome {
    const now = input.now ?? new Date();
    const dir = safeDir(input.root);
    if (dir === null) return 'skipped';
    const key = eolSessionKey(input.sessionId);
    const file = checkpointFile(input.root, key);
    if (fs.existsSync(file) || isSymlink(file)) {
        // Removed before anything else, and counted only once the removal held,
        // so a skipped write below can never leave the predecessor eligible.
        fs.rmSync(file, { force: true });
        logEvent(input.root, 'orphaned', now);
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
        continuity: decision.record,
    };
    writeAtomic(dir, file, `${JSON.stringify(cp, null, 2)}\n`);
    logEvent(input.root, 'written', now);
    return 'written';
}

/**
 * `session_start(compact)`: classify what an injection would have met, log it,
 * then consume the checkpoint. Returns only the class, never the checkpoint.
 */
export function observePostCompact(input: CheckpointInput): PostCompactOutcome {
    const now = input.now ?? new Date();
    const key = eolSessionKey(input.sessionId);
    const file = checkpointFile(input.root, key);
    const cp = readCheckpoint(file);
    let outcome: PostCompactOutcome;
    let ageMs: number | undefined;
    if (cp === null) {
        outcome = 'none';
    } else {
        ageMs = Math.max(0, now.getTime() - Date.parse(cp.written_at));
        if (cp.session_key !== key || cp.transcript_hash !== transcriptHash(input.transcriptPath)) outcome = 'key-mismatch';
        else if (cp.package_version !== input.version) outcome = 'version-mismatch';
        else if (ageMs > STALE_AFTER_MS) outcome = 'stale';
        else outcome = 'match';
    }
    // Logged before the checkpoint is consumed: if the log write fails, the
    // checkpoint stays and the next observation classifies it again.
    logEvent(input.root, outcome, now, ageMs);
    if (fs.existsSync(file) && !isSymlink(file)) fs.rmSync(file, { force: true });
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
