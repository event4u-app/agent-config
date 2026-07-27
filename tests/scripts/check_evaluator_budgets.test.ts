/**
 * Evaluator-budget checker (road-to-credible-install Phase 6): absolute
 * budget + the >regression_pct creep rule (fails even under budget), and
 * every check individually red-testable.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { evaluate } from '../../src/scripts/check_evaluator_budgets.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const BUDGETS = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'src', 'config', 'evaluator-budgets.json'), 'utf-8'),
) as { regression_pct: number; budgets: Record<string, { max: number; last_measured: number; method: string }> };

const doc = {
    regression_pct: 10,
    budgets: {
        size_mb: { max: 100, last_measured: 50, method: 'du' },
    },
};

describe('check_evaluator_budgets', () => {
    it('GREEN: under budget and under the creep ceiling', () => {
        expect(evaluate(doc, { size_mb: 52 })).toEqual([]);
    });

    it('RED: absolute budget exceeded', () => {
        const errors = evaluate(doc, { size_mb: 101 });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('exceeds budget');
    });

    it('RED: >10% regression fails even under the absolute budget', () => {
        const errors = evaluate(doc, { size_mb: 60 }); // 20% over last_measured, under max
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('regressed >10%');
    });

    it('RED: missing measurement fails (no silent coverage gap)', () => {
        const errors = evaluate(doc, {});
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('no measurement supplied');
    });

    it('committed budgets: every entry carries max, last_measured and a pinned method', () => {
        expect(Object.keys(BUDGETS.budgets).length).toBeGreaterThanOrEqual(7);
        for (const [name, entry] of Object.entries(BUDGETS.budgets)) {
            expect(entry.max, name).toBeGreaterThan(0);
            expect(entry.last_measured, name).toBeGreaterThan(0);
            expect(entry.method.length, name).toBeGreaterThan(10);
        }
    });
});
