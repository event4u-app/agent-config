/**
 * Tests for the pre-registered Phase-0 guards
 * (`src/scripts/_lib/harness_evolution_guards.ts`,
 * road-to-governed-harness-evolution steps 0.4, 0.5, 0.6).
 *
 * Each of the three steps states its verify clause as an OBSERVABLE FAILURE —
 * "a run in which a holdout value reaches proposer context exits non-zero", "a
 * run configured past the ceiling exits non-zero before spending", "a synthetic
 * diversity collapse trips the stop". So the load-bearing assertions here are
 * the negative ones; the accepting cases exist so a guard that started refusing
 * everything would not pass either.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    assertWithinBudget,
    BudgetExceededError,
    diversityCollapsed,
    discloseToProposer,
    holdoutUnderpowered,
    HoldoutLeakError,
    STOP_CONDITIONS,
    type DisclosureRecord,
    type FieldVisibility,
} from '../../src/scripts/_lib/harness_evolution_guards.js';
import { MIN_DISCORDANT } from '../../src/scripts/_lib/paired_verdict.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const SCHEMA: FieldVisibility[] = [
    { field: 'candidate_text', visibility: 'proposer-visible' },
    { field: 'task_id', visibility: 'proposer-visible' },
    { field: 'trial_scores', visibility: 'evaluator-private' },
    { field: 'holdout_answer', visibility: 'holdout' },
];

describe('0.4 — the evaluator trust boundary aborts, and names the field', () => {
    it('REFUSES a holdout field and names it', () => {
        const log: DisclosureRecord[] = [];
        expect(() =>
            discloseToProposer({ candidate_text: 'x', holdout_answer: 42 }, SCHEMA, log),
        ).toThrow(HoldoutLeakError);
        try {
            discloseToProposer({ holdout_answer: 42 }, SCHEMA, log);
        } catch (e) {
            expect((e as HoldoutLeakError).field).toBe('holdout_answer');
            expect((e as Error).message).toContain('holdout_answer');
        }
    });

    it('REFUSES an UNDECLARED field — fail closed, never fail open', () => {
        // The failure this pins: adding a field to an observation and
        // forgetting to classify it must not be silently equivalent to
        // publishing it.
        const log: DisclosureRecord[] = [];
        expect(() => discloseToProposer({ newly_added: 1 }, SCHEMA, log)).toThrow(HoldoutLeakError);
    });

    it('releases proposer-visible fields and LOGS each one', () => {
        const log: DisclosureRecord[] = [];
        const out = discloseToProposer(
            { candidate_text: 'x', task_id: 't1', trial_scores: [1, 2] },
            SCHEMA,
            log,
        );
        expect(Object.keys(out).sort()).toEqual(['candidate_text', 'task_id']);
        expect(log.map((r) => r.field).sort()).toEqual(['candidate_text', 'task_id']);
    });

    it('withholds evaluator-private fields WITHOUT throwing — they are not a leak', () => {
        const log: DisclosureRecord[] = [];
        const out = discloseToProposer({ trial_scores: [1, 2] }, SCHEMA, log);
        expect(out).toEqual({});
        expect(log).toEqual([]);
    });
});

describe('0.5 — the budget aborts BEFORE spending', () => {
    const budget = { maxCandidates: 5, maxTrialsPerCandidate: 20, maxSpendCents: 500 };

    it('accepts a plan inside every ceiling', () => {
        expect(() =>
            assertWithinBudget({ candidates: 5, trialsPerCandidate: 20, estimatedSpendCents: 500 }, budget),
        ).not.toThrow();
    });

    it('REFUSES on candidate count, and names the dimension', () => {
        try {
            assertWithinBudget({ candidates: 6, trialsPerCandidate: 1, estimatedSpendCents: 0 }, budget);
            throw new Error('should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(BudgetExceededError);
            expect((e as BudgetExceededError).dimension).toBe('candidates');
        }
    });

    it('REFUSES on trials', () => {
        try {
            assertWithinBudget({ candidates: 1, trialsPerCandidate: 21, estimatedSpendCents: 0 }, budget);
            throw new Error('should have thrown');
        } catch (e) {
            expect((e as BudgetExceededError).dimension).toBe('trials');
        }
    });

    it('REFUSES on spend', () => {
        try {
            assertWithinBudget({ candidates: 1, trialsPerCandidate: 1, estimatedSpendCents: 501 }, budget);
            throw new Error('should have thrown');
        } catch (e) {
            expect((e as BudgetExceededError).dimension).toBe('spend');
        }
    });

    it('fails on the COUNTABLE dimension first when several are over', () => {
        // Actionable without a pricing discussion — see the function's own note.
        try {
            assertWithinBudget({ candidates: 9, trialsPerCandidate: 99, estimatedSpendCents: 9999 }, budget);
            throw new Error('should have thrown');
        } catch (e) {
            expect((e as BudgetExceededError).dimension).toBe('candidates');
        }
    });

    it('the committed budget file matches the ceilings these tests pin', () => {
        // The config is the pre-registration; a test that pinned different
        // numbers would mean the registration and the guard had drifted.
        const doc = JSON.parse(
            fs.readFileSync(path.join(REPO, 'src', 'config', 'harness-evolution-budget.json'), 'utf8'),
        ) as { budget: Record<string, number> };
        expect(doc.budget['max_candidates']).toBe(budget.maxCandidates);
        expect(doc.budget['max_trials_per_candidate']).toBe(budget.maxTrialsPerCandidate);
        expect(doc.budget['max_spend_cents']).toBe(budget.maxSpendCents);
    });
});

describe('0.6 — epistemic stop conditions', () => {
    it('a synthetic diversity collapse trips the stop', () => {
        // The verify clause, literally: identical-after-normalisation candidates.
        expect(diversityCollapsed(['Use the code graph', 'use the  code graph', 'USE THE CODE GRAPH'])).toBe(true);
    });

    it('genuinely distinct candidates do not trip it', () => {
        expect(diversityCollapsed(['use the code graph', 'grep the tree first'])).toBe(false);
    });

    it('a single candidate is a collapse — one candidate measures nothing', () => {
        expect(diversityCollapsed(['only one'])).toBe(true);
    });

    it('holdout underpower is decided against paired_verdict’s DERIVED floor', () => {
        // Not a second hard-coded constant: MIN_DISCORDANT is derived from the
        // exact sign test at ALPHA, and forking it here would fork a derivation.
        expect(holdoutUnderpowered(MIN_DISCORDANT - 1, MIN_DISCORDANT)).toBe(true);
        expect(holdoutUnderpowered(MIN_DISCORDANT, MIN_DISCORDANT)).toBe(false);
    });

    it('every stop condition either names a detector or is explicitly model-carried', () => {
        // Step 0.6's verify clause. The assertion is that no condition is
        // AMBIGUOUS — a missing field would read as enforced.
        expect(STOP_CONDITIONS.length).toBe(4);
        for (const c of STOP_CONDITIONS) {
            expect(c.id).toMatch(/^[a-z-]+$/);
            expect(c.why.length).toBeGreaterThan(40);
            expect(c.detector === null || c.detector.length > 0).toBe(true);
        }
    });

    it('exactly one condition is model-carried, and it is the interference one', () => {
        const carried = STOP_CONDITIONS.filter((c) => c.detector === null).map((c) => c.id);
        expect(carried).toEqual(['cross-component-interference']);
    });
});
