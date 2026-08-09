// Tests for src/scripts/ai_council/quorum.ts
// (road-to-always-on-orchestration Phase 3.3).
import { describe, expect, it } from 'vitest';

import {
    evaluateQuorum,
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
