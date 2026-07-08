#!/usr/bin/env tsx
/**
 * `agent-config converge` — consented cleanup of duplicate install surfaces
 * (road-to-install-path-convergence Phase 3).
 *
 * Reads src/config/surface-matrix.yml, detects every tool whose declared
 * duplicate-class paths are ALL present, and — with consent — performs the
 * per-tool cleanup: the tool's own uninstall command plus tagged-orphan
 * reaping of the matrix-declared cache locations. Emits a convergence report
 * (what was removed, why, rollback hint).
 *
 * Consent model (council Q2, 2026-07-07 — no silent mutation of a
 * user-owned surface):
 *
 * - `install.auto_converge: true` in the GLOBAL settings file
 *   (~/.event4u/agent-config/agent-settings.yml) is standing consent. The
 *   first successful interactive/explicit converge persists it.
 * - Without the key, a TTY run asks ONE y/N question; a non-TTY run refuses
 *   with instructions (automation must opt in via the key or --yes).
 * - `--dry-run` prints the exact actions and exits 0 without consent.
 * - `--yes` grants consent for this run AND persists the key (explicit
 *   automation opt-in).
 *
 * Hard floor: converge removes ONLY matrix-declared, package-tagged paths
 * (`converge.reaps`) and runs ONLY matrix-declared uninstall commands. It
 * never deletes user-authored files; any path outside the matrix allowlist
 * is refused.
 *
 * Exit codes: 0 = converged / nothing to do / dry-run · 1 = refused or a
 * step failed · 2 = usage error.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as YAML from 'yaml';

import * as user_global_paths from '../_lib/user_global_paths.js';

type Dict = Record<string, unknown>;

interface OutSink {
    write: (t: string) => void;
}
const _stdout: OutSink = { write: (t) => process.stdout.write(t) };
const _stderr: OutSink = { write: (t) => process.stderr.write(t) };

function _print(out: OutSink, line = ''): void {
    out.write(`${line}\n`);
}

type Runner = (cmd: string[]) => number;

function _default_runner(cmd: string[]): number {
    const r = spawnSync(cmd[0] as string, cmd.slice(1), { stdio: 'inherit' });
    if (r.error) {
        _stderr.write(`agent-config converge: cannot run ${cmd[0]}: ${String(r.error)}\n`);
        return 1;
    }
    return r.status ?? 1;
}

const _HERE = fileURLToPath(import.meta.url);

/** Resolve the @event4u/agent-config package root (this repo). */
function _package_root(): string {
    return path.resolve(path.dirname(_HERE), '..', '..', '..');
}

const SETTINGS_FILENAME = 'agent-settings.yml';
const CONSENT_KEY_PATH = ['install', 'auto_converge'] as const;

class ArgparseExit extends Error {
    code: number;
    constructor(code: number) {
        super(`exit ${code}`);
        this.code = code;
    }
}

interface Args {
    dry_run: boolean;
    yes: boolean;
}

const PROG = 'agent-config converge';
const USAGE = `usage: ${PROG} [-h] [--dry-run] [--yes]\n`;

function _argError(msg: string): never {
    _stderr.write(USAGE);
    _stderr.write(`${PROG}: error: ${msg}\n`);
    throw new ArgparseExit(2);
}

function _parse(argv: string[]): Args {
    const args: Args = { dry_run: false, yes: false };
    for (const a of argv) {
        if (a === '-h' || a === '--help') {
            _stdout.write(USAGE);
            throw new ArgparseExit(0);
        }
        if (a === '--dry-run') {
            args.dry_run = true;
            continue;
        }
        if (a === '--yes' || a === '-y') {
            args.yes = true;
            continue;
        }
        _argError(`unrecognized arguments: ${a}`);
    }
    return args;
}

interface DuplicateFinding {
    tool: string;
    description: string;
    command: string;
    reaps: string[];
}

interface MatrixTool {
    duplicate?: { description?: string; detect?: { all_of?: unknown } };
    converge?: { command?: string; reaps?: unknown };
}

export function _load_matrix(matrix_path: string): Record<string, MatrixTool> {
    const raw = YAML.parse(fs.readFileSync(matrix_path, 'utf-8'), { version: '1.1' }) as Dict;
    const tools = raw['tools'];
    if (!tools || typeof tools !== 'object' || Array.isArray(tools)) {
        throw new Error('surface-matrix.yml: `tools` must be a mapping');
    }
    return tools as Record<string, MatrixTool>;
}

function _expand(p: string, home: string, pkg_root: string): string {
    return p.startsWith('~/') ? path.join(home, p.slice(2)) : path.join(pkg_root, p);
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** Detect all live duplicate classes per the matrix. */
export function detect_duplicates(
    tools: Record<string, MatrixTool>,
    home: string,
    pkg_root: string,
): DuplicateFinding[] {
    const findings: DuplicateFinding[] = [];
    for (const [tool_id, entry] of Object.entries(tools)) {
        const all_of = entry.duplicate?.detect?.all_of;
        if (!Array.isArray(all_of) || all_of.length === 0) {
            continue; // no defined class (pending_evidence is documented, never acted on)
        }
        const present = all_of.every(
            (p) => typeof p === 'string' && _exists(_expand(p, home, pkg_root)),
        );
        if (!present) {
            continue;
        }
        const reaps_raw = entry.converge?.reaps;
        const reaps = Array.isArray(reaps_raw)
            ? reaps_raw.filter((r): r is string => typeof r === 'string' && r.startsWith('~/'))
            : [];
        findings.push({
            tool: tool_id,
            description: entry.duplicate?.description ?? 'duplicate install surface',
            command: entry.converge?.command ?? '',
            reaps,
        });
    }
    return findings;
}

/** Read install.auto_converge from the global settings file. */
export function read_consent(settings_path: string): boolean {
    try {
        const raw = YAML.parse(fs.readFileSync(settings_path, 'utf-8'), { version: '1.1' }) as Dict;
        const install = raw?.[CONSENT_KEY_PATH[0]];
        if (install && typeof install === 'object' && !Array.isArray(install)) {
            return (install as Dict)[CONSENT_KEY_PATH[1]] === true;
        }
    } catch {
        /* missing / unreadable → no consent */
    }
    return false;
}

/** Persist install.auto_converge: true into the global settings file. */
export function persist_consent(settings_path: string, out: OutSink): void {
    let doc: Dict = {};
    try {
        const parsed = YAML.parse(fs.readFileSync(settings_path, 'utf-8'), { version: '1.1' });
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            doc = parsed as Dict;
        }
    } catch {
        /* absent → create */
    }
    const install =
        doc['install'] && typeof doc['install'] === 'object' && !Array.isArray(doc['install'])
            ? (doc['install'] as Dict)
            : {};
    if (install[CONSENT_KEY_PATH[1]] === true) {
        return;
    }
    install[CONSENT_KEY_PATH[1]] = true;
    doc['install'] = install;
    fs.mkdirSync(path.dirname(settings_path), { recursive: true });
    fs.writeFileSync(settings_path, YAML.stringify(doc), 'utf-8');
    _print(out, `✅  standing consent persisted: install.auto_converge: true (${settings_path})`);
}

/** One-time interactive y/N on a TTY; false everywhere else. */
function _tty_confirm(question: string): boolean {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        return false;
    }
    // Synchronous single-line read from the TTY.
    process.stdout.write(`${question} [y/N] `);
    const buf = Buffer.alloc(64);
    let answer = '';
    try {
        const fd = fs.openSync('/dev/tty', 'rs');
        const n = fs.readSync(fd, buf, 0, 64, null);
        fs.closeSync(fd);
        answer = buf.toString('utf-8', 0, n).trim().toLowerCase();
    } catch {
        return false;
    }
    return answer === 'y' || answer === 'yes';
}

export interface MainOptions {
    runner?: Runner;
    home?: string;
    package_root?: string;
    settings_path?: string;
    confirm?: (question: string) => boolean;
    out?: OutSink;
    err?: OutSink;
}

/**
 * Live-session notice for reaped Claude Code plugin caches — or null when no
 * reap touched `~/.claude/plugins/`.
 *
 * Removing an installed plugin's cache does NOT reach into Claude Code
 * sessions that are already running: they registered the plugin's hooks at
 * session start and keep firing them, so every subsequent event logs
 * `Failed to run: Plugin directory does not exist: …/plugins/cache/… — run
 * /plugin to reinstall` until the session restarts. Claude Code's own
 * `/plugin to reinstall` hint would recreate exactly the duplicate surface
 * converge just removed — the correct remedy is a restart, so converge says
 * so explicitly (road-to-truth-and-reference-hygiene follow-up, 2026-07-08).
 */
export function live_session_notice(executed_reaps: readonly string[]): string | null {
    const hit = executed_reaps.some((r) => r.startsWith('~/.claude/plugins/'));
    if (!hit) {
        return null;
    }
    return (
        '⚠️  Live-session note: Claude Code sessions that were ALREADY RUNNING still\n' +
        '    hold the removed plugin\'s hook registrations. Until you restart them,\n' +
        '    every event logs a non-blocking\n' +
        '      "Failed to run: Plugin directory does not exist: …/plugins/cache/…"\n' +
        '    error. This is cosmetic for new sessions but means the affected LIVE\n' +
        '    session\'s plugin-sourced hooks no longer run — restart Claude Code\n' +
        '    sessions to clear it. Do NOT follow the error\'s "/plugin to reinstall"\n' +
        '    hint: reinstalling recreates the duplicate surface converge just removed\n' +
        '    (the ~/.claude/ file projection already carries content AND hooks).'
    );
}

export function main(argv: string[] | null = null, opts: MainOptions = {}): number {
    let args: Args;
    try {
        args = _parse(argv ?? process.argv.slice(2));
    } catch (e) {
        if (e instanceof ArgparseExit) {
            return e.code;
        }
        throw e;
    }

    const out = opts.out ?? _stdout;
    const err = opts.err ?? _stderr;
    const runner = opts.runner ?? _default_runner;
    const home = opts.home ?? os.homedir();
    const pkg_root = opts.package_root ?? _package_root();
    const settings_path =
        opts.settings_path ?? user_global_paths.write_target(SETTINGS_FILENAME);
    const confirm = opts.confirm ?? _tty_confirm;

    const matrix_path = path.join(pkg_root, 'src', 'config', 'surface-matrix.yml');
    if (!fs.existsSync(matrix_path)) {
        _print(err, `❌  ${matrix_path} not found — reinstall the package (agent-config upgrade)`);
        return 1;
    }
    let tools: Record<string, MatrixTool>;
    try {
        tools = _load_matrix(matrix_path);
    } catch (e) {
        _print(err, `❌  surface-matrix.yml unreadable: ${e instanceof Error ? e.message : String(e)}`);
        return 1;
    }

    const findings = detect_duplicates(tools, home, pkg_root);
    if (findings.length === 0) {
        _print(out, '✅  no duplicate install surfaces detected — nothing to converge.');
        return 0;
    }

    _print(out, `Duplicate install surface(s) detected on ${findings.length} tool(s):`);
    for (const f of findings) {
        _print(out, `  · ${f.tool}: ${f.description}`);
    }
    _print(out);

    if (args.dry_run) {
        _print(out, 'Dry run — the following actions WOULD run (nothing was touched):');
        for (const f of findings) {
            if (f.command) {
                _print(out, `  → ${f.command}`);
            }
            for (const reap of f.reaps) {
                _print(out, `  → rm -rf ${reap}  (package-tagged orphan, matrix-declared)`);
            }
        }
        return 0;
    }

    // Consent gate — standing key, --yes, or one interactive y/N.
    let consented = args.yes || read_consent(settings_path);
    if (!consented) {
        consented = confirm(
            `Converge now? This runs the per-tool uninstall command(s) above and ` +
                `reaps the matrix-declared caches. Persists install.auto_converge: true.`,
        );
        if (!consented) {
            _print(
                err,
                '❌  converge refused — no consent. Re-run interactively, pass --yes, or set\n' +
                    `    install.auto_converge: true in ${settings_path}`,
            );
            return 1;
        }
    }
    persist_consent(settings_path, out);

    // Perform the cleanup — matrix-declared actions ONLY.
    let failures = 0;
    const report: string[] = [];
    const executed_reaps: string[] = [];
    for (const f of findings) {
        if (f.command) {
            _print(out, `→ ${f.command}`);
            const rc = runner(f.command.split(' '));
            if (rc !== 0) {
                failures += 1;
                _print(err, `⚠️  ${f.tool}: uninstall command exited ${rc} — continuing with reaps.`);
            } else {
                report.push(`${f.tool}: ran \`${f.command}\``);
            }
        }
        for (const reap of f.reaps) {
            // Hard floor: reap paths come from the matrix allowlist only and
            // are always ~/-anchored (enforced at load; non-~/ entries were
            // filtered in detect_duplicates).
            const abs = _expand(reap, home, pkg_root);
            if (!_exists(abs)) {
                continue;
            }
            try {
                fs.rmSync(abs, { recursive: true, force: true });
                report.push(`${f.tool}: reaped package-tagged orphan \`${reap}\``);
                executed_reaps.push(reap);
                _print(out, `→ reaped ${reap}`);
            } catch (e) {
                failures += 1;
                _print(err, `⚠️  ${f.tool}: could not reap ${reap}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    }

    _print(out);
    _print(out, 'Convergence report:');
    for (const line of report) {
        _print(out, `  ✅ ${line}`);
    }
    if (report.length === 0) {
        _print(out, '  (no actions completed)');
    }
    const notice = live_session_notice(executed_reaps);
    if (notice !== null) {
        _print(out);
        _print(out, notice);
    }
    _print(
        out,
        'Rollback hint: a removed Claude Code plugin can be reinstalled with\n' +
            '  claude plugin marketplace add event4u-app/agent-config && ' +
            'claude plugin install agent-config@event4u-agent-config\n' +
            '(the file projection is untouched — content and hooks keep working).',
    );
    return failures > 0 ? 1 : 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
