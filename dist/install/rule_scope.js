/**
 * Install-time rule scoping for the consumer install
 * (road-to-request-scoped-rule-load Phase 1b).
 *
 * Naming: this is the CONSUMER INSTALL path, not `docs/architecture.md`'s
 * Pipeline B (which is the `.augment/` projection). Earlier drafts called it
 * "Pipeline B" and collided with that name; use "the consumer install" here.
 *
 * The projection filter (`rule_in_scope`, now `shared/ruleInScope.ts`) covered only the
 * maintainer projection; the consumer install pipeline shipped rules
 * unfiltered (dead `EXCLUDE_RULES` in install.sh; no exclude at all on the
 * global payload). This module is the ONE scoping surface both install
 * paths consume — it deliberately re-uses `rule_in_scope` so the install
 * semantics can never drift from the projection semantics.
 *
 * ## The `source-of-truth.md` decision (Phase 1b Step 2 — recorded here)
 *
 * Before this module, `install.sh` excluded `source-of-truth.md` from
 * PROJECT installs (hardcoded name) while the GLOBAL payload shipped it —
 * the documented contradiction. Decision: the rule is excluded from BOTH
 * consumer paths, always (even under legacy-all). Rationale: its Iron Law
 * ("NEVER EDIT ANY GENERATED PROJECTION … ALWAYS WORK IN src/") describes
 * THIS repository's build layout; in a consumer project there is no `src/`
 * authoring tree and the installed files ARE the working surface — the rule
 * is not merely useless there, it actively forbids legitimate consumer
 * edits. Shipping it globally was the bug; project installs had it right.
 * The compat list below is the pre-flip carrier of that decision; once the
 * Phase-1 human gate flips consumer defaults to scoped, the rule drops out
 * via its maintainer-only workspace tag and this list can retire.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolve_rule_pack_scope } from '../scripts/_lib/scoped_projection.js';
import { rule_in_scope } from './ruleInScope.js';
/**
 * Rules excluded from EVERY consumer install path regardless of scope —
 * same treatment on project and global (see module doc for the decision).
 */
export const COMPAT_ALWAYS_EXCLUDED = ['source-of-truth.md'];
export const LEGACY_ALL = { workspaces: null, packs: null };
/** Non-empty string-array extraction; anything else → null (legacy-all). */
function _list(value) {
    if (Array.isArray(value) && value.length > 0) {
        return value.map((v) => String(v));
    }
    return null;
}
/**
 * Extract `projection.rule_workspaces` / `projection.rule_packs` from an
 * already-parsed settings object (same key contract as condense's
 * `_read_projection_list` — absent / empty = legacy-all).
 */
export function ruleScopeFromSettings(settings, packageRoot) {
    const proj = settings['projection'];
    if (typeof proj !== 'object' || proj === null || Array.isArray(proj)) {
        return LEGACY_ALL;
    }
    const p = proj;
    // `rule_packs: auto` derives the active-pack set — the SAME set the
    // skill/command prune uses — so the rule axis cannot drift from the
    // artefact axis. Resolving it needs the package root (packs.yml lives
    // there); without one the sentinel degrades to the inactive axis rather
    // than to an empty set, which would prune every pack-tagged rule.
    const packs = packageRoot === undefined
        ? _list(p['rule_packs'])
        : resolve_rule_pack_scope(p['rule_packs'], packageRoot, _list(_runtimeActivePacks(settings)) ?? []);
    return {
        workspaces: _list(p['rule_workspaces']),
        packs,
        roles: _list(p['rule_roles']),
    };
}
/** `runtime.active_packs` overlay from an already-parsed settings object. */
function _runtimeActivePacks(settings) {
    const rt = settings['runtime'];
    return typeof rt === 'object' && rt !== null && !Array.isArray(rt)
        ? rt['active_packs']
        : null;
}
/**
 * Whether a rule FILE (path into the shipped `dist/agent-src/rules` tree)
 * arrives in a consumer install under `scope`.
 *
 * Delegates the scoping decision to the projection-path predicate
 * (`rule_in_scope` — kernel always ships, untagged axes fail safe) and adds
 * the compat exclusion on top. Non-rule files (non-`.md`) always arrive.
 */
export function ruleFileArrives(sourcePath, scope) {
    if (!sourcePath.endsWith('.md')) {
        return true;
    }
    const basename = path.basename(sourcePath);
    if (COMPAT_ALWAYS_EXCLUDED.includes(basename)) {
        return false;
    }
    return rule_in_scope(sourcePath, scope.workspaces, scope.packs, scope.roles ?? null);
}
/**
 * Basenames from `rulesDir` that are EXCLUDED under `scope` — the shape the
 * bash installer consumes (one basename per line via the CLI below).
 */
export function excludedRuleBasenames(rulesDir, scope) {
    let entries;
    try {
        entries = fs.readdirSync(rulesDir).sort();
    }
    catch {
        return [];
    }
    const out = [];
    for (const name of entries) {
        if (!name.endsWith('.md')) {
            continue;
        }
        const full = path.join(rulesDir, name);
        try {
            if (!fs.statSync(full).isFile()) {
                continue;
            }
        }
        catch {
            continue;
        }
        if (!ruleFileArrives(full, scope)) {
            out.push(name);
        }
    }
    return out;
}
//# sourceMappingURL=rule_scope.js.map