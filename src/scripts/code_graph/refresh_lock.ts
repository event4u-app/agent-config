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
 * the owner record still carries the releaser's token, so a holder that was
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
    token: string;
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

function readOwner(lock: string): Owner | null {
    try {
        const o = JSON.parse(fs.readFileSync(ownerPath(lock), 'utf-8')) as Partial<Owner>;
        return typeof o.pid === 'number' && typeof o.started_at === 'number' && typeof o.token === 'string'
            ? { pid: o.pid, started_at: o.started_at, token: o.token }
            : null;
    } catch {
        return null;
    }
}

export function isStale(lock: string, now: number = Date.now()): boolean {
    const owner = readOwner(lock);
    if (owner) return !pidAlive(owner.pid);
    try {
        return now - fs.statSync(lock).mtimeMs > STALE_LOCK_MS;
    } catch {
        return true;
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
        const token = randomBytes(16).toString('hex');
        fs.writeFileSync(ownerPath(lock), JSON.stringify({ pid: process.pid, started_at: Date.now(), token }));
        return () => {
            if (readOwner(lock)?.token !== token) return;
            fs.rmSync(ownerPath(lock), { force: true });
            fs.rmSync(lock, { recursive: true, force: true });
        };
    }
    return null;
}
