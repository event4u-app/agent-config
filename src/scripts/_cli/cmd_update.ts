/**
 * `agent-config update` — explicit, opt-in update of the version pin
 * (TypeScript twin).
 *
 * TypeScript twin of `src/scripts/_cli/cmd_update.py` (ADR-200, py2ts
 * migration). The CLI contract mirrors the Python original EXACTLY — same
 * flags, same exit codes, same stdout/stderr split, byte-identical emitted
 * output, same filesystem effects, same subprocess argv/cwd/env. No behaviour
 * changes — latent quirks are replicated and flagged inline, not fixed.
 *
 * Phase 3 of road-to-portable-runtime-and-update-check (P3.1). The command is
 * the only user-driven path that flips `agent_config_version` in
 * `.agent-settings.yml`; the daily banner (P2) never writes settings files.
 *
 * Flags:
 *
 * - `--check` — print the available latest version + return; no write.
 * - `--to <version>` — pin to an exact version (registry-existence checked).
 *   Downgrades are allowed; the pin is a project decision.
 * - (no flag) — pin to the registry's `latest` tag.
 *
 * Write target: the **deepest** `.agent-settings.yml` in the project cascade
 * that already carries the `agent_config_version` key. When no file carries
 * it, the repo-root file is created/edited. Comments and key ordering are
 * preserved by line-based substitution.
 *
 * The npx cache is warmed via
 * `npx --yes @event4u/agent-config@<new> --version` so the next invocation is
 * offline-fast. The P2 state file is refreshed in lockstep — the new
 * `installed_version` is recorded so the banner does not yell about the old
 * pin.
 *
 * --- Parity notes (ADR-200) ---
 *
 * - `process.exitCode` is set; `process.exit()` is never called. argparse
 *   usage errors throw `ArgparseExit(2)`; `-h`/`--help` throws
 *   `ArgparseExit(0)`. Python's `sys.exit(main())` propagates the int.
 * - `main` is **async** because the default fetcher
 *   (`update_check.fetch_latest_from_npm`) is async in the TS twin (Node has
 *   no synchronous HTTP). Injected `fetcher` may be sync or async; both are
 *   awaited. The Python `main` is sync; the observable contract (stdout/stderr
 *   + exit code + files written) is identical.
 * - `from scripts._lib import installed_lock, update_check` resolves to the
 *   `.ts` twins. `update_check._read_state` / `_write_state` and
 *   `agent_settings._resolve_cascade_paths` are module-private in Python and
 *   NOT exported by the twins; they are replicated here byte-for-byte from the
 *   twin sources (flagged divergence — the originals are file-local privates,
 *   so re-deriving them keeps the import surface clean without editing shared
 *   modules). `_write_state` carries the same `ensure_ascii` divergence note as
 *   the upstream twin (payload is version strings + ISO timestamps, ASCII-only).
 * - `subprocess.run(["npx", …], …)` → `spawnSync` with identical argv, stdio
 *   ignored, a 120 s timeout, `check=False` (never throws). Any spawn error /
 *   timeout is swallowed, mirroring the Python `except (OSError,
 *   TimeoutExpired)`.
 * - `urllib.request` registry probe → `fetch` with a 1 s timeout; any failure
 *   yields `false`, mirroring the Python bare-except.
 * - `re` pin-line matching → a `RegExp`; `str.splitlines(keepends=True)` →
 *   `_splitlinesKeepends`.
 */

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as installed_lock from '../_lib/installed_lock.js';
import * as update_check from '../_lib/update_check.js';
import {
    DEFAULT_PROJECT_FILE,
    LOCAL_PROJECT_FILE,
    LOCAL_PROJECT_SUBDIR,
    find_project_root,
    resolve_project_root,
} from '../_lib/agent_settings.js';

const PACKAGE_NAME = '@event4u/agent-config';
// Mirrors the Python module constant; unused by the command body (parity).
export const PIN_KEY = 'agent_config_version';
const REGISTRY_VERSION_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/{version}`;
// The `m` flag makes JS `$` match before a trailing `\n`, replicating
// Python's `re.match` `$` semantics on lines kept with their newline
// (`splitlines(keepends=True)` / `for line in fh`). Each tested string is a
// single logical line, so multiline anchoring is equivalent to Python here.
const PIN_LINE_RE = /^(\s*agent_config_version\s*:\s*)(.*)$/m;

// ---------------------------------------------------------------------------
// Python-runtime parity helpers
// ---------------------------------------------------------------------------

const _HERE = fileURLToPath(import.meta.url);
const _HERE_DIR = path.dirname(_HERE);

class ArgparseExit extends Error {
    code: number;
    constructor(code: number) {
        super(`ArgparseExit(${code})`);
        this.name = 'ArgparseExit';
        this.code = code;
    }
}

interface OutSink {
    write(text: string): void;
}
const _stdout: OutSink = { write: (t) => process.stdout.write(t) };
const _stderr: OutSink = { write: (t) => process.stderr.write(t) };
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

/** `str.splitlines(keepends=True)` — split keeping the line terminators. */
function _splitlinesKeepends(text: string): string[] {
    const out: string[] = [];
    let buf = '';
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        buf += ch;
        if (ch === '\n') {
            out.push(buf);
            buf = '';
        }
    }
    if (buf) {
        out.push(buf);
    }
    return out;
}

// ---------------------------------------------------------------------------
// Replicated module-private helpers (see header parity note)
// ---------------------------------------------------------------------------

/** Twin of `agent_settings._canonical_settings_path` (file-local private). */
function _canonical_settings_path(project_root: string): string {
    return path.join(project_root, ...LOCAL_PROJECT_SUBDIR, DEFAULT_PROJECT_FILE);
}

/** Twin of `agent_settings._local_settings_path` (file-local private). */
function _local_settings_path(project_root: string): string {
    return path.join(project_root, ...LOCAL_PROJECT_SUBDIR, LOCAL_PROJECT_FILE);
}

/** Twin of `agent_settings._resolve` — absolute, normalised path. */
function _resolve(p: string): string {
    return path.resolve(p);
}

/**
 * Twin of `agent_settings._resolve_cascade_paths` (file-local private).
 *
 * Returns the ordered cascade of in-project settings files (shallow → deep).
 */
function _resolve_cascade_paths(cwd: string | null, project_path: string | null): string[] {
    if (cwd === null) {
        const legacy = project_path ? project_path : DEFAULT_PROJECT_FILE;
        const parent = path.dirname(legacy);
        return [legacy, _canonical_settings_path(parent), _local_settings_path(parent)];
    }

    const root = find_project_root(cwd);
    if (root === null) {
        const legacy = project_path ? project_path : DEFAULT_PROJECT_FILE;
        const parent = path.dirname(legacy);
        return [legacy, _canonical_settings_path(parent), _local_settings_path(parent)];
    }

    const cwd_resolved = _resolve(cwd);
    // Build the chain root → … → cwd (shallowest first, deepest last).
    const chain: string[] = [];
    let cursor = cwd_resolved;
    for (;;) {
        chain.push(cursor);
        if (cursor === root) {
            break;
        }
        const parent = path.dirname(cursor);
        if (parent === cursor) {
            break;
        }
        cursor = parent;
    }
    chain.reverse();
    const out: string[] = [];
    for (const dir of chain) {
        out.push(path.join(dir, DEFAULT_PROJECT_FILE));
        out.push(_canonical_settings_path(dir));
        out.push(_local_settings_path(dir));
    }
    return out;
}

/** Twin of `update_check._read_state` (module-private). */
function _read_state(state_path: string): Record<string, unknown> {
    try {
        const raw = fs.readFileSync(state_path, 'utf-8');
        const data: unknown = JSON.parse(raw);
        if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
            return data as Record<string, unknown>;
        }
    } catch {
        // Unreadable / corrupt state — treat as empty, same as Python.
    }
    return {};
}

/** Twin of `update_check._write_state` (module-private). */
function _write_state(state_path: string, payload: Record<string, unknown>): void {
    const parent = path.dirname(state_path);
    fs.mkdirSync(parent, { recursive: true });
    // mkstemp equivalent: unique sibling temp file, created 0600.
    const tmp = path.join(parent, `.update-check-${randomBytes(8).toString('hex')}`);
    try {
        // json.dump(indent=2, sort_keys=True). (Python also escapes non-ASCII
        // via ensure_ascii=True — flagged divergence matching the upstream
        // twin; payload values are version strings + timestamps, ASCII-only.)
        const sorted: Record<string, unknown> = {};
        for (const key of Object.keys(payload).sort()) {
            sorted[key] = payload[key];
        }
        fs.writeFileSync(tmp, JSON.stringify(sorted, null, 2), { encoding: 'utf-8', mode: 0o600 });
        fs.chmodSync(tmp, 0o600);
        fs.renameSync(tmp, state_path);
    } catch (err) {
        try {
            fs.unlinkSync(tmp);
        } catch {
            // Best-effort cleanup, mirroring the Python `except OSError: pass`.
        }
        throw err;
    }
}

// ---------------------------------------------------------------------------

function _normalize(version: string): string {
    return version.trim().replace(/^v+/, '');
}

async function _registry_has_version(version: string, timeout = 1.0): Promise<boolean> {
    const url = REGISTRY_VERSION_URL.replace('{version}', _normalize(version));
    try {
        const resp = await fetch(url, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(timeout * 1000),
        });
        return resp.status === 200;
    } catch {
        return false;
    }
}

/** Return the deepest cascade file that carries the pin, else repo root. */
function _find_pin_file(cwd: string): string {
    const cascade = _resolve_cascade_paths(cwd, null);
    for (const p of [...cascade].reverse()) {
        if (_isFile(p) && _read_pin_line(p) !== null) {
            return p;
        }
    }
    // No file carries it — pick the repo-root cascade entry (shallowest).
    if (cascade.length) {
        return cascade[0] as string;
    }
    return path.join(cwd, DEFAULT_PROJECT_FILE);
}

function _read_pin_line(p: string): number | null {
    let text: string;
    try {
        text = fs.readFileSync(p, { encoding: 'utf-8' });
    } catch {
        return null;
    }
    const lines = _splitlinesKeepends(text);
    for (let idx = 0; idx < lines.length; idx++) {
        if (PIN_LINE_RE.test(lines[idx] as string)) {
            return idx;
        }
    }
    return null;
}

/** Rewrite the pin in `path`; return `true` if the file changed. */
function _write_pin(p: string, new_version: string): boolean {
    const target = `agent_config_version: "${_normalize(new_version)}"\n`;
    let lines: string[];
    try {
        lines = _splitlinesKeepends(fs.readFileSync(p, { encoding: 'utf-8' }));
    } catch (err) {
        const e = err as NodeJS.ErrnoException;
        if (e && e.code === 'ENOENT') {
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, target, { encoding: 'utf-8' });
            return true;
        }
        throw err;
    }
    for (let idx = 0; idx < lines.length; idx++) {
        if (PIN_LINE_RE.test(lines[idx] as string)) {
            if (lines[idx] === target) {
                return false;
            }
            lines[idx] = target;
            fs.writeFileSync(p, lines.join(''), { encoding: 'utf-8' });
            return true;
        }
    }
    // File exists but has no pin line — append at end.
    if (lines.length && !(lines[lines.length - 1] as string).endsWith('\n')) {
        lines.push('\n');
    }
    lines.push(target);
    fs.writeFileSync(p, lines.join(''), { encoding: 'utf-8' });
    return true;
}

type Runner = (argv: string[]) => void;

function _warm_npx_cache(version: string, runner?: Runner): void {
    const run: Runner =
        runner ??
        ((argv: string[]) => {
            spawnSync(argv[0] as string, argv.slice(1), {
                stdio: 'ignore',
                timeout: 120 * 1000,
            });
        });
    try {
        run(['npx', '--yes', `${PACKAGE_NAME}@${_normalize(version)}`, '--version']);
    } catch {
        // OSError / TimeoutExpired — best-effort cache warm, never fatal.
    }
}

function _refresh_state(installed: string, latest: string, state_path: string): void {
    const state = _read_state(state_path);
    const payload = {
        last_check_utc: _isoNowZ(),
        last_seen_version: latest,
        installed_version: installed,
    };
    Object.assign(state, payload);
    try {
        _write_state(state_path, state);
    } catch {
        // mirrors Python `except OSError: pass`.
    }
}

/** `datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")`. */
function _isoNowZ(): string {
    const d = new Date();
    const p = (n: number, w = 2): string => String(n).padStart(w, '0');
    return (
        `${p(d.getUTCFullYear(), 4)}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}` +
        `T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}Z`
    );
}

interface MainOptions {
    cwd?: string | null;
    installed_version?: string | null;
    fetcher?: () => string | null | Promise<string | null>;
    version_checker?: (version: string) => boolean | Promise<boolean>;
    cache_warmer?: (version: string) => void;
    state_path?: string | null;
    out?: OutSink;
    err?: OutSink;
}

interface Args {
    check: boolean;
    to: string | null;
    offline: boolean;
}

function _parse(argv: string[]): Args {
    const prog = 'agent-config update';
    const usage = 'usage: agent-config update [-h] [--check] [--to VERSION] [--offline]\n';

    const emitError = (msg: string): never => {
        _stderr.write(usage);
        _stderr.write(`${prog}: error: ${msg}\n`);
        throw new ArgparseExit(2);
    };

    const args: Args = { check: false, to: null, offline: false };
    let i = 0;
    while (i < argv.length) {
        const tok = argv[i] as string;
        const flag = tok.includes('=') ? tok.slice(0, tok.indexOf('=')) : tok;
        if (flag === '-h' || flag === '--help') {
            _stdout.write(usage);
            throw new ArgparseExit(0);
        } else if (flag === '--check') {
            args.check = true;
            i += 1;
        } else if (flag === '--offline') {
            args.offline = true;
            i += 1;
        } else if (flag === '--to') {
            const eq = tok.indexOf('=');
            if (eq >= 0) {
                args.to = tok.slice(eq + 1);
                i += 1;
            } else {
                const val = argv[i + 1];
                if (val === undefined) {
                    emitError('argument --to: expected one argument');
                }
                args.to = val as string;
                i += 2;
            }
        } else {
            emitError(`unrecognized arguments: ${tok}`);
        }
    }
    return args;
}

/** Entry point. `scripts/agent-config` dispatches here. */
export async function main(argv: string[] | null = null, options: MainOptions = {}): Promise<number> {
    const out = options.out ?? _stdout;
    const err = options.err ?? _stderr;
    const fetcher = options.fetcher ?? (() => update_check.fetch_latest_from_npm());
    const version_checker = options.version_checker ?? _registry_has_version;
    const cache_warmer = options.cache_warmer ?? ((v: string) => _warm_npx_cache(v));

    const args = _parse(argv ?? process.argv.slice(2));

    // Phase 3 — anchor walk + AGENT_CONFIG_PROJECT_ROOT honored so
    // `agent-config update` from a subdir writes to the right file. `cwd` is
    // kept as a kwarg for test injection.
    const [cwd] = resolve_project_root(null, { cwd: options.cwd ?? null });
    const installed_version = options.installed_version || _detect_installed_version();
    const state_path = options.state_path || update_check.DEFAULT_STATE_PATH;

    // AGENT_CONFIG_OFFLINE=1 (set by `install.py --offline`) is honored as an
    // env-level kill-switch. Mirrors cmd_versions.py.
    const offline = args.offline || process.env['AGENT_CONFIG_OFFLINE'] === '1';

    if (offline && !args.to) {
        _print(
            err,
            '❌  agent-config: --offline requires --to <version> ' +
                "(no registry, no 'latest' to fetch).",
        );
        return 1;
    }

    let latest: string;
    if (args.to) {
        const target = _normalize(args.to);
        if (offline) {
            // Trust the caller; air-gapped env can't reach the registry.
            latest = target;
        } else if (!(await version_checker(target))) {
            _print(err, `❌  agent-config: version ${target} not found on the npm registry.`);
            return 1;
        } else {
            latest = target;
        }
    } else {
        const fetched = await fetcher();
        if (!fetched) {
            _print(
                err,
                '❌  agent-config: failed to fetch latest version from the npm registry.',
            );
            return 1;
        }
        latest = _normalize(fetched);
    }

    if (args.check) {
        if (update_check._is_newer(latest, installed_version)) {
            _print(out, `agent-config ${latest} available (you have ${installed_version}).`);
            _print(out, `Update: npx ${PACKAGE_NAME} update`);
        } else {
            _print(out, `agent-config is up to date (${installed_version}).`);
        }
        return 0;
    }

    const pin_file = _find_pin_file(cwd);
    const changed = _write_pin(pin_file, latest);
    const rel = _relativeToOr(pin_file, cwd);

    if (changed) {
        _print(out, `✅  Pinned ${PACKAGE_NAME} to ${latest} in ${rel}.`);
    } else {
        _print(out, `ℹ️  ${rel} already pins to ${latest}.`);
    }

    // `npx --yes <pkg>@<v> --version` would hit the registry; skip it offline
    // so the air-gap guarantee holds end-to-end.
    if (!offline) {
        cache_warmer(latest);
    }
    _refresh_state(latest, latest, state_path);
    _refresh_global_lockfile(latest, out);
    return 0;
}

/** `Path.relative_to(cwd)` with the Python `except ValueError` fallback. */
function _relativeToOr(target: string, base: string): string {
    const rel = path.relative(base, target);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        return target;
    }
    return rel;
}

/**
 * Update the global `installed.lock` if it exists.
 *
 * Resolution prefers `~/.event4u/agent-config/installed.lock` and falls back to
 * the legacy `~/.config/agent-config/installed.lock`.
 *
 * Phase 1.6 — the lockfile is only present when the user has run a global
 * install; we never create one here, but we keep it in lockstep when `update`
 * flips the pin. Atomic write goes through `installed_lock.write_lockfile`.
 */
function _refresh_global_lockfile(version: string, out: OutSink): void {
    const read_path = installed_lock.lockfile_path();
    const write_path = installed_lock.lockfile_write_path();
    const existing = installed_lock.read_lockfile(read_path);
    if (existing === null) {
        return;
    }
    const recorded = (existing as unknown as Record<string, unknown>)['agent_config_version'];
    const tools = [...(existing.tools ?? [])];
    if (recorded === version && read_path === write_path) {
        _print(out, `ℹ️  ${write_path} already records ${version}.`);
        return;
    }
    installed_lock.write_lockfile(version, tools, { path: write_path });
    _print(out, `✅  Refreshed global lockfile at ${write_path}.`);
}

/** Read `version` from the package's own `package.json`. */
function _detect_installed_version(): string {
    const pkg_json = path.join(path.resolve(_HERE_DIR, '..', '..', '..'), 'package.json');
    try {
        const data = JSON.parse(fs.readFileSync(pkg_json, { encoding: 'utf-8' })) as Record<
            string,
            unknown
        >;
        const version = data['version'];
        if (typeof version === 'string' && version.trim()) {
            return version.trim();
        }
    } catch {
        // pass
    }
    return '0.0.0';
}

// CLI entry guard — set process.exitCode; never call process.exit().
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
