// road-to-inbox-harvest-2026-08-e-council-topology-evidence — Phase 3, step 3.5.
//
// Order-swap consistency, per judge. The step's verify is "the metric exists per
// judge and is reported with the verdict", so the assertions are on the metric's
// shape and on the rendered line, and every judge below is a SCRIPTED bias — a
// metric that cannot separate a stable judge from a primacy-biased one is the
// defect, and the only way to see that is to feed it both.
import { describe, expect, it } from 'vitest';

import {
    judgeBothOrders,
    positionConsistency,
    renderPositionConsistency,
    sampleForSwap,
    type PairwiseJudge,
} from '../../../src/scripts/ai_council/judge_position_bias.js';

/** Always names whatever it was shown first — the systematic bias, not noise. */
const primacy: PairwiseJudge = () => 'first';
/** Always names whatever it was shown second. */
const recency: PairwiseJudge = () => 'second';
/** Prefers the body containing `GOOD`, wherever it sits — order-stable. */
const contentful: PairwiseJudge = (_ctx, first) => (first.includes('GOOD') ? 'first' : 'second');
/** Never decides. */
const abstains: PairwiseJudge = () => 'tie';

describe('judgeBothOrders — a flip resolves to `inconsistent`, never to a winner (3.5)', () => {
    it('a content-driven judge survives the swap and names the same candidate', () => {
        const o = judgeBothOrders('p1', 'GOOD answer', 'weak answer', contentful);
        expect(o.forward).toBe('first');
        expect(o.reverse).toBe('second');
        expect(o.resolution).toBe('a');
    });

    it('a primacy judge flips, and the flip is NOT resolved into a winner', () => {
        const o = judgeBothOrders('p1', 'a', 'b', primacy);
        expect(o.forward).toBe('first');
        expect(o.reverse).toBe('first');
        // Forward named A, reverse named B. Neither wins.
        expect(o.resolution).toBe('inconsistent');
    });

    it('a recency judge flips the same way, in the other direction', () => {
        expect(judgeBothOrders('p1', 'a', 'b', recency).resolution).toBe('inconsistent');
    });

    it('two ties are a tie, not an inconsistency', () => {
        expect(judgeBothOrders('p1', 'a', 'b', abstains).resolution).toBe('tie');
    });

    it('one tie and one decisive verdict is an inconsistency, not a win', () => {
        // The asymmetric case a naive `w1 === w2` check gets right only by
        // accident: the judge decided under one order and refused under the
        // other, which is exactly a position effect.
        let call = 0;
        const halfDecided: PairwiseJudge = () => (call++ === 0 ? 'first' : 'tie');
        expect(judgeBothOrders('p1', 'a', 'b', halfDecided).resolution).toBe('inconsistent');
    });

    it('the judge sees the bodies in PRESENTED order and nothing else', () => {
        const seen: Array<[string, string]> = [];
        judgeBothOrders('p1', 'alpha', 'beta', (_c, f, s) => {
            seen.push([f, s]);
            return 'tie';
        });
        expect(seen).toEqual([
            ['alpha', 'beta'],
            ['beta', 'alpha'],
        ]);
    });
});

describe('positionConsistency — per judge, with direction (3.5)', () => {
    const pairs: Array<[string, string, string]> = [
        ['p1', 'GOOD one', 'weak one'],
        ['p2', 'weak two', 'GOOD two'],
        ['p3', 'GOOD three', 'weak three'],
    ];
    const observe = (j: PairwiseJudge) => pairs.map(([id, a, b]) => judgeBothOrders(id, a, b, j));

    it('a stable judge scores 100% consistency and ~50% first-position', () => {
        const m = positionConsistency('contentful', observe(contentful));
        expect(m.sampled).toBe(3);
        expect(m.inconsistent).toBe(0);
        expect(m.position_consistency).toBe(1);
        // Six decisive verdicts, three naming the first slot — the body it
        // prefers is first in exactly one order per pair.
        expect(m.decisive_verdicts).toBe(6);
        expect(m.first_position_rate).toBeCloseTo(0.5, 10);
    });

    it('a primacy judge scores 0% consistency AND a first-position rate of 1.0', () => {
        const m = positionConsistency('primacy', observe(primacy));
        expect(m.position_consistency).toBe(0);
        expect(m.first_position_rate).toBe(1);
    });

    it('a recency judge is equally inconsistent but points the OTHER way', () => {
        const m = positionConsistency('recency', observe(recency));
        // This is the pair the step exists for: an inconsistency rate alone
        // cannot tell these two apart, and they need opposite remedies.
        expect(m.position_consistency).toBe(positionConsistency('primacy', observe(primacy)).position_consistency);
        expect(m.first_position_rate).toBe(0);
    });

    it('an abstaining judge is consistent with NO decisive verdicts — rate is null, not 0.5', () => {
        const m = positionConsistency('abstains', observe(abstains));
        expect(m.position_consistency).toBe(1);
        expect(m.decisive_verdicts).toBe(0);
        expect(m.first_position_rate).toBeNull();
    });

    it('zero sampled pairs give a null consistency, never a perfect score', () => {
        // An unrun swap must not be indistinguishable from a flawless judge.
        const m = positionConsistency('nobody', []);
        expect(m.sampled).toBe(0);
        expect(m.position_consistency).toBeNull();
    });

    it('the metric is PER JUDGE — two judges over the same pairs do not merge', () => {
        const rows = [
            positionConsistency('primacy', observe(primacy)),
            positionConsistency('contentful', observe(contentful)),
        ];
        expect(rows.map((r) => r.judge)).toEqual(['primacy', 'contentful']);
        expect(new Set(rows.map((r) => r.position_consistency)).size).toBe(2);
    });
});

describe('sampleForSwap — deterministic, so a published rate is re-drawable', () => {
    const ids = Array.from({ length: 200 }, (_, i) => `pair-${String(i)}`);

    it('same seed and rate give the same sample', () => {
        expect(sampleForSwap(ids, 0.25, 's')).toEqual(sampleForSwap(ids, 0.25, 's'));
    });

    it('a different seed gives a different sample', () => {
        expect(sampleForSwap(ids, 0.25, 's1')).not.toEqual(sampleForSwap(ids, 0.25, 's2'));
    });

    it('rate 0 samples nothing and rate 1 samples everything', () => {
        expect(sampleForSwap(ids, 0, 's')).toEqual([]);
        expect(sampleForSwap(ids, -1, 's')).toEqual([]);
        expect(sampleForSwap(ids, 1, 's')).toEqual(ids);
        expect(sampleForSwap(ids, 2, 's')).toEqual(ids);
    });

    it('an intermediate rate lands near it rather than at an extreme', () => {
        // Loose bounds on purpose: the assertion is that the sampler samples,
        // not that a 32-bit hash is uniform to three decimal places.
        const n = sampleForSwap(ids, 0.25, 'seed').length;
        expect(n).toBeGreaterThan(ids.length * 0.1);
        expect(n).toBeLessThan(ids.length * 0.45);
    });
});

describe('renderPositionConsistency — reported beside the verdict (3.5 verify)', () => {
    it('names every judge and both numbers', () => {
        const out = renderPositionConsistency([
            positionConsistency('primacy', [judgeBothOrders('p', 'a', 'b', primacy)]),
            positionConsistency('contentful', [judgeBothOrders('p', 'GOOD', 'b', contentful)]),
        ]);
        expect(out).toContain('primacy');
        expect(out).toContain('contentful');
        expect(out).toContain('first-position rate');
        expect(out.split('\n')).toHaveLength(2);
    });

    it('an unrun swap says so instead of printing nothing', () => {
        expect(renderPositionConsistency([])).toContain('NOT RUN');
    });

    it('a null rate renders `n/a`, never a fabricated percentage', () => {
        expect(renderPositionConsistency([positionConsistency('nobody', [])])).toContain('n/a');
    });
});
