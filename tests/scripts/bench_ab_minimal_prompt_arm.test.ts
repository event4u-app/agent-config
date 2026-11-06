import { describe, expect, it } from 'vitest';

import { ARMS, minimal_prompt_text } from '../../src/scripts/_lib/bench_ab_arms.js';
import { CODEX_VALID_ARMS, injected_text } from '../../src/scripts/bench_ab_v2_run.js';

describe('minimal-prompt arm (proof-where 3.2)', () => {
    it('runs with the plugin off and the minimal instruction injected as text', () => {
        expect(ARMS['minimal-prompt']).toEqual({ setting_sources: 'project,local', inject: 'minimal', min_lift_ratio: null });
        expect(injected_text('minimal', 2000)).toBe(minimal_prompt_text());
    });

    it('is far shorter than the smallest shipped rule set it is a baseline for', () => {
        const kernel = injected_text('profile-minimal', 2000) ?? '';
        const text = minimal_prompt_text();
        expect(text.length).toBeGreaterThan(0);
        expect(text.length).toBeLessThanOrEqual(400);
        expect(text.length * 20).toBeLessThan(kernel.length);
    });

    it('states each behaviour the package is meant to produce', () => {
        const text = minimal_prompt_text().toLowerCase();
        for (const behaviour of ['before you change', 'smallest change', 'caller', 'test', 'ambiguous', 'commit']) {
            expect(text).toContain(behaviour);
        }
    });

    it('carries to the codex host, being text only', () => {
        expect(CODEX_VALID_ARMS).toContain('minimal-prompt');
    });
});
