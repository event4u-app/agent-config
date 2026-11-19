// road-to-an-arena-and-a-panel Phase 4 — a resolvable key is not consent to
// spend: council:status says the metered rung is withheld unless the operator
// opted in with fallback.api_on_cli_loss.
import { describe, expect, it } from 'vitest';

import { fallbackPostureFor, renderPostureLines, type PostureInput } from '../../../src/scripts/_lib/council_fallback_posture.js';

const base: PostureInput = {
    transport: 'cli',
    hasApiRung: true,
    apiKeyRef: null,
    refResolves: undefined,
    keylessResolves: () => true,
};

describe('fallbackPostureFor', () => {
    it('asks once per run by default, when nothing is stored (D6)', () => {
        expect(fallbackPostureFor(base)).toBe('ask');
    });
    it('withholds the metered rung when the operator stored false', () => {
        expect(fallbackPostureFor({ ...base, apiOnCliLoss: false })).toBe('withheld');
    });
    it('falls back to api only with the opt-in', () => {
        expect(fallbackPostureFor({ ...base, apiOnCliLoss: true })).toBe('api');
    });
    it('a missing key is no rung, opt-in or not', () => {
        expect(fallbackPostureFor({ ...base, keylessResolves: () => false, apiOnCliLoss: true })).toBe('none');
        expect(fallbackPostureFor({ ...base, keylessResolves: () => false })).toBe('none');
        expect(fallbackPostureFor({ ...base, keylessResolves: () => false, apiOnCliLoss: false })).toBe('none');
    });
    it('a seat not on the cli rung has nothing to fall back from', () => {
        expect(fallbackPostureFor({ ...base, transport: 'api' })).toBe('n/a');
    });
});

describe('renderPostureLines', () => {
    it('names the ask state and how to store an answer', () => {
        const [line] = renderPostureLines([['openai', 'ask']], false);
        expect(line).toMatch(/asks once per run/);
        expect(line).toMatch(/fallback\.api_on_cli_loss/);
    });
    it('names the withheld state and how to opt in', () => {
        const [line] = renderPostureLines([['anthropic', 'withheld']], false);
        expect(line).toMatch(/withheld — subscriptions first/);
        expect(line).toMatch(/fallback\.api_on_cli_loss: true/);
        expect(line).not.toMatch(/would fall back to api/);
    });
});
