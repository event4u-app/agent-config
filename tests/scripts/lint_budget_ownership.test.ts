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
} from '../../src/scripts/lint_budget_ownership.js';

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
