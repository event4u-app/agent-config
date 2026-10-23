/**
 * Single-flight lock for `code-graph refresh --single-flight`.
 *
 * The lock is the SAME directory the git-hook refresh block in
 * `install-hooks.sh` takes with `mkdir`, so a refresh started by a hook and
 * one started by the `code-graph-refresh` session concern exclude each other.
 * `mkdir` is the primitive because it is atomic on every POSIX filesystem.
 *
 * Ownership is recorded in a SIBLING file, never inside the directory: the
 * shell block clears a stale lock with `rmdir`, which fails on a non-empty
 * directory and would leave that lock held forever.
 *
 * A lock is reclaimed only when its owner process is gone, or — for a
 * hook-taken lock, which carries no owner record — when it is older than
 * {@link STALE_LOCK_MS}, matching the shell block's own `-mmin -5` rule. A live
 * owner is never reclaimed on age, and a release removes the lock only while
 * the owner record still carries the releaser's nonce, so a holder that was
 * reclaimed cannot delete its successor's lock on the way out.
 */
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const LOCK_REL = path.join('agents', 'runtime', 'state', 'code-graph-refresh.lock');
/** Written by `code-graph auto-refresh on`; the session concern acts only while it exists. */
export const AUTO_REFRESH_REL = path.join('agents', 'runtime', 'state', 'code-graph-auto-refresh.json');
export const STALE_LOCK_MS = 5 * 60 * 1000;

interface Owner {
    pid: number;
    started_at: number;
    nonce: string;
}

const ownerPath = (lock: string): string => `${lock}.owner.json`;

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
        if (typeof o.pid === 'number' && typeof o.started_at === 'number' && typeof o.nonce === 'string') {
            return { pid: o.pid, started_at: o.started_at, nonce: o.nonce };
        }
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
    if (owner !== 'none') return !pidAlive(owner.pid);
    try {
        return now - fs.statSync(lock).mtimeMs > STALE_LOCK_MS;
    } catch (e) {
        return errno(e) === 'ENOENT';
    }
}

/** Take the lock, or return null when another refresh holds it. */
export function acquire(root: string): (() => void) | null {
    const lock = path.join(root, LOCK_REL);
    fs.mkdirSync(path.dirname(lock), { recursive: true });
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            fs.mkdirSync(lock);
        } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== 'EEXIST' || attempt > 0 || !isStale(lock)) return null;
            // Two reclaimers can interleave here and both build. That costs a
            // duplicate build, never a torn cache: each build publishes by rename.
            fs.rmSync(ownerPath(lock), { force: true });
            fs.rmSync(lock, { recursive: true, force: true });
            continue;
        }
        const nonce = randomBytes(16).toString('hex');
        fs.writeFileSync(ownerPath(lock), JSON.stringify({ pid: process.pid, started_at: Date.now(), nonce }));
        return () => {
            const owner = readOwner(lock);
            if (typeof owner === 'string' || owner.nonce !== nonce) return;
            fs.rmSync(ownerPath(lock), { force: true });
            fs.rmSync(lock, { recursive: true, force: true });
        };
    }
    return null;
}
