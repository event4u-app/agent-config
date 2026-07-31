#!/usr/bin/env tsx
/**
 * `agent-config upgrade` — fetch + install the latest global binary + refresh
 * (TypeScript twin).
 *
 * Ported from the retired Python `src/scripts/_cli/cmd_upgrade.py` (ADR-200, py2ts
 * migration). The CLI contract pins the historical contract exactly — same
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
 * 2. `agent-config global --no-ui` (→ `install --global`) — refresh the global
 *    root (`~/.event4u/agent-config/`) + regenerate plugin hooks. `--no-ui`
 *    suppresses the setup-wizard auto-launch: the wizard is an onboarding
 *    surface, not an upgrade step, and a foreground wizard server would block
 *    the remaining upgrade steps until Ctrl-C (which then failed the run).
 * 2b. When the Claude Code plugin (`agent-config@event4u-agent-config`) is
 *    installed, refresh it: `claude plugin marketplace update` +
 *    `claude plugin update` — otherwise the plugin snapshot stays pinned to
 *    its install-time git SHA and its command surface silently rots while
 *    the file projection moves ahead. Non-fatal: a refresh failure warns and
 *    names the manual commands. The plugin is OPTIONAL — the file projection
 *    is a full install on its own; no plugin → no step, no nag.
 * 3. `agent-config settings:sync --path <file>` for every EXISTING settings
 *    file (global `~/.event4u/agent-config/settings/.agent-settings.yml`,
 *    then the project settings when run inside a consumer project) — additive
 *    merge that inserts keys the new release added to the template while
 *    preserving user lines verbatim. Runs as a subprocess of the freshly
 *    installed binary so the NEW template is the merge source. Non-fatal:
 *    a sync failure warns and names the manual command, never fails the
 *    upgrade. Never creates a settings file that did not exist.
 * 4. If run from inside a consumer project that already has a `./agent-config`
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
import * as claude_plugin from '../_lib/claude_plugin.js';
import { event4u_root, write_target } from '../_lib/user_global_paths.js';
import { project_settings_path } from '../_lib/agent_settings.js';
import { _is_source_repo } from './cmd_refresh.js';
import { resolvePackageRoot } from '../_lib/package_root.js';

const PACKAGE_NAME = '@event4u/agent-config';
const PACKAGE_ROOT = resolvePackageRoot(import.meta.url);

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

/**
 * Refresh the consumer's installed `.git/hooks/pre-commit` gate after a
 * global upgrade — but only when the hook is OURS (identified by the
 * `pre-commit-roadmap-progress` marker) and only when run from inside a
 * project that has it. Without this, a hook installed under an older
 * release keeps running the old template forever (`hooks:install` without
 * `--force` short-circuits on the marker) — the py2ts-era hooks silently
 * no-op'd for exactly this reason. Non-fatal: a failure warns and names
 * the manual command.
 */
function _maybe_refresh_git_hook(
    project_root: string,
    runner: (cmd: string[]) => number,
    out: OutSink,
    err: OutSink,
): void {
    const hook = path.join(project_root, '.git', 'hooks', 'pre-commit');
    let text: string;
    try {
        text = fs.readFileSync(hook, 'utf-8');
    } catch {
        return; // no hook installed (or worktree indirection) — nothing to refresh
    }
    if (!text.includes('pre-commit-roadmap-progress')) {
        return; // not our hook — never overwrite a foreign pre-commit
    }
    const cmd = [_agent_config_bin(), 'hooks:install', '--force'];
    _print(out, '→ ' + cmd.join(' '));
    let rc: number;
    try {
        rc = runner(cmd);
    } catch (exc) {
        rc = 127;
        _print(err, `cannot run ${cmd[0]}: ${osErrorStr(exc)}`);
    }
    if (rc !== 0) {
        _print(
            err,
            `⚠️  agent-config upgrade: pre-commit hook refresh failed (exit ${rc}) — ` +
                'run `agent-config hooks:install --force` manually.',
        );
    }
}

/**
 * Existing settings files the post-upgrade sync should bring up to the new
 * template (additive merge — user lines preserved verbatim, only missing
 * template keys inserted; see `sync_agent_settings.ts`).
 *
 * Targets, in order:
 *  1. Global settings — `~/.event4u/agent-config/settings/.agent-settings.yml`
 *     (the canonical wizard-written file; `EVENT4U_CONFIG_HOME` honored).
 *  2. Project settings — the project's read-path settings file when the
 *     upgrade runs inside a consumer project that already has one.
 *
 * Only files that ALREADY EXIST are returned — the sync never creates a
 * settings file as an upgrade side effect (fresh installs get theirs from
 * the wizard / installer).
 */
function _settings_sync_targets(project_root: string): string[] {
    const targets: string[] = [];
    const global_settings = path.join(event4u_root(), 'settings', '.agent-settings.yml');
    if (_isFile(global_settings)) {
        targets.push(global_settings);
    }
    const project_settings = project_settings_path(project_root);
    if (project_settings !== global_settings && _isFile(project_settings)) {
        targets.push(project_settings);
    }
    return targets;
}

/**
 * Run the additive settings sync for every existing target — as a SUBPROCESS
 * of the freshly installed binary, never in-process: after `npm install -g`
 * the running module is still the OLD version, so an in-process merge would
 * use the OLD template and miss exactly the new keys the upgrade shipped.
 *
 * Non-fatal by design: the upgrade itself already succeeded; a sync failure
 * surfaces a warning + the manual command instead of failing the run.
 */
function _sync_settings_files(
    targets: readonly string[],
    runner: (cmd: string[]) => number,
    out: OutSink,
    err: OutSink,
): void {
    for (const target of targets) {
        const cmd = [_agent_config_bin(), 'settings:sync', '--path', target];
        _print(out, '→ ' + cmd.join(' '));
        let rc: number;
        try {
            rc = runner(cmd);
        } catch (exc) {
            rc = 127;
            _print(err, `cannot run ${cmd[0]}: ${osErrorStr(exc)}`);
        }
        if (rc !== 0) {
            _print(
                err,
                `⚠️  agent-config upgrade: settings sync failed (exit ${rc}) for ` +
                    `${target} — run \`agent-config settings:sync --path ${target}\` manually.`,
            );
        }
    }
}

/**
 * Refresh steps for the OPTIONAL Claude Code plugin. Non-empty only when the
 * `claude` CLI is on PATH AND the plugin is recorded as installed — the file
 * projection is a complete install on its own, so a missing plugin is not a
 * gap to nag about. When present, the plugin must be refreshed alongside the
 * global install: Claude Code pins it to the install-time git SHA, so without
 * this step its command surface silently lags every upgrade.
 */
function _claude_plugin_refresh_steps(): string[][] {
    const claude = shutilWhich('claude');
    if (claude === null) return [];
    if (!claude_plugin.claude_plugin_installed()) return [];
    return [
        [claude, 'plugin', 'marketplace', 'update', claude_plugin.CLAUDE_MARKETPLACE_NAME],
        [
            claude,
            'plugin',
            'update',
            `${claude_plugin.CLAUDE_PLUGIN_ID}@${claude_plugin.CLAUDE_MARKETPLACE_NAME}`,
        ],
    ];
}

/**
 * Run the plugin-refresh steps. Non-fatal by design (same contract as the
 * settings sync): the upgrade itself already succeeded; a failure surfaces a
 * warning + the manual command instead of failing the run.
 */
function _refresh_claude_plugin(
    steps: readonly string[][],
    runner: (cmd: string[]) => number,
    out: OutSink,
    err: OutSink,
): void {
    for (const cmd of steps) {
        _print(out, '→ ' + cmd.join(' '));
        let rc: number;
        try {
            rc = runner(cmd);
        } catch (exc) {
            rc = 127;
            _print(err, `cannot run ${cmd[0]}: ${osErrorStr(exc)}`);
        }
        if (rc !== 0) {
            _print(
                err,
                `⚠️  agent-config upgrade: Claude Code plugin refresh failed (exit ${rc}) — ` +
                    `run \`${cmd.join(' ')}\` manually.`,
            );
            return;
        }
    }
    if (steps.length > 0) {
        _print(out, 'ℹ️  Claude Code plugin refreshed — restart Claude Code to load it.');
    }
}

interface Args {
    check: boolean;
    dry_run: boolean;
    converge: boolean;
}

const PROG = 'agent-config upgrade';
const USAGE = `usage: ${PROG} [-h] [--check] [--dry-run] [--converge]\n`;

function _argError(msg: string): never {
    _stderr.write(USAGE);
    _stderr.write(`${PROG}: error: ${msg}\n`);
    throw new ArgparseExit(2);
}

function _parse(argv: string[]): Args {
    const args: Args = { check: false, dry_run: false, converge: false };
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
        if (flag === '--converge') {
            if (inlineVal !== null) {
                _argError(`argument --converge: ignored explicit argument '${inlineVal}'`);
            }
            args.converge = true;
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
    const npm_cmd: string[] = ['npm', 'install', '-g', target];
    // --no-ui: the setup wizard is an onboarding surface, not an upgrade
    // step — its foreground server used to block the upgrade until Ctrl-C.
    const global_cmd: string[] = [_agent_config_bin(), 'global', '--no-ui'];
    const steps: string[][] = [npm_cmd, global_cmd];

    const project_root = options.project_root ?? process.cwd();
    const sync_targets = _settings_sync_targets(project_root);
    const plugin_steps = _claude_plugin_refresh_steps();

    if (args.dry_run) {
        _print(out, 'agent-config upgrade — dry run, would execute:');
        for (const cmd of steps) {
            _print(out, '  ' + cmd.join(' '));
        }
        for (const cmd of plugin_steps) {
            _print(out, '  ' + cmd.join(' '));
        }
        for (const target of sync_targets) {
            _print(out, '  ' + [_agent_config_bin(), 'settings:sync', '--path', target].join(' '));
        }
        return 0;
    }

    // Step 1 — the new package version. Nothing after makes sense without
    // it, so this is the only hard-abort step.
    _print(out, '→ ' + npm_cmd.join(' '));
    const npm_rc = runner(npm_cmd);
    if (npm_rc !== 0) {
        _print(
            err,
            `❌  agent-config upgrade: step failed (exit ${npm_rc}): ` + `${npm_cmd.join(' ')}`,
        );
        return 1;
    }

    // Steps 2..N — independent. A failing step no longer skips the rest:
    // the 8.2.0 failure class (aborted `global` step silently skipping the
    // plugin refresh + settings sync) is closed by running every remaining
    // step and reporting per-step outcomes in the summary. A failed
    // essential step (global deploy) still exits 1 — after the others ran.
    const failed_essential: string[] = [];
    for (const cmd of steps.slice(1)) {
        _print(out, '→ ' + cmd.join(' '));
        const rc = runner(cmd);
        if (rc !== 0) {
            failed_essential.push(cmd.join(' '));
            _print(
                err,
                `❌  agent-config upgrade: step failed (exit ${rc}): ${cmd.join(' ')} — ` +
                    'continuing with the remaining steps.',
            );
        }
    }

    // Refresh the OPTIONAL Claude Code plugin so its command surface tracks
    // the upgrade — gated on the plugin actually being installed (empty step
    // list otherwise). Deprecation window of the single-surface model: once
    // the plugin is retired this block disappears with it.
    _refresh_claude_plugin(plugin_steps, runner, out, err);

    // Duplicate-surface convergence (road-to-install-path-convergence
    // Phase 3). Consent model (council Q2, 2026-07-07):
    //   --converge          → explicit consent for this run; persists
    //                         install.auto_converge: true as standing consent.
    //   standing key true   → auto-converge (the user opted in earlier).
    //   no key + TTY        → converge asks ONE y/N when duplicates exist.
    //   no key + non-TTY    → today's print-only prompt; NEVER a silent
    //                         mutation of a user-owned surface.
    {
        const converge_mod = await import('./cmd_converge.js');
        const consent = converge_mod.read_consent(write_target('agent-settings.yml'));
        const tty = Boolean(process.stdin.isTTY && process.stdout.isTTY);
        if (args.converge || consent || tty) {
            const rc = converge_mod.main(args.converge ? ['--yes'] : [], { out, err });
            if (rc !== 0 && (args.converge || consent)) {
                failed_essential.push('agent-config converge');
            }
        } else if (plugin_steps.length > 0) {
            _print(
                out,
                'ℹ️  Claude Code marketplace plugin detected — deprecated surface. Hooks now ' +
                    'live in ~/.claude/settings.json (wired by the global step above), so the ' +
                    'plugin only duplicates skills/commands. Remove it with:\n' +
                    '    claude plugin uninstall ' +
                    `${claude_plugin.CLAUDE_PLUGIN_ID}@${claude_plugin.CLAUDE_MARKETPLACE_NAME}\n` +
                    '    (or: agent-config converge)',
            );
        }
    }

    // Bring existing settings files up to the NEW template (additive; the
    // subprocess resolves the freshly installed binary + template).
    _sync_settings_files(sync_targets, runner, out, err);

    _maybe_refresh_project_wrapper(project_root, out, err);

    // Re-stamp OUR installed .git/hooks/pre-commit from the new template
    // (marker-guarded; foreign hooks are never touched).
    _maybe_refresh_git_hook(project_root, runner, out, err);

    // Doctor runs LAST, every time, non-fatal: its duplicate-surface and
    // hook-wiring findings ARE the upgrade summary's health section — a
    // mixed state (stale plugin, missing hooks) is named in the same run
    // instead of waiting for the user to think of running doctor.
    const doctor_cmd = [_agent_config_bin(), 'doctor'];
    _print(out, '→ ' + doctor_cmd.join(' '));
    const doctor_rc = runner(doctor_cmd);
    if (doctor_rc !== 0) {
        _print(
            err,
            `⚠️  agent-config doctor reported findings (exit ${doctor_rc}) — ` +
                'see the check output above for per-item fixes.',
        );
    }

    if (failed_essential.length > 0) {
        _print(
            err,
            `❌  agent-config upgrade finished with ${failed_essential.length} failed ` +
                `step(s):\n` +
                failed_essential.map((c) => `    · ${c}`).join('\n') +
                '\n   Re-run `agent-config upgrade`, or run the failed step directly. ' +
                '`agent-config doctor` names anything left in a mixed state.',
        );
        return 1;
    }

    _print(
        out,
        '✅  agent-config upgraded' +
            (doctor_rc === 0 ? ' — doctor green.' : ' — review the doctor findings above.') +
            ' Tune settings any time with `agent-config config`.',
    );
    return 0;
}

/** Thin wrapper around update_check._is_newer for one import site. */
function installed_lock_is_newer(latest: string, installed: string): boolean {
    return update_check._is_newer(latest, installed);
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
