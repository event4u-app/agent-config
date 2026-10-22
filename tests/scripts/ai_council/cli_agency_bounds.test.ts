import { describe, expect, it } from 'vitest';

import {
    LIGHT_LAUNCH_PROBES,
    lightLaunchFor,
} from '../../../src/scripts/ai_council/cli_agency_bounds.js';

describe('light seat launch probes', () => {
    it('light-launch-is-probed-per-version', () => {
        for (const p of LIGHT_LAUNCH_PROBES) {
            expect(p.probed_version, `${p.member} ${p.flag.join(' ')}`).toMatch(/\S/);
            expect(p.probed_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            // A lighter launch that dropped the subscription login is the bare
            // flag in another spelling, and is never recorded as a candidate.
            expect(p.keeps_subscription_login).toBe(true);
            expect(p.flag).not.toContain('--bare');
            expect(p.first_call_tokens).toBeLessThan(p.baseline_first_call_tokens);
        }
        const selected = LIGHT_LAUNCH_PROBES.filter((p) => p.selected);
        expect(new Set(selected.map((p) => p.member)).size).toBe(selected.length);

        const anthropic = selected.find((p) => p.member === 'anthropic');
        expect(anthropic).toBeDefined();
        expect(lightLaunchFor('anthropic', anthropic!.probed_version)).toEqual(anthropic!.flag);
        // Another version of the same binary was never probed: no flag is guessed.
        expect(lightLaunchFor('anthropic', '0.0.1 (Claude Code)')).toEqual([]);
        expect(lightLaunchFor('anthropic', null)).toEqual([]);
        expect(lightLaunchFor('xai', anthropic!.probed_version)).toEqual([]);
    });

    it('a selected light launch never loads the user rule layer', () => {
        for (const p of LIGHT_LAUNCH_PROBES.filter((x) => x.selected)) {
            expect(p.user_rules_loaded).toBe(false);
        }
    });
});
