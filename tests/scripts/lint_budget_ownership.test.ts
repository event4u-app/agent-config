/**
 * Budget-ownership lint (road-to-credible-install Phase 6.2): a budget
 * without an owner + review date fails; the seeded date-less budget is the
 * red case the roadmap pre-registered.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
    checkBudgetDoc,
    checkBudgetRows,
    budgetFiles,
    main,
    GOVERNED_NON_JSON,
    parseBudgetDoc,
} from '../../src/scripts/lint_budget_ownership.js';
import * as os from 'node:os';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'cost-parity-budget');

function readFixture(name: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf-8')) as Record<
        string,
        unknown
    >;
}

describe('lint_budget_ownership', () => {
    it('RED: a budget without a review date fails', () => {
        const errors = checkBudgetDoc('x-budget.json', { owner: 'maintainer' });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('review_by');
    });

    it('RED: a budget without an owner fails', () => {
        const errors = checkBudgetDoc('x-budget.json', { review_by: '2027-01-01' });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('owner');
    });

    it('GREEN: owner + valid review date passes', () => {
        expect(checkBudgetDoc('x-budget.json', { owner: 'maintainer', review_by: '2027-07-27' })).toEqual([]);
    });

    it('GREEN: every committed budget config passes the lint', () => {
        expect(budgetFiles().length).toBeGreaterThanOrEqual(1);
        expect(main()).toBe(0);
    });
});

describe('lint_budget_ownership — row schema (cost-parity § 1.2b/1.3)', () => {
    it('RED: the named negative fixture — `revised_from` without evidence — is rejected', () => {
        const errors = checkBudgetRows(
            'revised-without-evidence.budget.json',
            readFixture('revised-without-evidence.budget.json'),
        );
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('revision_evidence');
        expect(errors[0]).toContain('median_final_context_tokens');
    });

    it('RED: a row without a `source` is rejected — no untraceable baseline', () => {
        const errors = checkBudgetRows('x-budget.json', {
            schema_version: 1,
            registered_at: '2026-08-10',
            row_schema: { required_row_fields: ['id', 'source'] },
            rows: [{ id: 'r1' }],
        });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('source');
    });

    it('RED: an empty `source` string is rejected, not just a missing key', () => {
        const errors = checkBudgetRows('x-budget.json', {
            schema_version: 1,
            registered_at: '2026-08-10',
            row_schema: { required_row_fields: ['id', 'source'] },
            rows: [{ id: 'r1', source: '   ' }],
        });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('traceable origin');
    });

    it('RED: `revisable: false` is rejected — an unrevisable target is not honest-null', () => {
        const errors = checkBudgetRows('x-budget.json', {
            schema_version: 1,
            registered_at: '2026-08-10',
            row_schema: { required_row_fields: ['id'] },
            rows: [{ id: 'r1', revisable: false }],
        });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('revisable');
    });

    it('GREEN: a revision WITH an evidence pointer passes', () => {
        const doc = readFixture('revised-without-evidence.budget.json');
        const rows = doc['session_cost_targets'] as Record<string, unknown>[];
        rows[0]!['revision_evidence'] = 'agents/evidence/analysis/some-note.md';
        expect(checkBudgetRows('x.json', doc)).toEqual([]);
    });

    it('GREEN: a file that declares no `row_schema` is untouched by the row checks', () => {
        expect(checkBudgetRows('legacy-budget.json', { owner: 'maintainer', rows: [{ nope: 1 }] })).toEqual([]);
    });

    it('GREEN: the committed cost-parity budget satisfies the row schema', () => {
        const doc = JSON.parse(
            fs.readFileSync(path.join(REPO_ROOT, 'src', 'config', 'cost-parity-budget.json'), 'utf-8'),
        ) as Record<string, unknown>;
        expect(checkBudgetRows('src/config/cost-parity-budget.json', doc)).toEqual([]);
    });
});

/**
 * `b-budgets-yml-outside-ownership` (road-to-standing-payload-truth Phase 3.1).
 *
 * The council refused a widened `*budget*.{json,yml}` glob for two reasons, and
 * these tests pin both: a governed non-JSON budget is an explicit DECISION, not a
 * filename coincidence, and the read must dispatch on extension because the old
 * unconditional `JSON.parse` would have reported the very file the extension was
 * written for as `unparseable`.
 */
describe('governed non-JSON budgets — explicit list, never a widened glob', () => {
    const CONFIG_DIR = path.join(REPO_ROOT, 'src', 'config');

    it('budgets.yml is in the corpus', () => {
        const rels = budgetFiles(CONFIG_DIR).map((f) => path.basename(f));
        expect(rels).toContain('budgets.yml');
    });

    it('the corpus is 13 — the twelve JSON budgets plus the one named YAML', () => {
        // A floor AND a ceiling: a drop means src/config/ moved, and a silent rise
        // is exactly the glob-widening failure this mechanism exists to prevent.
        //
        // 12 -> 13 on 2026-08-30: `turnaround-budget.json` joined, registered by
        // road-to-agent-turnaround 1.2 with `owner` and `review_by` as
        // lint_budget_ownership requires. Raising this number is legitimate ONLY
        // alongside a budget that clears that linter — which is why the count
        // lives here rather than being derived from the glob it guards.
        expect(budgetFiles(CONFIG_DIR)).toHaveLength(13);
    });

    it('an UNLISTED *budget*.yml is not silently included', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-corpus-'));
        try {
            fs.writeFileSync(path.join(dir, 'rogue-budget.yml'), 'owner: nobody\n', 'utf-8');
            fs.writeFileSync(path.join(dir, 'real-budget.json'), '{"owner":"x"}', 'utf-8');
            fs.writeFileSync(path.join(dir, 'budgets.yml'), 'owner: maintainer\n', 'utf-8');
            const got = budgetFiles(dir).map((f) => path.basename(f)).sort();
            // `budgets.yml` joins because it is NAMED; `rogue-budget.yml` does not,
            // although a widened glob would have taken both.
            expect(got).toEqual(['budgets.yml', 'real-budget.json']);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('the governed list is the decision surface, and it is short on purpose', () => {
        expect(GOVERNED_NON_JSON).toEqual(['budgets.yml']);
    });

    it('parsing dispatches on extension — the defect that made a glob unworkable', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-parse-'));
        try {
            const yml = path.join(dir, 'budgets.yml');
            fs.writeFileSync(yml, "owner: maintainer\nreview_by: '2027-08-24'\n", 'utf-8');
            expect(parseBudgetDoc(yml)).toMatchObject({ owner: 'maintainer' });

            const json = path.join(dir, 'a-budget.json');
            fs.writeFileSync(json, '{"owner":"maintainer"}', 'utf-8');
            expect(parseBudgetDoc(json)).toMatchObject({ owner: 'maintainer' });

            // A YAML scalar or list is not a budget document — refused, not coerced.
            const bad = path.join(dir, 'scalar.yml');
            fs.writeFileSync(bad, 'just-a-string\n', 'utf-8');
            expect(() => parseBudgetDoc(bad)).toThrow(/not a mapping/);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('budgets.yml carries owner and review_by, and a missing one fails', () => {
        const doc = parseBudgetDoc(path.join(CONFIG_DIR, 'budgets.yml'));
        expect(doc['owner']).toBe('maintainer');
        expect(doc['review_by']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        // Sensitivity: strip each field and confirm the checker names it.
        for (const field of ['owner', 'review_by']) {
            const stripped = { ...doc };
            delete stripped[field];
            const errs = checkBudgetDoc('src/config/budgets.yml', stripped);
            expect(errs.join(' '), `dropping ${field} must be reported`).toContain(field);
        }
    });
});
