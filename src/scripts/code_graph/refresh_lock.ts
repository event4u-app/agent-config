/**
 * Single-flight lock for `code-graph refresh --single-flight` and `map`.
 *
 * Every producer goes through {@link acquire}: the git-hook refresh block in
 * `install-hooks.sh` and the `code-graph-refresh` session concern both run
 * `refresh --single-flight`, so there is one locking protocol, not two.
 * `mkdir` is the primitive because it is atomic on every POSIX filesystem.
 *
 * Ownership is recorded in a SIBLING file, never inside the directory, so the
 * directory is empty and a single `rmdir`-style removal clears it.
 *
 * A lock is reclaimed only on positive evidence that its owner is gone (see
 * {@link isStale}); an owner-less lock — a torn owner write — counts as stale
 * only past {@link STALE_LOCK_MS}. A release removes the lock only while the
 * owner record still carries the releaser's nonce, so a holder that was
 * reclaimed cannot delete its successor's lock on the way out.
 */
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export const LOCK_REL = path.join('agents', 'runtime', 'state', 'code-graph-refresh.lock');
/** Written by `code-graph auto-refresh on`; the session concern acts only while it exists. */
export const AUTO_REFRESH_REL = path.join('agents', 'runtime', 'state', 'code-graph-auto-refresh.json');
export const STALE_LOCK_MS = 5 * 60 * 1000;
/**
 * The oldest a held lock may be before its owner is no longer believed: a
 * refresh runs inside a 60 s build budget plus one map redraw, so an owner
 * still "alive" after this is a reused PID, or a process on another host
 * (a container sharing the checkout) whose liveness this host cannot probe.
 */
export const MAX_LOCK_AGE_MS = 30 * 60 * 1000;

interface Owner {
    pid: number;
    started_at: number;
    nonce: string;
    /** Absent in records written before the host was stored; treated as this host. */
    host?: string;
}

const ownerPath = (lock: string): string => `${lock}.owner.json`;
export const STALE_RECLAIM_MS = 60 * 1000;

export interface RefreshRecord {
    at: string;
    /** `session-start` (the concern) or `refresh` (the CLI run it starts, or a manual one). */
    by: 'session-start' | 'refresh';
    outcome: string;
    detail?: string | undefined;
}

/** One file per side, so the session concern writes without reading or merging anything. */
export const refreshRecordPath = (root: string, by: RefreshRecord['by']): string =>
    path.join(root, path.dirname(LOCK_REL), `code-graph-refresh.${by}.json`);

/** The last outcome of one side, so a refresh that never happens is visible. Best-effort. */
export function recordRefresh(root: string, rec: Omit<RefreshRecord, 'at'>): void {
    try {
        fs.writeFileSync(refreshRecordPath(root, rec.by), JSON.stringify({ at: new Date().toISOString(), ...rec }));
    } catch {
        /* never fails a refresh */
    }
}

export function readRefreshRecords(root: string): Partial<Record<RefreshRecord['by'], RefreshRecord>> {
    const out: Partial<Record<RefreshRecord['by'], RefreshRecord>> = {};
    for (const by of ['session-start', 'refresh'] as const) {
        try {
            out[by] = JSON.parse(fs.readFileSync(refreshRecordPath(root, by), 'utf-8')) as RefreshRecord;
        } catch {
            /* never recorded */
        }
    }
    return out;
}

function pidAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch (e) {
        // EPERM means the process exists but belongs to someone else.
        return (e as NodeJS.ErrnoException).code === 'EPERM';
    }
}

const errno = (e: unknown): string | undefined => (e as NodeJS.ErrnoException).code;

/** The owner record; `'none'` when there is no file or no valid record; `'unreadable'` on any other error. */
function readOwner(lock: string): Owner | 'none' | 'unreadable' {
    let raw: string;
    try {
        raw = fs.readFileSync(ownerPath(lock), 'utf-8');
    } catch (e) {
        return errno(e) === 'ENOENT' ? 'none' : 'unreadable';
    }
    try {
        const o = JSON.parse(raw) as Partial<Owner>;
        if (typeof o.pid === 'number' && typeof o.started_at === 'number' && typeof o.nonce === 'string') return o as Owner;
    } catch {
        /* a torn write; fall through to the age rule */
    }
    return 'none';
}

/**
 * True only on positive evidence: the owner's process is gone, the lock has
 * vanished, or an owner-less lock is provably older than the threshold. A lock
 * or owner record that cannot be inspected is treated as live.
 */
export function isStale(lock: string, now: number = Date.now()): boolean {
    const owner = readOwner(lock);
    if (owner === 'unreadable') return false;
    if (owner !== 'none') {
        if (now - owner.started_at > MAX_LOCK_AGE_MS) return true;
        // Another host's PID means nothing here: only the age rule above applies.
        if (owner.host && owner.host !== os.hostname()) return false;
        return !pidAlive(owner.pid);
    }
    try {
        return now - fs.statSync(lock).mtimeMs > STALE_LOCK_MS;
    } catch (e) {
        return errno(e) === 'ENOENT';
    }
}

function take(lock: string): () => void {
    const nonce = randomBytes(16).toString('hex');
    fs.writeFileSync(ownerPath(lock), JSON.stringify({ pid: process.pid, started_at: Date.now(), nonce, host: os.hostname() }));
    return () => {
        const owner = readOwner(lock);
        if (typeof owner === 'string' || owner.nonce !== nonce) return;
        fs.rmSync(ownerPath(lock), { force: true });
        fs.rmSync(lock, { recursive: true, force: true });
    };
}

/**
 * Take the lock, or return null when another refresh holds it.
 *
 * A stale lock is removed only while holding a second mkdir mutex, and only
 * after staleness is checked AGAIN under it. A reclaimer that judged the lock
 * stale and was then overtaken finds the successor's live lock on that second
 * check and declines, so it can never delete a lock created after it looked.
 * A reclaim mutex is held for a few file operations; one older than
 * {@link STALE_RECLAIM_MS} was left by a crash inside that section and is
 * cleared, or every later stale lock would stay held for good.
 * `afterStaleCheck` exists for the interleaving test only.
 */
export function acquire(root: string, afterStaleCheck?: () => void): (() => void) | null {
    const lock = path.join(root, LOCK_REL);
    fs.mkdirSync(path.dirname(lock), { recursive: true });
    try {
        fs.mkdirSync(lock);
        return take(lock);
    } catch (e) {
        if (errno(e) !== 'EEXIST' || !isStale(lock)) return null;
    }
    afterStaleCheck?.();
    const mutex = `${lock}.reclaim`;
    try {
        if (Date.now() - fs.statSync(mutex).mtimeMs > STALE_RECLAIM_MS) fs.rmSync(mutex, { recursive: true, force: true });
    } catch {
        /* no leftover mutex */
    }
    try {
        fs.mkdirSync(mutex);
    } catch {
        return null;
    }
    try {
        if (!isStale(lock)) return null;
        fs.rmSync(ownerPath(lock), { force: true });
        fs.rmSync(lock, { recursive: true, force: true });
        try {
            fs.mkdirSync(lock);
        } catch {
            return null;
        }
        return take(lock);
    } finally {
        fs.rmSync(mutex, { recursive: true, force: true });
    }
}
