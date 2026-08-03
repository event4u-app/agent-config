import { describe, expect, it } from 'vitest';

import { run_scenario, SCENARIOS } from '../../src/scripts/release_drill.js';

// The release step machinery (execute()) ran nowhere except live until
// 2026-08-03, when three orchestration bugs fired mid-release in one week.
// This suite runs the REAL execute() against the drill's simulated git/gh
// world — one test per scenario, so a regression names the exact failure
// mode it reintroduced.
describe('release drill — execute() against the simulated world', () => {
    for (const [name, scenario] of Object.entries(SCENARIOS)) {
        it(`${name} — ${scenario.summary}`, () => {
            const outcome = run_scenario(name);
            expect(outcome.failures, outcome.error ?? '').toEqual([]);
        });
    }

    it('covers both measured 2026-08-03 incidents by name', () => {
        expect(Object.keys(SCENARIOS)).toContain('push-rejected-then-recover');
        expect(Object.keys(SCENARIOS)).toContain('behind-then-merge');
    });
});
