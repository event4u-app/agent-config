// road-to-admissible-council-seats 3.2 — the aggregator, beside consensus.ts.
//
// Three properties, each of which is a refusal rather than a feature:
//   - a single-family panel returns ABSENT with the family reason;
//   - a three-judge panel with one corrupted score returns the TRIMMED value
//     and not the arithmetic mean (which is what a corrupted score moves);
//   - the position-swap path is exercised, not merely available.
//
// AC-9's other half is here too: nothing in production consumes a jury score
// while the shadow ledger is not accumulating. That is asserted by a grep over
// the shipped source rather than by reasoning about it.

import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    juryAggregate,
    juryPairwise,
    type JuryScore,
} from '../../../src/scripts/ai_council/jury_aggregate.js';
import type { PairwiseVerdict } from '../../../src/scripts/ai_council/judge_position_bias.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const s = (judge: string, family: string, score: number): JuryScore => ({ judge, family, score });

describe('3.2 — family diversity is a refusal, not a warning', () => {
    it('a single-family panel returns absent with the family reason', () => {
        const r = juryAggregate([
            s('a', 'anthropic', 0.9),
            s('b', 'anthropic', 0.8),
            s('c', 'anthropic', 0.85),
        ]);
        expect(r.present).toBe(false);
        if (r.present) return;
        expect(r.absentReason).toBe('single_family');
        expect(r.reason).toContain('redundancy, not agreement');
    });

    it('two families is enough; the families are reported', () => {
        const r = juryAggregate([s('a', 'anthropic', 0.9), s('b', 'openai', 0.7)]);
        expect(r.present).toBe(true);
        if (!r.present) return;
        expect(r.families).toEqual(['anthropic', 'openai']);
    });

    it('an empty panel is absent, not zero', () => {
        const r = juryAggregate([]);
        expect(r.present).toBe(false);
        if (r.present) return;
        expect(r.absentReason).toBe('no_scores');
    });

    it('a non-finite score refuses the panel rather than being dropped', () => {
        const r = juryAggregate([
            s('a', 'anthropic', 0.9),
            s('b', 'openai', Number.NaN),
            s('c', 'google', 0.8),
        ]);
        expect(r.present).toBe(false);
        if (r.present) return;
        expect(r.absentReason).toBe('non_finite_score');
    });
});

describe('3.2 — the aggregate is a trimmed statistic, never a vote count', () => {
    it('one corrupted score in a three-judge panel does not move the result', () => {
        const clean = [s('a', 'anthropic', 0.80), s('b', 'openai', 0.82), s('c', 'google', 0.84)];
        const corrupted = [s('a', 'anthropic', 0.80), s('b', 'openai', 0.82), s('c', 'google', 99)];

        const rc = juryAggregate(corrupted);
        expect(rc.present).toBe(true);
        if (!rc.present) return;

        const arithmetic = corrupted.reduce((acc, x) => acc + x.score, 0) / corrupted.length;
        // The whole point: the arithmetic mean is destroyed, the trimmed value
        // is not. Asserting only "not the mean" would pass for any wrong number,
        // so the exact surviving value is pinned too.
        expect(arithmetic).toBeGreaterThan(30);
        expect(rc.aggregate).not.toBeCloseTo(arithmetic, 6);
        expect(rc.aggregate).toBeCloseTo(0.82, 10);
        expect(rc.trimmed).toBe(2);

        // And it is stable against the clean panel — the corruption changed the
        // input and not the answer.
        const rk = juryAggregate(clean);
        expect(rk.present && rk.aggregate).toBeCloseTo(0.82, 10);
    });

    it('trims one from each end on a five-judge panel', () => {
        const r = juryAggregate([
            s('a', 'anthropic', 0),
            s('b', 'openai', 1),
            s('c', 'google', 2),
            s('d', 'xai', 3),
            s('e', 'meta', 100),
        ]);
        expect(r.present).toBe(true);
        if (!r.present) return;
        expect(r.aggregate).toBeCloseTo(2, 10); // mean(1,2,3)
        expect(r.trimmed).toBe(2);
    });

    it('n = 2 reports trimmed: 0 rather than implying robustness it lacks', () => {
        const r = juryAggregate([s('a', 'anthropic', 0.2), s('b', 'openai', 0.8)]);
        expect(r.present).toBe(true);
        if (!r.present) return;
        expect(r.trimmed).toBe(0);
        expect(r.aggregate).toBeCloseTo(0.5, 10);
    });

    it('the result carries no vote count anywhere in its shape', () => {
        const r = juryAggregate([s('a', 'anthropic', 1), s('b', 'openai', 1), s('c', 'google', 1)]);
        expect(r.present).toBe(true);
        if (!r.present) return;
        expect(Object.keys(r)).not.toContain('votes');
        expect(r.method).toBe('trimmed-mean');
    });
});

describe('3.2 — the position-swap path is exercised, not merely available', () => {
    /** A judge that always names whichever candidate is shown FIRST: pure
     *  primacy bias, which a single-order run would score as a clean win. */
    const primacy = (): PairwiseVerdict => 'first';
    /** A judge that genuinely prefers `a`, whatever the order. */
    const prefersA = (_c: { id: string }, first: string): PairwiseVerdict =>
        first === 'A-body' ? 'first' : 'second';

    it('a primacy-biased judge resolves inconsistent instead of winning', () => {
        const r = juryPairwise('p1', 'A-body', 'B-body', [
            { judge: 'j1', family: 'anthropic', fn: primacy },
            { judge: 'j2', family: 'openai', fn: primacy },
        ]);
        expect(r.present).toBe(true);
        expect(r.observations).toHaveLength(2);
        for (const o of r.observations) {
            expect(o.resolution).toBe('inconsistent');
        }
        expect(r.resolution).toBe('inconsistent');
        // The metric that shows the DIRECTION, which an inconsistency rate cannot.
        expect(r.consistency[0]?.first_position_rate).toBe(1);
    });

    it('a genuinely order-stable judge survives the swap and carries the panel', () => {
        const r = juryPairwise('p2', 'A-body', 'B-body', [
            { judge: 'j1', family: 'anthropic', fn: prefersA },
            { judge: 'j2', family: 'openai', fn: prefersA },
        ]);
        expect(r.resolution).toBe('a');
        expect(r.consistency[0]?.position_consistency).toBe(1);
        expect(r.consistency[0]?.first_position_rate).toBeCloseTo(0.5, 10);
    });

    it('an inconsistent judge stays in the denominator', () => {
        // Two stable + one flipper: 2 of 3 is a strict majority, so `a` carries.
        const r3 = juryPairwise('p3', 'A-body', 'B-body', [
            { judge: 'j1', family: 'anthropic', fn: prefersA },
            { judge: 'j2', family: 'openai', fn: prefersA },
            { judge: 'j3', family: 'google', fn: primacy },
        ]);
        expect(r3.resolution).toBe('a');
        // One stable + one flipper: 1 of 2 is NOT a majority. Dropping the
        // flipper from the denominator would have made this unanimous.
        const r2 = juryPairwise('p4', 'A-body', 'B-body', [
            { judge: 'j1', family: 'anthropic', fn: prefersA },
            { judge: 'j2', family: 'openai', fn: primacy },
        ]);
        expect(r2.resolution).toBe('inconsistent');
    });

    it('a single-family pairwise panel is refused too', () => {
        const r = juryPairwise('p5', 'A-body', 'B-body', [
            { judge: 'j1', family: 'anthropic', fn: prefersA },
            { judge: 'j2', family: 'anthropic', fn: prefersA },
        ]);
        expect(r.present).toBe(false);
        expect(r.absentReason).toBe('single_family');
        expect(r.resolution).toBeNull();
    });
});

describe('AC-9 — no production surface consumes a jury score', () => {
    it('the aggregator is imported by tests only', () => {
        // Shadow-only means shadow-only. A gate, a CLI subcommand, or a hook
        // that reads `juryAggregate` would turn an evaluation aid into a
        // verdict carrier — this roadmap's Risk 5, and ADR-257's boundary.
        let out = '';
        try {
            out = execFileSync(
                'grep',
                ['-rl', '--include=*.ts', 'jury_aggregate', 'src', 'tests'],
                { cwd: REPO_ROOT, encoding: 'utf8' },
            );
        } catch {
            out = '';
        }
        const consumers = out
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l !== '' && !l.endsWith('src/scripts/ai_council/jury_aggregate.ts'))
            .filter((l) => !l.startsWith('tests/'));
        expect(consumers).toEqual([]);
    });
});
