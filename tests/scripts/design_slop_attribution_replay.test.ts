// road-to-tells-a-near-miss-can-refute 3.2: attribution keeps 3.1 only while it
// never hides an introduced finding.
import { describe, expect, it } from 'vitest';

import { replay } from '../../internal/bench/design-slop-attribution/run.js';

describe('attribution replay', () => {
    const rows = replay();

    it('every introduced finding the probe reaches is still surfaced', () => {
        const reached = rows.filter((r) => r.probe_reached);
        expect(reached.length).toBeGreaterThan(20);
        for (const r of reached) expect(r.inject_with, r.file).toBeGreaterThan(0);
    });

    it('a neutral edit to a file with incumbent findings surfaces none of them', () => {
        const incumbent = rows.filter((r) => r.keep_without > 0);
        expect(incumbent.length).toBeGreaterThan(0);
        for (const r of incumbent) expect(r.keep_with, r.file).toBe(0);
    });
});
