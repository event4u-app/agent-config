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
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { containedPath } from './contained_write.js';
import { eolSessionKey } from './session_eol.js';
import { event4u_root, write_target, type EnvMap } from './user_global_paths.js';

/** A classification older than this reads as `stale`. A stated default, set to be revised from `age_ms` readings. */
export const STALE_AFTER_MS = 10 * 60 * 1000;

/** The event log never exceeds this; an append that would cross it first trims the log to half, newest lines kept. */
export const EVENT_LOG_MAX_BYTES = 256 * 1024;

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
    schema_version: 2;
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
 * A regular file's text, opened without following a symlink or blocking, and at
 * most `max` bytes even if the file grows after it was opened; `null` otherwise.
 */
export function readRegular(file: string, max: number): string | null {
    const { O_RDONLY, O_NOFOLLOW, O_NONBLOCK } = fs.constants;
    let fd: number;
    try {
        fd = fs.openSync(file, O_RDONLY | (O_NOFOLLOW ?? 0) | (O_NONBLOCK ?? 0));
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

/** The `version` of the nearest `package.json` at or above `startDir` (five levels at most), read through `readRegular`. */
export function packageVersionFrom(startDir: string): string | null {
    let dir = startDir;
    for (let i = 0; i < 5; i++) {
        const text = readRegular(path.join(dir, 'package.json'), PACKAGE_JSON_MAX_BYTES);
        if (text !== null) {
            try {
                const v = (JSON.parse(text) as { version?: unknown }).version;
                if (typeof v === 'string') return v;
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
            m?.schema_version !== 2 ||
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
    fs.writeFileSync(tmp, body, { flag: 'wx' });
    fs.renameSync(tmp, file);
}

function logEvent(env: EnvMap | undefined, event: EventName, now: Date, ageMs?: number): void {
    const dir = safeDir(env);
    if (dir === null) return;
    const file = eventsFile(env);
    const st = lstatOrNull(file);
    if (st !== null && !st.isFile()) return;
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
        return;
    }
    const { O_WRONLY, O_APPEND, O_CREAT, O_NOFOLLOW, O_NONBLOCK } = fs.constants;
    const fd = fs.openSync(file, O_WRONLY | O_APPEND | O_CREAT | (O_NOFOLLOW ?? 0) | (O_NONBLOCK ?? 0), 0o644);
    try {
        // Re-checked on the descriptor: a FIFO or a hard-linked file swapped in after the lstat is refused.
        const fst = fs.fstatSync(fd);
        if (fst.isFile() && fst.nlink === 1) fs.writeSync(fd, line);
    } finally {
        fs.closeSync(fd);
    }
}

/** `pre_compact`: invalidate an unclassified predecessor, then write this attempt's marker. */
export function recordPreCompact(input: CheckpointInput): PreCompactOutcome {
    const now = input.now ?? new Date();
    const dir = safeDir(input.env);
    if (dir === null) return 'skipped';
    const key = eolSessionKey(input.sessionId);
    const file = checkpointFile(key, input.env);
    if (lstatOrNull(file) !== null) {
        // Removed before anything else, and counted only once the removal held,
        // so a failed write below can never leave the predecessor eligible.
        fs.rmSync(file, { force: true });
        logEvent(input.env, 'orphaned', now);
    }
    const marker: Marker = {
        schema_version: 2,
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
        else if (m.package_version !== input.version) outcome = 'version-mismatch';
        else if (ageMs > STALE_AFTER_MS) outcome = 'stale';
        else outcome = 'match';
    }
    // Logged before the marker is consumed: if the log write fails, the marker
    // stays and the next observation classifies it again.
    logEvent(input.env, outcome, now, ageMs);
    // Consumed when classified, and removed when unreadable as a marker, so a
    // malformed file never lingers; anything that is not a regular file stays.
    if (lstatOrNull(file)?.isFile()) fs.rmSync(file, { force: true });
    return outcome;
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
            const ev = (JSON.parse(line) as { event?: EventName }).event;
            if (ev !== undefined && ev in tally) tally[ev]++;
        } catch {
            continue;
        }
    }
    return tally;
}
