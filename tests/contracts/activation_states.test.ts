/**
 * road-to-experience-loop-broadening step 5.1.
 *
 * verify: a failing case is classifiable into one of the five states, and a
 * case with an unobserved rung reports `unknown` rather than a success or a
 * failure.
 */
import { describe, expect, it } from 'vitest';

import {
    ACTIVATION_STATES,
    type ActivationState,
    classify,
    countsTowardWinRate,
    isActivationState,
} from '../../src/scripts/_lib/activation_states.js';

describe('classify — every failing case lands in exactly one of the five', () => {
    it.each<[string, Parameters<typeof classify>[0], ActivationState]>([
        ['asset absent', { available: false, activated: null, followed: null }, 'not-available'],
        ['present, never loaded', { available: true, activated: false, followed: null }, 'available-not-activated'],
        ['loaded, not conformed to', { available: true, activated: true, followed: false }, 'activated-not-followed'],
        ['loaded and conformed to', { available: true, activated: true, followed: true }, 'activated-followed'],
    ])('%s', (_label, obs, expected) => {
        const state = classify(obs);
        expect(state).toBe(expected);
        expect(isActivationState(state)).toBe(true);
        expect(ACTIVATION_STATES).toContain(state);
    });
});

describe('an unobserved rung reports unknown, never a success and never a failure', () => {
    // This is the half the verify line is actually about. `null` means the
    // instrument did not see -- a statement about the instrument, not about the
    // asset -- so collapsing it into either direction manufactures a signal.
    it.each([
        ['availability unobserved', { available: null, activated: true, followed: true }],
        ['activation unobserved', { available: true, activated: null, followed: true }],
        ['adherence unobserved', { available: true, activated: true, followed: null }],
        ['nothing observed at all', { available: null, activated: null, followed: null }],
    ])('%s → unknown', (_label, obs) => {
        const state = classify(obs);
        expect(state).toBe('unknown');
        // Stated as its own assertion rather than implied by the line above:
        // the bug this guards against is `unknown` being *reported* as one of
        // the two outcome states downstream.
        expect(state).not.toBe('activated-followed');
        expect(state).not.toBe('activated-not-followed');
        expect(countsTowardWinRate(state)).toBe(false);
    });
});

describe('an irrelevant rung is not an unknown rung', () => {
    // The short-circuit that makes this a function rather than a lookup table.
    // Once the asset is known absent, "was it followed" is not unobserved --
    // it is meaningless. Answering `unknown` there would hide a fact the
    // instrument actually established.
    it('absent asset with everything else unobserved is not-available, not unknown', () => {
        expect(classify({ available: false, activated: null, followed: null })).toBe('not-available');
    });

    it('never-loaded asset with adherence unobserved is available-not-activated, not unknown', () => {
        expect(classify({ available: true, activated: false, followed: null })).toBe('available-not-activated');
    });
});

describe('the win-rate denominator is chosen once, not per column', () => {
    it('counts only the two states that are facts about the asset being used', () => {
        const counted = ACTIVATION_STATES.filter(countsTowardWinRate);
        expect(counted).toEqual(['activated-not-followed', 'activated-followed']);
    });

    it('excludes not-available, because absence is not a quality signal', () => {
        expect(countsTowardWinRate('not-available')).toBe(false);
    });
});
