/**
 * The stop predicate, and the sensitivity proof its blocker demanded.
 *
 * `early-stop-vs-dissent-ordering` resolves only when *"the conjunct is in the
 * predicate and its sensitivity has been demonstrated red-then-green."* A test
 * that only exercises the happy path would satisfy neither half — so the
 * conformity-collapse fixture below is run BOTH ways: through the shipped
 * predicate, which must not stop, and through a neutered copy with the conjunct
 * removed, which must stop. The second is the red arm, and it is what makes the
 * first mean anything.
 */
import { describe, expect, it } from 'vitest';

import {
    MIN_ROUNDS,
    type StopInputs,
    evaluateStop,
    renderStop,
} from '../../src/scripts/ai_council/argument_exhaustion';

/** A run where the argument genuinely is finished. */
const EXHAUSTED: StopInputs = {
    roundsCompleted: 3,
    dissentRepairAttempted: true,
    selfNearDuplicate: [true, true, true],
    unresolvedAdversarialTriggers: 0,
};

/**
 * CONFORMITY COLLAPSE — the fixture the whole blocker is about.
 *
 * Indistinguishable from EXHAUSTED on every cost-visible axis: enough rounds,
 * everyone repeating themselves, no open objection. The ONLY difference is that
 * the anti-conformity defence never ran, so the agreement is untested.
 */
const CONFORMITY_COLLAPSE: StopInputs = {
    roundsCompleted: 3,
    dissentRepairAttempted: false,
    selfNearDuplicate: [true, true, true],
    unresolvedAdversarialTriggers: 0,
};

/** The predicate with the ordering conjunct REMOVED — the sabotage arm. */
function evaluateWithoutOrderingConjunct(x: StopInputs): boolean {
    return (
        x.roundsCompleted >= MIN_ROUNDS &&
        x.selfNearDuplicate.length > 0 &&
        x.selfNearDuplicate.every((d) => d) &&
        x.unresolvedAdversarialTriggers === 0
    );
}

describe('the ordering conjunct — red then green', () => {
    it('RED: remove the conjunct and the conformity-collapse fixture stops', () => {
        // This is the failure the blocker names: early stop fires on conformity
        // collapse and is reported as convergence.
        expect(evaluateWithoutOrderingConjunct(CONFORMITY_COLLAPSE)).toBe(true);
    });

    it('GREEN: with the conjunct in the shipped predicate, it does NOT stop', () => {
        const v = evaluateStop(CONFORMITY_COLLAPSE);
        expect(v.stop).toBe(false);
        expect(v.blockers).toContain('dissent-repair-not-attempted');
    });

    it('and the sabotage arm still agrees with the real one where it should', () => {
        // Sensitivity is only meaningful if the neutered copy differs on the ONE
        // axis under test. If it disagreed everywhere it would prove nothing.
        expect(evaluateWithoutOrderingConjunct(EXHAUSTED)).toBe(true);
        expect(evaluateStop(EXHAUSTED).stop).toBe(true);
    });
});

describe('removing any one condition makes a fixture stop that must not', () => {
    it.each([
        ['too-few-rounds', { ...EXHAUSTED, roundsCompleted: 1 }],
        ['dissent-repair-not-attempted', { ...EXHAUSTED, dissentRepairAttempted: false }],
        ['members-still-adding', { ...EXHAUSTED, selfNearDuplicate: [true, false, true] }],
        ['unresolved-adversarial-trigger', { ...EXHAUSTED, unresolvedAdversarialTriggers: 1 }],
    ] as const)('%s blocks the stop on its own', (blocker, input) => {
        const v = evaluateStop(input);
        expect(v.stop).toBe(false);
        expect(v.blockers).toContain(blocker);
    });

    it('reports EVERY failing condition, not just the first', () => {
        const v = evaluateStop({
            roundsCompleted: 1,
            dissentRepairAttempted: false,
            selfNearDuplicate: [false],
            unresolvedAdversarialTriggers: 2,
        });
        expect(v.blockers).toHaveLength(4);
    });
});

describe('majority size can never trigger a stop (6.3)', () => {
    it('unanimous but unrepaired does not stop', () => {
        // Unanimity is the most available signal and the least trustworthy one
        // here: it is exactly what conformity collapse produces.
        expect(evaluateStop({ ...CONFORMITY_COLLAPSE, selfNearDuplicate: [true, true, true, true, true] }).stop).toBe(
            false,
        );
    });

    it('a LARGER majority does not make the stop any easier', () => {
        const small = evaluateStop({ ...CONFORMITY_COLLAPSE, selfNearDuplicate: [true, true] });
        const large = evaluateStop({
            ...CONFORMITY_COLLAPSE,
            selfNearDuplicate: Array.from({ length: 20 }, () => true),
        });
        expect(small.stop).toBe(large.stop);
        expect(large.stop).toBe(false);
    });
});

describe('an empty council is not an exhausted one', () => {
    it('no present member blocks rather than stopping vacuously', () => {
        // `every()` over an empty array is true, which would make an empty
        // council the easiest one to stop — the opposite of the intent.
        const v = evaluateStop({ ...EXHAUSTED, selfNearDuplicate: [] });
        expect(v.stop).toBe(false);
        expect(v.blockers).toContain('no-members-present');
    });
});

describe('a stopped run is textually distinguishable from a full one (6.4)', () => {
    const text = renderStop({
        roundsCompleted: 3,
        roundsConfigured: 5,
        savedCalls: 4,
        savedCostUsd: 0.1234,
        exhaustedMembers: ['anthropic', 'openai'],
    });

    it('names that it stopped, and at which round of how many', () => {
        expect(text).toContain('STOPPED EARLY');
        expect(text).toContain('round 3 of 5');
    });

    it('names the reason, the saved calls and cost, and which members', () => {
        expect(text).toContain('argument exhaustion');
        expect(text).toContain('4 call(s)');
        expect(text).toContain('$0.1234');
        expect(text).toContain('anthropic, openai');
    });

    it('states outright that the remaining rounds did not execute', () => {
        // The failure this prevents is quiet: an artifact reading as though all
        // configured rounds ran is a claim about deliberation depth nobody made
        // on purpose.
        expect(text).toContain('NOT a full run');
    });
});

describe('the minimum-rounds floor', () => {
    it('is 2 — one round is an opening statement, not an argument', () => {
        expect(MIN_ROUNDS).toBe(2);
        expect(evaluateStop({ ...EXHAUSTED, roundsCompleted: MIN_ROUNDS }).stop).toBe(true);
        expect(evaluateStop({ ...EXHAUSTED, roundsCompleted: MIN_ROUNDS - 1 }).stop).toBe(false);
    });
});
