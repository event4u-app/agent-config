import { describe, expect, it } from 'vitest';

import { runSmoke } from '../../src/scripts/cross_model_smoke.js';

// Dry-run only — MockRouter, no keys, no network. Exercises the smoke
// end-to-end (catalogue load from src/skills + fixture read + per-host tally)
// so CI covers the orchestration without spend.
describe('cross_model_smoke — runSmoke (dry-run)', () => {
    it('runs the trigger fixtures through MockRouter and tallies per host', async () => {
        const out = await runSmoke({ skills: ['image-analyser'], hosts: ['anthropic', 'openai'], dryRun: true });

        expect(out.catalogue_size).toBeGreaterThan(50); // full src/skills catalogue
        expect(out.fixtures).toBe(1);
        expect(out.hosts).toHaveLength(2);

        for (const h of out.hosts) {
            expect(h.queries).toBe(10); // image-analyser: 5 should-trigger + 5 should-not
            expect(h.neg_controls).toBe(5);
            expect(h.parse_rate).toBe(1); // mock always "parses"
            expect(h.pass_rate).toBeGreaterThanOrEqual(0);
            expect(h.pass_rate).toBeLessThanOrEqual(1);
        }
    });

    it('skips fixtures with no triggers.json without throwing', async () => {
        const out = await runSmoke({ skills: ['__no_such_skill__'], hosts: ['openai'], dryRun: true });
        expect(out.fixtures).toBe(0);
        expect(out.hosts[0]!.queries).toBe(0);
    });
});
