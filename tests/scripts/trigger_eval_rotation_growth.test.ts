import { describe, expect, it } from 'vitest';

import { pick_rotation } from '../../src/scripts/trigger_eval_rotation.js';

/**
 * Growth simulation — the property a loop over static totals cannot observe.
 *
 * The suite list grows by one every `growEvery` weeks, exactly as the real one
 * does. For each suite we track the longest gap between consecutive visits
 * while it is present, and assert the worst of those gaps stays inside the
 * enforced freshness window.
 */
function worstStalenessWeeks(weeks: number, growEvery: number, batch: number, start: number): number {
    const lastSeen = new Map<string, number>();
    let worst = 0;
    for (let w = 0; w < weeks; w += 1) {
        const total = start + Math.floor(w / growEvery);
        const suites = Array.from({ length: total }, (_, i) => `s${String(i).padStart(4, '0')}`);
        for (const s of suites) if (!lastSeen.has(s)) lastSeen.set(s, w);
        for (const s of pick_rotation(suites, w, batch)) lastSeen.set(s, w);
        for (const s of suites) {
            const gap = w - (lastSeen.get(s) as number);
            if (gap > worst) worst = gap;
        }
    }
    return worst;
}

describe('rotation coverage is stable under suite-count growth', () => {
    const WINDOW_WEEKS = Math.floor(90 / 7); // MAX_AGE_DAYS = 90

    it('keeps worst-case staleness inside the window when a suite is added every 4 weeks', () => {
        const worst = worstStalenessWeeks(260, 4, 5, 39);
        expect(worst).toBeLessThanOrEqual(WINDOW_WEEKS);
    });

    it('keeps worst-case staleness inside the window when a suite is added every 8 weeks', () => {
        const worst = worstStalenessWeeks(260, 8, 5, 39);
        expect(worst).toBeLessThanOrEqual(WINDOW_WEEKS);
    });
});
