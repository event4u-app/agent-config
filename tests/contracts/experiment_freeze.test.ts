/**
 * road-to-experience-loop-broadening step 9.5.
 *
 * verify: a mid-run change to any of the five aborts the comparison rather than
 * continuing it.
 */
import { describe, expect, it } from 'vitest';

import {
    ExperimentDriftError,
    FROZEN_ELEMENTS,
    type ExperimentSpec,
    assertUnchanged,
    changedElements,
    freeze,
} from '../../src/scripts/_lib/experiment_freeze.js';

const SPEC: ExperimentSpec = {
    evaluator: 'paired-verdict@2',
    corpus: 'sha256:abc123',
    task: 'activation-routing',
    baseline: 'arm-control',
    fixtures: ['fixtures/a.json', 'fixtures/b.json'],
};

/** One mutation per frozen element, so all five are covered by construction. */
const MUTATIONS: ReadonlyArray<readonly [string, ExperimentSpec]> = [
    ['evaluator', { ...SPEC, evaluator: 'paired-verdict@3' }],
    ['corpus', { ...SPEC, corpus: 'sha256:def456' }],
    ['task', { ...SPEC, task: 'something-else' }],
    ['baseline', { ...SPEC, baseline: 'arm-other' }],
    ['fixtures', { ...SPEC, fixtures: ['fixtures/a.json'] }],
];

describe('a mid-run change to ANY of the five aborts', () => {
    it('covers every frozen element — the table is not a subset', () => {
        // Without this, a sixth element could be added to the type and silently
        // go untested while the suite still reads as exhaustive.
        expect(MUTATIONS.map(([n]) => n).sort()).toEqual([...FROZEN_ELEMENTS].sort());
    });

    it.each(MUTATIONS)('%s changing aborts the comparison', (name, mutated) => {
        const frozen = freeze(SPEC);
        expect(() => assertUnchanged(frozen, SPEC, mutated)).toThrow(ExperimentDriftError);
        expect(changedElements(SPEC, mutated)).toEqual([name]);
    });

    it('the abort NAMES which element moved', () => {
        // An abort nobody can act on gets suppressed. The message must be
        // enough to fix the run without re-deriving the cause.
        try {
            assertUnchanged(freeze(SPEC), SPEC, { ...SPEC, corpus: 'sha256:moved' });
            expect.unreachable('should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(ExperimentDriftError);
            expect((e as ExperimentDriftError).changed).toEqual(['corpus']);
            expect((e as Error).message).toMatch(/corpus/);
        }
    });

    it('it THROWS rather than returning a verdict', () => {
        // The design decision, asserted: a verdict is a value a caller mid-run
        // can log and step past, and a caller mid-run has every incentive to.
        // Only an abort cannot be quietly absorbed.
        const result = (() => {
            try {
                assertUnchanged(freeze(SPEC), SPEC, { ...SPEC, task: 'x' });
                return 'returned';
            } catch {
                return 'threw';
            }
        })();
        expect(result).toBe('threw');
    });
});

describe('an unchanged set continues', () => {
    it('the identical spec passes', () => {
        expect(() => assertUnchanged(freeze(SPEC), SPEC, SPEC)).not.toThrow();
    });

    it('a reordered fixture list is NOT drift', () => {
        // Order is a property of how the caller enumerated a directory, not of
        // the experiment. A freeze that fired here would be abandoned the first
        // time it fired spuriously -- which is how guards die.
        const reordered = { ...SPEC, fixtures: ['fixtures/b.json', 'fixtures/a.json'] };
        expect(freeze(reordered)).toBe(freeze(SPEC));
        expect(() => assertUnchanged(freeze(SPEC), SPEC, reordered)).not.toThrow();
        expect(changedElements(SPEC, reordered)).toEqual([]);
    });

    it('the digest is stable across calls', () => {
        expect(freeze(SPEC)).toBe(freeze({ ...SPEC }));
    });
});
