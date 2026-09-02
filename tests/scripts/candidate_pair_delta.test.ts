/**
 * The paired-delta producer: pairing, sign convention, ties, and every refusal.
 *
 * Written as refutations rather than confirmations. Each case names the wrong
 * behaviour it would catch, because a producer whose failure mode is a silently
 * smaller denominator cannot be checked by asserting that the happy path
 * returns a number.
 */
import { describe, expect, it } from 'vitest';

import {
    PairingError,
    TIE_EPSILON,
    compareArms,
    comparisonVector,
    pairCandidates,
    pairedDeltas,
    pairingKey,
} from '../../src/scripts/_lib/candidate_pair_delta.js';
import {
    CANDIDATE_RECORD_VERSION,
    type CandidateRecord,
    type MutationDimension,
} from '../../src/scripts/_lib/candidate_record.js';
import {
    ARTIFACT_COUNT_METRIC,
    artifactCountRow,
    promotionVerdict,
} from '../../src/scripts/_lib/evaluation_vector.js';
import { MIN_DISCORDANT } from '../../src/scripts/_lib/paired_verdict.js';

function rec(
    id: string,
    dimension: MutationDimension,
    path: string,
    content: string,
): CandidateRecord {
    return {
        kind: 'candidate',
        version: CANDIDATE_RECORD_VERSION,
        id,
        dimension,
        lifecycle: 'proposed',
        mutations: [{ path, content }],
    };
}

const SUBJECT_A = '.claude/rules/a.md';
const SUBJECT_B = '.claude/rules/b.md';

describe('pairingKey', () => {
    it('is independent of the candidate id, which is the only way two arms pair at all', () => {
        const control = rec('con-1111', 'content', SUBJECT_A, 'control body');
        const treatment = rec('con-2222', 'content', SUBJECT_A, 'treatment body');
        expect(control.id).not.toBe(treatment.id);
        expect(pairingKey(control)).toBe(pairingKey(treatment));
    });

    it('separates two observations on the same subject but different dimensions', () => {
        expect(pairingKey(rec('a', 'content', SUBJECT_A, 'x'))).not.toBe(
            pairingKey(rec('a', 'activation', SUBJECT_A, 'x')),
        );
    });
});

describe('pairCandidates', () => {
    it('gives both arms of a pair the same mutation-path set, which is why no path count can differ', () => {
        // The regression pin for the constant-zero artifact row: the key folds
        // the sorted path list, so a pair can only ever hold two records over
        // the same paths, and any count taken over them differs by exactly 0.
        // A future author tempted to derive the artifact delta from the pairs
        // has to delete this assertion first.
        const [pair] = pairCandidates(
            [rec('c', 'content', SUBJECT_A, 'one')],
            [rec('t', 'content', SUBJECT_A, 'two')],
        );
        const paths = (r: CandidateRecord) => r.mutations.map((m) => m.path).sort();
        expect(paths(pair?.control as CandidateRecord)).toEqual(paths(pair?.treatment as CandidateRecord));
        expect(() =>
            pairCandidates(
                [rec('c', 'content', SUBJECT_A, 'one')],
                [
                    {
                        ...rec('t', 'content', SUBJECT_A, 'two'),
                        mutations: [
                            { path: SUBJECT_A, content: 'two' },
                            { path: SUBJECT_B, content: 'extra' },
                        ],
                    },
                ],
            ),
        ).toThrow(PairingError);
    });

    it('refuses an unmatched control record rather than dropping it', () => {
        expect(() =>
            pairCandidates([rec('c', 'content', SUBJECT_A, 'x')], []),
        ).toThrow(PairingError);
    });

    it('refuses an unmatched treatment record rather than dropping it', () => {
        expect(() =>
            pairCandidates([], [rec('t', 'content', SUBJECT_A, 'x')]),
        ).toThrow(PairingError);
    });

    it('refuses two records for one observation on either arm', () => {
        const a = rec('a', 'content', SUBJECT_A, 'x');
        const b = rec('b', 'content', SUBJECT_A, 'y');
        expect(() => pairCandidates([a], [a, b])).toThrow(PairingError);
        expect(() => pairCandidates([a, b], [a])).toThrow(PairingError);
    });

    it('flags identical arms instead of throwing, because every trial then ties', () => {
        const same = rec('s', 'content', SUBJECT_A, 'identical');
        const [pair] = pairCandidates([same], [same]);
        expect(pair?.identical_arms).toBe(true);
    });

    it('does not flag arms whose bytes differ', () => {
        const [pair] = pairCandidates(
            [rec('c', 'content', SUBJECT_A, 'one')],
            [rec('t', 'content', SUBJECT_A, 'two')],
        );
        expect(pair?.identical_arms).toBe(false);
    });
});

describe('pairedDeltas', () => {
    it('makes positive favour the treatment for a higher-better metric', () => {
        expect(pairedDeltas([{ trial_id: 't', control: 1, treatment: 3 }], 'higher-better')).toEqual([2]);
    });

    it('reverses the subtraction for a lower-better metric, so positive still favours the treatment', () => {
        expect(pairedDeltas([{ trial_id: 't', control: 3, treatment: 1 }], 'lower-better')).toEqual([2]);
    });

    it('refuses zero trials rather than returning an empty verdict', () => {
        expect(() => pairedDeltas([], 'higher-better')).toThrow(PairingError);
    });

    it('refuses a duplicate trial id, which would inflate the discordant count', () => {
        expect(() =>
            pairedDeltas(
                [
                    { trial_id: 't', control: 1, treatment: 2 },
                    { trial_id: 't', control: 1, treatment: 2 },
                ],
                'higher-better',
            ),
        ).toThrow(PairingError);
    });

    it('refuses a non-finite outcome rather than reading it as zero', () => {
        expect(() =>
            pairedDeltas([{ trial_id: 't', control: Number.NaN, treatment: 1 }], 'higher-better'),
        ).toThrow(PairingError);
    });
});

describe('compareArms', () => {
    const control = [rec('c1', 'content', SUBJECT_A, 'c'), rec('c2', 'content', SUBJECT_B, 'c')];
    const treatment = [rec('t1', 'content', SUBJECT_A, 't'), rec('t2', 'content', SUBJECT_B, 't')];
    const keyA = pairingKey(control[0] as CandidateRecord);
    const keyB = pairingKey(control[1] as CandidateRecord);

    it('refuses a pair with no trials rather than shrinking the denominator', () => {
        expect(() =>
            compareArms({
                control,
                treatment,
                outcomes: { [keyA]: [{ trial_id: 'x', control: 0, treatment: 1 }] },
                direction: 'higher-better',
            }),
        ).toThrow(PairingError);
    });

    it('pools trials across pairs, which is what lifts the sample off the discordant floor', () => {
        // Trial ids are unique across the whole comparison, per TrialOutcome:
        // pooling makes every pair's deltas one sample, so an id reused on
        // another pair is one measurement contributing twice to it.
        const trials = (tag: string, n: number, delta: number) =>
            Array.from({ length: n }, (_, i) => ({
                trial_id: `${tag}-t${String(i)}`,
                control: 0,
                treatment: delta,
            }));
        const result = compareArms({
            control,
            treatment,
            outcomes: { [keyA]: trials('a', 3, 1), [keyB]: trials('b', 3, 1) },
            direction: 'higher-better',
        });
        expect(result.pairs).toHaveLength(2);
        expect(result.trials).toBe(6);
        expect(result.trials).toBeGreaterThan(MIN_DISCORDANT);
        expect(result.verdict.kind).toBe('pass');
    });

    it('returns underpowered when both arms are identical, and names the pairs that caused it', () => {
        const same = [rec('s1', 'content', SUBJECT_A, 'same'), rec('s2', 'content', SUBJECT_B, 'same')];
        const result = compareArms({
            control: same,
            treatment: same,
            outcomes: {
                [keyA]: [{ trial_id: 'a', control: 1, treatment: 1 }],
                [keyB]: [{ trial_id: 'b', control: 1, treatment: 1 }],
            },
            direction: 'higher-better',
        });
        expect(result.verdict.kind).toBe('underpowered');
        expect(result.identical_pairs).toEqual([keyA, keyB]);
    });

    it('refuses an outcomes key that matches no pair, not only a pair with no outcomes', () => {
        expect(() =>
            compareArms({
                control,
                treatment,
                outcomes: {
                    [keyA]: [{ trial_id: 'a', control: 0, treatment: 1 }],
                    [keyB]: [{ trial_id: 'b', control: 0, treatment: 1 }],
                    'content .claude/rules/typo.md': [{ trial_id: 'c', control: 0, treatment: 1 }],
                },
                direction: 'higher-better',
            }),
        ).toThrow(PairingError);
    });

    it('refuses one trial id reused across two pairs, which the per-pair check cannot see', () => {
        expect(() =>
            compareArms({
                control,
                treatment,
                outcomes: {
                    [keyA]: [{ trial_id: 'shared', control: 0, treatment: 1 }],
                    [keyB]: [{ trial_id: 'shared', control: 0, treatment: 1 }],
                },
                direction: 'higher-better',
            }),
        ).toThrow(PairingError);
    });

    it('treats a delta inside the tie epsilon as a tie, matching the A/B report', () => {
        const result = compareArms({
            control: [control[0] as CandidateRecord],
            treatment: [treatment[0] as CandidateRecord],
            outcomes: {
                [keyA]: [{ trial_id: 'a', control: 0, treatment: TIE_EPSILON / 2 }],
            },
            direction: 'higher-better',
        });
        expect(result.verdict.discordant).toBe(0);
    });
});

describe('comparisonVector', () => {
    const control = [rec('c1', 'content', SUBJECT_A, 'c')];
    const treatment = [rec('t1', 'content', SUBJECT_A, 't')];

    function passing() {
        return compareArms({
            control,
            treatment,
            outcomes: {
                [pairingKey(control[0] as CandidateRecord)]: Array.from({ length: 6 }, (_, i) => ({
                    trial_id: `t${String(i)}`,
                    control: 0,
                    treatment: 1,
                })),
            },
            direction: 'higher-better',
        });
    }

    it('always carries the artifact-count row, because the vector builder refuses one without it', () => {
        const vector = comparisonVector('cmp-1', 'route-recall', 'higher-better', passing(), 0);
        expect(vector.rows.map((r) => r.metric)).toContain(ARTIFACT_COUNT_METRIC);
        expect(vector.rows.filter((r) => r.kind === 'paired')).toHaveLength(1);
    });

    it('carries the delta it was GIVEN, which is the assertion a constant-zero row survives', () => {
        for (const delta of [-2, 0, 1, 7]) {
            const row = artifactCountRow(
                comparisonVector('cmp-1', 'route-recall', 'higher-better', passing(), delta),
            );
            expect(row?.delta).toBe(delta);
        }
    });

    it('makes the ceiling branch reachable: a positive delta blocks a vector that otherwise passes', () => {
        const comparison = passing();
        expect(comparison.verdict.kind).toBe('pass');
        const clean = promotionVerdict(comparisonVector('cmp-ok', 'route-recall', 'higher-better', comparison, 0));
        expect(clean.promote).toBe(true);
        const grown = promotionVerdict(comparisonVector('cmp-grow', 'route-recall', 'higher-better', comparison, 1));
        expect(grown.promote).toBe(false);
        expect(grown.blocking).toContain(ARTIFACT_COUNT_METRIC);
    });

    it('refuses a fractional or non-finite delta rather than rounding it into a ceiling comparison', () => {
        for (const bad of [0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
            expect(() =>
                comparisonVector('cmp-1', 'route-recall', 'higher-better', passing(), bad),
            ).toThrow(PairingError);
        }
    });
});
