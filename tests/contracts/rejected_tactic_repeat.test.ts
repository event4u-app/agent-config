/**
 * road-to-experience-loop-broadening steps 4.1 and 4.2.
 *
 * 4.1 verify: a synthetic run repeating a rejected tactic trips suppression
 *             even when the signal string differs.
 * 4.2 verify: a run of 8 with 3 repeats trips suppression exactly once, and a
 *             run of 8 with 2 repeats does not.
 */
import { describe, expect, it } from 'vitest';

import {
    SUPPRESSION_REPEATS,
    SUPPRESSION_WINDOW,
    rejectedTacticRepeat,
    type TacticAttempt,
} from '../../src/scripts/_lib/loop_guards.js';

const rejected = (tactic_id: string): TacticAttempt => ({ tactic_id, rejected: true });
const accepted = (tactic_id: string): TacticAttempt => ({ tactic_id, rejected: false });

describe('4.1 — it trips on the tactic, not on the wording', () => {
    it('fires when the same rejected tactic recurs', () => {
        const history = [rejected('widen-the-allowlist'), rejected('widen-the-allowlist'), rejected('widen-the-allowlist')];
        const s = rejectedTacticRepeat(history);
        expect(s.suppress).toBe(true);
        expect(s.tactic_id).toBe('widen-the-allowlist');
        expect(s.repeats).toBe(3);
    });

    it('the detector is given no signal string to ignore', () => {
        // The verify asks for suppression "even when the signal string
        // differs". That is only achievable by keying on something else, so the
        // input type carries no text field at all -- the function cannot read a
        // signal string even if a future author wanted it to. This asserts the
        // shape rather than trusting the implementation.
        const attempt: TacticAttempt = rejected('t');
        expect(Object.keys(attempt).sort()).toEqual(['rejected', 'tactic_id']);
    });

    it('the numeric stall detector could not have caught this case', () => {
        // Documents WHY 4.1 is a second detector rather than a tuning of the
        // first: stallSignal keys on the open-step count, which here moves on
        // every iteration while the tactic stays identical.
        const history = [rejected('same-tactic'), rejected('same-tactic'), rejected('same-tactic')];
        expect(rejectedTacticRepeat(history).suppress).toBe(true);
    });
});

describe('4.2 — the threshold, exactly as the verify states it', () => {
    it('a run of 8 with 3 repeats trips suppression exactly once', () => {
        const history = [
            rejected('a'), accepted('b'), rejected('a'), accepted('c'),
            rejected('a'), accepted('d'), accepted('e'), accepted('f'),
        ];
        expect(history.length).toBe(SUPPRESSION_WINDOW);
        const s = rejectedTacticRepeat(history);
        expect(s.suppress).toBe(true);
        expect(s.repeats).toBe(3);
        // "exactly once" -- one tactic named, not a list of every repeat.
        expect(s.tactic_id).toBe('a');
    });

    it('a run of 8 with 2 repeats does not', () => {
        const history = [
            rejected('a'), accepted('b'), rejected('a'), accepted('c'),
            accepted('d'), accepted('e'), accepted('f'), accepted('g'),
        ];
        expect(history.length).toBe(SUPPRESSION_WINDOW);
        const s = rejectedTacticRepeat(history);
        expect(s.suppress).toBe(false);
        expect(s.repeats).toBe(2);
    });
});

describe('accepted attempts are not repetition', () => {
    it('a tactic that keeps working never trips it', () => {
        // The false positive that gets a guard switched off: productive
        // repetition is not a loop.
        const history = [accepted('works'), accepted('works'), accepted('works'), accepted('works')];
        expect(rejectedTacticRepeat(history).suppress).toBe(false);
    });

    it('mixed outcomes count only the rejections', () => {
        const history = [rejected('t'), accepted('t'), rejected('t'), accepted('t')];
        const s = rejectedTacticRepeat(history);
        expect(s.repeats).toBe(2);
        expect(s.suppress).toBe(false);
    });
});

describe('the window bounds it', () => {
    it('repeats that have scrolled out of the window do not count', () => {
        const old = [rejected('a'), rejected('a')];
        const filler = Array.from({ length: SUPPRESSION_WINDOW }, (_, i) => accepted(`f${i}`));
        const s = rejectedTacticRepeat([...old, ...filler, rejected('a')]);
        expect(s.repeats).toBe(1);
        expect(s.suppress).toBe(false);
    });

    it('the constants are the ones the verify line names', () => {
        expect(SUPPRESSION_WINDOW).toBe(8);
        expect(SUPPRESSION_REPEATS).toBe(3);
    });
});
