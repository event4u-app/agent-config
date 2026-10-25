/**
 * A pack-scoped safety floor ships wherever a skill that depends on it can ship
 * (council 2026-10-25, D14 revisit of road-to-a-setup-that-decides-itself).
 *
 * claude-code and codex receive every skill whatever the active packs are, so a
 * floor gated on its pack left `contract-review` installed without the
 * `legal-safety-floor` it obeys. The rule scope is host-blind, so a
 * consequence-class rule whose `routes_to` names a skill passes the pack axis.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { excludedRuleBasenames, type RuleScope } from '../../src/install/rule_scope.js';
import { parseFrontmatter } from '../../src/install/ruleInScope.js';

const REPO = path.resolve(__dirname, '..', '..');
const RULES = path.join(REPO, 'src', 'rules');
const SKILLS = path.join(REPO, 'src', 'skills');

/** The default install: no pack active. */
const NO_PACKS: RuleScope = { workspaces: null, packs: [], roles: null };

function meta(rule: string): Record<string, unknown> {
    return parseFrontmatter(fs.readFileSync(path.join(RULES, rule), 'utf-8'))[0];
}

function guardedSkills(rule: string): string[] {
    const routes = meta(rule)['routes_to'];
    return (Array.isArray(routes) ? routes : [])
        .map(String)
        .filter((r) => r.startsWith('skill:'))
        .map((r) => r.slice('skill:'.length));
}

const floors = fs
    .readdirSync(RULES)
    .filter((f) => f.endsWith('.md') && typeof meta(f)['consequence_class'] === 'string' && guardedSkills(f).length > 0);

describe('a safety floor follows the skills it guards', () => {
    it('ships the legal, finance and strategy floors with no pack active', () => {
        const excluded = excludedRuleBasenames(RULES, NO_PACKS);
        for (const f of ['legal-safety-floor.md', 'finance-safety-floor.md', 'strategy-safety-floor.md']) {
            expect(excluded).not.toContain(f);
        }
    });

    it('keeps a consequence rule that guards no skill on its pack', () => {
        expect(excludedRuleBasenames(RULES, NO_PACKS)).toContain('image-likeness-and-rights.md');
    });

    it('names only skills that exist', () => {
        for (const f of floors) {
            for (const s of guardedSkills(f)) expect(fs.existsSync(path.join(SKILLS, s, 'SKILL.md')), `${f} -> ${s}`).toBe(true);
        }
    });

    it('lists every skill that says it obeys the floor', () => {
        const ids = floors.map((f) => f.replace(/\.md$/, ''));
        for (const skill of fs.readdirSync(SKILLS)) {
            const file = path.join(SKILLS, skill, 'SKILL.md');
            if (!fs.existsSync(file)) continue;
            const text = fs.readFileSync(file, 'utf-8');
            for (const id of ids) {
                if (new RegExp(`[Oo]beys? \`?${id}\\b`).test(text)) {
                    expect(guardedSkills(`${id}.md`), `${skill} obeys ${id}`).toContain(skill);
                }
            }
        }
    });
});
