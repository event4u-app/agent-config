// Tests for src/scripts/ai_council/quorum.ts
// (road-to-always-on-orchestration Phase 3.3).
import { describe, expect, it } from 'vitest';

import {
    evaluateQuorum,
    GATE_CLASS_ATTENDANCE_FLOOR,
    isSoloConcluded,
    resolveQuorumThreshold,
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
        expect(r).toEqual({ status: 'concluded', threshold: 1, total: 2, present: 1, heldByFloor: false });
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

// ── ADR-224 — the gate-class attendance floor ───────────────────────

describe('evaluateQuorum — the gate-class attendance floor (ADR-224)', () => {
    it('BOTH directions: a gate-class solo pass holds, a non-gate solo pass still concludes', () => {
        // The pair ADR-224 authorized, and the pair that has to move together —
        // asserting either alone would pass while the other regressed.
        const gated = evaluateQuorum(2, 1, 'majority', GATE_CLASS_ATTENDANCE_FLOOR);
        expect(gated.status).toBe('inconclusive');
        expect(gated.heldByFloor).toBe(true);

        const advisory = evaluateQuorum(2, 1);
        expect(advisory.status).toBe('concluded');
        expect(advisory.heldByFloor).toBe(false);
    });

    it('a gate-class pass with full attendance concludes — the floor is a floor, not a tax', () => {
        const r = evaluateQuorum(2, 2, 'majority', GATE_CLASS_ATTENDANCE_FLOOR);
        expect(r.status).toBe('concluded');
        expect(r.heldByFloor).toBe(false);
    });

    it('held-by-floor is distinguishable from threshold-never-met (Phase 3.1)', () => {
        // Both resolve `inconclusive`; only one of them met its threshold. If
        // these two became indistinguishable, the floor's own fire-rate would
        // be unmeasurable and it could never be retired on evidence.
        const held = evaluateQuorum(2, 1, 'majority', GATE_CLASS_ATTENDANCE_FLOOR);
        const never = evaluateQuorum(3, 1, 'majority', GATE_CLASS_ATTENDANCE_FLOOR);
        expect(held.status).toBe('inconclusive');
        expect(never.status).toBe('inconclusive');
        expect(held.present).toBeGreaterThanOrEqual(held.threshold);
        expect(never.present).toBeLessThan(never.threshold);
        expect(held.heldByFloor).toBe(true);
        expect(never.heldByFloor).toBe(false);
    });

    it('a floor above `total` is deliberately unwinnable — asymmetric to the threshold clamp', () => {
        // `resolveQuorumThreshold` clamps a threshold DOWN to `total` so a
        // misconfiguration cannot make a pass unwinnable. A floor is the
        // opposite: a council smaller than a gate requires must hold the gate,
        // not pass it because the requirement was lowered to fit the roster.
        expect(resolveQuorumThreshold(1, 5)).toBe(1);
        const r = evaluateQuorum(1, 1, 'majority', GATE_CLASS_ATTENDANCE_FLOOR);
        expect(r.status).toBe('inconclusive');
        expect(r.heldByFloor).toBe(true);
    });

    it('a zero-member gate-class pass holds instead of concluding trivially', () => {
        // Without the floor n=0 concludes (nothing to wait on). At a gate that
        // is a conclusion reached on nobody.
        expect(evaluateQuorum(0, 0).status).toBe('concluded');
        const r = evaluateQuorum(0, 0, 'majority', GATE_CLASS_ATTENDANCE_FLOOR);
        expect(r.status).toBe('inconclusive');
        expect(r.heldByFloor).toBe(true);
    });

    it('a held pass is not solo-CONCLUDED — the solo rate deflates as the floor fires', () => {
        // Documented consequence, pinned so it cannot change silently: the
        // floor makes the pass inconclusive, so `isSoloConcluded` is false and
        // the `solo` telemetry field goes false with it. That is why
        // `held_by_floor` is a separate registered metric, not a duplicate.
        const held = evaluateQuorum(2, 1, 'majority', GATE_CLASS_ATTENDANCE_FLOOR);
        expect(isSoloConcluded(held)).toBe(false);
        expect(isSoloConcluded(evaluateQuorum(2, 1))).toBe(true);
    });

    it('a malformed floor throws rather than failing open', () => {
        // A safety floor that degrades to "no floor" on a caller bug is absent
        // exactly where it was asked for, and silently so.
        expect(() => evaluateQuorum(2, 1, 'majority', { minPresent: 0 })).toThrow(RangeError);
        expect(() => evaluateQuorum(2, 1, 'majority', { minPresent: -1 })).toThrow(RangeError);
        expect(() => evaluateQuorum(2, 1, 'majority', { minPresent: 1.5 })).toThrow(RangeError);
        // Validated on SUPPLY, not on fire: this pass would not have been held
        // (threshold never met), and the malformed floor must still be caught.
        expect(() => evaluateQuorum(3, 1, 'majority', { minPresent: 0 })).toThrow(RangeError);
    });

    it('minPresent: 1 is a legal no-op floor — it can never hold a concluded pass', () => {
        // The lower clamp is 1, so the weakest expressible floor is inert by
        // construction: any pass meeting its threshold has present >= 1.
        for (const [total, present] of [
            [1, 1],
            [2, 1],
            [2, 2],
            [3, 2],
        ] as const) {
            const r = evaluateQuorum(total, present, 'majority', { minPresent: 1 });
            expect(r.heldByFloor).toBe(false);
            expect(r.status).toBe(evaluateQuorum(total, present).status);
        }
    });
});

describe('evaluateQuorum — no floor supplied reproduces pre-ADR-224 behaviour exactly (Phase 2.3)', () => {
    // The scope leak this phase most plausibly ships is the floor firing on a
    // pass that never declared itself gate-class. A happy-path test cannot see
    // it: it needs the whole attendance matrix asserted against the old rule,
    // which is `present >= ceil(total / 2)` and nothing else.
    const MATRIX: ReadonlyArray<readonly [number, number]> = (() => {
        const out: Array<readonly [number, number]> = [];
        for (let total = 0; total <= 5; total++) {
            for (let present = 0; present <= total; present++) {
                out.push([total, present]);
            }
        }
        return out;
    })();

    it('every (total, present) combination keeps its old status and is never floor-held', () => {
        for (const [total, present] of MATRIX) {
            const r = evaluateQuorum(total, present);
            const expected = present >= Math.ceil(total / 2) ? 'concluded' : 'inconclusive';
            expect(r.status, `total=${total} present=${present}`).toBe(expected);
            expect(r.heldByFloor, `total=${total} present=${present}`).toBe(false);
        }
    });

    it('an explicit null floor is identical to omitting the argument', () => {
        for (const [total, present] of MATRIX) {
            expect(evaluateQuorum(total, present, 'majority', null)).toEqual(
                evaluateQuorum(total, present),
            );
        }
    });

    it('a fixed-k setting without a floor is also untouched', () => {
        for (const [total, present] of MATRIX) {
            if (total === 0) {
                continue;
            }
            const r = evaluateQuorum(total, present, 2);
            expect(r.heldByFloor).toBe(false);
            expect(r.status).toBe(present >= Math.min(2, total) ? 'concluded' : 'inconclusive');
        }
    });
});
