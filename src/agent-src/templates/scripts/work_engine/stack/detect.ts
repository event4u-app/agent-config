/**
 * Frontend-stack detection from project manifests.
 *
 * TypeScript twin of `work_engine/stack/detect.py` (ADR-200 py2ts). Leaf
 * module — stdlib only, NO intra-`work_engine` imports — so the public API
 * names stay snake_case to mirror the Python module 1:1 (per ADR-200: Python
 * style is part of the contract).
 *
 * The detector reads `composer.json` and `package.json` from a project
 * root, applies the heuristic table below in priority order, and returns a
 * {@link StackResult} carrying the labelled frontend plus the manifest
 * `mtime` it was computed against. The dispatcher caches the result on
 * `state.stack` and re-runs detection whenever the recorded `mtime`
 * no longer matches what the filesystem reports.
 *
 * Heuristics (priority order — first match wins):
 *
 * 1. `composer.json` lists `livewire/livewire` AND `livewire/flux` →
 *    `blade-livewire-flux`
 * 2. `package.json` lists `react` AND any of `@radix-ui/*`,
 *    `shadcn-ui` or has a `components.json` (the shadcn marker file)
 *    → `react-shadcn`
 * 3. `package.json` lists `vue` (any major) → `vue`
 * 4. Otherwise → `plain`
 *
 * Detection is filesystem-cheap: at most three small JSON reads per
 * project root. Errors (missing file, malformed JSON, missing `require`
 * section) downgrade to `plain` rather than raising — a wrong stack
 * label is recoverable (audit catches it, user can override), but a
 * crash mid-dispatch is not.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * All stack labels the detector can return.
 *
 * Kept as a set so consumers (state schema, fixtures, tests) can
 * validate against a single source of truth without re-deriving.
 *
 * Mirrors Python's `frozenset` — the membership semantics are what
 * matter; the literal set construction order is irrelevant.
 */
export const KNOWN_STACKS: ReadonlySet<string> = new Set([
    'blade-livewire-flux',
    'react-shadcn',
    'vue',
    'plain',
]);

/** Fallback when no manifest signal matches. */
export const DEFAULT_STACK = 'plain';

const _SHADCN_RADIX_PREFIX = '@radix-ui/';
const _SHADCN_PACKAGE_NAMES: ReadonlySet<string> = new Set(['shadcn-ui', 'shadcn']);
const _FLUX_PACKAGE = 'livewire/flux';
const _LIVEWIRE_PACKAGE = 'livewire/livewire';

/**
 * A heterogeneous JSON object, mirroring a Python `dict[str, object]`.
 * A `null` prototype is not required — the only access is `.get(key)`-style
 * lookup plus `isinstance(section, dict)` checks, both reproduced below.
 */
type Manifest = { [key: string]: unknown };

/**
 * Outcome of one detection pass.
 *
 * `mtime` is the latest mtime among the manifests actually consulted
 * (`composer.json` and `package.json`), in POSIX seconds. Callers
 * cache the result keyed on this value; a stale cache is invalidated
 * by the next dispatch when the recorded mtime is older than what
 * {@link latest_manifest_mtime} returns.
 *
 * Mirrors the Python `@dataclass(frozen=True)`: a plain immutable value
 * carrier with `frontend` + `mtime` fields, constructed positionally /
 * by keyword.
 */
export class StackResult {
    readonly frontend: string;
    readonly mtime: number;

    constructor(args: { frontend: string; mtime: number }) {
        this.frontend = args.frontend;
        this.mtime = args.mtime;
    }
}

/**
 * Inspect `project_root` and label the frontend stack.
 *
 * @param project_root
 *   Directory that should contain a `composer.json` or `package.json` at
 *   its top level. Other layouts (monorepos, nested workspaces) call this
 *   with the workspace root that carries the manifest you care about — the
 *   caller picks the scope, the detector does not walk upwards.
 * @returns
 *   A {@link StackResult} whose `frontend` is one of {@link KNOWN_STACKS};
 *   `mtime` is the latest manifest mtime among the files actually
 *   consulted, or `0.0` when no manifests exist (greenfield project).
 */
export function detect_stack(project_root: string): StackResult {
    const composer = _read_json(path.join(project_root, 'composer.json'));
    const pkg = _read_json(path.join(project_root, 'package.json'));
    const components_json = _is_file(path.join(project_root, 'components.json'));
    const mtime = latest_manifest_mtime(project_root);

    if (_is_blade_livewire_flux(composer)) {
        return new StackResult({ frontend: 'blade-livewire-flux', mtime });
    }

    if (_is_react_shadcn(pkg, components_json)) {
        return new StackResult({ frontend: 'react-shadcn', mtime });
    }

    if (_has_vue(pkg)) {
        return new StackResult({ frontend: 'vue', mtime });
    }

    return new StackResult({ frontend: DEFAULT_STACK, mtime });
}

/**
 * Return the latest mtime across the manifests we consult.
 *
 * Used by the dispatcher's cache check: when the persisted
 * `state.stack.mtime` no longer matches the live value, the cached
 * label is invalidated and detection re-runs. Returns `0.0` when no
 * manifest is present so a fresh greenfield repo produces a stable
 * sentinel rather than a missing-file error.
 */
export function latest_manifest_mtime(project_root: string): number {
    const candidates = ['composer.json', 'package.json'];
    const mtimes: number[] = [];
    for (const name of candidates) {
        const p = path.join(project_root, name);
        if (_is_file(p)) {
            mtimes.push(_stat_mtime(p));
        }
    }
    return mtimes.length > 0 ? Math.max(...mtimes) : 0.0;
}

/**
 * Read a JSON manifest, returning `{}` on any error.
 *
 * Wrong-but-recoverable beats crash-mid-dispatch. Audit and the
 * refine step will surface the real shape of the project; the
 * detector's job is just to pick a routing label.
 */
function _read_json(p: string): Manifest {
    if (!_is_file(p)) {
        return {};
    }
    let payload: unknown;
    try {
        payload = JSON.parse(fs.readFileSync(p, { encoding: 'utf-8' }));
    } catch {
        // Mirrors Python's `except (OSError, json.JSONDecodeError)`: any read
        // or parse failure degrades to the empty manifest.
        return {};
    }
    return _isDict(payload) ? payload : {};
}

/**
 * Merge the dependency-style sections of a manifest into one map.
 *
 * composer.json uses `require` and `require-dev`; package.json uses
 * `dependencies`, `devDependencies`, `peerDependencies`, and
 * `optionalDependencies`. We only care whether a name is present
 * anywhere — version pinning is the audit step's concern.
 */
function _all_dependencies(manifest: Manifest, ...keys: string[]): Manifest {
    const merged: Manifest = {};
    for (const key of keys) {
        const section = manifest[key];
        if (_isDict(section)) {
            // `dict.update` overwrites with later keys but preserves the
            // insertion order of first-seen keys; we only test membership,
            // so a plain assign reproduces the relevant semantics.
            Object.assign(merged, section);
        }
    }
    return merged;
}

function _is_blade_livewire_flux(composer: Manifest): boolean {
    const deps = _all_dependencies(composer, 'require', 'require-dev');
    return _LIVEWIRE_PACKAGE in deps && _FLUX_PACKAGE in deps;
}

function _is_react_shadcn(pkg: Manifest, components_json: boolean): boolean {
    const deps = _all_dependencies(
        pkg,
        'dependencies',
        'devDependencies',
        'peerDependencies',
        'optionalDependencies',
    );
    if (!('react' in deps)) {
        return false;
    }
    const names = Object.keys(deps);
    const has_radix = names.some((name) => name.startsWith(_SHADCN_RADIX_PREFIX));
    const has_shadcn_pkg = names.some((name) => _SHADCN_PACKAGE_NAMES.has(name));
    return has_radix || has_shadcn_pkg || components_json;
}

function _has_vue(pkg: Manifest): boolean {
    const deps = _all_dependencies(
        pkg,
        'dependencies',
        'devDependencies',
        'peerDependencies',
        'optionalDependencies',
    );
    return 'vue' in deps;
}

// ── stdlib parity helpers ───────────────────────────────────────────────

/** Python `Path.is_file()` — true only for a regular file (follows symlinks). */
function _is_file(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/**
 * Python `Path.stat().st_mtime` in POSIX seconds.
 *
 * Python derives `st_mtime` (a float) from the OS nanosecond timestamp.
 * Reading `mtimeNs` (an integer, byte-identical to Python's `st_mtime_ns`)
 * and dividing by `1e9` reproduces the same value closely. Note: the exact
 * float byte-repr of `st_mtime` can differ between CPython and V8 for some
 * sub-second timestamps — callers that *serialize* mtime (only
 * `runner.to_config` does) treat it as non-deterministic and the parity
 * tests normalize the field. The detection logic compares `mtime` only for
 * cache-invalidation (numeric `!=`), where this precision is sufficient.
 */
function _stat_mtime(p: string): number {
    const st = fs.statSync(p, { bigint: true });
    return Number(st.mtimeNs) / 1e9;
}

/** Python `isinstance(x, dict)` — a plain (non-array, non-null) object. */
function _isDict(v: unknown): v is Manifest {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
