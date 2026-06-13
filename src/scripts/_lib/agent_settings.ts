/**
 * Centralized loader for `.agent-settings.yml` with user-global fallback.
 *
 * TypeScript twin of `src/scripts/_lib/agent_settings.py` (ADR-092,
 * Phase 2 / Wave 2a). Mirrors the Python module's public API exactly —
 * same exported snake_case names, same semantics, same cascade / anchor /
 * whitelist / merge behavior, same YAML load tolerance, same error types.
 * Single source of truth for how scripts read agent settings.
 *
 * Resolution order (deepest wins; user-global is whitelist-filtered only):
 *
 *   N.   `~/.event4u/agent-config/agent-settings.yml` (user-global; whitelist only)
 *   N-1. `<repo-root>/.agent-settings.yml`            (project-wide; all keys)
 *   N-2. `<intermediate-dir>/.agent-settings.yml`     (subsystem-scoped; all keys)
 *   1.   `<CWD>/.agent-settings.yml`                  (deepest, wins; all keys)
 *
 * The user-global path is resolved via the sibling `user_global_paths`
 * twin with a read-fallback to the legacy `~/.config/agent-config/`
 * location so pre-2.4 installs keep working during the migration.
 *
 * `<repo-root>` is the nearest ancestor that anchors the project
 * (closest-leaf wins; tiebreaker `.agent-settings.yml` > `agents/` > `.git`):
 *
 * - `.agent-settings.yml` file,
 * - `agents/` directory containing `roadmaps/`, `settings/.ai-council.yml`,
 *   or `roadmaps-progress.md` (bare `agents/` does NOT anchor),
 * - `.git` file or directory (submodule support).
 *
 * Set `AGENT_CONFIG_LEGACY_ANCHOR=1` to revert to the pre-Step-7
 * `.git`-only walk for one minor-version soak. When `cwd` is `null`
 * (default), the loader behaves identically to the pre-cascade
 * contract: project file + user-global only, no ancestor walk.
 *
 * Contract — pure, read-only, tolerant:
 *
 * - YAML parse failure / unreadable file → defaults, logged at WARNING.
 * - Missing files → defaults.
 * - No file is ever created or written by this module.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import * as user_global_paths from './user_global_paths.js';

/** JSON-ish value type — mirrors Python's `Any` for settings data. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SettingsValue = any;
export type SettingsDict = Record<string, SettingsValue>;

/**
 * Module logger sink. Mirrors `logging.getLogger(__name__)` so tests can
 * capture INFO/WARNING records the same way `caplog` does in pytest.
 *
 * Records are appended to `logger.records` and also emitted to the real
 * sink (`console.info` / `console.warn`) so production behavior matches
 * Python's logging. `name` mirrors the Python logger name used by tests.
 */
export interface LogRecord {
    level: 'INFO' | 'WARNING';
    message: string;
}

class Logger {
    readonly name = 'scripts._lib.agent_settings';
    readonly records: LogRecord[] = [];

    info(message: string, ...args: SettingsValue[]): void {
        this.records.push({ level: 'INFO', message: _format(message, args) });
    }

    warning(message: string, ...args: SettingsValue[]): void {
        this.records.push({ level: 'WARNING', message: _format(message, args) });
    }
}

/** printf-style `%s` interpolation mirroring Python's logging args. */
function _format(template: string, args: SettingsValue[]): string {
    let i = 0;
    return template.replace(/%s/g, () => {
        if (i < args.length) {
            const value = args[i];
            i += 1;
            return _pystr(value);
        }
        return '%s';
    });
}

/** Python-ish `str()` of a value for log messages (lists render `[...]`). */
function _pystr(value: SettingsValue): string {
    if (Array.isArray(value)) {
        return `[${value.map((v) => _pyrepr(v)).join(', ')}]`;
    }
    return String(value);
}

function _pyrepr(value: SettingsValue): string {
    if (typeof value === 'string') {
        return `'${value}'`;
    }
    return String(value);
}

export const logger = new Logger();

export const DEFAULT_PROJECT_FILE = '.agent-settings.yml';
/**
 * Per-machine override file. Gitignored. A SINGLE project-level file
 * living under `agents/settings/` — appended as the deepest cascade
 * layer so a developer's local values override every committed
 * `.agent-settings.yml` without ever being committed. Missing file is
 * harmless (read as {}).
 */
export const LOCAL_PROJECT_FILE = '.agent-settings.local.yml';
/** Project-relative directory the local override lives in. */
export const LOCAL_PROJECT_SUBDIR: readonly string[] = ['agents', 'settings'];

/** Single local override: `<root>/agents/settings/.agent-settings.local.yml`. */
function _local_settings_path(project_root: string): string {
    return path.join(project_root, ...LOCAL_PROJECT_SUBDIR, LOCAL_PROJECT_FILE);
}

/**
 * Canonical project settings file:
 * `<root>/agents/settings/.agent-settings.yml`.
 *
 * The project settings file lives in the project's settings layer
 * (`agents/settings/`), NOT at the repo root. The repo-root
 * `.agent-settings.yml` is a legacy location read only as a back-compat
 * fallback (see `project_settings_path`).
 */
function _canonical_settings_path(project_root: string): string {
    return path.join(project_root, ...LOCAL_PROJECT_SUBDIR, DEFAULT_PROJECT_FILE);
}

/**
 * Resolve the project settings file for **reading**.
 *
 * Returns the canonical `agents/settings/.agent-settings.yml` when it
 * exists; otherwise the legacy repo-root `.agent-settings.yml` when that
 * exists; otherwise the canonical path. Existence-checked, never writes.
 */
export function project_settings_path(project_root: string): string {
    const canonical = _canonical_settings_path(project_root);
    if (_exists(canonical)) {
        return canonical;
    }
    const legacy = path.join(project_root, DEFAULT_PROJECT_FILE);
    if (_exists(legacy)) {
        return legacy;
    }
    return canonical;
}

/**
 * Always the canonical **write** target:
 * `agents/settings/.agent-settings.yml`.
 *
 * Writers (install, sync, migrate) target this unconditionally; the
 * legacy root file is migrated into it, never written afresh.
 */
export function canonical_settings_write_path(project_root: string): string {
    return _canonical_settings_path(project_root);
}

export const DEFAULT_TEAM_FILE = '.agent-project-settings.yml';
export const USER_GLOBAL_FILENAME = 'agent-settings.yml';

/**
 * Canonical write target under the new `~/.event4u/agent-config/`
 * namespace. Reads route through `_resolve_user_global_file` so pre-2.4
 * installs are still picked up from `~/.config/agent-config/` until the
 * migration shim copies them across.
 *
 * NOTE: This is a function, not a constant, because tests need it to
 * follow `$HOME` / env overrides at call time (Python recomputes it via
 * the loader, but exposes `DEFAULT_USER_GLOBAL_FILE` as a module
 * attribute that the test for `defaults_resolve_when_neither_argument_given`
 * monkeypatches). The differential pattern uses the function value;
 * tests inject a path directly.
 */
export function DEFAULT_USER_GLOBAL_FILE(): string {
    return user_global_paths.write_target(USER_GLOBAL_FILENAME);
}

/** Return the active user-global settings path with legacy fallback. */
function _resolve_user_global_file(): string {
    const found = user_global_paths.resolve_with_fallback(USER_GLOBAL_FILENAME);
    if (found !== null) {
        return found;
    }
    return DEFAULT_USER_GLOBAL_FILE();
}

/**
 * Exact dotted paths allowed to cascade from user-global into the merged
 * settings. Anything not listed here is silently ignored when present in
 * the user-global file. Adding a key requires an ADR.
 */
export const MERGEABLE_KEYS: readonly string[] = [
    'name',
    'ide',
    'rule_loading_tier',
    'memory.cadence',
    'personal.bot_icon',
    'personal.autonomy',
    'telegraph.speak_scope',
];

const _DEFAULTS: SettingsDict = {};

/**
 * Defaults applied by `get_modules_config` when a key is absent from both
 * the team file and the developer cascade. Lists are returned as fresh
 * copies — callers may mutate the result safely.
 */
export const MODULES_DEFAULTS: SettingsDict = {
    enabled: false,
    root_paths: [],
    namespace_template: '',
    agent_folder: 'agents',
    skip_dirs: ['.module-template', '.example'],
    detection_acknowledged: false,
};

/** Anchor identifier returned by `find_project_root_with_anchor`. */
export const ANCHOR_AGENT_SETTINGS = 'agent-settings';
export const ANCHOR_AGENTS_DIR = 'agents-dir';
export const ANCHOR_GIT = 'git';

/**
 * Marker subpaths that qualify a bare `agents/` directory as a project
 * anchor (D1). Any one is sufficient.
 */
const _AGENTS_DIR_MARKERS: readonly string[] = [
    'roadmaps',
    'settings/.ai-council.yml',
    'roadmaps-progress.md',
    '.event4u-bridge.yml',
];

/**
 * Kill-switch (D5). When set to `"1"`, `find_project_root` /
 * `find_project_root_with_anchor` revert to the pre-Step-7 `.git`-only
 * walk for one minor-version soak.
 */
const _LEGACY_ANCHOR_ENV = 'AGENT_CONFIG_LEGACY_ANCHOR';

/** `Path.exists()` — true for files, dirs, symlinks (broken or not). */
function _exists(p: string): boolean {
    try {
        fs.lstatSync(p);
        // lstat does not follow symlinks; Python's exists() does. Re-check
        // through stat so a valid symlink target counts as existing.
        fs.statSync(p);
        return true;
    } catch {
        // lstat may succeed for a broken symlink while stat throws; Python's
        // Path.exists() returns False for broken symlinks, matching here.
        return false;
    }
}

/** `Path.is_dir()`. */
function _is_dir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/** `Path.is_file()`. */
function _is_file(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/**
 * Mirror of `Path.resolve()`: absolutize + normalize + resolve symlinks.
 * Python's `resolve()` is `strict=False` by default — it does NOT raise
 * on a missing path, it normalizes what it can. `fs.realpathSync` raises
 * on a missing path, so fall back to a normalized absolute path.
 */
function _resolve(p: string): string {
    const absolute = path.resolve(p);
    try {
        return fs.realpathSync(absolute);
    } catch {
        return absolute;
    }
}

/** Ancestor chain `[start, ...parents]` mirroring `[current, *current.parents]`. */
function _ancestor_chain(start: string): string[] {
    const chain: string[] = [];
    let cursor = start;
    for (;;) {
        chain.push(cursor);
        const parent = path.dirname(cursor);
        if (parent === cursor) {
            break;
        }
        cursor = parent;
    }
    return chain;
}

/**
 * Return the boundary-anchor name at `path` or `null`.
 *
 * Boundary anchors stop the walk and define the project root:
 *
 * - `agents/` containing a D1 marker → `"agents-dir"`
 * - `.git` (file or directory) → `"git"`
 *
 * `.agent-settings.yml` is a layer marker, not a boundary anchor — it
 * only anchors when no boundary is found in any ancestor.
 */
function _boundary_anchor_at(dir: string): string | null {
    const agents_dir = path.join(dir, 'agents');
    if (_is_dir(agents_dir)) {
        for (const marker of _AGENTS_DIR_MARKERS) {
            if (_exists(path.join(agents_dir, marker))) {
                return ANCHOR_AGENTS_DIR;
            }
        }
    }
    if (_exists(path.join(dir, '.git'))) {
        return ANCHOR_GIT;
    }
    return null;
}

/**
 * Walk up from `start` and return `[root, anchor_name]` or `null`.
 *
 * Two-tier lookup: boundary pass (first ancestor with `.git` or an
 * `agents/`+marker anchor, `agents/` wins ties at the same level), then a
 * layer fallback returning the **outermost** ancestor carrying
 * `.agent-settings.yml`. When `AGENT_CONFIG_LEGACY_ANCHOR=1`, only `.git`
 * is considered. Pure read-only; never raises on missing paths.
 */
export function find_project_root_with_anchor(
    start: string,
): [string, string] | null {
    const current = _exists(start) ? _resolve(start) : start;
    const legacy = process.env[_LEGACY_ANCHOR_ENV] === '1';
    const chain = _ancestor_chain(current);
    if (legacy) {
        for (const candidate of chain) {
            if (_exists(path.join(candidate, '.git'))) {
                return [candidate, ANCHOR_GIT];
            }
        }
        return null;
    }
    // Boundary pass.
    for (const candidate of chain) {
        const anchor = _boundary_anchor_at(candidate);
        if (anchor !== null) {
            return [candidate, anchor];
        }
    }
    // Layer fallback — outermost .agent-settings.yml wins so the cascade
    // can layer deeper files below it.
    let outermost: string | null = null;
    for (const candidate of chain) {
        if (_exists(path.join(candidate, DEFAULT_PROJECT_FILE))) {
            outermost = candidate;
        }
    }
    if (outermost !== null) {
        return [outermost, ANCHOR_AGENT_SETTINGS];
    }
    return null;
}

/**
 * Walk up from `start` and return the project root or `null`.
 *
 * Thin wrapper over `find_project_root_with_anchor` that drops the
 * anchor-name component.
 */
export function find_project_root(start: string): string | null {
    const result = find_project_root_with_anchor(start);
    return result !== null ? result[0] : null;
}

/** One ancestor probe record emitted by `find_project_root_with_trace`. */
export interface TraceRecord {
    ancestor: string;
    pass: 'boundary' | 'layer';
    hit: string | null;
    reason: string;
}

/**
 * Walk up from `start` and return `[root, anchor, trace]`.
 *
 * Diagnostic variant of `find_project_root_with_anchor`. Returns the same
 * `[root, anchor]` pair (or `[null, null]` when no anchor is found) plus
 * an ordered list of trace records describing every ancestor probed.
 * Pure read-only.
 */
export function find_project_root_with_trace(
    start: string,
): [string | null, string | null, TraceRecord[]] {
    const trace: TraceRecord[] = [];
    const current = _exists(start) ? _resolve(start) : start;
    const legacy = process.env[_LEGACY_ANCHOR_ENV] === '1';
    const chain = _ancestor_chain(current);

    if (legacy) {
        for (const candidate of chain) {
            const hit = _exists(path.join(candidate, '.git'));
            trace.push({
                ancestor: candidate,
                pass: 'boundary',
                hit: hit ? ANCHOR_GIT : null,
                reason: hit ? 'legacy: .git found' : 'legacy: no .git',
            });
            if (hit) {
                return [candidate, ANCHOR_GIT, trace];
            }
        }
        return [null, null, trace];
    }

    // Boundary pass — same probes as find_project_root_with_anchor.
    for (const candidate of chain) {
        const agents_dir = path.join(candidate, 'agents');
        if (_is_dir(agents_dir)) {
            for (const marker of _AGENTS_DIR_MARKERS) {
                if (_exists(path.join(agents_dir, marker))) {
                    trace.push({
                        ancestor: candidate,
                        pass: 'boundary',
                        hit: ANCHOR_AGENTS_DIR,
                        reason: `agents/ has ${marker}`,
                    });
                    return [candidate, ANCHOR_AGENTS_DIR, trace];
                }
            }
        }
        if (_exists(path.join(candidate, '.git'))) {
            trace.push({
                ancestor: candidate,
                pass: 'boundary',
                hit: ANCHOR_GIT,
                reason: '.git present',
            });
            return [candidate, ANCHOR_GIT, trace];
        }
        trace.push({
            ancestor: candidate,
            pass: 'boundary',
            hit: null,
            reason: 'no agents/ marker, no .git',
        });
    }

    // Layer fallback — outermost .agent-settings.yml wins.
    let outermost: string | null = null;
    for (const candidate of chain) {
        const present = _exists(path.join(candidate, DEFAULT_PROJECT_FILE));
        trace.push({
            ancestor: candidate,
            pass: 'layer',
            hit: present ? ANCHOR_AGENT_SETTINGS : null,
            reason: present
                ? `${DEFAULT_PROJECT_FILE} present`
                : `no ${DEFAULT_PROJECT_FILE}`,
        });
        if (present) {
            outermost = candidate;
        }
    }
    if (outermost !== null) {
        return [outermost, ANCHOR_AGENT_SETTINGS, trace];
    }
    return [null, null, trace];
}

/**
 * Origin tag returned by `resolve_project_root` alongside the anchor
 * names defined above.
 */
export const ORIGIN_ROOT_FLAG = 'root-flag'; // --root global flag (Step 8 A3)
export const ORIGIN_EXPLICIT = 'explicit'; // --project arg on a subcommand
export const ORIGIN_ENV = 'env'; // AGENT_CONFIG_PROJECT_ROOT (wrapper-pinned)
export const ORIGIN_CWD_FALLBACK = 'cwd-fallback'; // no anchor found

export const PROJECT_ROOT_ENV = 'AGENT_CONFIG_PROJECT_ROOT';
export const ROOT_OVERRIDE_ENV = 'AGENT_CONFIG_ROOT_OVERRIDE';

/**
 * Raised when an explicit project-root override points to an invalid path.
 *
 * `--root <path>` and `AGENT_CONFIG_PROJECT_ROOT` must fail loudly when
 * the target does not exist or is not a directory. Callers translate this
 * into exit code 2 (no silent CWD fallback).
 */
export class ProjectRootError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ProjectRootError';
    }
}

/**
 * Resolve `path`; throw `ProjectRootError` when invalid.
 *
 * `origin_label` is one of `--root`, `AGENT_CONFIG_PROJECT_ROOT`, or
 * `--project`; surfaced verbatim in the error message.
 */
function _validate_root_path(p: string, origin_label: string): string {
    const resolved = _expanduser(p);
    if (!_exists(resolved)) {
        throw new ProjectRootError(
            `${origin_label} points to a path that does not exist: ${resolved}`,
        );
    }
    if (!_is_dir(resolved)) {
        throw new ProjectRootError(
            `${origin_label} points to a non-directory: ${resolved}`,
        );
    }
    return _resolve(resolved);
}

/** `Path.expanduser()` — expand a leading `~`. */
function _expanduser(p: string): string {
    if (p === '~') {
        return os.homedir();
    }
    if (p.startsWith('~/') || (process.platform === 'win32' && p.startsWith('~\\'))) {
        return path.join(os.homedir(), p.slice(2));
    }
    return p;
}

/**
 * Return `[root, origin]` for any `cmd_*` entry point.
 *
 * Resolution order:
 *
 * 1. `AGENT_CONFIG_PROJECT_ROOT` env var with `AGENT_CONFIG_ROOT_OVERRIDE=1`
 *    set by the master CLI's `--root` flag → `ORIGIN_ROOT_FLAG`. Fail-loud.
 * 2. Explicit `arg` (`--project`/`--target`) → `ORIGIN_EXPLICIT`. Fail-loud.
 * 3. `AGENT_CONFIG_PROJECT_ROOT` env (wrapper) → `ORIGIN_ENV`. Fail-loud.
 * 4. Anchor walk from `cwd` → anchor name.
 * 5. Fall back to `cwd` itself → `ORIGIN_CWD_FALLBACK`.
 *
 * Throws `ProjectRootError` when any explicit override points to a
 * missing path or non-directory.
 */
export function resolve_project_root(
    arg: string | null,
    options: { cwd?: string | null } = {},
): [string, string] {
    const cwd = options.cwd ?? null;
    if (process.env[ROOT_OVERRIDE_ENV] === '1') {
        const env_value = process.env[PROJECT_ROOT_ENV];
        if (env_value) {
            return [_validate_root_path(env_value, '--root'), ORIGIN_ROOT_FLAG];
        }
    }
    if (arg !== null && String(arg) !== '') {
        return [_validate_root_path(arg, '--project'), ORIGIN_EXPLICIT];
    }
    const env_value = process.env[PROJECT_ROOT_ENV];
    if (env_value) {
        return [_validate_root_path(env_value, PROJECT_ROOT_ENV), ORIGIN_ENV];
    }
    const start = _resolve(cwd ?? process.cwd());
    const walked = find_project_root_with_anchor(start);
    if (walked !== null) {
        return walked;
    }
    return [start, ORIGIN_CWD_FALLBACK];
}

/**
 * Return the ordered cascade of in-project settings files (shallow → deep).
 *
 * When `cwd` is provided and `find_project_root(cwd)` succeeds, the list
 * contains every `<dir>/.agent-settings.yml` from the repo root down to
 * `cwd`, shallowest first, then the canonical project file under
 * `agents/settings/`, then the per-machine local override. When `cwd` is
 * `null` or no anchor is reached, falls back to the legacy three-path set.
 */
function _resolve_cascade_paths(
    cwd: string | null,
    project_path: string | null,
): string[] {
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
    return [
        ...chain.map((d) => path.join(d, DEFAULT_PROJECT_FILE)),
        _canonical_settings_path(root),
        _local_settings_path(root),
    ];
}

/**
 * Return the merged settings dict.
 *
 * `project_path` defaults to `./.agent-settings.yml` (CWD-relative).
 * `user_global_path` defaults to the resolved user-global file. Pass
 * `verbose=true` to log keys present in user-global that are not on the
 * whitelist. `cwd` enables the in-project cascade. When `cwd` is `null`
 * (default), the loader falls back to the single `project_path` behavior.
 */
export function load_agent_settings(
    options: {
        project_path?: string | null;
        user_global_path?: string | null;
        verbose?: boolean;
        cwd?: string | null;
    } = {},
): SettingsDict {
    const project_path = options.project_path ?? null;
    const user_global_path = options.user_global_path ?? null;
    const verbose = options.verbose ?? false;
    const cwd = options.cwd ?? null;

    const user_global_raw =
        _read_yaml(user_global_path ? user_global_path : _resolve_user_global_file()) ?? {};

    const [user_global_filtered, ignored] = _filter_whitelist(user_global_raw, MERGEABLE_KEYS);
    if (verbose && ignored.length > 0) {
        logger.info(
            'agent_settings: ignored non-whitelisted user-global keys: %s',
            [...ignored].sort(),
        );
    }

    const cascade = _resolve_cascade_paths(cwd, project_path);

    const merged: SettingsDict = _deep_copy_defaults(_DEFAULTS);
    _deep_merge(merged, user_global_filtered);
    for (const p of cascade) {
        const layer = _read_yaml(p) ?? {};
        if (Object.keys(layer).length > 0) {
            _deep_merge(merged, layer);
        }
    }
    return merged;
}

/**
 * Return the merged `modules:` configuration with defaults applied.
 *
 * Three-tier precedence (deepest wins): `MODULES_DEFAULTS` < team file
 * (`<project_root>/.agent-project-settings.yml`) < developer cascade
 * (every `.agent-settings.yml`). The team layer may pin keys via a
 * top-level `locked_keys` list of dotted paths; locked keys discard any
 * matching developer override and emit an INFO record. Pure, read-only.
 */
export function get_modules_config(
    options: {
        project_root?: string | null;
        team_path?: string | null;
        project_path?: string | null;
        cwd?: string | null;
    } = {},
): SettingsDict {
    const project_root = options.project_root ?? null;
    const team_path = options.team_path ?? null;
    const project_path = options.project_path ?? null;
    const cwd = options.cwd ?? null;

    const cwd_resolved = cwd !== null ? cwd : process.cwd();

    let team_file: string;
    if (team_path !== null) {
        team_file = team_path;
    } else {
        let root: string;
        if (project_root !== null) {
            root = project_root;
        } else {
            root = find_project_root(cwd_resolved) ?? cwd_resolved;
        }
        team_file = path.join(root, DEFAULT_TEAM_FILE);
    }

    const team_raw = _read_yaml(team_file) ?? {};
    const team_modules_candidate = team_raw['modules'];
    const team_modules: SettingsDict = _is_plain_dict(team_modules_candidate)
        ? team_modules_candidate
        : {};
    const locked_keys_raw = team_raw['locked_keys'];
    const locked_keys: string[] = Array.isArray(locked_keys_raw)
        ? locked_keys_raw.filter((k): k is string => typeof k === 'string')
        : [];

    const dev_merged = load_agent_settings({
        ...(project_path !== null ? { project_path } : {}),
        ...(cwd !== null ? { cwd } : {}),
    });
    const dev_modules_candidate = dev_merged['modules'];
    const dev_modules: SettingsDict = _is_plain_dict(dev_modules_candidate)
        ? dev_modules_candidate
        : {};

    const merged: SettingsDict = _deepcopy(MODULES_DEFAULTS);
    if (Object.keys(team_modules).length > 0) {
        _deep_merge(merged, team_modules);
    }

    if (Object.keys(dev_modules).length > 0) {
        for (const [key, value] of Object.entries(dev_modules)) {
            const dotted = `modules.${key}`;
            if (locked_keys.includes(dotted) && key in team_modules) {
                logger.info(
                    'agent_settings: ignoring developer override of locked key %s',
                    dotted,
                );
                continue;
            }
            if (_is_plain_dict(value) && _is_plain_dict(merged[key])) {
                _deep_merge(merged[key], value);
            } else {
                merged[key] = value;
            }
        }
    }

    return merged;
}

/** Discovered-module record returned by `enumerate_modules`. */
export interface ModuleEntry {
    name: string;
    root_path: string;
    module_path: string;
    has_agent_folder: boolean;
    agent_folder_path: string | null;
}

/**
 * Enumerate every module under `modules.root_paths`.
 *
 * For each path in `modules.root_paths` (resolved relative to
 * `project_root`), lists immediate subdirectories that survive the
 * `modules.skip_dirs` filter and reports whether each module ships a
 * per-module agent folder (`modules.agent_folder`, default `agents`).
 *
 * Returns a list sorted by `(root_path, name)`. `modules.enabled` is NOT
 * consulted. Missing roots are skipped silently (logged at INFO). Hidden
 * directories and `skip_dirs` entries are filtered out. Pure, read-only.
 */
export function enumerate_modules(
    options: {
        project_root?: string | null;
        cwd?: string | null;
        modules_config?: SettingsDict | null;
    } = {},
): ModuleEntry[] {
    const project_root = options.project_root ?? null;
    const cwd = options.cwd ?? null;
    let modules_config = options.modules_config ?? null;

    const cwd_resolved = cwd !== null ? cwd : process.cwd();
    let root: string;
    if (project_root !== null) {
        root = project_root;
    } else {
        root = find_project_root(cwd_resolved) ?? cwd_resolved;
    }
    root = _resolve(root);

    if (modules_config === null) {
        modules_config = get_modules_config({ project_root: root, ...(cwd !== null ? { cwd } : {}) });
    }

    const root_paths_raw: SettingsValue[] = modules_config['root_paths'] || [];
    const skip_dirs_raw: SettingsValue[] =
        modules_config['skip_dirs'] || MODULES_DEFAULTS['skip_dirs'];
    const agent_folder = String(modules_config['agent_folder'] || MODULES_DEFAULTS['agent_folder']);

    const skip_dirs = new Set<string>(
        (Array.isArray(skip_dirs_raw) ? skip_dirs_raw : [])
            .filter((s): s is string => typeof s === 'string'),
    );

    const discovered: ModuleEntry[] = [];
    for (const raw of Array.isArray(root_paths_raw) ? root_paths_raw : []) {
        if (typeof raw !== 'string' || raw.trim() === '') {
            continue;
        }
        const root_rel = _strip_slashes(raw.trim());
        const root_abs = _resolve(path.join(root, root_rel));
        try {
            // Latent-bug candidate (replicated verbatim, see divergence
            // notes): boundary check uses a raw string prefix match
            // (`startswith`) rather than a path-component boundary check,
            // so a sibling like `<root>-evil` would pass. Python does the
            // same; flagged, not fixed.
            if (!_is_dir(root_abs) || !root_abs.startsWith(root)) {
                logger.info('enumerate_modules: skipping missing/out-of-tree root %s', root_rel);
                continue;
            }
        } catch {
            logger.info('enumerate_modules: unreadable root %s', root_rel);
            continue;
        }

        let children: string[];
        try {
            children = fs
                .readdirSync(root_abs)
                .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        } catch {
            logger.info('enumerate_modules: cannot list %s', root_rel);
            continue;
        }

        for (const name of children) {
            if (name.startsWith('.') || skip_dirs.has(name)) {
                continue;
            }
            const child = path.join(root_abs, name);
            if (!_is_dir(child)) {
                continue;
            }
            const agent_dir = path.join(child, agent_folder);
            const has_agent = _is_dir(agent_dir);
            let module_rel: string;
            try {
                module_rel = _relative_to(_resolve(child), root);
            } catch {
                continue;
            }
            const entry: ModuleEntry = {
                name,
                root_path: root_rel,
                module_path: module_rel,
                has_agent_folder: has_agent,
                agent_folder_path: has_agent ? _posix_join(module_rel, agent_folder) : null,
            };
            discovered.push(entry);
        }
    }

    discovered.sort((a, b) => {
        if (a.root_path !== b.root_path) {
            return a.root_path < b.root_path ? -1 : 1;
        }
        return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });
    return discovered;
}

/**
 * Yield `[dotted_key, value, source_path]` for every leaf setting.
 *
 * Walks the same cascade as `load_agent_settings` and emits one tuple per
 * leaf observed at each layer (user-global → repo-root → intermediates →
 * CWD). Never blocks, never raises on missing files.
 */
export function* iter_setting_overrides(
    options: {
        project_path?: string | null;
        user_global_path?: string | null;
        cwd?: string | null;
    } = {},
): Generator<[string, SettingsValue, string]> {
    const project_path = options.project_path ?? null;
    const user_global_path = options.user_global_path ?? null;
    const cwd = options.cwd ?? null;

    const user_global_path_resolved = user_global_path
        ? user_global_path
        : _resolve_user_global_file();
    const user_global_raw = _read_yaml(user_global_path_resolved) ?? {};
    const [user_global_filtered] = _filter_whitelist(user_global_raw, MERGEABLE_KEYS);
    if (Object.keys(user_global_filtered).length > 0) {
        for (const key of _leaf_paths(user_global_filtered)) {
            yield [key, _get_dotted(user_global_filtered, key), user_global_path_resolved];
        }
    }

    for (const p of _resolve_cascade_paths(cwd, project_path)) {
        const layer = _read_yaml(p);
        if (!layer || Object.keys(layer).length === 0) {
            continue;
        }
        for (const key of _leaf_paths(layer)) {
            yield [key, _get_dotted(layer, key), p];
        }
    }
}

/** Best-effort YAML read; never raises. Returns `null` on any failure. */
function _read_yaml(p: string): SettingsDict | null {
    if (!_is_file(p)) {
        return null;
    }
    let YAML: typeof import('yaml');
    try {
        // Lazy require to mirror Python's lazy `import yaml` — a missing
        // package degrades to `null` (defaults) instead of crashing.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        YAML = require('yaml') as typeof import('yaml');
    } catch {
        return null;
    }
    let data: SettingsValue;
    try {
        const text = fs.readFileSync(p, 'utf-8');
        // version '1.1' matches PyYAML's safe_load (yes/no/on/off bools,
        // sexagesimal ints) so the differential corpus stays byte-faithful.
        data = YAML.parse(text, { version: '1.1' });
        if (data === null || data === undefined) {
            data = {};
        }
    } catch (err) {
        // OSError or YAML parse failure → defaults, logged at WARNING.
        if (_is_yaml_error(err) || _is_os_error(err)) {
            logger.warning('agent_settings: unreadable or malformed YAML at %s', p);
            return null;
        }
        throw err;
    }
    return _is_plain_dict(data) ? data : null;
}

function _is_yaml_error(err: unknown): boolean {
    // The `yaml` package throws YAMLParseError / YAMLWarning subclasses
    // whose names start with "YAML"; also catch generic parse Errors.
    if (err instanceof Error) {
        return err.name.startsWith('YAML') || err.name === 'Error' || err.name === 'TypeError';
    }
    return false;
}

function _is_os_error(err: unknown): boolean {
    return (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        typeof (err as { code: unknown }).code === 'string'
    );
}

/** Return `[filtered_dict, ignored_paths]` from a user-global blob. */
function _filter_whitelist(
    raw: SettingsDict,
    allowed: readonly string[],
): [SettingsDict, string[]] {
    const filtered: SettingsDict = {};
    for (const dotted of allowed) {
        const value = _get_dotted(raw, dotted);
        if (value !== null && value !== undefined) {
            _set_dotted(filtered, dotted, value);
        }
    }
    const ignored = _leaf_paths(raw).filter((p) => !allowed.includes(p));
    return [filtered, ignored];
}

function _get_dotted(data: SettingsDict, dotted: string): SettingsValue {
    let cursor: SettingsValue = data;
    for (const part of dotted.split('.')) {
        if (!_is_plain_dict(cursor) || !(part in cursor)) {
            return null;
        }
        cursor = cursor[part];
    }
    return cursor;
}

function _set_dotted(target: SettingsDict, dotted: string, value: SettingsValue): void {
    const parts = dotted.split('.');
    let cursor: SettingsDict = target;
    for (const part of parts.slice(0, -1)) {
        let nxt = cursor[part];
        if (nxt === undefined) {
            nxt = {};
            cursor[part] = nxt;
        }
        if (!_is_plain_dict(nxt)) {
            nxt = {};
            cursor[part] = nxt;
        }
        cursor = nxt;
    }
    cursor[parts[parts.length - 1] as string] = value;
}

function _leaf_paths(data: SettingsDict, prefix = ''): string[] {
    const paths: string[] = [];
    for (const [key, value] of Object.entries(data)) {
        const p = prefix ? `${prefix}.${key}` : key;
        if (_is_plain_dict(value) && Object.keys(value).length > 0) {
            paths.push(..._leaf_paths(value, p));
        } else {
            paths.push(p);
        }
    }
    return paths;
}

/** Merge `src` into `dst` in-place; nested dicts merged recursively. */
function _deep_merge(dst: SettingsDict, src: SettingsDict): void {
    for (const [key, value] of Object.entries(src)) {
        if (_is_plain_dict(value) && _is_plain_dict(dst[key])) {
            _deep_merge(dst[key], value);
        } else {
            dst[key] = value;
        }
    }
}

function _deep_copy_defaults(src: SettingsDict): SettingsDict {
    const out: SettingsDict = {};
    _deep_merge(out, src);
    return out;
}

/**
 * `copy.deepcopy` for the JSON-shaped values settings hold (dicts, lists,
 * scalars). Arrays and plain objects are cloned recursively; scalars pass
 * through.
 */
function _deepcopy<T extends SettingsValue>(value: T): T {
    if (Array.isArray(value)) {
        return value.map((v) => _deepcopy(v)) as unknown as T;
    }
    if (_is_plain_dict(value)) {
        const out: SettingsDict = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = _deepcopy(v);
        }
        return out as unknown as T;
    }
    return value;
}

/**
 * `isinstance(x, dict)` — a plain object, not an array / null / class
 * instance. Mirrors Python's `isinstance(..., dict)` for settings data,
 * which is always built from `yaml.safe_load` (plain dicts).
 */
function _is_plain_dict(value: SettingsValue): value is SettingsDict {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
    );
}

/** Strip leading/trailing `/` like Python's `str.strip("/")`. */
function _strip_slashes(s: string): string {
    return s.replace(/^\/+/, '').replace(/\/+$/, '');
}

/**
 * `Path.relative_to(root)` — throws when `child` is not under `root`
 * (mirrors Python's `ValueError`). Returns the OS-native relative path.
 */
function _relative_to(child: string, root: string): string {
    const rel = path.relative(root, child);
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
        throw new Error(`${child} is not in the subpath of ${root}`);
    }
    return rel;
}

/** Join two repo-relative path fragments with forward slashes (posix). */
function _posix_join(a: string, b: string): string {
    return `${a.split(path.sep).join('/')}/${b}`;
}
