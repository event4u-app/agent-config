/**
 * PID-file management for the browser-wizard server.
 *
 * Written to `<projectRoot>/agents/runtime/gui/server.pid` on boot;
 * removed on clean shutdown. On the next `--gui` boot a stale PID
 * (process gone) is silently overwritten. A live PID aborts with a
 * helpful message so two wizards can't fight for the same project.
 */

import { closeSync, existsSync, openSync, readFileSync, unlinkSync, writeFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { ensureRuntimeDir } from './transaction-log.js';

export const PID_FILE_NAME = 'server.pid';

export function pidFilePath(projectRoot: string): string {
    return join(ensureRuntimeDir(projectRoot), PID_FILE_NAME);
}

/** True iff a process with `pid` is currently alive on this host. */
export function isProcessAlive(pid: number): boolean {
    if (!Number.isFinite(pid) || pid <= 0) return false;
    try {
        // Signal 0 — existence check; throws ESRCH if absent, EPERM if alive but not ours.
        process.kill(pid, 0);
        return true;
    } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        return code === 'EPERM';
    }
}

export interface PidCheckResult {
    readonly path: string;
    readonly conflict: boolean;
    readonly conflictingPid?: number;
}

/** Inspect any pre-existing PID file. */
export function inspectPidFile(projectRoot: string): PidCheckResult {
    const path = pidFilePath(projectRoot);
    if (!existsSync(path)) return { path, conflict: false };
    const raw = readFileSync(path, 'utf8').trim();
    const pid = Number.parseInt(raw, 10);
    if (!Number.isFinite(pid)) return { path, conflict: false };
    if (isProcessAlive(pid)) return { path, conflict: true, conflictingPid: pid };
    return { path, conflict: false };
}

/** Write the current pid to the PID file (non-atomic; overwrites). */
export function writePidFile(projectRoot: string, pid: number = process.pid): string {
    const path = pidFilePath(projectRoot);
    writeFileSync(path, `${pid}\n`, 'utf8');
    return path;
}

/**
 * Atomically create the PID file with O_EXCL semantics (`wx` flag). Two
 * concurrent boots cannot both succeed: the second `openSync` throws
 * EEXIST. Stale-but-dead PID files are reaped first via
 * `inspectPidFile` so a previous crash doesn't permanently lock the
 * project root.
 *
 * Council `wizard-wiring-2026-05-22.synthesis.md` Tier 2 item 6.
 *
 * @throws PidLockConflictError when another live process already owns the lock.
 */
export class PidLockConflictError extends Error {
    readonly conflictingPid: number | undefined;
    readonly path: string;
    constructor(path: string, conflictingPid: number | undefined) {
        super(
            `GUI server already running (pid ${conflictingPid ?? '?'}); ` +
            `stop it or delete ${path} before retrying.`,
        );
        this.name = 'PidLockConflictError';
        this.path = path;
        this.conflictingPid = conflictingPid;
    }
}

export function lockPidFile(projectRoot: string, pid: number = process.pid): string {
    const path = pidFilePath(projectRoot);
    // Reap a stale lock (process gone) before attempting the atomic create.
    const pre = inspectPidFile(projectRoot);
    if (!pre.conflict && existsSync(path)) {
        try { unlinkSync(path); } catch { /* ignore */ }
    }
    try {
        const fd = openSync(path, 'wx');
        try {
            writeSync(fd, `${pid}\n`);
        } finally {
            closeSync(fd);
        }
        return path;
    } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'EEXIST') {
            // Re-inspect: a different process may have grabbed it
            // between the reap and our openSync.
            const post = inspectPidFile(projectRoot);
            throw new PidLockConflictError(path, post.conflictingPid);
        }
        throw err;
    }
}

/** Remove the PID file; idempotent. */
export function clearPidFile(projectRoot: string): void {
    const path = pidFilePath(projectRoot);
    if (existsSync(path)) {
        try { unlinkSync(path); } catch { /* ignore */ }
    }
}
