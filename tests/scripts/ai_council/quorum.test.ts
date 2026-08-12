// Tests for src/scripts/ai_council/quorum.ts
// (road-to-always-on-orchestration Phase 3.3).
import { describe, expect, it } from 'vitest';

import {
    evaluateQuorum,
    isSoloConcluded,
    resolveQuorumThreshold,
    SOLO_FLOOR_MIN_PRESENT,
    wouldSoloFloorHold,
} from '../../../src/scripts/ai_council/quorum.js';

describe('resolveQuorumThreshold — majority', () => {
    // The council-verified table: simple majority is ceil(n/2), NOT
    // "more than half" (floor(n/2)+1) — n=2 must resolve to 1, not 2.
    const CASES: ReadonlyArray<readonly [number, number]> = [
        [0, 0],
        [1, 1],
        [2, 1],
        [3, 2],
        [4, 2],
        [5, 3],
        [6, 3],
        [7, 4],
    ];

    for (const [n, k] of CASES) {
        it(`n=${n} → k=${k}`, () => {
            expect(resolveQuorumThreshold(n)).toBe(k);
            expect(resolveQuorumThreshold(n, 'majority')).toBe(k);
        });
    }

    it('rejects a negative total', () => {
        expect(() => resolveQuorumThreshold(-1)).toThrow(RangeError);
    });

    it('rejects a non-integer total', () => {
        expect(() => resolveQuorumThreshold(1.5)).toThrow(RangeError);
    });
});

describe('resolveQuorumThreshold — fixed k', () => {
    it('uses the fixed value when it fits within [1, total]', () => {
        expect(resolveQuorumThreshold(5, 3)).toBe(3);
        expect(resolveQuorumThreshold(3, 1)).toBe(1);
    });

    it('clamps a fixed k above total down to total', () => {
        expect(resolveQuorumThreshold(2, 5)).toBe(2);
    });

    it('clamps a fixed k below 1 up to 1', () => {
        expect(resolveQuorumThreshold(3, 0)).toBe(1);
        expect(resolveQuorumThreshold(3, -4)).toBe(1);
    });

    it('total=0 always resolves to 0, regardless of the fixed setting', () => {
        expect(resolveQuorumThreshold(0, 5)).toBe(0);
    });
});

describe('evaluateQuorum', () => {
    it('n=2 concludes at 1 present — the deadlock-avoidance case', () => {
        const r = evaluateQuorum(2, 1);
        expect(r).toEqual({ status: 'concluded', threshold: 1, total: 2, present: 1 });
    });

    it('n=2 with 0 present is inconclusive', () => {
        const r = evaluateQuorum(2, 0);
        expect(r.status).toBe('inconclusive');
        expect(r.threshold).toBe(1);
    });

    it('n=3 needs 2 — 1 present is inconclusive, 2 present concludes', () => {
        expect(evaluateQuorum(3, 1).status).toBe('inconclusive');
        expect(evaluateQuorum(3, 2).status).toBe('concluded');
    });

    it('present at exactly the threshold concludes (>=, not >)', () => {
        const r = evaluateQuorum(4, 2);
        expect(r.status).toBe('concluded');
    });

    it('present above total clamps down to total rather than inflating the verdict', () => {
        const r = evaluateQuorum(2, 5);
        expect(r.present).toBe(2);
        expect(r.status).toBe('concluded');
    });

    it('a negative present clamps to 0', () => {
        const r = evaluateQuorum(2, -3);
        expect(r.present).toBe(0);
        expect(r.status).toBe('inconclusive');
    });

    it('honours a fixed k setting end to end', () => {
        expect(evaluateQuorum(4, 2, 2).status).toBe('concluded');
        expect(evaluateQuorum(4, 1, 2).status).toBe('inconclusive');
    });

    it('n=0 (no members configured) concludes trivially — nothing to wait on', () => {
        expect(evaluateQuorum(0, 0).status).toBe('concluded');
    });
});

describe('isSoloConcluded — the 1-of-n conclusion, made visible', () => {
    it('1-of-2 concluded is solo — the case ceil(n/2) makes legal and invisible', () => {
        expect(isSoloConcluded(evaluateQuorum(2, 1))).toBe(true);
    });

    it('full attendance is never solo', () => {
        expect(isSoloConcluded(evaluateQuorum(2, 2))).toBe(false);
        expect(isSoloConcluded(evaluateQuorum(3, 2))).toBe(false);
    });

    it('an inconclusive pass is never solo, whatever present is', () => {
        // 1 of 3 needs 2 → inconclusive. It carries one voice and is still
        // not a solo *conclusion*: nothing was concluded.
        expect(isSoloConcluded(evaluateQuorum(3, 1))).toBe(false);
    });

    it('a one-member council counts as solo — configured, not degraded', () => {
        // Deliberate: a conclusion reached on one voice is the thing being
        // measured, and n=1 reaches it by construction. Callers that care
        // read `total` alongside.
        expect(isSoloConcluded(evaluateQuorum(1, 1))).toBe(true);
    });

    it('n=0 concludes trivially and is not solo — there is no voice at all', () => {
        expect(isSoloConcluded(evaluateQuorum(0, 0))).toBe(false);
    });

    it('a fixed k=1 over 3 members still reads solo at present=1', () => {
        expect(isSoloConcluded(evaluateQuorum(3, 1, 1))).toBe(true);
    });
});

describe('wouldSoloFloorHold — the ADR-224 counterfactual', () => {
    it('holds a degraded solo conclusion: 1 of 2 answered', () => {
        expect(wouldSoloFloorHold(evaluateQuorum(2, 1))).toBe(true);
    });

    it('does not hold full attendance', () => {
        expect(wouldSoloFloorHold(evaluateQuorum(2, 2))).toBe(false);
        expect(wouldSoloFloorHold(evaluateQuorum(3, 3))).toBe(false);
    });

    it('does not hold a pass that never concluded — that is a different outcome', () => {
        // 1 of 3 needs 2 → inconclusive. The floor did not stop this pass;
        // the threshold did. Keeping the two apart is the whole point of
        // recording them as separate fields.
        const q = evaluateQuorum(3, 1);
        expect(q.status).toBe('inconclusive');
        expect(wouldSoloFloorHold(q)).toBe(false);
    });

    it('never holds a council CONFIGURED with one member', () => {
        // The clamp into [1, total] carries the semantics, not just safety:
        // n=1 concluding on its one voice is the configured shape, not a
        // degraded pass, and merging it into the fire-rate would repeat the
        // exact conflation quorum-attendance-budget.json warns about for the
        // solo-conclusion rate.
        expect(wouldSoloFloorHold(evaluateQuorum(1, 1))).toBe(false);
        expect(wouldSoloFloorHold(evaluateQuorum(1, 1), 5)).toBe(false);
    });

    it('fires on a CONSTRUCTION-degraded pass — the case ADR-224 was decided on', () => {
        // 2 configured, 1 failed to construct, 1 answered. post_run `total`
        // is the roster that constructed, so this reads total=1/present=1 —
        // indistinguishable from a one-member council unless configured_total
        // is consulted. Clamping against `total` alone made the floor
        // structurally unable to fire here, which is a metric blind to its
        // own target population.
        const degraded = evaluateQuorum(1, 1);
        expect(wouldSoloFloorHold(degraded)).toBe(false);
        expect(wouldSoloFloorHold(degraded, SOLO_FLOOR_MIN_PRESENT, 2)).toBe(true);
    });

    it('still does not fire for a council CONFIGURED with one member', () => {
        // Same total/present as the degraded pass above; only
        // configured_total separates them, which is exactly the split the
        // budget file insists on for the solo-conclusion rate.
        expect(wouldSoloFloorHold(evaluateQuorum(1, 1), SOLO_FLOOR_MIN_PRESENT, 1)).toBe(false);
    });

    it('does not treat a --siblings fan-out as a shortfall', () => {
        // total > configured_total is legitimate: --siblings fans ONE config
        // entry into N clients. The ceiling is the larger of the two, so a
        // 3-client pass with 2 present is judged against 3, not against 1.
        expect(wouldSoloFloorHold(evaluateQuorum(3, 3), SOLO_FLOOR_MIN_PRESENT, 1)).toBe(false);
        // A fixed k=1 is what lets a 3-client pass CONCLUDE on one voice;
        // under `majority` the same shape is inconclusive and the floor is
        // not what stopped it.
        expect(wouldSoloFloorHold(evaluateQuorum(3, 1, 1), SOLO_FLOOR_MIN_PRESENT, 1)).toBe(true);
    });

    it('clamps a floor above the roster instead of holding every pass', () => {
        // Unclamped, a floor of 5 over a 2-member council would report a
        // 100 % fire-rate — an artefact of the config, not a finding about
        // the council.
        expect(wouldSoloFloorHold(evaluateQuorum(2, 2), 5)).toBe(false);
        expect(wouldSoloFloorHold(evaluateQuorum(2, 1), 5)).toBe(true);
    });

    it('a floor of 1 can never hold anything', () => {
        expect(wouldSoloFloorHold(evaluateQuorum(2, 1), 1)).toBe(false);
        expect(wouldSoloFloorHold(evaluateQuorum(3, 1, 1), 0)).toBe(false);
    });

    it('defaults to the ADR-224 value', () => {
        expect(SOLO_FLOOR_MIN_PRESENT).toBe(2);
        const q = evaluateQuorum(2, 1);
        expect(wouldSoloFloorHold(q)).toBe(wouldSoloFloorHold(q, SOLO_FLOOR_MIN_PRESENT));
    });

    // ── the scope-leak negative test ────────────────────────────────
    //
    // The regression this phase could most plausibly ship is the floor
    // leaking into passes it was never scoped to. In an ENFORCING design
    // that test can only be written per-call-site, and it can only check the
    // sites someone remembered. In the shadow design the claim is universal
    // and therefore checkable as one: consulting the floor changes NOTHING
    // about the verdict, for any roster, any presence, any floor value.
    it('never changes the quorum verdict — for any roster, presence or floor', () => {
        for (let total = 0; total <= 5; total++) {
            for (let present = 0; present <= total; present++) {
                for (const setting of ['majority', 1, 2, 3] as const) {
                    const before = evaluateQuorum(total, present, setting);
                    const snapshot = { ...before };
                    for (const floor of [0, 1, 2, 3, 9]) {
                        wouldSoloFloorHold(before, floor);
                        // The predicate is pure: it neither mutates the
                        // result it was handed nor feeds back into it.
                        expect({ ...before }).toEqual(snapshot);
                        expect(evaluateQuorum(total, present, setting).status).toBe(
                            snapshot.status,
                        );
                    }
                }
            }
        }
    });

    it('is mutually exclusive with an inconclusive verdict, by construction', () => {
        for (let total = 0; total <= 5; total++) {
            for (let present = 0; present <= total; present++) {
                const q = evaluateQuorum(total, present);
                if (wouldSoloFloorHold(q)) {
                    expect(q.status).toBe('concluded');
                }
            }
        }
    });
});
