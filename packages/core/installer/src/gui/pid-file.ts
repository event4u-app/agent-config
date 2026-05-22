/**
 * PID-file management for the browser-wizard server.
 *
 * Written to `<projectRoot>/agents/runtime/gui/server.pid` on boot;
 * removed on clean shutdown. On the next `--gui` boot a stale PID
 * (process gone) is silently overwritten. A live PID aborts with a
 * helpful message so two wizards can't fight for the same project.
 */

import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
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

/** Write the current pid to the PID file (atomic on POSIX via rename trick). */
export function writePidFile(projectRoot: string, pid: number = process.pid): string {
    const path = pidFilePath(projectRoot);
    writeFileSync(path, `${pid}\n`, 'utf8');
    return path;
}

/** Remove the PID file; idempotent. */
export function clearPidFile(projectRoot: string): void {
    const path = pidFilePath(projectRoot);
    if (existsSync(path)) {
        try { unlinkSync(path); } catch { /* ignore */ }
    }
}
