/**
 * The high-consequence rule class — road-to-rule-laws-that-can-stand 2.1.
 *
 * The criterion is prose and cannot be unit-tested: whether a rule's law
 * governs an irreversible external action is a reading, not a computation. What
 * CAN be checked is everything that makes the reading falsifiable, and that is
 * what this file asserts:
 *
 *   the criterion is published where an author meets it (the rule schema);
 *   every member names one of its three clauses, in its own frontmatter;
 *   the frontmatter and the class config agree, in both directions;
 *   every id in the file is a real routed rule, so the list was walked rather
 *       than remembered;
 *   every member can carry its law in a stub, or is recorded under `no_stub`
 *       with the reason it cannot;
 *   the rejected near-misses carry a reason each, so a reader can disagree with
 *       a specific sentence rather than with a vibe.
 *
 * The last one is the point of the whole file. A class with no recorded
 * rejections is indistinguishable from a list someone chose first.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    CLAUSES,
    declaredClause,
    readConsequenceClass,
    stubLawIds,
} from '../../src/scripts/_lib/rule_consequence_class.js';
import { lawText, ruleBody } from '../../src/scripts/_lib/rule_law_section.js';
import { kernelRuleIds, LAW_HARD_CHARS, routedRuleIds } from '../../src/scripts/lint_rule_law_section.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const cfg = readConsequenceClass(REPO_ROOT);
const routed = new Set(routedRuleIds(REPO_ROOT));

function ruleText(id: string): string {
    return fs.readFileSync(path.join(REPO_ROOT, 'src', 'rules', `${id}.md`), 'utf-8');
}

describe('the criterion is published where an author meets it', () => {
    const schema = JSON.parse(
        fs.readFileSync(path.join(REPO_ROOT, 'src/scripts/schemas/rule.schema.json'), 'utf-8'),
    ) as { properties: Record<string, { enum?: string[]; description?: string }> };

    it('is the `consequence_class` property of the rule schema, with exactly three clauses', () => {
        const prop = schema.properties.consequence_class;
        expect(prop, 'the schema must carry the criterion').toBeDefined();
        expect(prop?.enum).toEqual([...CLAUSES]);
    });

    it('states all three clauses and the negative half, so it can be applied and refused', () => {
        const d = schema.properties.consequence_class?.description ?? '';
        for (const clause of CLAUSES) {
            expect(d, `the criterion must define ${clause}`).toContain(clause);
        }
        // Without the negative half every rule is "important" and the class is
        // the whole corpus — the overshoot the roadmap's risk register names.
        expect(d).toMatch(/NOT\s+high-consequence/);
    });

    it('is the config\'s declared source, so the two cannot drift apart silently', () => {
        expect(cfg.criterion_ref).toContain('rule.schema.json');
        expect(cfg.criterion_ref).toContain('consequence_class');
    });
});

describe('the class is what the criterion produced', () => {
    it('is not empty and does not swallow the corpus', () => {
        const members = Object.keys(cfg.members);
        expect(members.length).toBeGreaterThan(0);
        // A class over half the routed corpus is a criterion to narrow, not a
        // ceiling to raise — the roadmap's own words for this risk.
        expect(members.length).toBeLessThan(routed.size / 2);
    });

    it('names only real routed rules — in members, no_stub and excluded alike', () => {
        for (const id of Object.keys(cfg.members)) {
            expect(routed.has(id), `member ${id} is not a routed rule`).toBe(true);
        }
        for (const id of Object.keys(cfg.no_stub)) {
            expect(cfg.members[id], `no_stub ${id} must also be a member`).toBeDefined();
        }
        for (const id of Object.keys(cfg.excluded)) {
            expect(routed.has(id), `excluded ${id} is not a routed rule`).toBe(true);
            expect(cfg.members[id], `${id} cannot be both a member and excluded`).toBeUndefined();
        }
    });

    it('gives every member one clause and a reason that reads as a sentence', () => {
        for (const [id, row] of Object.entries(cfg.members)) {
            expect(CLAUSES, `${id} clause`).toContain(row.clause);
            expect(row.why.length, `${id} needs a real why`).toBeGreaterThan(40);
        }
    });

    it('records a reason for every near-miss it rejected', () => {
        expect(Object.keys(cfg.excluded).length).toBeGreaterThan(0);
        for (const [id, reason] of Object.entries(cfg.excluded)) {
            expect(reason.length, `${id} needs a real rejection reason`).toBeGreaterThan(40);
        }
    });

    it('excludes the kernel, which is never thinned and so never needs a stub law', () => {
        for (const id of kernelRuleIds(REPO_ROOT)) {
            expect(cfg.members[id], `kernel rule ${id} must not be a class member`).toBeUndefined();
        }
    });
});

describe('each member records its clause in its own frontmatter', () => {
    it('declares the same clause the class config gives it', () => {
        for (const [id, row] of Object.entries(cfg.members)) {
            expect(declaredClause(ruleText(id)), `${id} frontmatter clause`).toBe(row.clause);
        }
    });

    it('no rule outside the class declares one — the key is not decoration', () => {
        for (const id of routed) {
            if (cfg.members[id] !== undefined) continue;
            expect(declaredClause(ruleText(id)), `${id} declares a clause but is not a member`).toBeNull();
        }
    });
});

describe('every member can carry its law, or says why it cannot', () => {
    it('a member outside no_stub has a law section under the hard ceiling', () => {
        for (const id of stubLawIds(cfg)) {
            const law = lawText(ruleBody(ruleText(id)));
            expect(law, `${id} is a class member with no law section`).not.toBeNull();
            expect((law as string).length, `${id} law section`).toBeLessThanOrEqual(LAW_HARD_CHARS);
        }
    });

    it('a no_stub entry really cannot stand — missing law, or over the ceiling', () => {
        for (const [id, row] of Object.entries(cfg.no_stub)) {
            expect(row.reason.length, `${id} needs a real reason`).toBeGreaterThan(40);
            const law = lawText(ruleBody(ruleText(id)));
            const blocked = law === null || law.length > LAW_HARD_CHARS;
            expect(blocked, `${id} can carry its law — remove it from no_stub`).toBe(true);
        }
    });
});
