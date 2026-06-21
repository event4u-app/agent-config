#!/usr/bin/env tsx
/**
 * `agent-config validate` — drift detection for the installed-tools manifest
 * (TypeScript twin).
 *
 * TypeScript twin of `src/scripts/_cli/cmd_validate.py` (ADR-200, py2ts
 * migration). The CLI contract mirrors the Python original EXACTLY — same
 * flags, same exit codes, same stdout/stderr split, byte-identical emitted
 * output, same filesystem semantics. No behaviour changes — latent quirks are
 * replicated, not fixed.
 *
 * Phase 3.4 of road-to-global-first-install.md (ADR-008). Read-only check —
 * never edits the manifest, never re-runs the installer. Exits non-zero if any
 * drift is found so CI can gate on it. Surfaces three drift kinds documented in
 * ADR-008 §Lifecycle:
 *
 * 1. **marker_missing**     — recorded `bridge_marker` path does not exist.
 * 2. **scope_divergence**   — recorded scope is `project` but the marker only
 *    exists at the user-scope anchor (or vice versa); the manifest is lying
 *    about where the tool actually lives.
 * 3. **version_drift**      — manifest's `agent_config_version` no longer
 *    matches the package's currently-installed version (single repo-level
 *    check, surfaced once not per-tool).
 *
 * --- Parity notes (ADR-200) ---
 *
 * - `main()` returns an exit code; the CLI entry guard sets `process.exitCode`
 *   (never `process.exit()`). The Python uses `sys.exit(main(sys.argv[1:]))`.
 * - argparse usage errors (unknown flags, missing argument) print usage +
 *   `error:` to stderr and throw `ArgparseExit(2)`. `-h`/`--help` prints usage
 *   to stdout and throws `ArgparseExit(0)`. The `--help` BODY (per-flag
 *   descriptions) is a documented divergence — argparse re-wraps it to terminal
 *   width; golden tests assert the `usage:` token + exit code, not the body.
 * - `_lib.*` / `scripts.install` imports resolve to the `.ts` twins (never a
 *   `.py`). The Python dual-path try/except collapses to a single static
 *   import. `USER_SCOPE_PATHS` / `PROJECT_BRIDGE_MARKERS` are `Record`s in the
 *   install twin (Python dicts); `.get()` → indexing with an `undefined` guard.
 * - `Path(bridge_marker).expanduser()` → `expanduser`; `Path.is_absolute()` →
 *   `path.isAbsolute`; `Path / Path` join → `path.join`; `.exists()` →
 *   `pathExists`.
 * - `current_package_version()` returns `"0.0.0"` fallback in both runtimes;
 *   the `_version_drift` guard short-circuits on an empty string the same way
 *   (it never is, but the truthy check is preserved verbatim).
 * - `os.environ.get("PROJECT_ROOT")` → `process.env.PROJECT_ROOT`. `str(...)`
 *   / `.strip()` parity via `String()` + `.trim()`.
 * - The `{x!r}` repr in `manifest_corrupt` detail (`scope=…, marker=…`) uses a
 *   Python `repr()` of the string scalars; `_pyRepr` replicates single-quote
 *   preference + backslash/quote escaping.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as installed_lock from '../_lib/installed_lock.js';
import * as installed_tools from '../_lib/installed_tools.js';
import { resolve_project_root } from '../_lib/agent_settings.js';
import { PROJECT_BRIDGE_MARKERS, USER_SCOPE_PATHS } from '../install.js';

type Dict = Record<string, unknown>;

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

/**
 * `pathlib.Path(p)` string form — collapse repeated separators and strip a
 * trailing separator (Python `str(Path("~/.cursor/"))` → `~/.cursor`), keeping
 * a lone root `/`. Mirrors how the Python original wraps every marker/anchor in
 * `Path(...)` before `str()`-ing it into a message.
 */
function pyPathStr(p: string): string {
    if (p === '') return '.';
    const isAbs = p.startsWith('/');
    const parts = p.split('/').filter((seg) => seg !== '');
    const joined = parts.join('/');
    if (isAbs) {
        return '/' + joined;
    }
    return joined === '' ? '.' : joined;
}

/**
 * `Path(p).expanduser()` — expand a leading `~` then normalise via pathlib
 * string rules (trailing-slash strip, collapsed separators). We only handle a
 * bare `~` / `~/…` like the original (no `~user`).
 */
function expanduser(p: string): string {
    let expanded: string;
    if (p === '~') {
        expanded = os.homedir();
    } else if (p.startsWith('~/') || p.startsWith('~\\')) {
        // pathlib joins `~` → home, then the remainder.
        expanded = path.join(os.homedir(), p.slice(2));
    } else {
        expanded = p;
    }
    return pyPathStr(expanded);
}

function pathExists(p: string): boolean {
    try {
        // `Path.exists()` follows symlinks; statSync mirrors that.
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** `print(...)` — line to stdout. */
function print(line = ''): void {
    process.stdout.write(line + '\n');
}

/** Python `repr()` for the scalar values interpolated with `{x!r}`. */
function pyRepr(value: unknown): string {
    if (value === null || value === undefined) return 'None';
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') {
        const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return `'${escaped}'`;
    }
    return String(value);
}

// ---------------------------------------------------------------------------
// Module body (cmd_validate.py).
// ---------------------------------------------------------------------------

function _resolve_marker(project_root: string, bridge_marker: string, scope: string): string {
    if (scope === 'global') {
        return expanduser(bridge_marker);
    }
    // Python: `Path(candidate)` if absolute else `project_root / candidate`.
    const candidate = bridge_marker;
    if (path.isAbsolute(candidate)) {
        return pyPathStr(candidate);
    }
    return pyPathStr(path.join(project_root, candidate));
}

/** Return the *other* scope's canonical marker path, or null if unknown. */
function _counterpart_path(project_root: string, tool_id: string, scope: string): string | null {
    if (scope === 'project') {
        const anchor = USER_SCOPE_PATHS[tool_id];
        return anchor ? expanduser(anchor) : null;
    }
    const rel = PROJECT_BRIDGE_MARKERS[tool_id];
    return rel ? pyPathStr(path.join(project_root, rel)) : null;
}

function _check_entry(project_root: string, entry: Dict): Dict[] {
    const name = String(entry['name'] ?? '').trim();
    const scope = String(entry['scope'] ?? '').trim();
    const bridge_marker = String(entry['bridge_marker'] ?? '').trim();
    const issues: Dict[] = [];
    if (!name || (scope !== 'project' && scope !== 'global') || !bridge_marker) {
        issues.push({
            kind: 'manifest_corrupt',
            name: name || '<unknown>',
            detail: `entry missing required fields (scope=${pyRepr(scope)}, marker=${pyRepr(bridge_marker)})`,
        });
        return issues;
    }
    const target = _resolve_marker(project_root, bridge_marker, scope);
    if (!pathExists(target)) {
        const counterpart = _counterpart_path(project_root, name, scope);
        if (counterpart !== null && pathExists(counterpart)) {
            const other_scope = scope === 'project' ? 'global' : 'project';
            issues.push({
                kind: 'scope_divergence',
                name,
                detail:
                    `recorded scope=${scope} (${target}) is missing, but ` +
                    `counterpart at scope=${other_scope} (${counterpart}) exists`,
            });
        } else {
            issues.push({
                kind: 'marker_missing',
                name,
                detail: `bridge_marker not found: ${target}`,
            });
        }
    }
    return issues;
}

function _version_drift(manifest_version: string, current_version: string): Dict | null {
    if (!manifest_version || !current_version) {
        return null;
    }
    if (manifest_version !== current_version) {
        return {
            kind: 'version_drift',
            name: '<manifest>',
            detail:
                `manifest recorded agent_config_version=${manifest_version}; ` +
                `currently installed package is ${current_version}`,
        };
    }
    return null;
}

interface Opts {
    project: string | null;
    quiet: boolean;
    skip_version_check: boolean;
}

const PROG = 'agent-config validate';

// Verbatim argparse usage block (captured from the .py at COLUMNS=80). The
// per-flag `--help` BODY is a documented divergence — argparse re-wraps it to
// terminal width; golden tests assert the `usage:` token + exit code only.
const USAGE =
    `usage: ${PROG} [-h] [--project PROJECT] [--quiet]\n` +
    '                             [--skip-version-check]\n';

function _argError(msg: string): never {
    process.stderr.write(USAGE);
    process.stderr.write(`${PROG}: error: ${msg}\n`);
    throw new ArgparseExit(2);
}

function _parse(argv: string[]): Opts {
    const opts: Opts = { project: null, quiet: false, skip_version_check: false };
    const positionals: string[] = [];
    let i = 0;
    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(USAGE);
            throw new ArgparseExit(0);
        }
        const eq = a.startsWith('--') ? a.indexOf('=') : -1;
        const flag = eq >= 0 ? a.slice(0, eq) : a;
        const inlineVal = eq >= 0 ? a.slice(eq + 1) : null;
        if (flag === '--quiet') {
            if (inlineVal !== null) {
                _argError(`argument --quiet: ignored explicit argument '${inlineVal}'`);
            }
            opts.quiet = true;
            i += 1;
            continue;
        }
        if (flag === '--skip-version-check') {
            if (inlineVal !== null) {
                _argError(`argument --skip-version-check: ignored explicit argument '${inlineVal}'`);
            }
            opts.skip_version_check = true;
            i += 1;
            continue;
        }
        if (flag === '--project') {
            let value: string;
            if (inlineVal !== null) {
                value = inlineVal;
            } else {
                if (i + 1 >= argv.length) {
                    _argError('argument --project: expected one argument');
                }
                value = argv[i + 1] as string;
                i += 1;
            }
            opts.project = value;
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
    return opts;
}

function _emit(quiet: boolean, msg: string): void {
    if (!quiet) {
        print(msg);
    }
}

function _format(issue: Dict): string {
    return `  ❌  [${issue['kind']}] ${issue['name']}: ${issue['detail']}`;
}

export function main(argv: string[]): number {
    const opts = _parse(argv);
    // Phase 3 — honor AGENT_CONFIG_PROJECT_ROOT + anchor walk via the shared
    // helper. Legacy `PROJECT_ROOT` env var stays as a fallback so existing CI
    // scripts keep working.
    const arg = opts.project || process.env['PROJECT_ROOT'] || null;
    const [project_root] = resolve_project_root(arg);
    const manifest = installed_tools.manifest_path(project_root);
    const data = installed_tools.read_manifest(manifest);

    if (data === null) {
        _emit(opts.quiet, `❌  No manifest found at ${manifest}`);
        _emit(opts.quiet, '    Run `./agent-config init --tools=<id>` to create one.');
        _emit(opts.quiet, '    Diagnose: `./agent-config doctor --check manifest-integrity`');
        return 1;
    }

    const entries = (data['tools'] as Dict[] | undefined) || [];
    const issues: Dict[] = [];
    for (const entry of entries) {
        for (const issue of _check_entry(project_root, entry)) {
            issues.push(issue);
        }
    }

    if (!opts.skip_version_check) {
        const manifest_version = String(data['agent_config_version'] ?? '').trim();
        const current_version = installed_lock.current_package_version();
        const drift = _version_drift(manifest_version, current_version);
        if (drift !== null) {
            issues.push(drift);
        }
    }

    _emit(opts.quiet, `Manifest:  ${manifest}`);
    _emit(opts.quiet, `Tools:     ${entries.length} entries`);

    if (issues.length === 0) {
        _emit(opts.quiet, '✅  No drift detected.');
        return 0;
    }

    _emit(opts.quiet, `Drift:     ${issues.length} issue(s)`);
    for (const issue of issues) {
        _emit(opts.quiet, _format(issue));
    }
    _emit(opts.quiet, '');
    _emit(opts.quiet, 'Run `./agent-config sync` to replay missing bridges, or');
    _emit(opts.quiet, '`./agent-config init --tools=<id> --force` to refresh the manifest.');
    // Deeplink: route per-kind to the matching `doctor` check so users can
    // copy-paste even though `doctor` is Tier-1 and absent from --help.
    const kinds = new Set(issues.map((issue) => issue['kind'] as string));
    if (kinds.has('version_drift')) {
        _emit(opts.quiet, 'Diagnose:  `./agent-config doctor --check lockfile-freshness`');
    }
    if (kinds.has('marker_missing') || kinds.has('scope_divergence')) {
        _emit(opts.quiet, 'Diagnose:  `./agent-config doctor --check bridge-drift`');
    }
    if (kinds.has('manifest_corrupt')) {
        _emit(opts.quiet, 'Diagnose:  `./agent-config doctor --check manifest-integrity`');
    }
    return 1;
}

// --- CLI entry ---

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
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
    _resolve_marker,
    _counterpart_path,
    _check_entry,
    _version_drift,
    _format,
    ArgparseExit,
};
export type { Opts };
