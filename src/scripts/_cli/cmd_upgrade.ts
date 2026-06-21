#!/usr/bin/env tsx
/**
 * `agent-config upgrade` — fetch + install the latest global binary + refresh
 * (TypeScript twin).
 *
 * TypeScript twin of `src/scripts/_cli/cmd_upgrade.py` (ADR-200, py2ts
 * migration). The CLI contract mirrors the Python original EXACTLY — same
 * flags, same exit codes, same stdout/stderr split, byte-identical emitted
 * output, same filesystem effects, same subprocess argv/cwd/env. No behaviour
 * changes — latent quirks are replicated and flagged inline, not fixed.
 *
 * Distinct from `agent-config update` (which only flips the
 * `agent_config_version` pin in `.agent-settings.yml` — a project decision,
 * see `cmd_update`). `upgrade` is the **global** self-update path mandated by
 * ADR-020's "no per-repo bump" goal: it installs the latest published package
 * globally and re-runs the global install so new skills / rules / hooks reach
 * every consumer at once.
 *
 * Side effects, in order:
 *
 * 1. `npm install -g @event4u/agent-config@latest` — refresh the global binary
 *    on PATH (the binary the Claude plugin hook resolves).
 * 2. `agent-config global` (→ `install.py --global`) — refresh the global root
 *    (`~/.event4u/agent-config/`) + regenerate plugin hooks.
 * 3. If run from inside a consumer project that already has a `./agent-config`
 *    wrapper, re-stamp that wrapper from the canonical template.
 *
 * Flags:
 *
 * - `--check` — report installed vs latest; install nothing. Exit 0.
 * - `--dry-run` — print the exact commands that would run; execute none.
 * - (no flag) — perform the upgrade.
 *
 * Exit codes: `0` success / already-latest / check / dry-run · `1` a step
 * failed.
 *
 * --- Parity notes (ADR-200) ---
 *
 * - `main()` is **async** because the default fetcher
 *   (`update_check.fetch_latest_from_npm`) is async in the TS twin (Node has no
 *   synchronous HTTP). An injected `fetcher` may be sync or async; both are
 *   awaited. The Python `main` is sync; the observable contract
 *   (stdout/stderr + exit code + files written + subprocess argv) is identical.
 * - `process.exitCode` is set; `process.exit()` is never called. argparse
 *   usage errors throw `ArgparseExit(2)`; `-h`/`--help` throws
 *   `ArgparseExit(0)`. Python's `raise SystemExit(main())` propagates the int.
 *   The `--help` BODY is a documented divergence.
 * - `subprocess.run(cmd, check=False).returncode` → `spawnSync` with identical
 *   argv (no shell), inherited stdio, `check=False`. An `OSError`-equivalent
 *   spawn error (npm / bash missing) writes the same `cannot run <cmd[0]>:
 *   <err>` line to stderr and returns 1, mirroring the Python `except OSError`.
 *   The runner is injectable for tests.
 * - `_lib.installed_lock` / `_lib.update_check` / `_lib.cli_wrapper` and the
 *   sibling `cmd_refresh._is_source_repo` resolve to the `.ts` twins.
 * - `shutil.which("agent-config")` → `shutilWhich`; the package-local wrapper
 *   fallback (`parents[3] / "agent-config"`) is `path.join(PACKAGE_ROOT,
 *   'agent-config')`.
 * - `lock.get("agent_config_version")` → `LockfileData.agent_config_version`
 *   (the lockfile twin parses it to a string). `.strip().lstrip("v")` →
 *   `.trim()` + leading-`v` strip.
 * - `update_check._is_newer` is the shared twin; `installed_lock_is_newer` is a
 *   thin wrapper kept for the single import site (parity with the Python).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as installed_lock from '../_lib/installed_lock.js';
import * as update_check from '../_lib/update_check.js';
import * as cli_wrapper from '../_lib/cli_wrapper.js';
import { _is_source_repo } from './cmd_refresh.js';

const PACKAGE_NAME = '@event4u/agent-config';
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// ---------------------------------------------------------------------------
// Parity primitives (ADR-200).
// ---------------------------------------------------------------------------

const _HERE = fileURLToPath(import.meta.url);

/** argparse usage-error / help exit (code 2 / 0). Caught at the CLI entry. */
class ArgparseExit extends Error {
    constructor(public readonly code: number) {
        super(`argparse-exit-${code}`);
    }
}

interface OutSink {
    write(text: string): void;
}
const _stdout: OutSink = { write: (t) => process.stdout.write(t) };
const _stderr: OutSink = { write: (t) => process.stderr.write(t) };

/** `print(line, file=out)` — append a trailing newline like Python's print. */
function _print(out: OutSink, line = ''): void {
    out.write(line + '\n');
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** `shutil.which(name)` — first PATH hit (with PATHEXT on win32). */
function shutilWhich(name: string): string | null {
    const isExe = (p: string): boolean => {
        try {
            const st = fs.statSync(p);
            if (!st.isFile()) return false;
            if (process.platform === 'win32') return true;
            fs.accessSync(p, fs.constants.X_OK);
            return true;
        } catch {
            return false;
        }
    };
    if (name.includes('/') || name.includes('\\')) {
        return isExe(name) ? name : null;
    }
    const pathEnv = process.env['PATH'] || '';
    const sep = process.platform === 'win32' ? ';' : ':';
    const exts =
        process.platform === 'win32'
            ? (process.env['PATHEXT'] || '.COM;.EXE;.BAT;.CMD').split(';')
            : [''];
    const seen = new Set<string>();
    for (const dir of pathEnv.split(sep)) {
        const d = dir === '' ? '.' : dir;
        if (seen.has(d)) continue;
        seen.add(d);
        for (const ext of exts) {
            const candidate = path.join(d, name + ext);
            if (isExe(candidate)) {
                return candidate;
            }
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// Module body (cmd_upgrade.py).
// ---------------------------------------------------------------------------

type Runner = (cmd: string[]) => number;

function _default_runner(cmd: string[]): number {
    const r = spawnSync(cmd[0] as string, cmd.slice(1), { stdio: 'inherit' });
    if (r.error) {
        // npm / bash missing (OSError-equivalent).
        _stderr.write(`agent-config upgrade: cannot run ${cmd[0]}: ${osErrorStr(r.error)}\n`);
        return 1;
    }
    return r.status ?? 1;
}

/** Render an OSError-equivalent like Python's `str(exc)` for the message. */
function osErrorStr(exc: unknown): string {
    if (exc && typeof exc === 'object' && 'message' in exc) {
        return String((exc as { message: unknown }).message);
    }
    return String(exc);
}

/** Python `str.lstrip("v")` — strip leading 'v' characters. */
function lstripV(s: string): string {
    let out = s;
    while (out.length > 0 && out[0] === 'v') {
        out = out.slice(1);
    }
    return out;
}

function _installed_version(): string {
    const lock = installed_lock.read_lockfile();
    if (lock !== null && typeof lock === 'object') {
        const v = (lock as unknown as Record<string, unknown>)['agent_config_version'];
        if (typeof v === 'string' && v) {
            return lstripV(v.trim());
        }
    }
    return '';
}

/**
 * The global wrapper the second step invokes. Prefer the binary on PATH; fall
 * back to the package-local wrapper so a maintainer dev-loop (no global install
 * yet) still refreshes.
 */
function _agent_config_bin(): string {
    return shutilWhich('agent-config') ?? path.join(PACKAGE_ROOT, 'agent-config');
}

/**
 * Re-stamp the project-local `./agent-config` wrapper after a global upgrade —
 * but only when the upgrade was run from inside a consumer project that
 * *already* has a wrapper. Never creates one, never touches the source repo.
 */
function _maybe_refresh_project_wrapper(project_root: string, out: OutSink, _err: OutSink): void {
    if (_is_source_repo(project_root)) {
        return;
    }
    if (!_isFile(path.join(project_root, 'agent-config'))) {
        return; // not a consumer project root (or never installed) — leave it
    }
    if (!cli_wrapper.needs_refresh(project_root)) {
        return;
    }
    const wrapper = cli_wrapper.install_cli_wrapper(project_root);
    if (wrapper !== null) {
        _print(out, `✅  refreshed stale project wrapper: ${wrapper}`);
    }
}

interface Args {
    check: boolean;
    dry_run: boolean;
}

const PROG = 'agent-config upgrade';
const USAGE = `usage: ${PROG} [-h] [--check] [--dry-run]\n`;

function _argError(msg: string): never {
    _stderr.write(USAGE);
    _stderr.write(`${PROG}: error: ${msg}\n`);
    throw new ArgparseExit(2);
}

function _parse(argv: string[]): Args {
    const args: Args = { check: false, dry_run: false };
    const positionals: string[] = [];
    let i = 0;
    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            _stdout.write(USAGE);
            throw new ArgparseExit(0);
        }
        const eq = a.startsWith('--') ? a.indexOf('=') : -1;
        const flag = eq >= 0 ? a.slice(0, eq) : a;
        const inlineVal = eq >= 0 ? a.slice(eq + 1) : null;
        if (flag === '--check') {
            if (inlineVal !== null) {
                _argError(`argument --check: ignored explicit argument '${inlineVal}'`);
            }
            args.check = true;
            i += 1;
            continue;
        }
        if (flag === '--dry-run') {
            if (inlineVal !== null) {
                _argError(`argument --dry-run: ignored explicit argument '${inlineVal}'`);
            }
            args.dry_run = true;
            i += 1;
            continue;
        }
        if (a.startsWith('-') && a !== '-') {
            _argError(`unrecognized arguments: ${a}`);
        }
        positionals.push(a);
        i += 1;
    }
    if (positionals.length > 0) {
        _argError(`unrecognized arguments: ${positionals.join(' ')}`);
    }
    return args;
}

interface MainOptions {
    runner?: Runner;
    fetcher?: () => string | null | Promise<string | null>;
    installed?: string | null;
    project_root?: string | null;
    out?: OutSink;
    err?: OutSink;
}

export async function main(argv: string[] | null = null, options: MainOptions = {}): Promise<number> {
    const runner = options.runner ?? _default_runner;
    const fetcher = options.fetcher ?? (() => update_check.fetch_latest_from_npm());
    const out = options.out ?? _stdout;
    const err = options.err ?? _stderr;
    const args = _parse(argv ?? process.argv.slice(2));

    const installed =
        options.installed !== undefined && options.installed !== null
            ? options.installed
            : _installed_version();
    const latest = (await fetcher()) || '';

    if (args.check) {
        if (!latest) {
            _print(
                err,
                'agent-config upgrade: latest version unavailable ' +
                    '(registry unreachable).',
            );
            return 0;
        }
        if (installed && !installed_lock_is_newer(latest, installed)) {
            _print(out, `✅  agent-config is up to date (${installed}).`);
        } else {
            _print(
                out,
                `ℹ️  agent-config ${latest} available ` +
                    `(installed: ${installed || 'unknown'}). Run ` +
                    '`agent-config upgrade`.',
            );
        }
        return 0;
    }

    const target = `${PACKAGE_NAME}@latest`;
    const steps: string[][] = [
        ['npm', 'install', '-g', target],
        [_agent_config_bin(), 'global'],
    ];

    if (args.dry_run) {
        _print(out, 'agent-config upgrade — dry run, would execute:');
        for (const cmd of steps) {
            _print(out, '  ' + cmd.join(' '));
        }
        return 0;
    }

    for (const cmd of steps) {
        _print(out, '→ ' + cmd.join(' '));
        const rc = runner(cmd);
        if (rc !== 0) {
            _print(
                err,
                `❌  agent-config upgrade: step failed (exit ${rc}): ` + `${cmd.join(' ')}`,
            );
            return 1;
        }
    }

    _maybe_refresh_project_wrapper(options.project_root ?? process.cwd(), out, err);

    _print(
        out,
        '✅  agent-config upgraded. Run `agent-config doctor` to verify ' +
            'PATH + plugin parity.',
    );
    return 0;
}

/** Thin wrapper around update_check._is_newer for one import site. */
function installed_lock_is_newer(latest: string, installed: string): boolean {
    return update_check._is_newer(latest, installed);
}

// --- CLI entry ---

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    main(process.argv.slice(2))
        .then((code) => {
            process.exitCode = code;
        })
        .catch((exc) => {
            if (exc instanceof ArgparseExit) {
                process.exitCode = exc.code;
            } else {
                throw exc;
            }
        });
}

export {
    _parse,
    _default_runner,
    _installed_version,
    _agent_config_bin,
    _maybe_refresh_project_wrapper,
    installed_lock_is_newer,
    ArgparseExit,
};
export type { Args, Runner };
