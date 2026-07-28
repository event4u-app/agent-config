/**
 * L0b per-worker token stop-loss (road-to-lean-agent-init Phase 2).
 *
 * The FIXTURE below is the roadmap's acceptance artifact: it proves the
 * partial-result shape (what was found, what remains, suggested next rung)
 * that a budget-hit worker returns inside a `BLOCKED` envelope. The stop-loss
 * composes with the N=3 validation budget and the ADR-109 / response-contract
 * body — it replaces nothing.
 */
import { describe, expect, it } from 'vitest';

import { composeSpawnBrief } from '../../src/scripts/_lib/subagent_spawn.js';
import {
    budgetForTier,
    evaluateWorkerBudget,
    MAX_TOKENS_PER_WORKER,
    validateWorkerPartialResult,
    type WorkerPartialResult,
} from '../../src/scripts/_lib/worker_budget.js';

/** Canonical budget-hit fixture — the observed lk-02 shape stopped at 15k. */
const PARTIAL_RESULT_FIXTURE: WorkerPartialResult = {
    budget_hit: true,
    found: ['src/gateway/types.ts:41', 'src/gateway/adapters/rest.ts:12', 'tests/gateway/input.test.ts:7'],
    remaining: 'Two candidate import sites under src/legacy/ not yet confirmed.',
    suggested_next_rung: 'primitive',
};

describe('per-tier budgets (start values, telemetry-refined)', () => {
    it('lookup-class lite seed is the roadmap-pinned ~15k', () => {
        expect(MAX_TOKENS_PER_WORKER.lite).toBe(15_000);
    });

    it('budgets are strictly increasing by tier and far below the observed 280–327k runaways', () => {
        expect(MAX_TOKENS_PER_WORKER.lite).toBeLessThan(MAX_TOKENS_PER_WORKER.medium);
        expect(MAX_TOKENS_PER_WORKER.medium).toBeLessThan(MAX_TOKENS_PER_WORKER.high);
        expect(MAX_TOKENS_PER_WORKER.high).toBeLessThan(280_000);
    });

    it('inherit resolves via the session tier', () => {
        expect(budgetForTier('inherit', 'medium')).toBe(MAX_TOKENS_PER_WORKER.medium);
        expect(budgetForTier('inherit')).toBe(MAX_TOKENS_PER_WORKER.high);
        expect(budgetForTier('lite')).toBe(MAX_TOKENS_PER_WORKER.lite);
    });
});

describe('budget evaluation', () => {
    it('under budget → no hit', () => {
        const e = evaluateWorkerBudget(9_000, 15_000);
        expect(e.budget_hit).toBe(false);
    });

    it('at/over budget → hit with stop-exploring reason', () => {
        for (const consumed of [15_000, 308_000]) {
            const e = evaluateWorkerBudget(consumed, 15_000);
            expect(e.budget_hit).toBe(true);
            expect(e.reason).toContain('partial result + escalation flag');
        }
    });
});

describe('partial-result fixture — the shape the roadmap requires', () => {
    it('the canonical fixture is valid: found refs + remaining + suggested next rung', () => {
        expect(validateWorkerPartialResult(PARTIAL_RESULT_FIXTURE)).toEqual([]);
    });

    it('budget_hit is the literal escalation flag — false/absent is invalid', () => {
        expect(validateWorkerPartialResult({ ...PARTIAL_RESULT_FIXTURE, budget_hit: false })).not.toEqual([]);
    });

    it('found rejects inline bodies (refs only — spawn-contract privacy floor)', () => {
        const bad = { ...PARTIAL_RESULT_FIXTURE, found: ['line one\nline two of a dumped file body'] };
        const errors = validateWorkerPartialResult(bad);
        expect(errors.some((e) => e.includes('refs only'))).toBe(true);
    });

    it('suggested_next_rung is a closed enum', () => {
        const bad = { ...PARTIAL_RESULT_FIXTURE, suggested_next_rung: 'try-harder' };
        expect(validateWorkerPartialResult(bad)).not.toEqual([]);
    });

    it('remaining must state what is left, never empty', () => {
        expect(validateWorkerPartialResult({ ...PARTIAL_RESULT_FIXTURE, remaining: '' })).not.toEqual([]);
    });
});

describe('spawn-brief integration', () => {
    it('the brief carries the tier-resolved budget', () => {
        const brief = composeSpawnBrief({ task: 'confirm import call sites', max_tokens_per_worker: budgetForTier('lite') });
        expect(brief.max_tokens_per_worker).toBe(15_000);
        expect(brief.warnings).toEqual([]);
    });

    it('invalid budgets are dropped with a warning, never silently widened', () => {
        const brief = composeSpawnBrief({ task: 't', max_tokens_per_worker: -5 });
        expect(brief.max_tokens_per_worker).toBeNull();
        expect(brief.warnings.some((w) => w.includes('max_tokens_per_worker'))).toBe(true);
    });

    it('legacy dispatch (no budget set) stays null — additive, breaks nothing', () => {
        const brief = composeSpawnBrief({ task: 't' });
        expect(brief.max_tokens_per_worker).toBeNull();
    });
});
