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
import { RULE_PACKS_AUTO, consumerRuleWorkspaces, resolve_rule_pack_scope } from '../scripts/_lib/scoped_projection.js';
import { rule_in_scope } from './ruleInScope.js';
/**
 * Rules excluded from EVERY consumer install path regardless of scope —
 * same treatment on project and global (see module doc for the decision).
 */
export const COMPAT_ALWAYS_EXCLUDED = ['source-of-truth.md'];
export const LEGACY_ALL = { workspaces: null, packs: null };
/** Non-empty string-array extraction; anything else → null (legacy-all). */
export function _list(value) {
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
    // The WORKSPACE axis is derived from the pack vocabulary since ADR-293 step
    // 4.6, so it no longer depends on a `projection` block existing at all — a
    // rule is not a setting, and a settings file that happens to omit a section
    // cannot switch one off. The role axis is still read, so a missing block
    // leaves it inactive exactly as before.
    const derivedWorkspaces = packageRoot === undefined ? null : consumerRuleWorkspaces(packageRoot);
    // The PACK axis is derived too since step 4.9 (owner directive 2026-10-24):
    // the active-pack set, the same set the skill/command prune uses, whether or
    // not a settings file says anything. For one release window an explicitly
    // written legacy `projection.rule_packs` still wins — see `legacyRulePacks`.
    const proj = settings['projection'];
    const p = typeof proj === 'object' && proj !== null && !Array.isArray(proj) ? proj : {};
    const legacy = legacyRulePacks(p);
    const packs = packageRoot === undefined
        ? legacy === undefined
            ? null
            : _list(legacy)
        : resolve_rule_pack_scope(legacy === undefined ? RULE_PACKS_AUTO : legacy, packageRoot, _list(_runtimeActivePacks(settings)) ?? []);
    return {
        // DERIVED since ADR-293 step 4.6, not read. `projection.rule_workspaces`
        // carried this list as a settings default — the nine consumer workspace
        // ids, re-typed into the template and needing a re-type whenever a pack
        // arrived with a new one. What it encoded is a RULE: maintainer-only
        // rules never project to a consumer. `consumerRuleWorkspaces` derives
        // exactly that from the pack vocabulary, and the derived set equals the
        // old default (asserted in `consumer_rule_workspaces.test.ts`).
        // Without a package root there is no vocabulary to read, so the axis is
        // INACTIVE rather than empty — the same degradation `rule_packs` makes
        // above, and the same reason: a package that cannot read its own pack
        // list must ship more than it should, never less.
        workspaces: derivedWorkspaces,
        packs,
        roles: _list(p['rule_roles']),
    };
}
/**
 * The release window in which an explicitly written `projection.rule_packs`
 * still decides (step 4.9). When it closes, delete {@link legacyRulePacks} and
 * its caller's branch; the tombstone in `REMOVED_KEYS` then names the key as
 * ignored.
 */
export const RULE_PACKS_LEGACY_WINDOW = 'one release window after the 2026-10-24 retirement of projection.rule_packs';
/**
 * The legacy `projection.rule_packs` value while the window is open, or
 * `undefined` when none was written. An explicitly written value wins over the
 * derivation — a consumer who chose a scope does not lose it silently on the
 * upgrade — and `doctor` names how it differs (`rulePacksLegacyCheck`).
 */
export function legacyRulePacks(projection) {
    return Object.prototype.hasOwnProperty.call(projection, 'rule_packs') ? projection['rule_packs'] : undefined;
}
/** `runtime.active_packs` overlay from an already-parsed settings object. */
export function _runtimeActivePacks(settings) {
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