/**
 * Install-time rule scoping — Pipeline B of consumer-scoped rule projection
 * (road-to-request-scoped-rule-load Phase 1b).
 *
 * The projection filter (`rule_in_scope`, condense.ts) covered only the
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

import { rule_in_scope } from '../scripts/condense.js';

/**
 * Rules excluded from EVERY consumer install path regardless of scope —
 * same treatment on project and global (see module doc for the decision).
 */
export const COMPAT_ALWAYS_EXCLUDED: readonly string[] = ['source-of-truth.md'];

/**
 * Workspace/pack/role scope read from consumer settings. `null` axis =
 * unset. `roles` is optional (additive — road-to-lean-agent-init Phase 4,
 * the subagent role-scoping axis) so pre-existing `RuleScope` literals
 * without the field keep compiling unchanged.
 */
export interface RuleScope {
    readonly workspaces: readonly string[] | null;
    readonly packs: readonly string[] | null;
    readonly roles?: readonly string[] | null;
}

export const LEGACY_ALL: RuleScope = { workspaces: null, packs: null };

/** Non-empty string-array extraction; anything else → null (legacy-all). */
function _list(value: unknown): readonly string[] | null {
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
export function ruleScopeFromSettings(settings: Record<string, unknown>): RuleScope {
    const proj = settings['projection'];
    if (typeof proj !== 'object' || proj === null || Array.isArray(proj)) {
        return LEGACY_ALL;
    }
    const p = proj as Record<string, unknown>;
    return {
        workspaces: _list(p['rule_workspaces']),
        packs: _list(p['rule_packs']),
        roles: _list(p['rule_roles']),
    };
}

/**
 * Whether a rule FILE (path into the shipped `dist/agent-src/rules` tree)
 * arrives in a consumer install under `scope`.
 *
 * Delegates the scoping decision to the projection-path predicate
 * (`rule_in_scope` — kernel always ships, untagged axes fail safe) and adds
 * the compat exclusion on top. Non-rule files (non-`.md`) always arrive.
 */
export function ruleFileArrives(sourcePath: string, scope: RuleScope): boolean {
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
export function excludedRuleBasenames(rulesDir: string, scope: RuleScope): string[] {
    let entries: string[];
    try {
        entries = fs.readdirSync(rulesDir).sort();
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const name of entries) {
        if (!name.endsWith('.md')) {
            continue;
        }
        const full = path.join(rulesDir, name);
        try {
            if (!fs.statSync(full).isFile()) {
                continue;
            }
        } catch {
            continue;
        }
        if (!ruleFileArrives(full, scope)) {
            out.push(name);
        }
    }
    return out;
}
