/**
 * Tests for the activation ladder
 * (`src/scripts/_lib/activation_ladder.ts`,
 * road-to-governed-harness-evolution steps 1.1 and 1.2).
 *
 * Step 1.1's verify clause is the load-bearing one and it is stated as a
 * capability: *"a deliberately failing trigger eval is classifiable as content
 * vs activation vs adherence from the recorded receipt alone."* So the four
 * representative receipts below are the test — one per family plus the
 * delivered-but-not-visible case the 6-rung form exists for, which is exactly
 * the evidence matrix the AI council attached as a condition to its option-B
 * verdict.
 *
 * Step 1.2's verify is a NEGATIVE: *"no aggregation folds `unknown` into a
 * success denominator."* That is asserted directly rather than inferred from a
 * rate looking plausible.
 */
import { describe, expect, it } from 'vitest';

import {
    classifyFailure,
    LADDER,
    LADDER_RUNGS,
    ladderRate,
    PRECEDENCE_REASONS,
    rungState,
    type ActivationReceipt,
} from '../../src/scripts/_lib/activation_ladder.js';

/** All rungs reached, then override the ones a case is about. */
function receipt(over: Partial<ActivationReceipt['rungs']>, reason?: ActivationReceipt['reason']): ActivationReceipt {
    const rungs: ActivationReceipt['rungs'] = Object.fromEntries(
        LADDER_RUNGS.map((r) => [r, 'reached' as const]),
    );
    return { artefact: 'x', rungs: { ...rungs, ...over }, ...(reason === undefined ? {} : { reason }) };
}

describe('1.1 — a failing eval is classifiable from the receipt alone', () => {
    it('CONTENT: the artefact never matched the request', () => {
        expect(classifyFailure(receipt({ eligible: 'not-reached' }, 'pack-filter'))).toBe('content');
    });

    it('ACTIVATION: it matched but lost to a higher-priority rule', () => {
        expect(
            classifyFailure(receipt({ selected: 'not-reached' }, 'lost-to-higher-priority-rule')),
        ).toBe('activation');
    });

    it('ACTIVATION: delivered but NOT visible — the split the 6-rung form exists for', () => {
        // Under `thin`/`delivery` (lean_projection_mode.ts:19) an artefact can
        // be delivered and then trimmed. The 4-rung ladder collapses this into
        // `injected` and cannot express it, which is why E4 resolved to six.
        const r = receipt({ visible: 'not-reached' }, 'context-budget');
        expect(classifyFailure(r)).toBe('activation');
        expect(rungState(r, 'delivered')).toBe('reached');
        expect(rungState(r, 'visible')).toBe('not-reached');
    });

    it('ADHERENCE: present, visible, and not followed', () => {
        expect(
            classifyFailure(receipt({ adhered: 'not-reached' }, 'contradictory-instruction')),
        ).toBe('adherence');
    });

    it('a fully reached receipt did not fail — null, never "adherence"', () => {
        expect(classifyFailure(receipt({}))).toBeNull();
    });

    it('reports the EARLIEST failing rung, not the last', () => {
        // Two rungs fail; the receipt must point at the first, because that is
        // the one a fix would address.
        expect(
            classifyFailure(receipt({ eligible: 'not-reached', adhered: 'not-reached' })),
        ).toBe('content');
    });
});

describe('1.2 — a missing state stays unknown', () => {
    it('an ABSENT rung reads `unknown`, never `not-reached`', () => {
        const r: ActivationReceipt = { artefact: 'x', rungs: { eligible: 'reached' } };
        expect(rungState(r, 'visible')).toBe('unknown');
    });

    it('an unknown rung short-circuits classification instead of being skipped', () => {
        // Skipping it would attribute the failure to a LATER rung the run may
        // never have reached — the same inflation, wearing a different shape.
        const r: ActivationReceipt = {
            artefact: 'x',
            rungs: { eligible: 'reached', selected: 'reached', adhered: 'not-reached' },
        };
        expect(classifyFailure(r)).toBe('unknown');
    });

    it('the rate denominator EXCLUDES unknown', () => {
        const rs = [
            receipt({}),
            receipt({ visible: 'not-reached' }),
            { artefact: 'z', rungs: {} } as ActivationReceipt,
        ];
        const rate = ladderRate(rs, 'visible');
        expect(rate.reached).toBe(1);
        expect(rate.notReached).toBe(1);
        expect(rate.unknown).toBe(1);
        // 1/2, not 1/3 — the capture gap does not become a failure, and it does
        // not become a success either.
        expect(rate.rate).toBe(0.5);
    });

    it('an all-unknown population reports null, NOT zero', () => {
        const rate = ladderRate([{ artefact: 'a', rungs: {} }, { artefact: 'b', rungs: {} }], 'adhered');
        expect(rate.unknown).toBe(2);
        expect(rate.rate).toBeNull(); // zero is a measurement; there was none
    });

    it('an empty population reports null as well', () => {
        expect(ladderRate([], 'eligible').rate).toBeNull();
    });
});

describe('E4+E9 option B — the council condition, as assertions', () => {
    it('six rungs, and the three the 4-rung form collapses are all present', () => {
        expect(LADDER_RUNGS.length).toBe(6);
        expect(LADDER_RUNGS).toContain('projected');
        expect(LADDER_RUNGS).toContain('delivered');
        expect(LADDER_RUNGS).toContain('visible');
    });

    it('every rung has an observable predicate and a family — no rung is decorative', () => {
        // The council's stated revisit condition is a rung with no distinct
        // observable predicate. This is that check.
        expect(LADDER.length).toBe(LADDER_RUNGS.length);
        for (const spec of LADDER) {
            expect(spec.observedBy.length).toBeGreaterThan(0);
            expect(spec.predicate.length).toBeGreaterThan(30);
            expect(['content', 'activation', 'adherence']).toContain(spec.family);
        }
    });

    it('the matrix covers every rung exactly once, in ladder order', () => {
        expect(LADDER.map((s) => s.rung)).toEqual([...LADDER_RUNGS]);
    });

    it('all three families are reachable — a taxonomy with an unusable member is not one', () => {
        expect(new Set(LADDER.map((s) => s.family))).toEqual(
            new Set(['content', 'activation', 'adherence']),
        );
    });

    it('the precedence reasons name PLACES, not categories', () => {
        // The flat `rule/skill/hook/router/host/model` attribution this replaces
        // named a category; you cannot fix "router".
        expect(PRECEDENCE_REASONS.length).toBe(6);
        for (const r of PRECEDENCE_REASONS) expect(r).toMatch(/^[a-z][a-z-]+$/);
    });
});
