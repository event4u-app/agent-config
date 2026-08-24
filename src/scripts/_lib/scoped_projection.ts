/**
 * The scoped-projection predicate — ONE implementation, two callers.
 *
 * `projection.mode: scoped` narrows a GLOBAL deploy to the active profile's
 * packs. Two places need to know exactly which skills survive that prune:
 *
 *   1. `install.ts` — which artefacts it actually writes to the user's tree.
 *   2. `count_scoped_projection.ts` — the number the claims ledger publishes.
 *
 * Before this module those were the same rule written once and *typed* a
 * second time into `docs/CLAIMS.md`. The published pair drifted from the
 * benchmark doc it cited as its own method (217/288 vs 215/286) and grew by
 * one on every skill added, because nothing could compare them. The fix is
 * not a second counter — a second counting path that disagrees with the
 * first is the failure this replaces. It is this module: the installer and
 * the counter call the same functions, so a divergence is impossible rather
 * than merely unlikely.
 *
 * Consumers: `install.ts` (the prune itself) and `count_scoped_projection.ts`
 * (the published number).
 */

import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import type * as YamlModule from 'yaml';

import * as surface_tiers from './surface_tiers.js';

/**
 * ESM-safe `require`. A bare `require('yaml')` is `undefined` under tsx (the
 * runner every `./scripts-run` gate uses), so the older lazy-require pattern
 * elsewhere in this tree degrades to "no yaml" silently. `createRequire`
 * keeps the load lazy — `yaml` stays out of the installer bundle's static
 * graph — while actually resolving.
 */
const _require = createRequire(import.meta.url);

/** `workspaces` values whose packs are ALWAYS active under `scoped` mode. */
export const SCOPED_ACTIVE_WORKSPACES: ReadonlySet<string> = new Set([
    'engineering',
    'agent-config-maintainer',
]);

export interface PackRecord {
    id: string;
    workspaces: string[];
    requires: string[];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Lazy YAML safe_load mirroring PyYAML (version 1.1); `null` when absent. */
function yamlSafeLoad(text: string): unknown {
    let YAML: typeof YamlModule;
    try {
        YAML = _require('yaml') as typeof YamlModule;
    } catch {
        return null;
    }
    try {
        return YAML.parse(text, { version: '1.1' }) ?? null;
    } catch {
        return null;
    }
}

/** Repo-relative location of the pack vocabulary. */
export const PACKS_YML_REL = path.join('src', 'config', 'discovery', 'packs.yml');

/**
 * Parse `src/config/discovery/packs.yml` into `{id, workspaces, requires}`
 * records. `requires` falls back to the legacy `requires_hint` field name
 * when `requires` is absent.
 *
 * Deliberately THROWS on a missing file or a parse result that is not a
 * list — an empty active-pack set would be the LEAST safe fallback here
 * (it would prune every tagged artefact, the opposite of the fail-safe
 * contract). Callers wrap this in a try/catch that restores the full tree
 * on any error instead.
 */
export function load_packs_registry(package_root: string): PackRecord[] {
    const vocab_path = path.join(package_root, PACKS_YML_REL);
    const data = yamlSafeLoad(fs.readFileSync(vocab_path, 'utf-8'));
    if (!Array.isArray(data)) {
        throw new Error(`packs.yml did not parse to a list: ${vocab_path}`);
    }
    const out: PackRecord[] = [];
    for (const entry of data) {
        if (!isPlainObject(entry)) continue;
        const id = entry['id'];
        if (typeof id !== 'string' || id === '') continue;
        const workspaces_raw = entry['workspaces'];
        const workspaces = Array.isArray(workspaces_raw)
            ? workspaces_raw.filter((w): w is string => typeof w === 'string')
            : [];
        const requires_raw = entry['requires'] ?? entry['requires_hint'];
        const requires = Array.isArray(requires_raw)
            ? requires_raw.filter((r): r is string => typeof r === 'string')
            : [];
        out.push({ id, workspaces, requires });
    }
    return out;
}

/**
 * Active pack id set for `scoped` mode: every pack whose `workspaces`
 * intersects `SCOPED_ACTIVE_WORKSPACES`, unioned with `runtime_active_packs`,
 * expanded over the `requires` graph (transitive closure).
 */
export function compute_active_pack_ids(
    packs: readonly PackRecord[],
    runtime_active_packs: readonly string[],
): Set<string> {
    const by_id = new Map<string, PackRecord>();
    for (const p of packs) by_id.set(p.id, p);

    const active = new Set<string>();
    for (const p of packs) {
        if (p.workspaces.some((w) => SCOPED_ACTIVE_WORKSPACES.has(w))) {
            active.add(p.id);
        }
    }
    for (const id of runtime_active_packs) {
        active.add(id);
    }

    let frontier = [...active];
    while (frontier.length > 0) {
        const next: string[] = [];
        for (const id of frontier) {
            const rec = by_id.get(id);
            if (rec === undefined) continue;
            for (const dep of rec.requires) {
                if (!active.has(dep)) {
                    active.add(dep);
                    next.push(dep);
                }
            }
        }
        frontier = next;
    }
    return active;
}

/**
 * The prune predicate itself: `true` when this artefact is DROPPED under
 * `scoped`. Untagged artefacts (empty `packs:` frontmatter) are core/shared
 * and always kept; a tagged artefact survives iff its tags intersect the
 * active set.
 */
export function is_pruned_under_scoped(md_path: string, active_ids: ReadonlySet<string>): boolean {
    const packs = surface_tiers.frontmatter_packs(md_path);
    if (packs.size === 0) return false;
    for (const id of packs) {
        if (active_ids.has(id)) return false;
    }
    return true;
}

/**
 * Sentinel value for `projection.rule_packs`: derive the pack scope from the
 * active-pack set instead of listing ids by hand.
 *
 * The rule layer's pack axis was wired end-to-end but shipped inactive
 * (`rule_packs: []`), so a rule whose own body says "auto-activates when
 * pack-X is installed" projected into installs that do not have pack-X,
 * where it guards nothing. Listing the active ids by hand is not a fix — the
 * list would need re-typing whenever a pack is added, which is the
 * two-counting-paths failure this module exists to prevent. `auto` reuses
 * `compute_active_pack_ids`, the SAME set the skill/command prune uses, so
 * the rule axis cannot drift from the artefact axis.
 */
export const RULE_PACKS_AUTO = 'auto';

/**
 * Resolve a raw `projection.rule_packs` setting into the pack scope
 * `rule_in_scope` consumes.
 *
 * - `'auto'` (scalar or single-element list) → the derived active-pack set.
 * - a non-empty list → that list, verbatim.
 * - anything else (absent, `[]`, wrong type) → `null`, axis inactive.
 *
 * A derivation failure (unreadable / malformed `packs.yml`) returns `null`,
 * not an empty set: an empty set would prune every pack-tagged rule, the
 * opposite of the fail-safe contract `rule_in_scope` documents.
 */
export function resolve_rule_pack_scope(
    raw: unknown,
    package_root: string,
    runtime_active_packs: readonly string[] = [],
): string[] | null {
    const is_auto =
        raw === RULE_PACKS_AUTO ||
        (Array.isArray(raw) && raw.length === 1 && raw[0] === RULE_PACKS_AUTO);
    if (is_auto) {
        try {
            return [
                ...compute_active_pack_ids(load_packs_registry(package_root), runtime_active_packs),
            ].sort();
        } catch {
            return null;
        }
    }
    if (Array.isArray(raw) && raw.length > 0) {
        return raw.map((v) => String(v));
    }
    return null;
}

export interface ScopedProjectionStats {
    /** Skills a default `projection.mode: scoped` install deploys. */
    projected: number;
    /** Every skill in the catalog — identical to canonical `count('skills')`. */
    total: number;
    /** `total - projected`; the reduction the claim reports. */
    pruned: number;
    /** Pack ids active by default, sorted — the requires-closure result. */
    active_packs: string[];
    /** The workspaces whose packs are always on under `scoped`. */
    workspaces: string[];
}

/**
 * Partition a skill catalog with the installer's own predicate.
 *
 * The caller supplies the file set — in practice always
 * `update_counts.iter_skills()`, the walk behind the canonical
 * `count('skills')`, so `projected + pruned === total` holds by
 * construction. Taking it as a parameter (rather than importing
 * `update_counts` here) keeps this module free of a cycle: `update_counts`
 * imports it, not the other way round.
 *
 * `runtime_active_packs` defaults to empty: the published claim is about the
 * DEFAULT for a new install, and a fresh machine has no overlay.
 */
export function scoped_projection_stats(
    package_root: string,
    skills: Iterable<string>,
    runtime_active_packs: readonly string[] = [],
): ScopedProjectionStats {
    const active = compute_active_pack_ids(load_packs_registry(package_root), runtime_active_packs);

    let projected = 0;
    let total = 0;
    for (const skill of skills) {
        total += 1;
        if (!is_pruned_under_scoped(skill, active)) {
            projected += 1;
        }
    }

    return {
        projected,
        total,
        pruned: total - projected,
        active_packs: [...active].sort(),
        workspaces: [...SCOPED_ACTIVE_WORKSPACES].sort(),
    };
}

/** The installer's deploy tuple: [written, skipped, status, paths]. */
export type DeployTuple = [number, number, string, string[]];

// --- Deploy-tree prune mechanics ------------------------------------------
// Moved here WHOLE from `install.ts` (a pure move, names forwarded there) so
// the prune sits beside `is_pruned_under_scoped`, the predicate it consumes —
// which is what this module's header says it exists for. It also pays for the
// `check_source_size_budget` ratchet, which counts every line in a file above
// 1,500 and which `install.ts` at 5,466 lines cannot grow past.

/**
 * Remove skills/commands matching `is_pruned` from a completed deploy.
 *
 * road-to-install-contract-stability Phase 2 Step 2 (generalized in
 * road-to-credible-install Phase 2 to back both the core-only lab prune and
 * the scoped-projection pack prune off the same mechanics). Skills are
 * pruned by whole directory (tier decided by the skill's `SKILL.md`
 * frontmatter); commands by file (own frontmatter). Rules / personas /
 * contexts / templates are core/shared and left intact. Returns
 * `[pruned_count, adjusted_results]` with the pruned paths removed from each
 * tool's `written_paths` so the manifest never records them.
 */
export function prune_modules_by(
    deploy_results: Record<string, DeployTuple>,
    is_pruned: (md_path: string) => boolean,
): [number, Record<string, DeployTuple>] {
    let pruned = 0;
    const adjusted: Record<string, DeployTuple> = {};
    for (const tool_id of Object.keys(deploy_results)) {
        const [written, skipped, status, paths] = deploy_results[tool_id] as DeployTuple;
        const pruned_skill_dirs = new Set<string>();
        for (const p of paths) {
            const parts = p.split(path.sep);
            if (parts.includes('skills')) {
                const i = parts.indexOf('skills');
                if (i + 1 < parts.length) {
                    const skill_root = parts.slice(0, i + 2).join(path.sep);
                    if (!pruned_skill_dirs.has(skill_root)) {
                        const skillmd = path.join(skill_root, 'SKILL.md');
                        if (fs.existsSync(skillmd) && is_pruned(skillmd)) {
                            pruned_skill_dirs.add(skill_root);
                        }
                    }
                }
            }
        }
        const keep: string[] = [];
        const delete_files: string[] = [];
        for (const p of paths) {
            const parts = p.split(path.sep);
            let is_target = false;
            if (parts.includes('skills')) {
                const i = parts.indexOf('skills');
                if (i + 1 < parts.length && pruned_skill_dirs.has(parts.slice(0, i + 2).join(path.sep))) {
                    is_target = true;
                }
            } else if (
                parts.includes('commands') &&
                path.extname(p) === '.md' &&
                is_pruned(p)
            ) {
                is_target = true;
            }
            (is_target ? delete_files : keep).push(p);
        }
        for (const d of pruned_skill_dirs) {
            fs.rmSync(d, { recursive: true, force: true });
        }
        for (const p of delete_files) {
            if (p.split(path.sep).includes('commands') && fs.existsSync(p)) {
                try {
                    fs.unlinkSync(p);
                } catch {
                    // OSError → swallow, mirroring the .py.
                }
            }
        }
        pruned += delete_files.length;
        adjusted[tool_id] = [Math.max(0, written - delete_files.length), skipped, status, keep];
    }
    return [pruned, adjusted];
}

/**
 * Remove lab-tier skills/commands from a completed deploy (core-only).
 *
 * road-to-install-contract-stability Phase 2 Step 2. Thin wrapper over
 * `_prune_modules_by` — see that function for the mechanics.
 */
export function prune_lab_modules(
    deploy_results: Record<string, DeployTuple>,
    lab_ids: Set<string>,
): [number, Record<string, DeployTuple>] {
    return prune_modules_by(deploy_results, (p) => surface_tiers.is_lab_artefact(p, lab_ids));
}
