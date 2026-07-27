/**
 * Budget-ownership lint (road-to-credible-install Phase 6.2): a budget
 * without an owner + review date fails; the seeded date-less budget is the
 * red case the roadmap pre-registered.
 */
import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { checkBudgetDoc, budgetFiles, main } from '../../src/scripts/lint_budget_ownership.js';

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
