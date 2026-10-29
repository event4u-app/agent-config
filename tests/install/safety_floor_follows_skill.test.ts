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
        const excluded = new Set(excludedRuleBasenames(RULES, NO_PACKS));
        const unguarded = fs
            .readdirSync(RULES)
            .filter((f) => f.endsWith('.md') && typeof meta(f)['consequence_class'] === 'string' && guardedSkills(f).length === 0)
            .filter((f) => Array.isArray(meta(f)['packs']));
        expect(unguarded.length).toBeGreaterThan(0);
        for (const f of unguarded) expect(excluded.has(f), f).toBe(true);
    });

    it('ships the image floor with no pack active, since six skills link it', () => {
        expect(excludedRuleBasenames(RULES, NO_PACKS)).not.toContain('image-likeness-and-rights.md');
        // Every skill that names the rule is routed, so dropping one route fails here.
        const naming = fs.readdirSync(SKILLS).filter((d) => {
            const f = path.join(SKILLS, d, 'SKILL.md');
            return fs.existsSync(f) && fs.readFileSync(f, 'utf-8').includes('image-likeness-and-rights');
        });
        expect(naming.length).toBeGreaterThan(0);
        expect([...guardedSkills('image-likeness-and-rights.md')].sort()).toEqual(naming.sort());
    });

    it('names only skills that exist', () => {
        for (const f of floors) {
            for (const s of guardedSkills(f)) expect(fs.existsSync(path.join(SKILLS, s, 'SKILL.md')), `${f} -> ${s}`).toBe(true);
        }
    });

    it('ships every pack-scoped consequence rule a skill says it obeys, with no pack active', () => {
        const excluded = new Set(excludedRuleBasenames(RULES, NO_PACKS));
        const consequence = fs
            .readdirSync(RULES)
            .filter((f) => f.endsWith('.md') && typeof meta(f)['consequence_class'] === 'string')
            .map((f) => f.replace(/\.md$/, ''));
        let obeyed = 0;
        for (const skill of fs.readdirSync(SKILLS)) {
            const file = path.join(SKILLS, skill, 'SKILL.md');
            if (!fs.existsSync(file)) continue;
            const text = fs.readFileSync(file, 'utf-8');
            for (const id of consequence) {
                if (!new RegExp(`[Oo]beys? \`?${id}\\b`).test(text)) continue;
                obeyed += 1;
                expect(excluded.has(`${id}.md`), `${skill} obeys ${id}, which a no-pack install drops`).toBe(false);
            }
        }
        expect(obeyed).toBeGreaterThan(0);
    });
});
