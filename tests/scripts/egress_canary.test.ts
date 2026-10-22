// road-to-free-hands-a-paid-head-checks 1.3: planted canaries go through
// ask_transport to a loopback mock that records the bytes it receives.
import { describe, expect, it } from 'vitest';

import { CANARIES, PLACEMENTS, runEgressCanary } from '../../src/scripts/egress_canary.js';

describe('egress canary run', () => {
    it('no detectable canary leaves in clear text; each is named replaced, refused or not-detectable', async () => {
        const report = await runEgressCanary();
        expect(report.rows).toHaveLength(CANARIES.length * PLACEMENTS.length);
        for (const row of report.rows) {
            expect(['replaced', 'refused', 'not-detectable']).toContain(row.outcome);
            if (row.outcome === 'refused') expect(row.reason).toMatch(/\S/);
            if (row.outcome === 'replaced') expect(row.placeholder).toMatch(/\S/);
        }
        // Credentials have rows, so none may be not-detectable.
        for (const row of report.rows.filter((r) => r.class === 'credential')) {
            expect(row.outcome, `${row.canary} in ${row.placement}`).not.toBe('not-detectable');
        }
        expect(report.leaked).toEqual([]);
        // In protect mode the identifier rows of one-detector 2.3 see every
        // personal canary; only the internal identifiers have no row.
        for (const row of report.rows.filter((r) => r.class === 'personal')) {
            expect(row.outcome, `${row.canary} in ${row.placement}`).not.toBe('not-detectable');
        }
    }, 60_000);
});
