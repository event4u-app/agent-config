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
 * A lock is reclaimed when its owner process is gone, or when it is older than
 * {@link STALE_LOCK_MS} — a hook-taken lock carries no owner file, so age is
 * the only signal there, matching the shell block's own `-mmin -5` rule.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export const LOCK_REL = path.join('agents', 'runtime', 'state', 'code-graph-refresh.lock');
export const STALE_LOCK_MS = 5 * 60 * 1000;

interface Owner {
    pid: number;
    started_at: number;
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
        return typeof o.pid === 'number' && typeof o.started_at === 'number' ? { pid: o.pid, started_at: o.started_at } : null;
    } catch {
        return null;
    }
}

export function isStale(lock: string, now: number = Date.now()): boolean {
    const owner = readOwner(lock);
    if (owner) return !pidAlive(owner.pid) || now - owner.started_at > STALE_LOCK_MS;
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
        fs.writeFileSync(ownerPath(lock), JSON.stringify({ pid: process.pid, started_at: Date.now() }));
        return () => {
            fs.rmSync(ownerPath(lock), { force: true });
            fs.rmSync(lock, { recursive: true, force: true });
        };
    }
    return null;
}
