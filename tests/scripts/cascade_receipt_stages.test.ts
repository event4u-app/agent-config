/**
 * The receipt-bearing half of the evaluation cascade's stage list.
 *
 * `road-to-governed-evidence-production` step 1.1, second conjunct: *"the stage
 * list can produce the Phase 1 classification"*, and AC-1's sharper wording —
 * *"the evaluation cascade's stage list can assign all four Phase 1 families
 * rather than two."*
 *
 * That is a claim about the STAGE LIST, and it is what this file asserts: each
 * of `content`, `activation`, `adherence` and `unknown` is reachable through
 * `runCascade`, each from the side of the list entitled to assign it. The
 * companion file `activation_receipt_producer.test.ts` asserts the other half —
 * that three of the four are reachable from real filesystem observation and that
 * `adhered` has no admitted source, which is a COVERAGE fact and not a stage-list
 * one.
 */
import { describe, expect, it } from 'vitest';

import {
    CASCADE_STAGES,
    PREFIX_ASSIGNABLE_FAMILIES,
    RECEIPT_ASSIGNABLE_FAMILIES,
    FAILURE_FAMILIES,
    familyForStage,
    runCascade,
    type FailureFamily,
} from '../../src/scripts/_lib/evaluation_cascade.js';
import {
    LADDER_RUNGS,
    RECEIPT_STAGES,
    type ActivationReceipt,
    type LadderRung,
    type RungState,
} from '../../src/scripts/_lib/activation_ladder.js';

const BUDGET = { maxCandidates: 100, maxTrialsPerCandidate: 10, maxSpendCents: 10_000 };
const PLAN = { candidates: 1, trialsPerCandidate: 1, estimatedSpendCents: 0 };

function record(over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        kind: 'candidate',
        version: 1,
        id: 'cand-ok',
        dimension: 'content',
        lifecycle: 'proposed',
        mutations: [{ path: '.claude/rules/x.md', content: '# x\n' }],
        ...over,
    };
}

/** A receipt that climbs every rung before `stallAt`, then fails it. */
function stallingAt(stallAt: LadderRung): ActivationReceipt {
    const rungs: Partial<Record<LadderRung, RungState>> = {};
    for (const r of LADDER_RUNGS) {
        if (r === stallAt) {
            rungs[r] = 'not-reached';
            break;
        }
        rungs[r] = 'reached';
    }
    return { artefact: 'a', rungs };
}

describe('the stage list spans all four families, and each half keeps its own permissions', () => {
    it('the stage list spans all four; the PREFIX still spans exactly two', () => {
        const union = new Set<FailureFamily>([
            ...PREFIX_ASSIGNABLE_FAMILIES,
            ...RECEIPT_ASSIGNABLE_FAMILIES,
        ]);
        expect([...union].sort()).toEqual([...FAILURE_FAMILIES].sort());
        // The exclusion 4.1 shipped for is UNCHANGED — widening it was never
        // the fix, and a later edit that widens it must red here.
        expect([...PREFIX_ASSIGNABLE_FAMILIES].sort()).toEqual(['content', 'unknown']);
        // The receipt half spans all four rather than the prefix's complement:
        // the `eligible` rung's family is `content`. Stated as an assertion
        // because the first hand-written permission table got this wrong.
        expect([...RECEIPT_ASSIGNABLE_FAMILIES].sort()).toEqual([...FAILURE_FAMILIES].sort());
    });

    it('every prefix stage stays inside the prefix permissions', () => {
        for (const s of CASCADE_STAGES) {
            expect(PREFIX_ASSIGNABLE_FAMILIES, s).toContain(familyForStage(s));
        }
    });

    it('every receipt stage stays inside the receipt permissions', () => {
        for (const s of RECEIPT_STAGES) {
            expect(RECEIPT_ASSIGNABLE_FAMILIES, s).toContain(familyForStage(s));
        }
    });
});

describe('runCascade reaches each of the four families', () => {
    it('content — from the deterministic prefix, with no receipt at all', () => {
        const r = runCascade({ raw: { nonsense: true }, plan: PLAN, budget: BUDGET });
        expect(r.outcome).toBe('abort');
        if (r.outcome !== 'abort') return;
        expect(r.family).toBe('content');
    });

    it('activation — from a receipt whose projected rung was observed not-reached', () => {
        const r = runCascade({
            raw: record(),
            plan: PLAN,
            budget: BUDGET,
            receipt: stallingAt('projected'),
        });
        expect(r.outcome).toBe('abort');
        if (r.outcome !== 'abort') return;
        expect(r.family).toBe('activation');
        expect(r.failed_stage).toBe('receipt-projected');
        expect(r.model_calls).toBe(0);
    });

    it('adherence — from a receipt whose adhered rung was observed not-reached', () => {
        const r = runCascade({
            raw: record(),
            plan: PLAN,
            budget: BUDGET,
            receipt: stallingAt('adhered'),
        });
        expect(r.outcome).toBe('abort');
        if (r.outcome !== 'abort') return;
        expect(r.family).toBe('adherence');
        expect(r.failed_stage).toBe('receipt-adhered');
    });

    it('unknown — from the prefix, and separately from an unobserved rung', () => {
        const fromPrefix = runCascade({
            raw: record({ mutations: [{ path: '.claude/rules/holdout-x.md', content: 'x' }] }),
            plan: PLAN,
            budget: BUDGET,
        });
        expect(fromPrefix.outcome === 'abort' && fromPrefix.family).toBe('unknown');

        // An UNOBSERVED rung is not a failure: the cascade learns nothing about
        // activation and must not abort. Folding `unknown` into a refusal would
        // reject every candidate whose adherence nobody can observe — which is
        // every candidate, today.
        const partial = runCascade({
            raw: record(),
            plan: PLAN,
            budget: BUDGET,
            receipt: { artefact: 'a', rungs: { eligible: 'reached' } },
        });
        expect(partial.outcome).toBe('incomplete');
        if (partial.outcome !== 'incomplete') return;
        expect(partial.stages_run).toContain('receipt-selected');
        expect(partial.stages_run).not.toContain('receipt-projected');
    });
});

describe('EC-2 — receipt stages run after the prefix and before the measurement stage', () => {
    it('a full climb records the prefix, then all six receipt stages, then the verdict', () => {
        const rungs = Object.fromEntries(LADDER_RUNGS.map((r) => [r, 'reached'])) as Record<
            LadderRung,
            RungState
        >;
        const r = runCascade({
            raw: record(),
            plan: PLAN,
            budget: BUDGET,
            receipt: { artefact: 'a', rungs },
            rows: [
                {
                    metric: 'task-success',
                    kind: 'paired',
                    direction: 'higher-better',
                    verdict: {
                        kind: 'pass',
                        discordant: 12,
                        wins: 11,
                        losses: 1,
                        p: 0.003,
                        magnitude_mean: 0.4,
                        at_floor: false,
                        why: 'pass on 12 discordant trials',
                    },
                },
                { metric: 'artifact-count-delta', kind: 'counted', direction: 'lower-better', delta: 0 },
            ] as never,
        });
        expect(r.outcome).toBe('pass');
        if (r.outcome !== 'pass') return;
        expect(r.stages_run).toEqual([
            'schema-validity',
            'path-ownership',
            'holdout-disclosure',
            'budget',
            'near-duplicate',
            ...RECEIPT_STAGES,
            'metric-verdict',
        ]);
        expect(r.model_calls).toBe(0);
    });

    it('no receipt means the six stages do not run at all — absent, not unknown-six', () => {
        // `stages_run` is what a reader counts coverage from. Six entries that
        // observed nothing would be six entries of fabricated coverage.
        const r = runCascade({ raw: record(), plan: PLAN, budget: BUDGET });
        expect(r.outcome).toBe('incomplete');
        for (const s of RECEIPT_STAGES) expect(r.stages_run).not.toContain(s);
    });
});
