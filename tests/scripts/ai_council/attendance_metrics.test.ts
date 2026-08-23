/**
 * The four registered attendance metrics, replayed across the schema bump.
 *
 * Step 3.2 of `road-to-council-evidence-integrity`. The obligation is stated in
 * two halves and both are asserted here: the four metrics registered in
 * `src/config/quorum-attendance-budget.json` reproduce UNCHANGED over a log that
 * spans v4 → v5, and the new agreement rate EXCLUDES the pre-v5 stratum instead
 * of defaulting it.
 *
 * The second half is the one worth a test. Defaulting a missing field to
 * `not_tallied` would produce a plausible number out of an absence — the exact
 * failure mode this roadmap exists to close — and a rate is exactly the shape in
 * which that mistake is invisible.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import { computeMetrics, parseLog, STANCE_AGREEMENT_SINCE } from '../../../src/scripts/council_attendance_metrics.js';

const LOG = path.resolve(__dirname, '../../fixtures/council-events-schema-span/events.log');
const lines = parseLog(fs.readFileSync(LOG, 'utf8'));

describe('council attendance metrics over a v4→v5 span', () => {
    it('counts only post_run/command=run lines as passes', () => {
        // 7 quorum_result lines in the fixture; one is pre_run/estimate and one
        // line is not a quorum_result at all. Both are out.
        expect(computeMetrics(lines).passes).toBe(6);
    });

    it('the four registered metrics are computed over the FULL span, bump included', () => {
        const m = computeMetrics(lines);
        // 6 passes: present/total = 1, 0.5, 1, 1, 1, 1 → 5.5/6
        expect(m.attendance_rate).toBeCloseTo(5.5 / 6, 10);
        // one pass has total 2 < configured_total 3
        expect(m.roster_shortfall_rate).toBeCloseTo(1 / 6, 10);
        expect(m.solo_conclusion_rate).toBeCloseTo(1 / 6, 10);
        expect(m.shadow_floor_fire_rate).toBeCloseTo(1 / 6, 10);
        expect(m.absent_reason_distribution).toEqual({ quota: 1, no_binary: 1 });
    });

    it('the v4 lines are EXCLUDED from the agreement rate, not defaulted into it', () => {
        const m = computeMetrics(lines);
        expect(m.agreement_eligible).toBe(3);
        expect(m.agreement_excluded).toBe(3);
        // 1 of the 3 eligible lines is `consensus`. Defaulting the three v4
        // lines to `not_tallied` would give 1/6 — a plausible number invented
        // out of an absence, and the assertion that catches it.
        expect(m.consensus_rate).toBeCloseTo(1 / 3, 10);
        expect(m.consensus_rate).not.toBeCloseTo(1 / 6, 10);
    });

    it('dropping the v4 stratum leaves the agreement rate identical — the exclusion is real', () => {
        // The mirror of the assertion above, from the other side: if the v4
        // lines genuinely contribute nothing, removing them cannot move the
        // rate. A rate that changes here was silently reading them.
        const onlyV5 = lines.filter((l) => Number(l['schema_version'] ?? 0) >= STANCE_AGREEMENT_SINCE);
        expect(computeMetrics(onlyV5).consensus_rate).toBeCloseTo(computeMetrics(lines).consensus_rate ?? -1, 10);
    });

    it('an empty log yields nulls, never zeros — no passes is not a rate of 0', () => {
        const m = computeMetrics([]);
        expect(m.passes).toBe(0);
        expect(m.attendance_rate).toBeNull();
        expect(m.consensus_rate).toBeNull();
    });

    it('a malformed line is skipped rather than guessed at', () => {
        expect(parseLog('{"action":"quorum_result"}\nnot json at all\n[1,2,3]\n').length).toBe(1);
    });
});
