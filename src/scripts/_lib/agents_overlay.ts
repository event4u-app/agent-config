/**
 * Resolve files under `agents/<kind>/<name>.md` via the cascade.
 *
 * TypeScript twin of `src/scripts/_lib/agents_overlay.py` (ADR-088,
 * Phase 2 / Wave 2b). Companion to `agent_settings`: where the settings
 * loader merges YAML, this resolves single-file overlays — overrides,
 * contexts, decisions — to a single deepest match across the in-project
 * ancestor chain plus the user-global directory (when the `kind` is
 * whitelisted). Mirrors the Python module's public API exactly — same
 * exported snake_case names, same cascade order, same asymmetry, same
 * `ValueError` (here `Error`) on non-cascade-eligible kinds.
 *
 * Resolution order (deepest wins, every layer optional):
 *
 *   N. `~/.event4u/agent-config/agents/<kind>/<name>.md` (user-global; weakest;
 *                                                          `kind` must be in
 *                                                          `USER_GLOBAL_OVERLAY_KINDS`;
 *                                                          legacy
 *                                                          `~/.config/agent-config/agents/`
 *                                                          tree read as fallback)
 * N-1. `<repo-root>/agents/<kind>/<name>.md`
 * N-2. `<intermediate-dir>/agents/<kind>/<name>.md`      (optional)
 *   1. `<CWD>/agents/<kind>/<name>.md`                   (deepest, wins)
 *
 * Asymmetry: `overrides/` is the developer's personal layer and may
 * live user-global; `contexts/` and `decisions/` are project-shaped
 * and must not leak across projects, so the user-global layer is
 * silently skipped for them. Stateful subdirs (state/, memory/,
 * roadmaps/, work_engine/, council-* …) are not cascade-eligible
 * at all and throw `Error` when passed as `kind`.
 *
 * Contract — pure, read-only, tolerant:
 *
 * - Does not read file contents — returns the resolved path only.
 * - Missing layer / missing file → silently skipped, never throws.
 * - Invalid `kind` → `Error` (programmer error, not user input).
 * - No file is ever created or written by this module.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { find_project_root } from './agent_settings.js';
import * as user_global_paths from './user_global_paths.js';

/**
 * Subdirs of `agents/` that participate in the cascade. Every entry is
 * **additive** (single-file artefacts; deepest wins). Stateful or
 * session-scoped subdirs (`memory/`, `roadmaps/`, `work_engine/`,
 * `runtime/` — which holds `state/`, `council/`, `.agent-prices.md`)
 * are deliberately excluded — they are project-rooted only.
 */
export const CASCADE_ELIGIBLE_KINDS: ReadonlySet<string> = new Set([
    'overrides',
    'contexts',
    'decisions',
]);

/**
 * Subset of `CASCADE_ELIGIBLE_KINDS` allowed to live at the user-global
 * layer (`~/.event4u/agent-config/agents/<kind>/`). `contexts/` and
 * `decisions/` are project-shaped and must not leak across projects;
 * only `overrides/` — the developer's personal layer — is whitelisted.
 */
export const USER_GLOBAL_OVERLAY_KINDS: ReadonlySet<string> = new Set(['overrides']);

/**
 * Canonical write target under the new vendor namespace. The probe in
 * `resolve_overlay` adds the legacy `~/.config/agent-config/agents/`
 * tree as a read-only fallback for pre-2.4 installs.
 *
 * Mutable (despite the export) because the pytest suite reassigns the
 * Python module attribute `USER_GLOBAL_AGENTS_DIR` to redirect it at a
 * tmp path. The vitest port reassigns through `_setUserGlobalAgentsDir`.
 */
export let USER_GLOBAL_AGENTS_DIR: string = user_global_paths.write_target('agents');
let _LEGACY_USER_GLOBAL_AGENTS_DIR: string = path.join(user_global_paths.legacy_xdg_root(), 'agents');

/**
 * Test seam mirroring `monkeypatch.setattr(ao, "USER_GLOBAL_AGENTS_DIR", ...)`.
 *
 * The Python suite redirects the module attribute directly; an ES module
 * `export let` cannot be reassigned from outside, so this setter is the
 * supported equivalent. Passing the new agents dir keeps the legacy dir
 * in lockstep (its parent's `.config/agent-config/agents` shape) the same
 * way Python recomputes nothing — the legacy dir is left as-is unless an
 * explicit second argument is given.
 */
export function _setUserGlobalAgentsDir(
    agents_dir: string,
    legacy_agents_dir?: string,
): void {
    USER_GLOBAL_AGENTS_DIR = agents_dir;
    if (legacy_agents_dir !== undefined) {
        _LEGACY_USER_GLOBAL_AGENTS_DIR = legacy_agents_dir;
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
 * Python's `resolve()` is `strict=False` — it does not raise on a
 * missing path. `fs.realpathSync` raises on a missing path, so fall back
 * to a normalized absolute path.
 */
function _resolve(p: string): string {
    const absolute = path.resolve(p);
    try {
        return fs.realpathSync(absolute);
    } catch {
        return absolute;
    }
}

/**
 * Return the deepest existing `agents/<kind>/<name>.md` or `null`.
 *
 * Walks the in-project ancestor chain from `cwd` to the project root
 * (inclusive) and probes each layer for `agents/<kind>/<name>.md`.
 * Falls through to the user-global directory only when
 * `kind in USER_GLOBAL_OVERLAY_KINDS`. Returns the **deepest** existing
 * file (highest precedence), or `null` if no layer carries the overlay.
 *
 * `name` is treated as a basename — no path traversal, no
 * subdirectories. Callers that need nested layouts should encode the
 * structure inside the overlay file, not the filename.
 */
export function resolve_overlay(name: string, kind: string, cwd: string): string | null {
    if (!CASCADE_ELIGIBLE_KINDS.has(kind)) {
        const allowed = [...CASCADE_ELIGIBLE_KINDS].sort();
        throw new Error(
            `agents_overlay: kind '${kind}' not cascade-eligible ` +
                `(allowed: [${allowed.map((k) => `'${k}'`).join(', ')}])`,
        );
    }

    // Candidate layers, shallowest → deepest. Last match wins.
    const candidates: string[] = [];

    if (USER_GLOBAL_OVERLAY_KINDS.has(kind)) {
        // Legacy first, new last — deepest wins, so the new namespace
        // overrides the legacy path when both happen to exist mid-migration.
        candidates.push(path.join(_LEGACY_USER_GLOBAL_AGENTS_DIR, kind, `${name}.md`));
        candidates.push(path.join(USER_GLOBAL_AGENTS_DIR, kind, `${name}.md`));
    }

    const root = find_project_root(cwd);
    if (root !== null) {
        const cwd_resolved = _resolve(cwd);
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
        for (const layer_dir of chain) {
            candidates.push(path.join(layer_dir, 'agents', kind, `${name}.md`));
        }
    }

    let deepest: string | null = null;
    for (const candidate of candidates) {
        if (_is_file(candidate)) {
            deepest = candidate;
        }
    }
    return deepest;
}
