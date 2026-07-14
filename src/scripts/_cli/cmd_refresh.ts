#!/usr/bin/env tsx
/**
 * `agent-config refresh` — idempotent re-install, no version change
 * (TypeScript twin).
 *
 * Ported from the retired Python `src/scripts/_cli/cmd_refresh.py` (ADR-200, py2ts
 * migration). The CLI contract pins the historical contract exactly — same
 * flags, same exit codes, same stdout/stderr split, byte-identical emitted
 * output, same filesystem effects, same subprocess argv/cwd/env. No behaviour
 * changes — latent quirks are replicated and flagged inline, not fixed.
 *
 * The same-version counterpart to `agent-config upgrade` (which fetches the
 * latest). Two scopes, exactly one required:
 *
 * - `--global` — re-run the global install (`scripts/install --global`) so the
 *   global root + Claude plugin hooks are rewritten from the
 *   currently-installed package. Idempotent: a second run is a no-op diff.
 * - `--project` — refresh the **minimal** project surface ADR-020 permits for
 *   a consumer: an `agents/overrides/` scaffold and the managed `agents/`
 *   block in `.gitignore`, plus cleanup of any legacy
 *   `agents/.event4u-bridge.yml` (the marker was retired — ADR-020 amendment
 *   2026-07-13; the global root is resolved from `~/.event4u/agent-config`).
 *   Writes **no** distributed content. No wizard.
 *
 * Bare `agent-config refresh` (no scope flag) errors — never a silent global
 * default (council 2026-05-30).
 *
 * Exit codes: `0` success · `1` a step failed / bad invocation.
 *
 * --- Parity notes (ADR-200) ---
 *
 * - `main()` returns an exit code; the CLI entry guard sets `process.exitCode`
 *   (never `process.exit()`). The Python uses `raise SystemExit(main())`.
 * - argparse has NO usage errors reachable here beyond `-h`/`--help` and
 *   unknown flags: both store_true; `-h`/`--help` prints usage to stdout +
 *   throws `ArgparseExit(0)`, unknown flags print usage + `error:` to stderr +
 *   throw `ArgparseExit(2)`. The `--help` BODY is a documented divergence.
 * - `subprocess.run(cmd, check=False).returncode` → `spawnSync` with identical
 *   argv (no shell), inherited stdio, `check=False` (never throws). An
 *   `OSError`-equivalent spawn error (binary missing) writes the same
 *   `cannot run <cmd[0]>: <err>` line to stderr and returns 1, mirroring the
 *   Python `except OSError`. The runner is injectable for tests.
 * - `_lib.*` / `scripts.install` / `scripts.sync_gitignore` imports resolve to
 *   the `.ts` twins. `scripts.install._remove_legacy_consumer_bridge_marker`
 *   is module-private in the install twin (not exported); it is replicated
 *   here — a small `isFile` + `fs.rmSync` guard gated on dev-mode / source
 *   repo, matching the install-twin source.
 * - `Path(__file__).resolve().parents[3]` → `path.resolve(_HERE_DIR, '..',
 *   '..', '..')`. `.is_file()` / `.is_dir()` / `.exists()` →
 *   `_isFile` / `_isDir` / `_exists`. The `packages/` source-marker glob probe
 *   becomes a `readdirSync` scan of `packages/` (the source-marker dir name is
 *   the `SRC_MARKER_DIR` constant, shared with the marker-cleanup guard).
 * - `print(..., file=out/err)` → an injectable `OutSink` defaulting to
 *   `process.stdout` / `process.stderr`. The Python `out`/`err` kwargs default
 *   to `sys.stdout` / `sys.stderr`.
 * - `sync_gitignore.main([...])` returns an `int | None`; the `rc not in
 *   (0, None)` guard is preserved. The advisory `ImportError` arm (helper
 *   absent) is unreachable with a static import, so it is documented but kept
 *   structurally as a try/catch around the call for parity with the
 *   `except ImportError` branch wording.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as cli_wrapper from '../_lib/cli_wrapper.js';
import * as sync_gitignore from '../sync_gitignore.js';

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

/** A captured-output sink mirroring a Python text stream. */
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

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _readText(p: string): string {
    return fs.readFileSync(p, { encoding: 'utf-8' });
}

function _writeText(p: string, text: string): void {
    fs.writeFileSync(p, text, { encoding: 'utf-8' });
}

// ---------------------------------------------------------------------------
// Replicated install-twin module-private: consumer bridge marker writer.
// Byte-for-byte from `scripts/install.ts` (see header parity note).
// ---------------------------------------------------------------------------

const CONSUMER_BRIDGE_MARKER_RELPATH = path.join('agents', '.event4u-bridge.yml');

/**
 * Source-repo sentinel directory name — present at the root of the
 * agent-config package source tree. Shared by the bridge-marker writer guard
 * and the `_is_source_repo` monorepo probe so the literal lives in one place
 * (the only other textual mention is the `_is_source_repo` docstring, matching
 * the retired Python implementation's two occurrences for the ADR-051 path-count parity).
 */
const SRC_MARKER_DIR = '.agent-src.uncondensed';


/**
 * Mirrors `install._remove_legacy_consumer_bridge_marker` (module-private).
 * The consumer bridge marker was retired (ADR-020 amendment 2026-07-13); the
 * global root is resolved from the well-known `~/.event4u/agent-config` path.
 * `refresh --project` deletes any legacy `agents/.event4u-bridge.yml` a prior
 * install committed. Returns the removed path, or `null` when nothing to do
 * (no marker / dev mode / source repo).
 */
function _remove_legacy_consumer_bridge_marker(
    project_root: string,
    env: NodeJS.ProcessEnv | null = null,
): string | null {
    const env_map = env ?? process.env;
    if (env_map['AGENT_CONFIG_DEV_MODE'] === '1') return null;
    if (_isDir(path.join(project_root, SRC_MARKER_DIR))) return null;

    const target = path.join(project_root, CONSUMER_BRIDGE_MARKER_RELPATH);
    if (!_isFile(target)) return null;
    try {
        fs.rmSync(target);
    } catch {
        return null;
    }
    return target;
}

// ---------------------------------------------------------------------------
// Module body (cmd_refresh.py).
// ---------------------------------------------------------------------------

type Runner = (cmd: string[]) => number;

function _default_runner(cmd: string[]): number {
    const r = spawnSync(cmd[0] as string, cmd.slice(1), { stdio: 'inherit' });
    if (r.error) {
        // OSError-equivalent (binary missing / spawn failure).
        _stderr.write(`agent-config refresh: cannot run ${cmd[0]}: ${osErrorStr(r.error)}\n`);
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

function _refresh_global(runner: Runner, out: OutSink, err: OutSink): number {
    const install_sh = path.join(PACKAGE_ROOT, 'src', 'scripts', 'install');
    if (!_isFile(install_sh)) {
        _print(err, `❌  agent-config refresh: installer not found at ${install_sh}`);
        return 1;
    }
    _print(out, '→ refreshing global install (scripts/install --global)');
    const rc = runner(['bash', install_sh, '--global']);
    if (rc !== 0) {
        _print(err, `❌  agent-config refresh --global: install failed (exit ${rc})`);
        return 1;
    }
    _print(out, '✅  global install refreshed.');
    return 0;
}

/**
 * True when `project_root` is the agent-config package itself.
 *
 * `_remove_legacy_consumer_bridge_marker` only guards on a root-level
 * `.agent-src.uncondensed/`, which the monorepo keeps under `packages/<pkg>/`
 * instead — so the narrow guard misses here and would touch the maintainer
 * tree. This broader check (condensed output, packaged
 * source, or the package's own `package.json` name) makes `refresh --project`
 * a no-op in any agent-config checkout. Consumers use dev-mode, not refresh.
 */
function _is_source_repo(project_root: string): boolean {
    if (_isDir(path.join(project_root, 'dist/agent-src'))) {
        return true;
    }
    if (_glob_packages_uncondensed(project_root).length > 0) {
        return true;
    }
    const pkg = path.join(project_root, 'package.json');
    if (_isFile(pkg)) {
        try {
            const data = JSON.parse(_readText(pkg)) as Record<string, unknown>;
            if (data['name'] === '@event4u/agent-config') {
                return true;
            }
        } catch {
            // OSError / ValueError → pass.
        }
    }
    return false;
}

/** `(project_root / "packages").glob` over the SRC_MARKER_DIR source marker. */
function _glob_packages_uncondensed(project_root: string): string[] {
    const packages = path.join(project_root, 'packages');
    let entries: string[];
    try {
        entries = fs.readdirSync(packages);
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const name of entries) {
        const candidate = path.join(packages, name, SRC_MARKER_DIR);
        if (_exists(candidate)) {
            out.push(candidate);
        }
    }
    return out;
}

function _refresh_project(project_root: string, out: OutSink, err: OutSink): number {
    if (_is_source_repo(project_root)) {
        _print(
            out,
            'ℹ️  refresh --project skipped: this is the agent-config package ' +
                'itself (or a checkout of it). Maintainers use ' +
                'AGENT_CONFIG_DEV_MODE=1, not a consumer refresh.',
        );
        return 0;
    }

    // Bridge marker retired (ADR-020 amendment 2026-07-13). The global root is
    // resolved from the well-known `~/.event4u/agent-config` path, so there is
    // no per-project marker to scaffold — clean up any legacy one instead.
    const removed = _remove_legacy_consumer_bridge_marker(project_root);
    if (removed !== null) {
        _print(out, `✅  removed legacy bridge marker: ${removed}`);
    }

    const overrides = path.join(project_root, 'agents', 'overrides');
    fs.mkdirSync(overrides, { recursive: true });
    const keep = path.join(overrides, 'README.md');
    if (!_exists(keep)) {
        _writeText(
            keep,
            '# Project overrides\n\n' +
                'Project-local overrides/extensions of shared skills, rules, and ' +
                'commands. The only project-side agent surface ADR-020 permits. ' +
                'See the `override-management` skill.\n',
        );
    }
    _print(out, `✅  overrides scaffold: ${overrides}`);

    // Re-stamp the `./agent-config` wrapper from the canonical template so an
    // older, fallback-less wrapper cannot linger and break the hooks.
    const wrapper = cli_wrapper.install_cli_wrapper(project_root);
    if (wrapper !== null) {
        _print(out, `✅  ./agent-config wrapper refreshed: ${wrapper}`);
    }

    const rc = _sync_gitignore(project_root, out, err);
    if (rc !== 0) {
        return rc;
    }
    _print(out, '✅  refresh --project complete.');
    return 0;
}

function _sync_gitignore(project_root: string, out: OutSink, err: OutSink): number {
    // The `except ImportError` arm (helper absent) is unreachable with a static
    // import; the try/catch preserves the structural shape + wording for parity.
    let mod: typeof sync_gitignore;
    try {
        mod = sync_gitignore;
    } catch (exc) {
        _print(err, `⚠️  refresh --project: gitignore sync unavailable (${osErrorStr(exc)})`);
        return 0; // advisory — do not fail the refresh on a missing helper
    }
    const rc = mod.main(['--path', path.join(project_root, '.gitignore')]);
    if (rc !== 0 && rc !== null && rc !== undefined) {
        _print(err, `⚠️  refresh --project: gitignore sync returned ${rc}`);
    } else {
        _print(out, '✅  .gitignore agents/ block synced.');
    }
    return 0;
}

interface Args {
    is_global: boolean;
    is_project: boolean;
}

const PROG = 'agent-config refresh';
const USAGE = `usage: ${PROG} [-h] [--global] [--project]\n`;

function _argError(msg: string): never {
    _stderr.write(USAGE);
    _stderr.write(`${PROG}: error: ${msg}\n`);
    throw new ArgparseExit(2);
}

function _parse(argv: string[]): Args {
    const args: Args = { is_global: false, is_project: false };
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
        if (flag === '--global') {
            if (inlineVal !== null) {
                _argError(`argument --global: ignored explicit argument '${inlineVal}'`);
            }
            args.is_global = true;
            i += 1;
            continue;
        }
        if (flag === '--project') {
            if (inlineVal !== null) {
                _argError(`argument --project: ignored explicit argument '${inlineVal}'`);
            }
            args.is_project = true;
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
    project_root?: string | null;
    out?: OutSink;
    err?: OutSink;
}

export function main(argv: string[] | null = null, options: MainOptions = {}): number {
    const runner = options.runner ?? _default_runner;
    const out = options.out ?? _stdout;
    const err = options.err ?? _stderr;
    const args = _parse(argv ?? process.argv.slice(2));

    if (!args.is_global && !args.is_project) {
        _print(
            err,
            '❌  agent-config refresh: specify a scope — --global ' +
                'and/or --project (never a silent default).',
        );
        return 1;
    }

    const root = options.project_root ?? process.cwd();
    let rc = 0;
    if (args.is_global) {
        rc = _refresh_global(runner, out, err) || rc;
    }
    if (args.is_project && rc === 0) {
        rc = _refresh_project(root, out, err) || rc;
    }
    return rc;
}

// --- CLI entry ---

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    try {
        process.exitCode = main(process.argv.slice(2));
    } catch (e) {
        if (e instanceof ArgparseExit) {
            process.exitCode = e.code;
        } else {
            throw e;
        }
    }
}

export {
    _parse,
    _default_runner,
    _refresh_global,
    _is_source_repo,
    _refresh_project,
    _sync_gitignore,
    _remove_legacy_consumer_bridge_marker,
    ArgparseExit,
};
export type { Args, Runner };
