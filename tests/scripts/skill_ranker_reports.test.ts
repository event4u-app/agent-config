// Tests for the three reporting tools added with the sealed-slice work:
// report_skill_ranker_confusion, report_label_agreement, sweep_skill_ranker_signals.
//
// These produce the numbers a published evidence artifact quotes, so what is
// worth guarding is not "does it divide" but the places a report can state
// something its own data does not support:
//
//   1. a comparator that is not a total order — tied rows then come out in
//      engine-defined order and the artifact's "regenerate every figure" claim
//      is false in a way no reader can see;
//   2. a sentinel that collapses two causes — `share: null` means "no threshold"
//      and "no denominator", and attributing it to one states something the
//      neighbouring cell contradicts;
//   3. a slice-independent sentence — the generator emitting "the sealed slice
//      is not read here" on a run that read it;
//   4. an agreement definition that silently changes which rows it keeps.
//
// Fixture-derived throughout: every expectation is computed from constants
// written here, never from the live corpus, so a corpus change cannot make a
// stale number pass.
import { describe, expect, it } from 'vitest';

import {
    agrees,
    type AgreementKind,
} from '../../src/scripts/report_label_agreement';
import {
    confusionPairs,
    falseActivation,
    firstExpectedRank,
    meanReciprocalRank,
    type RowReading,
} from '../../src/scripts/report_skill_ranker_confusion';
import { _body_signals } from '../../src/scripts/skill_tools/score_skill_relevance';

function reading(over: Partial<RowReading> = {}): RowReading {
    return { id: 'r#positives[0]', expected: ['alpha'], rankedFirst: 'beta', topScore: 10, rankOfExpected: 0, ...over };
}

describe('firstExpectedRank — absent is 0, never a sentinel that does arithmetic', () => {
    const rows: [string, number, string[]][] = [
        ['alpha', 30, []],
        ['beta', 20, []],
        ['gamma', 10, []],
    ];

    it('is 1-based, so the top row is 1 and not 0', () => {
        expect(firstExpectedRank(rows, ['alpha'])).toBe(1);
        expect(firstExpectedRank(rows, ['gamma'])).toBe(3);
    });

    it('returns the FIRST expected skill found, not the best-fit one', () => {
        expect(firstExpectedRank(rows, ['gamma', 'beta'])).toBe(2);
    });

    it('returns 0 when no expected skill is ranked at all', () => {
        // 0 rather than Infinity: the reciprocal of "absent" is 0, which is what
        // MRR wants, and a sentinel that participates in arithmetic is how a
        // rank metric quietly becomes a different metric.
        expect(firstExpectedRank(rows, ['delta'])).toBe(0);
        expect(firstExpectedRank([], ['alpha'])).toBe(0);
    });
});

describe('meanReciprocalRank', () => {
    it('averages 1/rank and scores an unranked row as 0, not as a miss it drops', () => {
        const mrr = meanReciprocalRank([
            reading({ rankOfExpected: 1 }),
            reading({ rankOfExpected: 4 }),
            reading({ rankOfExpected: 0 }),
        ]);
        expect(mrr).toBeCloseTo((1 + 0.25 + 0) / 3, 10);
    });

    it('an empty set is 0 rather than a division by zero', () => {
        expect(meanReciprocalRank([])).toBe(0);
    });
});

describe('confusionPairs — a TOTAL order, so the table reproduces', () => {
    it('counts a miss once per (expected-first, ranked-first) pair and skips hits', () => {
        const pairs = confusionPairs([
            reading({ expected: ['a'], rankedFirst: 'x', rankOfExpected: 2 }),
            reading({ expected: ['a'], rankedFirst: 'x', rankOfExpected: 3 }),
            reading({ expected: ['a'], rankedFirst: 'y', rankOfExpected: 2 }),
            reading({ expected: ['a'], rankedFirst: 'a', rankOfExpected: 1 }),
        ]);
        expect(pairs).toEqual([
            { expected: 'a', got: 'x', count: 2 },
            { expected: 'a', got: 'y', count: 1 },
        ]);
    });

    it('keys on the label FIRST skill, so a three-slot label is one confusion', () => {
        // The defect this refuses: counting every skill in a label would turn one
        // row into three confusions and make the frequency column a count of
        // label widths rather than of errors.
        const pairs = confusionPairs([
            reading({ expected: ['a', 'b', 'c'], rankedFirst: 'x', rankOfExpected: 2 }),
        ]);
        expect(pairs).toEqual([{ expected: 'a', got: 'x', count: 1 }]);
    });

    it('breaks a full tie on `got`, so equal rows have ONE order', () => {
        // The previous comparator returned 1 for both argument orders on a full
        // tie — never 0 — leaving equal rows in engine-defined order. Asserted
        // by feeding the same rows in two different orders and requiring one
        // answer, which is the property, not a pinned permutation.
        const rows = [
            reading({ expected: ['a'], rankedFirst: 'zeta', rankOfExpected: 2 }),
            reading({ expected: ['a'], rankedFirst: 'alpha', rankOfExpected: 2 }),
            reading({ expected: ['a'], rankedFirst: 'mid', rankOfExpected: 2 }),
        ];
        const forward = confusionPairs(rows).map((p) => p.got);
        const backward = confusionPairs([...rows].reverse()).map((p) => p.got);
        expect(forward).toEqual(['alpha', 'mid', 'zeta']);
        expect(backward).toEqual(forward);
    });

    it('names an unranked miss rather than dropping it', () => {
        const pairs = confusionPairs([
            reading({ expected: ['a'], rankedFirst: null, rankOfExpected: 0 }),
        ]);
        expect(pairs).toEqual([{ expected: 'a', got: '(nothing ranked)', count: 1 }]);
    });

    it('honours the limit', () => {
        const rows = ['p', 'q', 'r'].map((got) =>
            reading({ expected: ['a'], rankedFirst: got, rankOfExpected: 2 }),
        );
        expect(confusionPairs(rows, 2)).toHaveLength(2);
    });
});

describe('falseActivation — null means one of TWO things and says which', () => {
    const hit = (score: number): RowReading => reading({ rankOfExpected: 1, topScore: score });

    it('compares the empties against the median top score of a correct hit', () => {
        const fa = falseActivation([hit(10), hit(20), hit(30)], [5, 20, 25]);
        expect(fa.median_correct_hit_score).toBe(20);
        expect(fa.at_or_above_median).toBe(2);
        expect(fa.share).toBe(round3(2 / 3));
    });

    it('averages the two middle scores on an even number of hits', () => {
        const fa = falseActivation([hit(10), hit(20), hit(30), hit(40)], []);
        expect(fa.median_correct_hit_score).toBe(25);
    });

    it('reports share null — never a measured 100 % — when NO row is a correct hit', () => {
        // The defect this refuses: a median of 0 makes every empty "at or above"
        // it, since every score is >= 0, and prints a 100 % false-activation
        // rate from a degenerate threshold.
        const fa = falseActivation([reading({ rankOfExpected: 2 })], [1, 2, 3]);
        expect(fa.correct_hits).toBe(0);
        expect(fa.share).toBeNull();
        expect(fa.at_or_above_median).toBe(0);
    });

    it('reports share null when there are no empties to compare', () => {
        const fa = falseActivation([hit(10)], []);
        expect(fa.correct_hits).toBe(1);
        expect(fa.share).toBeNull();
    });

    function round3(n: number): number {
        return Math.round(n * 1000) / 1000;
    }
});

describe('agrees — three definitions, and they are not interchangeable', () => {
    const cases: [string[], string[], Record<AgreementKind, boolean>][] = [
        [['a'], ['a'], { exact: true, overlap: true, polarity: true }],
        [['a', 'b'], ['b', 'a'], { exact: true, overlap: true, polarity: true }],
        [['a', 'b'], ['b', 'c'], { exact: false, overlap: true, polarity: true }],
        [['a'], ['z'], { exact: false, overlap: false, polarity: true }],
        [['a'], [], { exact: false, overlap: false, polarity: false }],
        [[], [], { exact: true, overlap: true, polarity: true }],
    ];

    for (const [first, second, want] of cases) {
        it(`[${first.join()}] vs [${second.join()}] — exact ${String(want.exact)}, overlap ${String(want.overlap)}, polarity ${String(want.polarity)}`, () => {
            expect(agrees(first, second, 'exact')).toBe(want.exact);
            expect(agrees(first, second, 'overlap')).toBe(want.overlap);
            expect(agrees(first, second, 'polarity')).toBe(want.polarity);
        });
    }

    it('is symmetric in its two seats — neither is privileged', () => {
        for (const [first, second] of cases) {
            for (const kind of ['exact', 'overlap', 'polarity'] as const) {
                expect(agrees(first, second, kind), `${kind} on [${first.join()}]/[${second.join()}]`).toBe(
                    agrees(second, first, kind),
                );
            }
        }
    });

    it('exact agreement is a SUBSET of overlap, which is a subset of polarity', () => {
        // The ordering is the whole reason three definitions are reported: a
        // definition that kept rows a weaker one dropped would make the three
        // top-1 figures incomparable.
        for (const [first, second] of cases) {
            if (agrees(first, second, 'exact')) expect(agrees(first, second, 'overlap')).toBe(true);
            if (agrees(first, second, 'overlap')) expect(agrees(first, second, 'polarity')).toBe(true);
        }
    });
});

describe('_body_signals — the bounds, asserted directly rather than through rank()', () => {
    it('keeps a `###` subsection inside `## When to use`, title and body', () => {
        const got = _body_signals(
            '## When to use\n\nalways\n\n### Do NOT use when\n\nnever\n\n## Procedure\n\nsteps\n',
        );
        expect(got.whenToUse).toContain('always');
        expect(got.whenToUse).toContain('Do NOT use when');
        expect(got.whenToUse).toContain('never');
        expect(got.whenToUse).not.toContain('steps');
    });

    it('ends the section at a sibling `##`, so one section is not the whole file', () => {
        const got = _body_signals('## When to use\n\nalways\n\n## Gotchas\n\ntrap\n');
        expect(got.whenToUse).toBe('always');
    });

    it('a `##` line inside a fence is neither a heading nor a section terminator', () => {
        const got = _body_signals('## When to use\n\nalways\n\n```markdown\n## Not A Heading\n```\n\nstill\n');
        expect(got.headings).toEqual(['When to use']);
        expect(got.whenToUse).toContain('still');
    });

    it('drops the fence delimiter and its info string, which are not prose', () => {
        // The defect this refuses: pushing the delimiter put the language tag of
        // every fenced sample into the index, so `bash` became a topic term.
        const got = _body_signals('## When to use\n\n```bash\nrun it\n```\n');
        expect(got.whenToUse).not.toContain('bash');
        expect(got.whenToUse).toContain('run it');
    });

    it('a shorter inner fence does not close a longer outer one', () => {
        const got = _body_signals('## When to use\n\n````\n```\n## Still Fenced\n```\n````\n\nafter\n');
        expect(got.headings).toEqual(['When to use']);
        expect(got.whenToUse).toContain('after');
    });

    it('collects `##` and `###` headings and stops at `####`', () => {
        const got = _body_signals('## Two\n\n### Three\n\n#### Four\n');
        expect(got.headings).toEqual(['Two', 'Three']);
    });

    it('a body with no When-to-use section yields an empty capture, not the whole body', () => {
        const got = _body_signals('## Procedure\n\nsteps\n');
        expect(got.whenToUse).toBe('');
        expect(got.headings).toEqual(['Procedure']);
    });

    it('a nested heading that also says "when to use" does not re-level the section', () => {
        // The defect: assigning `whenLevel` unconditionally let a `###` whose
        // own title starts with "when to use" overwrite the outer level 2 with
        // 3, after which the NEXT sibling `###` closed the section early and
        // everything from it to the real end was dropped.
        const got = _body_signals(
            [
                '## When to use',
                'outer prose',
                '### When to use it on a monorepo',
                'inner prose',
                '### Another subsection',
                'sibling prose',
                '## Procedure',
                'steps',
            ].join('\n'),
        );
        expect(got.whenToUse).toContain('outer prose');
        expect(got.whenToUse).toContain('inner prose');
        expect(got.whenToUse).toContain('sibling prose');
        expect(got.whenToUse).not.toContain('steps');
    });

    it('a level-1 heading closes the section — it is strictly higher', () => {
        const got = _body_signals('## When to use\n\nalways\n\n# New Top Section\n\nleaked prose\n');
        expect(got.whenToUse).toBe('always');
        expect(got.whenToUse).not.toContain('leaked prose');
        // `#` is a document title, not a topic the ranker should index.
        expect(got.headings).toEqual(['When to use']);
    });
});
