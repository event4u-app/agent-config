// A skill body may shrink, never silently grow —
// `road-to-surfaces-no-gate-reads` Phase 3.
//
// Step 3.2 names the three cases and they are the describe blocks below: raise
// one fixture body by one byte and the check fails; add a `raised` entry and it
// passes; shrink a body and the ceiling is not moved by the check itself.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    BUDGET_REL,
    compare,
    measureBodies,
    nextCeilings,
    readBudget,
    type Budget,
} from '../../src/scripts/check_skill_body_budget.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

const BODIES = { alpha: 1000, beta: 2000 };
const BUDGET: Budget = { ceilings: { alpha: 1000, beta: 2000 }, raised: [] };

describe('check_skill_body_budget — red, then green, 3.2', () => {
    it('red: one byte over the ceiling is a finding', () => {
        const findings = compare({ ...BODIES, alpha: 1001 }, BUDGET);
        expect(findings).toHaveLength(1);
        expect(findings[0]?.skill).toBe('alpha');
        expect(findings[0]?.actual).toBe(1001);
        expect(findings[0]?.ceiling).toBe(1000);
        expect(findings[0]?.reason).toBe('grew-without-a-raise');
    });

    it('green: a `raised` entry covering the new size clears it', () => {
        const budget: Budget = {
            ceilings: BUDGET.ceilings,
            raised: [{ skill: 'alpha', old: 1000, new: 1001, reason: 'one worked example the body could not carry' }],
        };
        expect(compare({ ...BODIES, alpha: 1001 }, budget)).toHaveLength(0);
    });

    it('a `raised` entry with no reason does not clear it', () => {
        // A rise somebody wrote down is a decision. A rise with an empty
        // reason is the drift wearing the decision's shape.
        const budget: Budget = {
            ceilings: BUDGET.ceilings,
            raised: [{ skill: 'alpha', old: 1000, new: 1001, reason: '   ' }],
        };
        const findings = compare({ ...BODIES, alpha: 1001 }, budget);
        expect(findings).toHaveLength(1);
        expect(findings[0]?.reason).toBe('raise-without-a-reason');
    });

    it('a `raised` entry that does not cover the actual size does not clear it', () => {
        const budget: Budget = {
            ceilings: BUDGET.ceilings,
            raised: [{ skill: 'alpha', old: 1000, new: 1001, reason: 'one example' }],
        };
        // Raised to 1001, grew to 1200 — the recorded decision is not a blank
        // cheque for whatever the body becomes later.
        const findings = compare({ ...BODIES, alpha: 1200 }, budget);
        expect(findings).toHaveLength(1);
        expect(findings[0]?.reason).toBe('grew-without-a-raise');
    });

    it('a `raised` entry written against an earlier ceiling does not license later growth', () => {
        // Raised 400 → 5000 once, re-recorded down to 1000 since: the old
        // entry is not a standing allowance up to 5000.
        const budget: Budget = {
            ceilings: BUDGET.ceilings,
            raised: [{ skill: 'alpha', old: 400, new: 5000, reason: 'an earlier growth' }],
        };
        const findings = compare({ ...BODIES, alpha: 1200 }, budget);
        expect(findings.map((f) => f.reason)).toEqual(['raise-does-not-match']);
        expect(nextCeilings({ ...BODIES, alpha: 1200 }, budget).alpha).toBe(1000);
    });

    it('shrinking is never a finding', () => {
        expect(compare({ ...BODIES, alpha: 1 }, BUDGET)).toHaveLength(0);
    });

    it('a skill with no recorded ceiling is not a finding', () => {
        // A new skill gets its ceiling on first landing. Refusing it here
        // would make adding a skill need a second commit to make the first
        // one legal.
        expect(compare({ ...BODIES, gamma: 99999 }, BUDGET)).toHaveLength(0);
    });
});

describe('check_skill_body_budget — the check lowers nothing on its own, 3.1', () => {
    it('a shrink tightens the ceiling on re-record', () => {
        expect(nextCeilings({ ...BODIES, alpha: 400 }, BUDGET).alpha).toBe(400);
    });

    it('a growth does NOT loosen it, even on re-record', () => {
        // The property that makes `--update` safe to run at any time: it
        // cannot be used to launder a rise nobody recorded.
        expect(nextCeilings({ ...BODIES, alpha: 5000 }, BUDGET).alpha).toBe(1000);
    });

    it('a growth covered by a `raised` entry does move the ceiling', () => {
        const budget: Budget = {
            ceilings: BUDGET.ceilings,
            raised: [{ skill: 'alpha', old: 1000, new: 5000, reason: 'the procedure section this skill was missing' }],
        };
        expect(nextCeilings({ ...BODIES, alpha: 5000 }, budget).alpha).toBe(5000);
    });

    it('a deleted skill keeps no ceiling', () => {
        expect(nextCeilings({ beta: 2000 }, BUDGET).alpha).toBeUndefined();
    });
});

describe('check_skill_body_budget — against the real tree', () => {
    it('the budget file exists and covers every skill body', () => {
        const budget = readBudget(REPO);
        expect(budget, `${BUDGET_REL} is missing`).not.toBeNull();
        const bodies = measureBodies(REPO);
        expect(Object.keys(bodies).length).toBeGreaterThan(250);
        const uncovered = Object.keys(bodies).filter((s) => (budget as Budget).ceilings[s] === undefined);
        expect(uncovered, `no ceiling recorded for: ${uncovered.join(', ')}`).toEqual([]);
    });

    it('the live tree is within budget', () => {
        const budget = readBudget(REPO) as Budget;
        const findings = compare(measureBodies(REPO), budget);
        const message = findings.map((f) => `${f.skill} ${String(f.actual)} > ${String(f.ceiling)}`).join('\n');
        expect(findings, message).toHaveLength(0);
    });

    it('SENSITIVITY: the real corpus would red if any body grew', () => {
        // The live check passing says nothing until the same comparison has
        // been shown to fail on this corpus.
        const budget = readBudget(REPO) as Budget;
        const grown = { ...measureBodies(REPO) };
        const first = Object.keys(grown).sort()[0] as string;
        grown[first] = (grown[first] as number) + 1;
        expect(compare(grown, budget)).toHaveLength(1);
    });

    it('the budget file is JSON with both keys and no stray skills', () => {
        const budget = readBudget(REPO) as Budget;
        const bodies = measureBodies(REPO);
        const stray = Object.keys(budget.ceilings).filter((s) => bodies[s] === undefined);
        expect(stray, `ceilings recorded for skills that no longer exist: ${stray.join(', ')}`).toEqual([]);
        expect(Array.isArray(budget.raised)).toBe(true);
    });

    it('every recorded `raised` entry carries a real reason', () => {
        const budget = readBudget(REPO) as Budget;
        for (const r of budget.raised) {
            expect(typeof r.reason === 'string' && r.reason.trim().length > 10, `raise for ${r.skill}`).toBe(true);
            expect(r.new).toBeGreaterThan(r.old);
        }
    });
});

describe('check_skill_body_budget — --update preserves what it did not write', () => {
    it('the real budget file keeps owner, review_by and _comment', () => {
        // The first `--update` of this file DROPPED all three: it wrote a
        // fresh object from the two fields it knew about, and
        // lint_budget_ownership caught the loss on the next CI run. A writer
        // that silently narrows the file it maintains is the same defect
        // class this gate exists to catch in skill bodies.
        const doc = JSON.parse(fs.readFileSync(path.join(REPO, BUDGET_REL), 'utf8')) as Record<string, unknown>;
        expect(typeof doc['owner']).toBe('string');
        expect(String(doc['owner']).trim().length).toBeGreaterThan(0);
        expect(String(doc['review_by'])).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(typeof doc['_comment']).toBe('string');
    });

    it('readBudget carries every other top-level key in `rest`', () => {
        const budget = readBudget(REPO) as Budget;
        expect((budget.rest ?? {})['owner']).toBeDefined();
        expect((budget.rest ?? {})['review_by']).toBeDefined();
        expect((budget.rest ?? {})['ceilings']).toBeUndefined();
        expect((budget.rest ?? {})['raised']).toBeUndefined();
    });
});

describe('check_skill_body_budget — the file on disk', () => {
    it('is committed under src/config and is valid JSON', () => {
        const abs = path.join(REPO, BUDGET_REL);
        expect(fs.existsSync(abs)).toBe(true);
        expect(() => JSON.parse(fs.readFileSync(abs, 'utf8'))).not.toThrow();
    });
});

describe('check_skill_body_budget — procedure step files carry their own ceilings (4.3)', () => {
    it('measures every references/steps/*.md under its own key', () => {
        const bodies = measureBodies(REPO);
        const stepKeys = Object.keys(bodies).filter((k) => k.includes('/references/steps/'));
        expect(stepKeys.length).toBeGreaterThan(0);
        for (const k of stepKeys) expect(k).toMatch(/^[a-z0-9-]+\/references\/steps\/[^/]+\.md$/);
    });

    it('a step file that grows past its ceiling is a finding, like a head', () => {
        const key = 'alpha/references/steps/01-a.md';
        const budget: Budget = { ceilings: { alpha: 1000, [key]: 300 }, raised: [] };
        const findings = compare({ alpha: 1000, [key]: 301 }, budget);
        expect(findings.map((f) => f.skill)).toEqual([key]);
    });
});
