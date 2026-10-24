/**
 * The doctor half of step 4.9 of road-to-a-setup-that-decides-itself, kept out
 * of `rule_scope.ts` because that module is in the hook dispatch bundle and this
 * one runs only from `doctor`.
 */
import * as fs from 'node:fs';

import * as YAML from 'yaml';

import { RULE_PACKS_AUTO, resolve_rule_pack_scope } from '../scripts/_lib/scoped_projection.js';
import { RULE_PACKS_LEGACY_WINDOW, _list, _runtimeActivePacks, legacyRulePacks } from './rule_scope.js';

/**
 * The doctor half of step 4.9: whether any of `settingsFiles` (project and
 * user-global) still carries a legacy `projection.rule_packs`, and how the scope
 * it selects differs from the derived active-pack set.
 */
export function rulePacksLegacyCheck(
    settingsFiles: readonly string[],
    packageRoot: string,
): { id: string; status: 'ok' | 'warn'; message: string; remedy: string } {
    const id = 'rule-packs-legacy';
    for (const file of settingsFiles) {
        let doc: unknown;
        try {
            doc = YAML.parse(fs.readFileSync(file, 'utf8'));
        } catch {
            continue;
        }
        if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) continue;
        const proj = (doc as Record<string, unknown>)['projection'];
        if (typeof proj !== 'object' || proj === null || Array.isArray(proj)) continue;
        const legacy = legacyRulePacks(proj as Record<string, unknown>);
        if (legacy === undefined) continue;
        const active = _list(_runtimeActivePacks(doc as Record<string, unknown>)) ?? [];
        const derived = resolve_rule_pack_scope(RULE_PACKS_AUTO, packageRoot, active) ?? [];
        const chosen = resolve_rule_pack_scope(legacy, packageRoot, active);
        const remedy = `delete projection.rule_packs from ${file} to take the derived set; it is read for ${RULE_PACKS_LEGACY_WINDOW}, then ignored`;
        if (chosen === null) {
            return { id, status: 'warn', message: `${file}: projection.rule_packs keeps the rule pack axis inactive, where the derived set would scope it to ${derived.join(', ')}`, remedy };
        }
        const plus = chosen.filter((x) => !derived.includes(x)).map((x) => `+${x}`);
        const minus = derived.filter((x) => !chosen.includes(x)).map((x) => `-${x}`);
        if (plus.length === 0 && minus.length === 0) {
            return { id, status: 'ok', message: `${file}: projection.rule_packs equals the derived active-pack set; it can be deleted`, remedy: '' };
        }
        return { id, status: 'warn', message: `${file}: projection.rule_packs differs from the derived active-pack set: ${[...plus, ...minus].join(' ')}`, remedy };
    }
    return { id, status: 'ok', message: 'no projection.rule_packs written; the rule pack axis is derived from the active-pack set', remedy: '' };
}

