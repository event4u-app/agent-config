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
 * bounded. Every read, write and delete first requires each path component
 * from the repository root down to be a real directory, and reads only regular
 * files of bounded size without following or blocking — hooks run inside
 * repositories whose contents others can supply, including symlinks and FIFOs.
 *
 * Two sessions appending at once can interleave; a trim racing an append can
 * drop that append. Accepted for a counts-only log.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { containedPath } from './contained_write.js';
import { buildContinuityRecord } from './continuity_writer.js';
import { git_dir } from './git_common_dir.js';
import { recycle_consumed_rel } from './recycle_envelope_paths.js';
import { claim_read_paths, read_claimed_slug } from './roadmap_claim.js';
import { roadmapPath } from './run_checkpoint.js';
import { eolSessionKey, eolStateFile, type StoredEolCounters } from './session_eol.js';

/** A classification older than this reads as `stale`. A stated default, set to be revised from `age_ms` readings. */
export const STALE_AFTER_MS = 10 * 60 * 1000;

/** The event log keeps at most this many lines; older ones are dropped when it is trimmed. */
export const EVENT_LOG_MAX_LINES = 2000;

/** A log larger than this is trimmed; one that cannot be read within it is replaced. */
export const EVENT_LOG_MAX_BYTES = 256 * 1024;

const CHECKPOINT_MAX_BYTES = 256 * 1024;

/** Largest file the continuity writer and its readers may be handed. */
const READ_MAX_BYTES = 1024 * 1024;

export type PreCompactOutcome = 'written' | 'skipped';
export type PostCompactOutcome = 'match' | 'key-mismatch' | 'version-mismatch' | 'stale' | 'none';
type EventName = PreCompactOutcome | 'orphaned' | PostCompactOutcome;

export interface CheckpointInput {
    root: string;
    sessionId: string;
    transcriptPath: string;
    /** The claimed roadmap; `undefined` resolves it here, after the claim files pass the preflight. */
    slug?: string | null | undefined;
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

/** True when every existing component from `root` down to the checkpoint directory is a real directory. */
function inBoundary(root: string): boolean {
    return containedPath(root, checkpointDir(root));
}

/** The directory, created inside the boundary, or `null` when the boundary does not hold. */
function safeDir(root: string): string | null {
    const dir = checkpointDir(root);
    if (!inBoundary(root)) return null;
    fs.mkdirSync(dir, { recursive: true });
    return inBoundary(root) ? dir : null;
}

/** A regular file's text, read without following a symlink or blocking; `null` otherwise or over `max` bytes. */
function readRegular(file: string, max: number): string | null {
    const { O_RDONLY, O_NOFOLLOW, O_NONBLOCK } = fs.constants;
    let fd: number;
    try {
        fd = fs.openSync(file, O_RDONLY | (O_NOFOLLOW ?? 0) | (O_NONBLOCK ?? 0));
    } catch {
        return null;
    }
    try {
        if (!fs.fstatSync(fd).isFile()) return null;
        // Read at most max + 1 bytes: a file that grew after fstat is still refused.
        const buf = Buffer.alloc(max + 1);
        let n = 0;
        for (;;) {
            const got = fs.readSync(fd, buf, n, buf.length - n, null);
            if (got === 0) break;
            n += got;
            if (n > max) return null;
        }
        return buf.subarray(0, n).toString('utf8');
    } catch {
        return null;
    } finally {
        fs.closeSync(fd);
    }
}

function isRegularFile(p: string): boolean {
    try {
        return fs.lstatSync(p).isFile();
    } catch {
        return false;
    }
}

function readCheckpoint(file: string): Checkpoint | null {
    const text = readRegular(file, CHECKPOINT_MAX_BYTES);
    if (text === null) return null;
    try {
        const cp = JSON.parse(text) as Partial<Checkpoint>;
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
    if (fs.existsSync(file) && !isRegularFile(file)) return;
    const row: Record<string, unknown> = { at: now.toISOString(), event };
    if (ageMs !== undefined) row['age_ms'] = ageMs;
    const line = `${JSON.stringify(row)}\n`;
    let size = 0;
    try {
        size = fs.lstatSync(file).size;
    } catch {
        size = 0;
    }
    if (size > EVENT_LOG_MAX_BYTES / 4) {
        const text = readRegular(file, EVENT_LOG_MAX_BYTES * 4);
        const lines = text === null ? [] : text.split('\n').filter((l) => l.startsWith('{') && l.length < 512);
        if (text === null || size > EVENT_LOG_MAX_BYTES || lines.length >= EVENT_LOG_MAX_LINES) {
            const kept = lines.slice(-(EVENT_LOG_MAX_LINES - 1));
            writeAtomic(dir, file, `${kept.join('\n')}${kept.length > 0 ? '\n' : ''}${line}`);
            return;
        }
    }
    const { O_WRONLY, O_APPEND, O_CREAT, O_NOFOLLOW } = fs.constants;
    const fd = fs.openSync(file, O_WRONLY | O_APPEND | O_CREAT | (O_NOFOLLOW ?? 0), 0o644);
    try {
        fs.writeSync(fd, line);
    } finally {
        fs.closeSync(fd);
    }
}

/** Absent, or a regular non-symlink file no larger than `max`. A FIFO, device or symlink fails. */
function absentOrRegular(p: string, max = READ_MAX_BYTES): boolean {
    let st: fs.Stats;
    try {
        st = fs.lstatSync(p);
    } catch {
        return true;
    }
    return st.isFile() && st.size <= max;
}

/**
 * Every file the continuity writer and the claim reader will open for this
 * session, checked before any of them is opened. Those readers are shared with
 * the Stop path and read without these guards, so the checkpoint refuses to
 * call them unless each path is absent or a plain file. Git's refs and
 * packed-refs are not walked: a repository whose refs block also blocks git.
 */
function readsAreSafe(root: string, sessionId: string, slug: string | null | undefined): boolean {
    const paths = [eolStateFile(root, eolSessionKey(sessionId)), path.join(root, recycle_consumed_rel(sessionId))];
    if (slug === undefined) paths.push(...claim_read_paths(root, sessionId));
    else if (slug !== null) paths.push(roadmapPath(root, slug));
    if (!paths.every((p) => absentOrRegular(p))) return false;
    const dotGit = path.join(root, '.git');
    try {
        const st = fs.lstatSync(dotGit);
        if (!(st.isDirectory() || (st.isFile() && st.size <= READ_MAX_BYTES))) return false;
    } catch {
        return true;
    }
    const gd = git_dir(root);
    return gd === null || absentOrRegular(path.join(gd, 'HEAD'));
}

function readCounters(root: string, sessionKey: string): StoredEolCounters | null {
    const file = eolStateFile(root, sessionKey);
    if (!containedPath(root, path.dirname(file))) return null;
    const text = readRegular(file, READ_MAX_BYTES);
    if (text === null) return null;
    try {
        return (JSON.parse(text) as { counters?: StoredEolCounters }).counters ?? null;
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
    if (isRegularFile(file) || isSymlink(file)) {
        // Removed before anything else, and counted only once the removal held,
        // so a skipped write below can never leave the predecessor eligible.
        fs.rmSync(file, { force: true });
        logEvent(input.root, 'orphaned', now);
    }

    let slug = input.slug;
    if (!readsAreSafe(input.root, input.sessionId, slug)) {
        logEvent(input.root, 'skipped', now);
        return 'skipped';
    }
    if (slug === undefined) {
        slug = read_claimed_slug(input.root, input.sessionId);
        if (!readsAreSafe(input.root, input.sessionId, slug)) {
            logEvent(input.root, 'skipped', now);
            return 'skipped';
        }
    }
    const decision = buildContinuityRecord({
        root: input.root,
        sessionId: input.sessionId,
        slug,
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
    if (!inBoundary(input.root)) return 'none';
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
    if (cp !== null && isRegularFile(file)) fs.rmSync(file, { force: true });
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
    if (!inBoundary(root)) return tally;
    const text = readRegular(eventsFile(root), EVENT_LOG_MAX_BYTES * 4);
    if (text === null) return tally;
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
