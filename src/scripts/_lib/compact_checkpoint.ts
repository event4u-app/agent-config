/**
 * Compaction checkpoint — a marker written at `pre_compact`, classified after,
 * never injected.
 *
 * Injection is deliberately absent: (session key, transcript hash) names the
 * session, not the compaction attempt, so a marker left behind by an aborted
 * compaction would match the next one. The marker carries no task state either:
 * which fields may ever be restored is still undecided, and reading task state
 * would mean calling readers (roadmap, claims, git) this hook cannot bound.
 *
 * What it records:
 *
 *   - `orphaned` — a marker still unclassified when the next `pre_compact` runs.
 *     An aborted compaction produces this, and so does a compaction whose
 *     `session_start` never reached the concern; the count cannot tell them apart.
 *   - the post-compaction class — `match`, `key-mismatch`, `version-mismatch`,
 *     `stale` or `none` — of what an injection WOULD have met.
 *   - `age_ms` between write and classification, so a staleness bound can be
 *     set from readings rather than guessed.
 *
 * Every file this module opens sits under the user's own runtime directory
 * (`~/.event4u/agent-config/state/compact-checkpoint/`, never inside a
 * repository), plus the package's own `package.json`. Storage outside the
 * repository is what keeps repository contents from substituting a directory
 * or a file under it. Below the runtime root each component must still be a
 * real directory; every read opens a
 * regular file only, without following a symlink or blocking, and reads at most
 * a fixed number of bytes — hooks run inside repositories whose contents others
 * can supply. A concurrent swap between check and open is narrowed, not closed.
 * Two sessions appending at once can interleave, and a trim racing an append can
 * drop that append; accepted for a counts-only log.
 * A sweep can also remove a marker that replaced an expired one between the
 * sweep's lstat and its removal; that observation then reads `none`.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { containedPath } from './contained_write.js';
import { eolSessionKey } from './session_eol.js';
import { event4u_root, write_target, type EnvMap } from './user_global_paths.js';

/** A classification older than this reads as `stale`. A stated default, set to be revised from `age_ms` readings. */
export const STALE_AFTER_MS = 10 * 60 * 1000;

/**
 * The event log's bound. An append that would cross it first trims the log to
 * half, newest lines kept. Concurrent appenders can each pass the size check,
 * so the bound is approximate by a few lines under concurrency, not exact. A
 * tally therefore counts the retained window, not every event ever logged.
 */
export const EVENT_LOG_MAX_BYTES = 256 * 1024;

/** A marker of any session untouched this long is abandoned and removed by the next write. */
export const MARKER_RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * Most directory entries one sweep looks at, kept or removed, plus one read to
 * learn whether the end was reached. Markers are written only below
 * `WRITE_LIMIT`; the gap absorbs the event log and writers racing past the
 * check, so ordinarily a sweep sees the whole directory and an expired marker
 * is removed by the next write.
 *
 * Without a cross-process lock this is not a hard ceiling: more simultaneous
 * writers than the gap can push the directory past it. Cleanup still makes
 * progress then — while a sweep is incomplete no marker is added, and each
 * sweep removes the expired entries among those it looks at — so the
 * directory only shrinks until a sweep is complete again. Files that never
 * expire (anything not named like a marker or temp file) are not removed, and
 * `SWEEP_MAX` of them would stop writes for good.
 */
export const SWEEP_MAX = 512;

/** A marker is written only while the directory holds fewer entries than this; the 32-entry gap to `SWEEP_MAX` covers the event log, temp files and writers racing past the check. */
export const WRITE_LIMIT = 480;

const MARKER_NAME = /^[0-9a-f]{64}\.json$/;
const TEMP_NAME = /^\..+\.[0-9a-f]{12}\.tmp$/;

const PACKAGE_NAME = '@event4u/agent-config';

const MARKER_MAX_BYTES = 4 * 1024;
const PACKAGE_JSON_MAX_BYTES = 64 * 1024;

export type PreCompactOutcome = 'written' | 'skipped';
export type PostCompactOutcome = 'match' | 'key-mismatch' | 'version-mismatch' | 'stale' | 'none';
type EventName = PreCompactOutcome | 'orphaned' | PostCompactOutcome;

export interface CheckpointInput {
    /** Environment the runtime root resolves from; `process.env` when absent. */
    env?: EnvMap;
    sessionId: string;
    transcriptPath: string;
    version: string | null;
    now?: Date;
}

interface Marker {
    schema_version: 3;
    /** Random per write, so two markers are told apart even within one millisecond. */
    generation: string;
    session_key: string;
    transcript_hash: string;
    package_version: string | null;
    written_at: string;
}

export function checkpointDir(env?: EnvMap): string {
    return write_target(path.join('state', 'compact-checkpoint'), { env: env ?? null });
}

export function checkpointFile(sessionKey: string, env?: EnvMap): string {
    return path.join(checkpointDir(env), `${sessionKey}.json`);
}

export function eventsFile(env?: EnvMap): string {
    return path.join(checkpointDir(env), 'events.jsonl');
}

export function transcriptHash(transcriptPath: string): string {
    return crypto.createHash('sha256').update(transcriptPath).digest('hex').slice(0, 16);
}

function lstatOrNull(p: string): fs.Stats | null {
    try {
        return fs.lstatSync(p);
    } catch {
        return null;
    }
}

function inBoundary(env?: EnvMap): boolean {
    return containedPath(event4u_root(env ?? null), checkpointDir(env));
}

/** The directory, created under the runtime root, or `null` when a component below it is not a real directory. */
function safeDir(env?: EnvMap): string | null {
    if (!inBoundary(env)) return null;
    fs.mkdirSync(checkpointDir(env), { recursive: true });
    return inBoundary(env) ? checkpointDir(env) : null;
}

/**
 * The two open flags every read and append here depends on, or `null` when the
 * platform lacks either. Callers skip rather than open without them: a missing
 * flag must never silently mean "follow symlinks" or "block".
 */
export function protectionFlags(constants: typeof fs.constants = fs.constants): { O_NOFOLLOW: number; O_NONBLOCK: number } | null {
    const { O_NOFOLLOW, O_NONBLOCK } = constants;
    return typeof O_NOFOLLOW === 'number' && typeof O_NONBLOCK === 'number' ? { O_NOFOLLOW, O_NONBLOCK } : null;
}

/**
 * A regular file's text, opened without following a symlink or blocking, and at
 * most `max` bytes even if the file grows after it was opened; `null` otherwise,
 * including on a platform that lacks the protection flags.
 */
export function readRegular(file: string, max: number, constants: typeof fs.constants = fs.constants): string | null {
    const flags = protectionFlags(constants);
    if (flags === null) return null;
    let fd: number;
    try {
        fd = fs.openSync(file, constants.O_RDONLY | flags.O_NOFOLLOW | flags.O_NONBLOCK);
    } catch {
        return null;
    }
    try {
        if (!fs.fstatSync(fd).isFile()) return null;
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

/** The `version` of this package's own `package.json` at or above `startDir` (five levels at most), read through `readRegular`. */
export function packageVersionFrom(startDir: string): string | null {
    let dir = startDir;
    for (let i = 0; i < 5; i++) {
        const text = readRegular(path.join(dir, 'package.json'), PACKAGE_JSON_MAX_BYTES);
        if (text !== null) {
            try {
                const pkg = JSON.parse(text) as { name?: unknown; version?: unknown };
                if (pkg.name === PACKAGE_NAME && typeof pkg.version === 'string') return pkg.version;
            } catch {
                // not a package manifest; keep walking
            }
        }
        const up = path.dirname(dir);
        if (up === dir) break;
        dir = up;
    }
    return null;
}

function readMarker(file: string): Marker | null {
    const text = readRegular(file, MARKER_MAX_BYTES);
    if (text === null) return null;
    try {
        const m = JSON.parse(text) as Partial<Marker>;
        if (
            m?.schema_version !== 3 ||
            typeof m.generation !== 'string' ||
            typeof m.session_key !== 'string' ||
            typeof m.transcript_hash !== 'string' ||
            typeof m.written_at !== 'string' ||
            !Number.isFinite(Date.parse(m.written_at)) ||
            (m.package_version !== null && typeof m.package_version !== 'string')
        ) {
            return null;
        }
        return m as Marker;
    } catch {
        return null;
    }
}

function writeAtomic(dir: string, file: string, body: string): void {
    if (lstatOrNull(file)?.isSymbolicLink()) throw new Error('refusing to write through a symlink');
    const tmp = path.join(dir, `.${path.basename(file)}.${crypto.randomBytes(6).toString('hex')}.tmp`);
    try {
        fs.writeFileSync(tmp, body, { flag: 'wx' });
        fs.renameSync(tmp, file);
    } catch (err) {
        fs.rmSync(tmp, { force: true });
        throw err;
    }
}

/** Whether the event reached the log. */
function logEvent(env: EnvMap | undefined, event: EventName, now: Date, ageMs?: number): boolean {
    const dir = safeDir(env);
    if (dir === null) return false;
    const file = eventsFile(env);
    const st = lstatOrNull(file);
    if (st !== null && !st.isFile()) return false;
    const row: Record<string, unknown> = { at: now.toISOString(), event };
    if (ageMs !== undefined) row['age_ms'] = ageMs;
    const line = `${JSON.stringify(row)}\n`;
    const lineBytes = Buffer.byteLength(line, 'utf8');
    if ((st?.size ?? 0) + lineBytes > EVENT_LOG_MAX_BYTES) {
        const text = readRegular(file, EVENT_LOG_MAX_BYTES * 4);
        const kept: string[] = [];
        let bytes = lineBytes;
        const lines = text === null ? [] : text.split('\n').filter((l) => l.startsWith('{'));
        for (let i = lines.length - 1; i >= 0; i--) {
            const len = Buffer.byteLength(lines[i]!, 'utf8') + 1;
            if (bytes + len > EVENT_LOG_MAX_BYTES / 2) break;
            kept.unshift(lines[i]!);
            bytes += len;
        }
        writeAtomic(dir, file, `${kept.join('\n')}${kept.length > 0 ? '\n' : ''}${line}`);
        return true;
    }
    const flags = protectionFlags();
    if (flags === null) return false;
    const { O_WRONLY, O_APPEND, O_CREAT } = fs.constants;
    const fd = fs.openSync(file, O_WRONLY | O_APPEND | O_CREAT | flags.O_NOFOLLOW | flags.O_NONBLOCK, 0o644);
    try {
        // Re-checked on the descriptor: a FIFO or a hard-linked file swapped in after the lstat is refused.
        const fst = fs.fstatSync(fd);
        if (!(fst.isFile() && fst.nlink === 1)) return false;
        const buf = Buffer.from(line, 'utf8');
        for (let off = 0; off < buf.length; ) off += fs.writeSync(fd, buf, off, buf.length - off);
        return true;
    } finally {
        fs.closeSync(fd);
    }
}

/**
 * Remove markers of any session, and temporary files, not touched within
 * `MARKER_RETENTION_MS`; regular files with those names only. Reads the
 * directory incrementally, looks at no more than `SWEEP_MAX` entries and reads
 * one more to learn whether it reached the end; `complete` says whether it did.
 */
export function sweepAbandoned(dir: string, now: Date): { inspected: number; complete: boolean } {
    let d: fs.Dir;
    try {
        d = fs.opendirSync(dir);
    } catch {
        return { inspected: 0, complete: false };
    }
    let inspected = 0;
    let complete = false;
    try {
        for (;;) {
            if (inspected >= SWEEP_MAX) {
                complete = d.readSync() === null;
                break;
            }
            const entry = d.readSync();
            if (entry === null) {
                complete = true;
                break;
            }
            inspected++;
            if (!MARKER_NAME.test(entry.name) && !TEMP_NAME.test(entry.name)) continue;
            const p = path.join(dir, entry.name);
            const st = lstatOrNull(p);
            if (st !== null && st.isFile() && now.getTime() - st.mtimeMs > MARKER_RETENTION_MS) fs.rmSync(p, { force: true });
        }
    } catch {
        complete = false;
    } finally {
        d.closeSync();
    }
    return { inspected, complete };
}

/** `pre_compact`: invalidate an unclassified predecessor, then write this attempt's marker if there is room. */
export function recordPreCompact(input: CheckpointInput): PreCompactOutcome {
    const now = input.now ?? new Date();
    const dir = safeDir(input.env);
    if (dir === null) return 'skipped';
    const key = eolSessionKey(input.sessionId);
    const file = checkpointFile(key, input.env);
    if (lstatOrNull(file) !== null) {
        // Removed first, before any refusal below, so neither a refused nor a
        // failed write can leave the predecessor eligible.
        fs.rmSync(file, { force: true });
        logEvent(input.env, 'orphaned', now);
    }
    const sweep = sweepAbandoned(dir, now);
    if (!sweep.complete || sweep.inspected >= WRITE_LIMIT) {
        logEvent(input.env, 'skipped', now);
        return 'skipped';
    }
    const marker: Marker = {
        schema_version: 3,
        generation: crypto.randomBytes(8).toString('hex'),
        session_key: key,
        transcript_hash: transcriptHash(input.transcriptPath),
        package_version: input.version,
        written_at: now.toISOString(),
    };
    writeAtomic(dir, file, `${JSON.stringify(marker)}\n`);
    logEvent(input.env, 'written', now);
    return 'written';
}

/**
 * `session_start(compact)`: classify what an injection would have met, log it,
 * then consume the marker. Returns only the class.
 */
export function observePostCompact(input: CheckpointInput): PostCompactOutcome {
    const now = input.now ?? new Date();
    if (!inBoundary(input.env)) return 'none';
    const key = eolSessionKey(input.sessionId);
    const file = checkpointFile(key, input.env);
    const m = readMarker(file);
    let outcome: PostCompactOutcome;
    let ageMs: number | undefined;
    if (m === null) {
        outcome = 'none';
    } else {
        ageMs = Math.max(0, now.getTime() - Date.parse(m.written_at));
        if (m.session_key !== key || m.transcript_hash !== transcriptHash(input.transcriptPath)) outcome = 'key-mismatch';
        // An unknown version on both sides compares equal: `match` means the
        // available keys agree, not that the package version was verified.
        else if (m.package_version !== input.version) outcome = 'version-mismatch';
        else if (ageMs > STALE_AFTER_MS) outcome = 'stale';
        else outcome = 'match';
    }
    // Consumed only once the class is logged: if logging fails, the marker stays
    // and the next observation classifies it again. A malformed marker is
    // removed the same way; anything that is not a regular file stays.
    if (logEvent(input.env, outcome, now, ageMs)) {
        if (m !== null) consumeIfUnchanged(file, m.generation);
        else removeIfStillInvalid(file);
    }
    return outcome;
}

/**
 * Remove the marker only if it is still the one that was read (same
 * `generation`), so a marker written by a `pre_compact` that ran between the
 * read and the removal is left for its own observation. Narrows the window to
 * the read-compare-remove sequence; without a lock it cannot be closed.
 */
export function consumeIfUnchanged(file: string, generation: string): boolean {
    if (!lstatOrNull(file)?.isFile()) return false;
    const current = readMarker(file);
    if (current === null || current.generation !== generation) return false;
    fs.rmSync(file, { force: true });
    return true;
}

/** Remove a regular file at the marker path only if it still does not read as a valid marker. */
export function removeIfStillInvalid(file: string): boolean {
    if (!lstatOrNull(file)?.isFile() || readMarker(file) !== null) return false;
    fs.rmSync(file, { force: true });
    return true;
}

/** Event counts from the log, for the evidence file and the step's verify. */
export function readEventTally(env?: EnvMap): Record<EventName, number> {
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
    if (!inBoundary(env)) return tally;
    const text = readRegular(eventsFile(env), EVENT_LOG_MAX_BYTES * 4);
    if (text === null) return tally;
    for (const line of text.split('\n')) {
        if (!line) continue;
        try {
            const ev = (JSON.parse(line) as { event?: unknown }).event;
            if (typeof ev === 'string' && Object.hasOwn(tally, ev)) tally[ev as EventName]++;
        } catch {
            continue;
        }
    }
    return tally;
}
