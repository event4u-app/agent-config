/**
 * Transaction log + rollback for the browser-wizard install flow.
 *
 * Every planned write is appended to
 * `<projectRoot>/agents/runtime/gui/install-<ts>.log` BEFORE the atomic
 * rename runs. If the SSE stream is cancelled mid-flight (POST
 * /api/cancel, browser tab closed, server crash) the next `--gui` boot
 * detects the log and offers to roll back any files that landed.
 *
 * Log shape: newline-delimited JSON, one TransactionLogEntry per line.
 * Roundtrip-stable: `appendEntry` -> `readLog` returns the same list.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TransactionLogEntry } from './types.js';

/** Resolve the GUI runtime directory. Tests inject `subdir`. */
export function guiRuntimeDir(projectRoot: string, subdir = 'gui'): string {
    return join(projectRoot, 'agents', 'runtime', subdir);
}

/** Create the GUI runtime directory if missing; idempotent. */
export function ensureRuntimeDir(projectRoot: string, subdir = 'gui'): string {
    const dir = guiRuntimeDir(projectRoot, subdir);
    mkdirSync(dir, { recursive: true });
    return dir;
}

/** Build a fresh log path: `install-<iso-ts>.log` with `:` stripped. */
export function newLogPath(projectRoot: string, now: () => string = () => new Date().toISOString()): string {
    const dir = ensureRuntimeDir(projectRoot);
    const ts = now().replace(/[:.]/g, '-');
    return join(dir, `install-${ts}.log`);
}

/** Append one entry; line is `JSON.stringify(entry) + '\n'`. */
export function appendEntry(logPath: string, entry: TransactionLogEntry): void {
    appendFileSync(logPath, `${JSON.stringify(entry)}\n`, 'utf8');
}

/** Read every entry from a log file. Tolerates trailing blank lines. */
export function readLog(logPath: string): readonly TransactionLogEntry[] {
    if (!existsSync(logPath)) return [];
    const text = readFileSync(logPath, 'utf8');
    return text
        .split('\n')
        .filter((l) => l.length > 0)
        .map((l) => JSON.parse(l) as TransactionLogEntry);
}

/** A log is "open" when it has a `start` but no terminal `commit`/`cancel`/`error`. */
export function isOpenLog(entries: readonly TransactionLogEntry[]): boolean {
    if (entries.length === 0) return false;
    const hasStart = entries.some((e) => e.kind === 'start');
    if (!hasStart) return false;
    return !entries.some((e) => e.kind === 'commit' || e.kind === 'cancel' || e.kind === 'error');
}

/** Find the newest open log under `agents/runtime/gui/`, if any. */
export function findOpenLog(projectRoot: string): string | undefined {
    const dir = guiRuntimeDir(projectRoot);
    if (!existsSync(dir)) return undefined;
    const candidates = readdirSync(dir)
        .filter((n) => n.startsWith('install-') && n.endsWith('.log'))
        .map((n) => join(dir, n));
    let newest: { path: string; mtime: number } | undefined;
    for (const p of candidates) {
        const entries = readLog(p);
        if (!isOpenLog(entries)) continue;
        const m = statSync(p).mtimeMs;
        if (newest === undefined || m > newest.mtime) newest = { path: p, mtime: m };
    }
    return newest?.path;
}

/** All `plan` paths recorded in a log — used by rollback to know what to remove. */
export function plannedPaths(entries: readonly TransactionLogEntry[]): readonly string[] {
    return entries.filter((e): e is Extract<TransactionLogEntry, { kind: 'plan' }> => e.kind === 'plan').map((e) => e.path);
}

/** Mark a log as closed by appending a terminal `cancel` entry. */
export function closeLog(logPath: string, reason: string, now: () => string = () => new Date().toISOString()): void {
    appendEntry(logPath, { kind: 'cancel', ts: now(), reason });
}

/** Truncate (overwrite-empty) a log — used when the user declines rollback. */
export function discardLog(logPath: string): void {
    writeFileSync(logPath, '', 'utf8');
}
