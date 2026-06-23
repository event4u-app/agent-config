import { describe, expect, it } from 'vitest';

import { MAX_ATTEMPTS_PER_TARGET, breachedGuardrails, budgetHalt, isLayerDisabled } from '../../src/scripts/_lib/subagent_steering.js';

describe('isLayerDisabled — kill-switch', () => {
    it('master switch off → disabled', () => {
        expect(isLayerDisabled({ enabled: false, auto: 'on' })).toBe(true);
    });
    it('auto off → disabled', () => {
        expect(isLayerDisabled({ enabled: true, auto: 'off' })).toBe(true);
    });
    it('enabled + auto on/ask → active', () => {
        expect(isLayerDisabled({ enabled: true, auto: 'on' })).toBe(false);
        expect(isLayerDisabled({ enabled: true, auto: 'ask' })).toBe(false);
    });
});

describe('budgetHalt — N=3 per target', () => {
    it('halts at the cap, not before', () => {
        expect(budgetHalt(MAX_ATTEMPTS_PER_TARGET - 1)).toBe(false);
        expect(budgetHalt(MAX_ATTEMPTS_PER_TARGET)).toBe(true);
        expect(budgetHalt(MAX_ATTEMPTS_PER_TARGET + 1)).toBe(true);
    });
});

describe('breachedGuardrails — surfaced, not auto-disable', () => {
    it('all within bounds → no breach', () => {
        expect(
            breachedGuardrails({ token_ratio: 1.5, spawn_failure_rate: 0.05, verify_skip_rate: 0.0, user_override_rate: 0.1 }),
        ).toEqual([]);
    });

    it('token blowup over 2x → breach', () => {
        expect(breachedGuardrails({ token_ratio: 2.5, spawn_failure_rate: 0, verify_skip_rate: 0, user_override_rate: 0 })).toContain('token_blowup');
    });

    it('verify skip over 1% → breach (safety)', () => {
        expect(breachedGuardrails({ token_ratio: 1, spawn_failure_rate: 0, verify_skip_rate: 0.02, user_override_rate: 0 })).toContain('verify_skip');
    });

    it('multiple breaches reported together', () => {
        const b = breachedGuardrails({ token_ratio: 3, spawn_failure_rate: 0.2, verify_skip_rate: 0.05, user_override_rate: 0.5 });
        expect(b).toEqual(expect.arrayContaining(['token_blowup', 'spawn_failure', 'verify_skip', 'user_override']));
    });
});
