/**
 * `agent-config statusline:tap | statusline:install | statusline:uninstall`.
 *
 * The tap is how AC learns the plan window. Claude Code pipes a JSON payload
 * into the status-line command on every refresh, and that payload is the only
 * official carrier of `rate_limits.five_hour` / `seven_day` and of the context
 * window. The tap sits in front of the user's own status line: it hands the
 * same bytes to the user's command, prints that command's output unchanged,
 * and only then writes one counts-only snapshot to the machine-wide quota
 * ledger. Every error of its own is swallowed — a status line that goes blank
 * because AC failed to write a file is worse than no ledger.
 *
 * `install` records the user's `statusLine` value beside the ledger and points
 * `statusLine` at the tap; `uninstall` puts the recorded value back. The
 * original is stored rather than quoted into a shell line, so no command ever
 * has to survive a second round of quoting.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { write_atomic } from '../_lib/fs_atomic.js';
import { appendQuotaSnapshot, quotaStateDir, snapshotFromStatusPayload } from '../_lib/quota_ledger.js';
import { quotaSegment } from '../_lib/pressure.js';
import type { EnvMap } from '../_lib/user_global_paths.js';

/** The command the installer writes into `statusLine.command`. */
export const TAP_COMMAND = 'agent-config statusline:tap';

/** How long the user's own status-line command may run before the tap gives up on it. */
const WRAPPED_TIMEOUT_MS = 5000;

export function originalPath(env?: EnvMap | null): string {
    return path.join(quotaStateDir(env), 'statusline-original.json');
}

export function claudeSettingsPath(env?: EnvMap | null): string {
    const e = env ?? process.env;
    const home = e['CLAUDE_CONFIG_DIR'] ?? path.join(e['HOME'] ?? os.homedir(), '.claude');
    return path.join(home, 'settings.json');
}

interface RecordedOriginal {
    /** The user's `statusLine` value, or `null` when there was none. */
    readonly statusLine: unknown;
}

function readOriginal(env?: EnvMap | null): RecordedOriginal | null {
    try {
        const o = JSON.parse(fs.readFileSync(originalPath(env), 'utf-8')) as Record<string, unknown>;
        return 'statusLine' in o ? { statusLine: o['statusLine'] } : null;
    } catch {
        return null;
    }
}

function wrappedCommand(env?: EnvMap | null): string | null {
    const rec = readOriginal(env);
    const sl = rec?.statusLine;
    if (sl === null || typeof sl !== 'object') return null;
    const cmd = (sl as Record<string, unknown>)['command'];
    return typeof cmd === 'string' && cmd.trim() !== '' && !isTap(cmd) ? cmd : null;
}

function isTap(command: unknown): boolean {
    return typeof command === 'string' && command.trim().startsWith(TAP_COMMAND);
}

export interface TapOptions {
    readonly stdin: string;
    readonly env?: EnvMap | null;
    readonly now?: number;
    /** Runs the user's command; injected by tests. */
    readonly run?: (command: string, input: string) => string;
}

function runShell(command: string, input: string): string {
    const r = spawnSync('/bin/sh', ['-c', command], { input, encoding: 'utf-8', timeout: WRAPPED_TIMEOUT_MS });
    return typeof r.stdout === 'string' ? r.stdout : '';
}

/**
 * One tap: the wrapped line's output first, then the snapshot. Returns what is
 * printed. With no wrapped command the tap prints AC's own compact segment, and
 * only while a window is under pressure.
 */
export function runTap(opts: TapOptions): string {
    const now = opts.now ?? Date.now();
    let printed = '';
    let wrapped: string | null = null;
    try {
        wrapped = wrappedCommand(opts.env);
    } catch {
        wrapped = null;
    }
    if (wrapped !== null) {
        try {
            printed = (opts.run ?? runShell)(wrapped, opts.stdin);
        } catch {
            printed = '';
        }
    }
    try {
        const snapshot = snapshotFromStatusPayload(JSON.parse(opts.stdin), now);
        if (snapshot !== null) appendQuotaSnapshot(snapshot, opts.env);
    } catch {
        // the ledger is best-effort; the line must still print
    }
    if (wrapped === null) {
        try {
            printed = quotaSegment(opts.env, now);
        } catch {
            printed = '';
        }
    }
    return printed;
}

export interface InstallResult {
    readonly code: 0 | 1;
    readonly message: string;
}

function readSettings(file: string): Record<string, unknown> | null {
    try {
        const o = JSON.parse(fs.readFileSync(file, 'utf-8')) as unknown;
        return o !== null && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
    } catch (err) {
        return (err as NodeJS.ErrnoException).code === 'ENOENT' ? {} : null;
    }
}

function writeSettings(file: string, settings: Record<string, unknown>): void {
    write_atomic(file, `${JSON.stringify(settings, null, 2)}\n`);
}

export function installTap(env?: EnvMap | null): InstallResult {
    const file = claudeSettingsPath(env);
    const settings = readSettings(file);
    if (settings === null) return { code: 1, message: `❌  ${file} is not a JSON object — nothing changed.` };
    const current = settings['statusLine'];
    if (current !== null && typeof current === 'object' && isTap((current as Record<string, unknown>)['command'])) {
        return { code: 0, message: `statusline:install · already installed in ${file}` };
    }
    write_atomic(originalPath(env), JSON.stringify({ statusLine: current ?? null }));
    settings['statusLine'] = { type: 'command', command: TAP_COMMAND };
    writeSettings(file, settings);
    const kept = current === undefined ? 'no previous status line' : 'your status line is chained and keeps printing';
    return { code: 0, message: `statusline:install · tap installed in ${file} (${kept}); undo with agent-config statusline:uninstall` };
}

export function uninstallTap(env?: EnvMap | null): InstallResult {
    const file = claudeSettingsPath(env);
    const settings = readSettings(file);
    if (settings === null) return { code: 1, message: `❌  ${file} is not a JSON object — nothing changed.` };
    const current = settings['statusLine'];
    if (current === null || typeof current !== 'object' || !isTap((current as Record<string, unknown>)['command'])) {
        return { code: 0, message: `statusline:uninstall · the tap is not installed in ${file}` };
    }
    const rec = readOriginal(env);
    if (rec === null || rec.statusLine === null || rec.statusLine === undefined) {
        delete settings['statusLine'];
    } else {
        settings['statusLine'] = rec.statusLine;
    }
    writeSettings(file, settings);
    try {
        fs.rmSync(originalPath(env), { force: true });
    } catch {
        // a stale record is harmless: install overwrites it
    }
    return { code: 0, message: `statusline:uninstall · previous status line restored in ${file}` };
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const [verb] = argv;
    if (verb === 'tap') {
        let stdin = '';
        try {
            stdin = fs.readFileSync(0, 'utf-8');
        } catch {
            stdin = '';
        }
        const out = runTap({ stdin });
        if (out !== '') process.stdout.write(out);
        return 0;
    }
    if (verb === 'install' || verb === 'uninstall') {
        const r = verb === 'install' ? installTap() : uninstallTap();
        (r.code === 0 ? process.stdout : process.stderr).write(`${r.message}\n`);
        return r.code;
    }
    process.stderr.write('usage: agent-config statusline:tap | statusline:install | statusline:uninstall\n');
    return 2;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exitCode = main();
}
