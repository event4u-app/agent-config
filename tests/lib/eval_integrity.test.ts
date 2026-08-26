/**
 * Judge hygiene + publication integrity.
 *
 * Each `describe` below is one mechanism that lets a correctly-run benchmark
 * produce a number nobody should act on. They are separate tests because they
 * are separate failures: fixing one does not close another, and a single
 * "the benchmark is honest" test would hide which of them regressed.
 */
import { describe, expect, it } from 'vitest';

import {
    auditAssertions,
    classifyAssertion,
    classifyOverfit,
    evidenceDeficit,
} from '../../src/scripts/_lib/judge_hygiene.js';
import {
    ABORT_REASONS,
    baselineIdentity,
    completenessVerdict,
    coverageExcludingNonActivating,
    discriminationDeficit,
    evaluateThreshold,
    firstAttempts,
    scanLeaks,
    scoreWithImplicitZeros,
    type BaselineIdentity,
    type Receipt,
} from '../../src/scripts/_lib/eval_publication.js';

describe('overfitting classification is advisory and says which shape', () => {
    it('names a vocabulary-shaped criterion', () => {
        expect(classifyOverfit('Output mentions the word idempotent').shape).toBe('vocabulary');
    });

    it('names a technique-shaped criterion', () => {
        expect(classifyOverfit('Solves it by calling the shared resolver').shape).toBe('technique');
    });

    it('leaves an outcome-shaped criterion alone', () => {
        expect(classifyOverfit('The endpoint rejects a cross-tenant id').shape).toBe('outcome');
    });

    it('prefers vocabulary over technique when both markers appear', () => {
        // Vocabulary is the narrower and worse shape, so it wins the label.
        expect(classifyOverfit('Mentions the term retry, implemented as a loop').shape).toBe(
            'vocabulary',
        );
    });
});

describe('an assertion is worth what it separates', () => {
    it('an always-pass assertion is inflation and says so', () => {
        const f = classifyAssertion({ id: 'a', treatment_passes: 6, control_passes: 6, trials: 6 });
        expect(f.verdict).toBe('non-discriminating-always-pass');
        expect(f.action).toContain('remove or replace');
    });

    it('an always-fail assertion is investigated, not removed', () => {
        const f = classifyAssertion({ id: 'b', treatment_passes: 0, control_passes: 0, trials: 6 });
        expect(f.verdict).toBe('non-discriminating-always-fail');
        expect(f.action).toContain('investigate');
    });

    it('treatment over control is where the value is', () => {
        expect(
            classifyAssertion({ id: 'c', treatment_passes: 5, control_passes: 1, trials: 6 }).verdict,
        ).toBe('discriminating');
    });

    it('control over treatment is a finding about the treatment, not a defect', () => {
        const f = classifyAssertion({ id: 'd', treatment_passes: 1, control_passes: 5, trials: 6 });
        expect(f.verdict).toBe('inverted');
        expect(f.action).toContain('keep and read it');
    });

    it('zero trials is not a result', () => {
        expect(classifyAssertion({ id: 'e', treatment_passes: 0, control_passes: 0, trials: 0 }).action).toContain(
            'never exercised',
        );
    });

    it('the audit names how many points every arm is guaranteed', () => {
        const a = auditAssertions([
            { id: '1', treatment_passes: 4, control_passes: 4, trials: 4 },
            { id: '2', treatment_passes: 4, control_passes: 4, trials: 4 },
            { id: '3', treatment_passes: 4, control_passes: 0, trials: 4 },
        ]);
        expect(a.guaranteed_points).toBe(2);
        expect(a.discriminating).toBe(1);
        expect(a.non_discriminating).toBe(2);
    });
});

describe('a pass verdict needs evidence, not the expected label', () => {
    it('rejects a section that is the label plus one vague sentence', () => {
        expect(evidenceDeficit('## Findings\n\nEverything looks fine here.')).toContain('word floor');
    });

    it('rejects prose of any length that cites nothing checkable', () => {
        const body = `## Findings\n\n${'The system behaves as intended and the team is confident about it. '.repeat(3)}`;
        expect(evidenceDeficit(body)).toContain('no checkable reference');
    });

    it('accepts a section citing a path', () => {
        const body =
            '## Findings\n\nThe tenant filter is missing at src/api/orders.ts, so a request carrying ' +
            'another account identifier is served without any ownership comparison at all, and the ' +
            'same shape repeats on every sibling route in that module.';
        expect(evidenceDeficit(body)).toBeNull();
    });

    it('accepts a section citing a measured figure', () => {
        const body =
            '## Findings\n\nThe sweep read 175 files and the slowest concern accounted for 240 ms of ' +
            'the total, which is where the regression sits rather than in the parser itself.';
        expect(evidenceDeficit(body)).toBeNull();
    });
});

describe('a comparison arm that cannot discriminate is not a weak result', () => {
    it('refuses a fixture set the control arm can fully satisfy', () => {
        expect(
            discriminationDeficit([
                { id: 'a', requires_artifact_behaviour: false },
                { id: 'b', requires_artifact_behaviour: false },
            ]),
        ).toContain('cannot adjudicate');
    });

    it('one planted item recoverable only via the behaviour is enough', () => {
        expect(
            discriminationDeficit([
                { id: 'a', requires_artifact_behaviour: false },
                { id: 'b', requires_artifact_behaviour: true },
            ]),
        ).toBeNull();
    });

    it('an empty fixture set is refused rather than passed', () => {
        expect(discriminationDeficit([])).toContain('nothing to recover');
    });
});

describe('under-reporting must not buy a higher ratio', () => {
    it('counts a missed plant as an implicit zero', () => {
        const s = scoreWithImplicitZeros({
            reported: [{ id: 'a', score: 1 }],
            planted: ['a', 'b', 'c', 'd'],
        });
        expect(s.denominator).toBe(4);
        expect(s.ratio).toBe(0.25);
        expect(s.missed).toEqual(['b', 'c', 'd']);
    });

    it('a perfect run over everything planted is 1', () => {
        expect(
            scoreWithImplicitZeros({
                reported: [
                    { id: 'a', score: 1 },
                    { id: 'b', score: 1 },
                ],
                planted: ['a', 'b'],
            }).ratio,
        ).toBe(1);
    });
});

describe('the leak scan reads the transcript, not the configuration', () => {
    it('finds a denied path in a recorded tool input', () => {
        const f = scanLeaks({
            denied: ['tests/fixtures/ground-truth.json'],
            toolInputs: ['ls .', 'cat tests/fixtures/ground-truth.json'],
        });
        expect(f).toHaveLength(1);
        expect(f[0]?.evidence).toContain('ground-truth');
    });

    it('reports each denied path once, however often it was read', () => {
        expect(
            scanLeaks({
                denied: ['scorers/'],
                toolInputs: ['cat scorers/a.ts', 'cat scorers/b.ts'],
            }),
        ).toHaveLength(1);
    });

    it('is silent on a clean run', () => {
        expect(scanLeaks({ denied: ['scorers/'], toolInputs: ['ls src']})).toHaveLength(0);
    });
});

describe('a cached baseline is keyed on the criteria too', () => {
    const base: BaselineIdentity = {
        prompt: 'p',
        fixtures: ['f'],
        rubric: ['r'],
        assertions: ['a'],
        toolExpectations: ['t'],
        turnLimit: 10,
        tokenLimit: 100,
    };

    it('an edited RUBRIC changes the key — the half most often omitted', () => {
        expect(baselineIdentity({ ...base, rubric: ['r2'] })).not.toBe(baselineIdentity(base));
    });

    it('edited assertions, tool expectations and limits each change the key', () => {
        const k = baselineIdentity(base);
        expect(baselineIdentity({ ...base, assertions: ['a2'] })).not.toBe(k);
        expect(baselineIdentity({ ...base, toolExpectations: ['t2'] })).not.toBe(k);
        expect(baselineIdentity({ ...base, turnLimit: 11 })).not.toBe(k);
        expect(baselineIdentity({ ...base, tokenLimit: 101 })).not.toBe(k);
    });

    it('is stable for identical input', () => {
        expect(baselineIdentity(base)).toBe(baselineIdentity({ ...base }));
    });

    it('does not confuse two fields concatenating to the same text', () => {
        expect(baselineIdentity({ ...base, prompt: 'pf', fixtures: [] })).not.toBe(
            baselineIdentity(base),
        );
    });
});

describe('attempt-one accounting and the completeness precondition', () => {
    const r = (over: Partial<Receipt>): Receipt => ({
        caseId: 'c1',
        configuration: 'cfg',
        attempt: 1,
        outcome: 'pass',
        ...over,
    });

    it('keeps the first attempt and never lets a correction replace it', () => {
        const got = firstAttempts([
            r({ attempt: 1, outcome: 'fail' }),
            r({ attempt: 2, outcome: 'pass' }),
        ]);
        expect(got).toHaveLength(1);
        expect(got[0]?.outcome).toBe('fail');
    });

    it('does not collide two configurations whose names concatenate alike', () => {
        const got = firstAttempts([
            r({ configuration: 'ab', caseId: 'c' }),
            r({ configuration: 'a', caseId: 'bc' }),
        ]);
        expect(got).toHaveLength(2);
    });

    it('publishes only when every configuration has one first attempt per case', () => {
        const v = completenessVerdict(
            [r({ caseId: 'c1' }), r({ caseId: 'c2' })],
            ['cfg'],
            ['c1', 'c2'],
        );
        expect(v.publishable).toBe(true);
    });

    it('refuses a missing receipt and names it', () => {
        const v = completenessVerdict([r({ caseId: 'c1' })], ['cfg'], ['c1', 'c2']);
        expect(v.publishable).toBe(false);
        expect(v.reasons.join(' ')).toContain('c2: no first-attempt receipt');
    });

    it('refuses two first attempts for one case', () => {
        const v = completenessVerdict([r({}), r({})], ['cfg'], ['c1']);
        expect(v.publishable).toBe(false);
        expect(v.reasons.join(' ')).toContain('2 first-attempt receipts');
    });

    it('lists EVERY reason, so one fix does not reveal the next a day later', () => {
        const v = completenessVerdict([], ['cfg'], ['c1', 'c2', 'c3']);
        expect(v.reasons).toHaveLength(3);
    });

    it('refuses an abort with no reason, and one outside the allow-list', () => {
        expect(
            completenessVerdict([r({ outcome: 'aborted' })], ['cfg'], ['c1']).reasons.join(' '),
        ).toContain('no reason');
        expect(
            completenessVerdict(
                [r({ outcome: 'aborted', failureReason: 'felt wrong' })],
                ['cfg'],
                ['c1'],
            ).reasons.join(' '),
        ).toContain('unlisted reason');
    });

    it('accepts an abort carrying an allow-listed reason', () => {
        for (const reason of ABORT_REASONS) {
            expect(
                completenessVerdict([r({ outcome: 'aborted', failureReason: reason })], ['cfg'], ['c1'])
                    .publishable,
            ).toBe(true);
        }
    });
});

describe('coverage excludes what cannot self-activate', () => {
    it('reports the non-activating set separately rather than in the rate', () => {
        const c = coverageExcludingNonActivating({
            artifacts: [
                { id: 'a', can_self_activate: true, covered: true },
                { id: 'b', can_self_activate: true, covered: false },
                { id: 'c', can_self_activate: false, covered: false },
            ],
        });
        expect(c.rate).toBe(0.5);
        expect(c.denominator).toBe(2);
        expect(c.dependency_level).toEqual(['c']);
    });

    it('an all-dependency population has NO rate rather than a rate of zero', () => {
        const c = coverageExcludingNonActivating({
            artifacts: [{ id: 'a', can_self_activate: false, covered: false }],
        });
        expect(c.rate).toBeNull();
    });
});

describe('the indeterminate branch is declared before the run', () => {
    const d = { metric: 'lift', pass: 0.6, refute: 0.4 };

    it('supports above the pass bar', () => {
        expect(evaluateThreshold(d, 0.7).outcome).toBe('supported');
    });

    it('refutes at or below the refute bar', () => {
        expect(evaluateThreshold(d, 0.4).outcome).toBe('refuted');
    });

    it('lands indeterminate in between, and says what a null does NOT license', () => {
        const v = evaluateThreshold(d, 0.5);
        expect(v.outcome).toBe('indeterminate');
        expect(v.interpretation_limit).toContain('NO directional reading');
    });

    it('refuses a declaration with no indeterminate band at all', () => {
        expect(() => evaluateThreshold({ metric: 'x', pass: 0.5, refute: 0.5 }, 0.5)).toThrow(
            /no indeterminate band/,
        );
    });
});
