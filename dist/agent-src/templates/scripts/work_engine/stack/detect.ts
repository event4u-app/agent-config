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
 * 2. `composer.json` lists `filament/filament` → `filament` (before bare
 *    Livewire: Filament pulls Livewire in transitively)
 * 3. `composer.json` lists `livewire/livewire` → `blade-livewire`
 * 4. `package.json` lists `react` AND any of `@radix-ui/*`,
 *    `shadcn-ui` or has a `components.json` (the shadcn marker file)
 *    → `react-shadcn`
 * 5. `package.json` lists `react` → `react`
 * 6. `package.json` lists `vue` (any major) → `vue`
 * 7. Either manifest names a recognised-but-unmodelled framework
 *    (Svelte, Angular, Nuxt, Astro, Solid, Qwik, Inertia) → `unknown`
 * 8. Otherwise → `plain`
 *
 * Rules 3, 5 and 7 exist because the earlier table sent three common
 * shapes into `plain`: Laravel+Livewire without Flux failed rule 1's `&&`,
 * React without Radix failed rule 4, and every unmodelled framework was
 * indistinguishable from a genuinely plain project. `plain` now means "no
 * frontend markers"; `unknown` means "a framework we do not model", and
 * dispatch refuses on it rather than handing over generic tooling silently.
 *
 * Detection is filesystem-cheap: at most three small JSON reads per
 * project root. Errors (missing file, malformed JSON, missing `require`
 * section) downgrade to `plain` rather than raising — a wrong stack
 * label is recoverable (audit catches it, user can override), but a
 * crash mid-dispatch is not.
 *
 * Root manifests only, by design: a monorepo caller passes the workspace
 * root that carries the manifest it cares about. Note the consequence —
 * a caller that always passes the repository root gets `plain` for a
 * monorepo, so the caller owns scope selection, not the detector.
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
    'blade-livewire',
    'filament',
    'react-shadcn',
    'react',
    'vue',
    'plain',
    'unknown',
]);

/**
 * Label for a project with no frontend markers at all.
 *
 * `plain` used to carry two meanings — "genuinely a plain HTML/Tailwind
 * project" and "detection failed, here is generic tooling anyway" — which made
 * a loud failure impossible without punishing real plain projects. The second
 * meaning is now {@link UNSUPPORTED_STACK}.
 */
export const DEFAULT_STACK = 'plain';

/**
 * Label for a project whose frontend IS recognisable but is not modelled.
 *
 * Dispatch refuses on this label instead of degrading to generic tooling: a
 * Filament or Svelte project silently routed to a Tailwind-only bundle is
 * user-hostile precisely because the output looks like it worked.
 */
export const UNSUPPORTED_STACK = 'unknown';

const _SHADCN_RADIX_PREFIX = '@radix-ui/';
const _SHADCN_PACKAGE_NAMES: ReadonlySet<string> = new Set(['shadcn-ui', 'shadcn']);
const _FLUX_PACKAGE = 'livewire/flux';
const _LIVEWIRE_PACKAGE = 'livewire/livewire';
const _FILAMENT_PACKAGE = 'filament/filament';

/**
 * Frontend markers this package recognises but does not model.
 *
 * One of these present means detection **succeeded** at recognising a
 * framework and the package simply has no lane for it — the `unknown` case,
 * not the `plain` case. Keep the list short and factual; a marker leaves it
 * only when a real lane exists.
 */
const _UNMODELLED_MARKERS: ReadonlyArray<string> = [
    'svelte',
    '@angular/core',
    'nuxt',
    'astro',
    'solid-js',
    '@builder.io/qwik',
    '@inertiajs/vue3',
    '@inertiajs/react',
    'inertiajs/inertia-laravel',
];

/**
 * A heterogeneous JSON object, mirroring a Python `dict[str, object]`.
 * A `null` prototype is not required — the only access is `.get(key)`-style
 * lookup plus `isinstance(section, dict)` checks, both reproduced below.
 */
type Manifest = { [key: string]: unknown };

/**
 * The independent axes a frontend stack actually varies along.
 *
 * A flat label forces all-or-nothing matches: `livewire ∧ flux` was never the
 * bug, it was the symptom of collapsing three axes into one enum value. The
 * measured proof is Nuxt — `nuxt` is on the unmodelled-marker list, but the
 * project is labelled `vue` because Vue is a Nuxt dependency and matched first.
 * No ordering of one list can express "Nuxt implies Vue but is not Vue".
 *
 * Axes are **additive**: the flat `frontend` label keeps its existing
 * computation untouched, so the eight shipped labels are byte-stable by
 * construction rather than by test. Dispatch composition reads the axes.
 *
 * `'none'` means "this axis is genuinely absent" (a Blade app has no JS
 * component library); `'unknown'` means "not recognised", which is a different
 * fact and must not be conflated with absence.
 */
export interface StackAxes {
    /** Template / view layer — what markup is authored in. */
    readonly view: string;
    /** Reactivity layer — what drives updates. */
    readonly reactivity: string;
    /** Component library on top of the reactivity layer. */
    readonly component_lib: string;
    /** Styling system. */
    readonly css: string;
    /**
     * Meta-framework wrapping the reactivity layer (Nuxt over Vue, Next over
     * React, Astro over anything). Its own axis precisely because it does not
     * replace the layer underneath — which is what the flat label got wrong.
     */
    readonly meta: string;
}

/** Every axis unresolved — the shape for a project with no signals at all. */
const _EMPTY_AXES: StackAxes = {
    view: 'none',
    reactivity: 'none',
    component_lib: 'none',
    css: 'none',
    meta: 'none',
};

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
    /** Multi-axis view of the same detection. See {@link StackAxes}. */
    readonly axes: StackAxes;
    /**
     * Conflicting signals on one axis, e.g. `['reactivity: react + vue']`.
     *
     * Non-empty means the project is genuinely two things and the detector
     * refuses to pick. Guessing a priority order is the worse property for a
     * global package: asking costs one turn, a wrong silent pick costs the
     * whole run.
     */
    readonly ambiguity: ReadonlyArray<string>;

    constructor(args: {
        frontend: string;
        mtime: number;
        axes?: StackAxes;
        ambiguity?: ReadonlyArray<string>;
    }) {
        this.frontend = args.frontend;
        this.mtime = args.mtime;
        this.axes = args.axes ?? _EMPTY_AXES;
        this.ambiguity = args.ambiguity ?? [];
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

    // Axes are computed once and attached to every result below. The label
    // chain that follows is UNCHANGED — that is deliberate, so the eight
    // shipped labels stay byte-stable by construction rather than by test.
    // Composition reads `axes`; only the ambiguity guard alters a label.
    const axes = _detect_axes(composer, pkg, components_json, project_root);
    const ambiguity = _detect_ambiguity(composer, pkg);
    const _r = (frontend: string): StackResult =>
        new StackResult({ frontend, mtime, axes, ambiguity });

    // Conflicting signals on one axis: refuse rather than let the priority
    // chain below silently pick a winner. Measured baseline: react + vue in
    // one manifest resolved to `react` with no warning at all.
    if (ambiguity.length > 0) {
        return _r(UNSUPPORTED_STACK);
    }

    if (_is_blade_livewire_flux(composer)) {
        return _r('blade-livewire-flux');
    }

    // Filament before bare Livewire: it pulls Livewire in transitively, so a
    // Filament project would otherwise be labelled by its dependency rather
    // than by the framework the developer actually works in.
    if (_has_package(composer, ['require', 'require-dev'], _FILAMENT_PACKAGE)) {
        return _r('filament');
    }

    // Livewire WITHOUT Flux is the common Laravel frontend, not an unknown
    // one. It used to fail the `&&` above and land in `plain`.
    if (_has_package(composer, ['require', 'require-dev'], _LIVEWIRE_PACKAGE)) {
        return _r('blade-livewire');
    }

    if (_is_react_shadcn(pkg, components_json)) {
        return _r('react-shadcn');
    }

    // React without Radix/shadcn is a served stack, not an unknown one.
    if (_has_package(pkg, _PKG_DEP_KEYS, 'react')) {
        return _r('react');
    }

    if (_has_vue(pkg)) {
        return _r('vue');
    }

    // A recognised-but-unmodelled framework is NOT `plain`. Refusing here is
    // the point: `plain` means "no frontend markers", and conflating the two
    // is what let a Svelte or Inertia project receive Tailwind-only tooling
    // and no warning.
    if (_has_unmodelled_marker(composer, pkg)) {
        return _r(UNSUPPORTED_STACK);
    }

    // Monorepo: no manifest at the root, but one sits in a workspace directory.
    // That is a wrong-scope call, not a plain project — the caller owns scope
    // selection, so say so instead of labelling the whole repo `plain` and
    // dispatching generic tooling at it.
    //
    // A repo with no manifest ANYWHERE stays `plain`: that is greenfield, and
    // the scaffold path depends on it.
    if (mtime === 0.0) {
        const roots = _nested_frontend_roots(project_root);
        if (roots.length === 1) {
            // Unambiguous scope: descend once and keep the workspace's own
            // axes. Refusing here would punish the common monorepo shape for a
            // scope decision the layout already makes.
            const inner = detect_stack(roots[0] as string);
            return new StackResult({
                frontend: inner.frontend,
                mtime: inner.mtime,
                axes: inner.axes,
                ambiguity: inner.ambiguity,
            });
        }
        if (roots.length > 1) {
            // Several frontend roots: the caller owns scope selection, so name
            // them and let the step ask. Picking the first would be the silent
            // guess this detector exists to avoid.
            return new StackResult({
                frontend: UNSUPPORTED_STACK,
                mtime,
                axes,
                ambiguity: [
                    `workspace roots: ${roots.map((r) => path.basename(r)).join(' + ')}`,
                ],
            });
        }
    }

    return _r(DEFAULT_STACK);
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
    const mtimes: number[] = [];
    for (const name of _CACHE_KEY_FILES) {
        const p = path.join(project_root, name);
        if (_is_file(p)) {
            mtimes.push(_stat_mtime(p));
        }
    }
    return mtimes.length > 0 ? Math.max(...mtimes) : 0.0;
}

/**
 * Files whose mtime invalidates a cached detection.
 *
 * The two manifests are not sufficient: the signal table also reads marker
 * files, so adding `components.json` or a `nuxt.config.ts` changes the detected
 * axes while leaving both manifests untouched — and the cache would have served
 * the pre-marker answer indefinitely.
 *
 * `components.json` is listed first so a shadcn adoption, the most common of
 * these, is picked up.
 */
const _CACHE_KEY_FILES: ReadonlyArray<string> = [
    'composer.json',
    'package.json',
    'components.json',
    'nuxt.config.ts',
    'nuxt.config.js',
    'astro.config.mjs',
];

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

/** Dependency sections a `package.json` can carry. */
const _PKG_DEP_KEYS: ReadonlyArray<string> = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
];

/** True when `name` appears in any of `manifest`'s named dependency sections. */
function _has_package(
    manifest: Manifest,
    sections: ReadonlyArray<string>,
    name: string,
): boolean {
    return name in _all_dependencies(manifest, ...sections);
}

/**
 * Signal table, one entry per axis value.
 *
 * `first match wins` applies **per axis only** — collapsing that across axes is
 * the original defect. A Nuxt project matches `meta: nuxt` AND
 * `reactivity: vue`; both are true, and the flat label could hold only one.
 *
 * Order within an axis is specificity-descending: a marker file beats a bare
 * dependency, and a wrapper is listed before what it wraps.
 */
const _AXIS_SIGNALS: ReadonlyArray<{
    readonly axis: keyof StackAxes;
    readonly value: string;
    readonly npm?: ReadonlyArray<string>;
    readonly npm_prefix?: ReadonlyArray<string>;
    readonly composer?: ReadonlyArray<string>;
    readonly files?: ReadonlyArray<string>;
}> = [
    // meta — wrappers, checked before the layer they wrap
    { axis: 'meta', value: 'nextjs', npm: ['next'] },
    { axis: 'meta', value: 'nuxt', npm: ['nuxt'], files: ['nuxt.config.ts', 'nuxt.config.js'] },
    { axis: 'meta', value: 'astro', npm: ['astro'], files: ['astro.config.mjs'] },
    { axis: 'meta', value: 'remix', npm: ['@remix-run/react'] },
    { axis: 'meta', value: 'sveltekit', npm: ['@sveltejs/kit'] },
    { axis: 'meta', value: 'filament', composer: ['filament/filament'] },

    // reactivity
    { axis: 'reactivity', value: 'react', npm: ['react'] },
    { axis: 'reactivity', value: 'vue', npm: ['vue'] },
    { axis: 'reactivity', value: 'svelte', npm: ['svelte'] },
    { axis: 'reactivity', value: 'angular', npm: ['@angular/core'] },
    { axis: 'reactivity', value: 'solid', npm: ['solid-js'] },
    { axis: 'reactivity', value: 'qwik', npm: ['@builder.io/qwik'] },
    { axis: 'reactivity', value: 'livewire', composer: ['livewire/livewire'] },
    { axis: 'reactivity', value: 'alpine', npm: ['alpinejs'] },
    { axis: 'reactivity', value: 'htmx', npm: ['htmx.org'] },

    // view
    { axis: 'view', value: 'svelte-sfc', npm: ['svelte'] },
    { axis: 'view', value: 'vue-sfc', npm: ['vue'] },
    // Angular templates are HTML with its own directive syntax, not JSX.
    // Listing it under `jsx` was wrong and would have handed a React idiom to
    // an Angular project through the Phase-3 composition.
    { axis: 'view', value: 'angular-html', npm: ['@angular/core'] },
    { axis: 'view', value: 'astro', npm: ['astro'] },
    { axis: 'view', value: 'jsx', npm: ['react'] },
    { axis: 'view', value: 'blade', composer: ['laravel/framework'] },

    // component_lib — marker file beats dependency
    { axis: 'component_lib', value: 'shadcn', npm: ['shadcn-ui', 'shadcn'], files: ['components.json'] },
    { axis: 'component_lib', value: 'radix', npm_prefix: ['@radix-ui/'] },
    { axis: 'component_lib', value: 'flux', composer: ['livewire/flux'] },
    { axis: 'component_lib', value: 'nuxt-ui', npm: ['@nuxt/ui'] },
    { axis: 'component_lib', value: 'vuetify', npm: ['vuetify'] },
    { axis: 'component_lib', value: 'mui', npm: ['@mui/material'] },

    // css
    { axis: 'css', value: 'tailwind', npm: ['tailwindcss'] },
    { axis: 'css', value: 'bootstrap', npm: ['bootstrap'] },
];

/** Axes where two signals are a genuine conflict rather than a stack. */
const _AMBIGUOUS_AXES: ReadonlyArray<keyof StackAxes> = ['reactivity'];

/**
 * Client-side SPA frameworks — two of these in one manifest is a real conflict.
 *
 * Everything else on the reactivity axis co-exists legitimately: Alpine and htmx
 * are progressive-enhancement layers, and Livewire is server-driven, so
 * Laravel+Livewire with a React widget is an ordinary stack, not an ambiguity.
 * Treating any two reactivity signals as a conflict refused those projects —
 * caught by the existing blade-wins-over-react precedence test.
 */
const _EXCLUSIVE_REACTIVITY: ReadonlySet<string> = new Set([
    'react',
    'vue',
    'svelte',
    'angular',
    'solid',
    'qwik',
]);

/** Resolve every axis independently from the manifests plus marker files. */
function _detect_axes(
    composer: Manifest,
    pkg: Manifest,
    components_json: boolean,
    project_root: string,
): StackAxes {
    const npm = _all_dependencies(pkg, ..._PKG_DEP_KEYS);
    const php = _all_dependencies(composer, 'require', 'require-dev');
    const npm_names = Object.keys(npm);
    const out: Record<string, string> = { ..._EMPTY_AXES };
    const decided = new Set<string>();

    for (const sig of _AXIS_SIGNALS) {
        if (decided.has(sig.axis)) continue;
        const hit =
            (sig.npm ?? []).some((n) => n in npm) ||
            (sig.npm_prefix ?? []).some((p) => npm_names.some((n) => n.startsWith(p))) ||
            (sig.composer ?? []).some((n) => n in php) ||
            (sig.files ?? []).some(
                (f) =>
                    (f === 'components.json' && components_json) ||
                    _is_file(path.join(project_root, f)),
            );
        if (hit) {
            out[sig.axis] = sig.value;
            decided.add(sig.axis);
        }
    }

    // An unresolved axis on a project that HAS manifests is "not recognised" —
    // a different fact from "absent", and conflating them is what made a
    // refusal indistinguishable from a genuinely plain project.
    const has_manifest = npm_names.length > 0 || Object.keys(php).length > 0;
    if (has_manifest) {
        for (const axis of ['view', 'reactivity'] as const) {
            if (!decided.has(axis)) out[axis] = 'unknown';
        }
    }
    return out as unknown as StackAxes;
}

/** Report axes carrying two mutually exclusive signals. */
function _detect_ambiguity(composer: Manifest, pkg: Manifest): string[] {
    const npm = _all_dependencies(pkg, ..._PKG_DEP_KEYS);
    const php = _all_dependencies(composer, 'require', 'require-dev');
    const found: string[] = [];
    for (const axis of _AMBIGUOUS_AXES) {
        const hits = _AXIS_SIGNALS.filter(
            (sig) =>
                sig.axis === axis &&
                ((sig.npm ?? []).some((n) => n in npm) ||
                    (sig.composer ?? []).some((n) => n in php)),
        )
            .map((sig) => sig.value)
            .filter((v) => _EXCLUSIVE_REACTIVITY.has(v));
        if (hits.length > 1) {
            found.push(`${axis}: ${hits.join(' + ')}`);
        }
    }
    return found;
}

/** Workspace directories a monorepo conventionally puts its packages in. */
const _WORKSPACE_DIRS: ReadonlyArray<string> = ['packages', 'apps', 'services', 'libs'];

/**
 * Return the workspace roots that carry a manifest, sorted.
 *
 * Reads the declarative `workspaces` field when present and falls back to the
 * conventional directories. Deliberately shallow — one `readdir` per candidate
 * directory, one `stat` per child.
 *
 * Empty means "not a monorepo". Exactly one means the scope is unambiguous and
 * detection can descend into it. More than one is a question for the caller,
 * not a guess for the detector.
 */
function _nested_frontend_roots(project_root: string): string[] {
    const roots: string[] = [];
    const seen = new Set<string>();
    // `workspaces` is the declarative answer when present; the conventional
    // directories are the fallback for repos that do not declare them.
    const root_pkg = _read_json(path.join(project_root, 'package.json'));
    const declared = root_pkg['workspaces'];
    const globs: string[] = Array.isArray(declared)
        ? (declared as unknown[]).filter((g): g is string => typeof g === 'string')
        : [];
    const dirs = new Set<string>(_WORKSPACE_DIRS);
    for (const g of globs) {
        const head = g.split('/')[0];
        if (head !== undefined && head !== '' && !head.includes('*')) dirs.add(head);
    }
    for (const dir of dirs) {
        const base = path.join(project_root, dir);
        let entries: string[];
        try {
            entries = fs.readdirSync(base);
        } catch {
            continue;
        }
        for (const entry of entries) {
            const child = path.join(base, entry);
            if (seen.has(child)) continue;
            if (
                _is_file(path.join(child, 'package.json')) ||
                _is_file(path.join(child, 'composer.json'))
            ) {
                seen.add(child);
                roots.push(child);
            }
        }
    }
    return roots.sort();
}

/** True when either manifest names a framework we recognise but do not model. */
function _has_unmodelled_marker(composer: Manifest, pkg: Manifest): boolean {
    const composer_deps = _all_dependencies(composer, 'require', 'require-dev');
    const pkg_deps = _all_dependencies(pkg, ..._PKG_DEP_KEYS);
    return _UNMODELLED_MARKERS.some((marker) => marker in composer_deps || marker in pkg_deps);
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
