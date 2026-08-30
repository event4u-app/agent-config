// The measurement machinery, proven synthetically.
//
// `road-to-supervised-telemetry-collector` step 5.3 — the checkpoint the AI
// council made a prerequisite for Phase 6 on 2026-08-30: *"The synthetic test is
// a checkpoint, not a Phase 6 step. It answers 'does the instrument work?'
// before asking 'what does it measure?'"*
//
// Every case here seeds counts and asserts the computed ratio, its Wilson bound,
// and the eligibility boundary. NONE of it claims anything about the real
// capture rate, which needs a 21-day window no run can compress. The end-to-end
// block additionally drives the REAL denominator writer and the REAL store, so
// the numerator and denominator this module divides are the ones the collector
// actually produces rather than two numbers a test invented.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    CAPTURE_TARGET,
    ENABLEMENT_READING_NAMES,
    judgeCapture,
    judgeEnablement,
    MINIMUM_MACHINES,
    MINIMUM_SAMPLE,
    WILSON_Z,
    WINDOW_DAYS,
    wilsonInterval,
    type EnablementReadings,
} from '../../src/scripts/_lib/capture_rate.js';
import {
    enableCollector,
    readOpportunities,
    recordOpportunity,
    spoolRecord,
} from '../../src/scripts/_lib/collector_denominator.js';
import { COLLECTOR_SCHEMA_VERSION } from '../../src/scripts/_lib/collector_record.js';
import {
    isStoreAvailable,
    openCollectorStore,
    readRecords,
    readSummary,
} from '../../src/scripts/_lib/collector_store.js';
import { drainOnce } from '../../src/scripts/collector_daemon.js';

let userRoot: string;

beforeEach(() => {
    userRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'capture-rate-'));
});

afterEach(() => {
    fs.rmSync(userRoot, { recursive: true, force: true });
});

describe('the Wilson interval', () => {
    it('matches a hand-computed reference to ten significant figures', () => {
        // 900/1000 at z = 1.959963984540054. Computed from the closed form in
        // the docstring, independently of the implementation, so this is a
        // reference check rather than a self-consistency one.
        const p = 0.9;
        const n = 1000;
        const z2 = WILSON_Z * WILSON_Z;
        const denom = 1 + z2 / n;
        const centre = p + z2 / (2 * n);
        const spread = WILSON_Z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
        const expected = { lower: (centre - spread) / denom, upper: (centre + spread) / denom };

        const actual = wilsonInterval(900, 1000);
        expect(actual.lower).toBeCloseTo(expected.lower, 10);
        expect(actual.upper).toBeCloseTo(expected.upper, 10);
        // The interval is BELOW the point estimate on the low side — the whole
        // reason 1.2 item 9 judges on the lower bound.
        expect(actual.lower).toBeLessThan(0.9);
    });

    it('is narrower on a larger sample at the same proportion', () => {
        const small = wilsonInterval(90, 100);
        const large = wilsonInterval(9_000, 10_000);
        expect(large.upper - large.lower).toBeLessThan(small.upper - small.lower);
        // Both lower bounds are BELOW 0.9 — at a point estimate exactly equal
        // to the target, no sample size clears a lower-bound rule, because the
        // interval is always below the estimate on the low side. A larger
        // sample gets closer, and that is all it does.
        expect(small.lower).toBeLessThan(CAPTURE_TARGET);
        expect(large.lower).toBeLessThan(CAPTURE_TARGET);
        expect(CAPTURE_TARGET - large.lower).toBeLessThan(CAPTURE_TARGET - small.lower);
    });

    it('names the point estimate the 1.3 target actually demands at the minimum sample', () => {
        // A consequence of the rule that is easy to miss and expensive to
        // discover late: the target is 90 % on the LOWER BOUND, so at n = 2000
        // the point estimate has to be materially higher. Computed here rather
        // than asserted, so the number moves if the sample floor does.
        let needed = 0;
        for (let k = 0; k <= MINIMUM_SAMPLE; k += 1) {
            if (wilsonInterval(k, MINIMUM_SAMPLE).lower >= CAPTURE_TARGET) {
                needed = k;
                break;
            }
        }
        expect(needed).toBeGreaterThan(MINIMUM_SAMPLE * CAPTURE_TARGET);
        // ~91.3 % at n = 2000. Recorded as a range so a floating-point wobble
        // is not a failure, and so the direction of the claim is what is tested.
        expect(needed / MINIMUM_SAMPLE).toBeGreaterThan(0.905);
        expect(needed / MINIMUM_SAMPLE).toBeLessThan(0.92);
    });

    // removing_this_constraint_reds_it: replace the Wilson formula with the
    // normal approximation `p ± z·sqrt(p(1-p)/n)` — the reference check reds.

    it('never leaves [0, 1], including at the boundaries', () => {
        expect(wilsonInterval(0, 10).lower).toBe(0);
        // Wilson's upper bound at k = n approaches 1 without exceeding it; the
        // reading is 0.9999999999999999, which is the closed form's own value
        // and not a clamp artefact. The normal approximation returns 1.0 flat
        // here — a zero-width interval at the boundary — which is the reason
        // for the choice.
        expect(wilsonInterval(10, 10).upper).toBeCloseTo(1, 12);
        expect(wilsonInterval(10, 10).upper).toBeLessThanOrEqual(1);
        expect(wilsonInterval(10, 10).lower).toBeGreaterThan(0.6);
        expect(wilsonInterval(10, 10).lower).toBeLessThan(1);
    });

    it('reports [0, 1] on an empty sample — "we measured nothing", not "we measured zero"', () => {
        expect(wilsonInterval(0, 0)).toEqual({ lower: 0, upper: 1 });
    });

    // removing_this_constraint_reds_it: return `{lower: 0, upper: 0}` at n = 0 —
    // an empty sample then reads as a total capture failure.

    it('refuses impossible counts rather than returning a number', () => {
        expect(() => wilsonInterval(11, 10)).toThrow(RangeError);
        expect(() => wilsonInterval(-1, 10)).toThrow(RangeError);
        expect(() => wilsonInterval(1.5, 10)).toThrow(TypeError);
    });
});

describe('the target decision rule', () => {
    const eligible = { machines: MINIMUM_MACHINES, windowDays: WINDOW_DAYS };

    it('judges on the LOWER bound, not the point estimate', () => {
        // 1800/2000 is exactly 90 % as a point estimate, and its lower bound is
        // below 90 %. The rule says that has NOT cleared the target — this is
        // the case 1.2 item 9 was written to decide before the number existed.
        const verdict = judgeCapture({ numerator: 1800, denominator: 2000, ...eligible });
        expect(verdict.rate).toBeCloseTo(0.9, 10);
        expect(verdict.interval.lower).toBeLessThan(CAPTURE_TARGET);
        expect(verdict.meetsTarget).toBe(false);
    });

    // removing_this_constraint_reds_it: judge on `rate >= target` instead of
    // `interval.lower >= target` — this block reds and nothing else does.

    it('passes when the lower bound clears the target', () => {
        const verdict = judgeCapture({ numerator: 1880, denominator: 2000, ...eligible });
        expect(verdict.interval.lower).toBeGreaterThanOrEqual(CAPTURE_TARGET);
        expect(verdict.meetsTarget).toBe(true);
        expect(verdict.eligible).toBe(true);
    });

    it('returns meetsTarget = null when the reading is not eligible — never false', () => {
        // A short window and a small sample are "keep observing", not "missed".
        // Collapsing them to `false` would fire 6.3's decision record for a
        // measurement that never happened.
        const short = judgeCapture({ numerator: 190, denominator: 200, machines: 5, windowDays: 3 });
        expect(short.eligible).toBe(false);
        expect(short.meetsTarget).toBeNull();
        expect(short.ineligibleBecause).toContain('window-too-short');
        expect(short.ineligibleBecause).toContain('sample-too-small');
    });

    // removing_this_constraint_reds_it: return `false` instead of `null` for an
    // ineligible reading.

    it('enforces the minimum-sample boundary exactly', () => {
        const below = judgeCapture({
            numerator: MINIMUM_SAMPLE - 1,
            denominator: MINIMUM_SAMPLE - 1,
            ...eligible,
        });
        expect(below.ineligibleBecause).toContain('sample-too-small');

        const at = judgeCapture({
            numerator: MINIMUM_SAMPLE,
            denominator: MINIMUM_SAMPLE,
            ...eligible,
        });
        expect(at.ineligibleBecause).not.toContain('sample-too-small');
    });

    it('enforces the machine floor and the window length independently', () => {
        expect(
            judgeCapture({ numerator: 2000, denominator: 2000, machines: 4, windowDays: 21 })
                .ineligibleBecause,
        ).toEqual(['too-few-machines']);
        expect(
            judgeCapture({ numerator: 2000, denominator: 2000, machines: 5, windowDays: 20 })
                .ineligibleBecause,
        ).toEqual(['window-too-short']);
    });

    it('reports a null rate on an empty denominator rather than dividing', () => {
        const verdict = judgeCapture({ numerator: 0, denominator: 0, machines: 0, windowDays: 0 });
        expect(verdict.rate).toBeNull();
        expect(verdict.meetsTarget).toBeNull();
    });

    it('refuses a numerator above its denominator as impossible, not as 100 %', () => {
        const verdict = judgeCapture({ numerator: 2100, denominator: 2000, ...eligible });
        expect(verdict.ineligibleBecause).toContain('numerator-exceeds-denominator');
        expect(verdict.meetsTarget).toBeNull();
    });

    // removing_this_constraint_reds_it: drop the numerator>denominator check —
    // the reading becomes an eligible 105 % capture rate.
});

describe('the six-part enablement gate', () => {
    const all = (v: boolean | null): EnablementReadings =>
        Object.fromEntries(
            ENABLEMENT_READING_NAMES.map((n) => [n, v]),
        ) as unknown as EnablementReadings;

    it('flips only when all six are recorded and true', () => {
        expect(judgeEnablement(all(true)).flip).toBe(true);
    });

    it('a MISSING reading blocks the flip, and is reported apart from a failure', () => {
        for (const name of ENABLEMENT_READING_NAMES) {
            const readings = { ...all(true), [name]: null } as EnablementReadings;
            const verdict = judgeEnablement(readings);
            expect(verdict.flip, name).toBe(false);
            expect(verdict.missing, name).toEqual([name]);
            expect(verdict.failed, name).toEqual([]);
        }
    });

    // removing_this_constraint_reds_it: treat `null` as `false` in
    // `judgeEnablement` — every case above lands in `failed` instead of
    // `missing`, and "we did not look" becomes indistinguishable from "we looked
    // and it was bad". Only one of those two is 6.3's trigger.

    it('a FALSE reading blocks the flip and is reported as a failure', () => {
        const verdict = judgeEnablement({ ...all(true), captureTargetMet: false });
        expect(verdict.flip).toBe(false);
        expect(verdict.failed).toEqual(['captureTargetMet']);
        expect(verdict.missing).toEqual([]);
    });
});

describe.runIf(isStoreAvailable())('end to end — the REAL writers feed the ratio', () => {
    it('computes a rate from the denominator log and the store, not from invented numbers', () => {
        enableCollector(userRoot);

        // 40 dispatch opportunities, of which 34 produce a spooled record. The
        // 6 that do not are the loss the ratio exists to measure.
        for (let i = 0; i < 40; i += 1) {
            expect(recordOpportunity('pre_tool_use', 'claude', userRoot)).toBe(true);
            if (i >= 34) continue;
            spoolRecord(
                {
                    schema_version: COLLECTOR_SCHEMA_VERSION,
                    machine_id: '3f2504e0-4f89-4d3a-9a0c-0305e82c3301',
                    episode_id: 'b7c3d1e2-8a4f-4b6c-9d0e-1f2a3b4c5d6e',
                    event: 'pre_tool_use',
                    sequence: i,
                    outcome: 'captured',
                    platform: 'claude',
                    occurred_on: '2026-08-30',
                    collector_version: '1.0.0',
                },
                userRoot,
            );
        }

        const handle = openCollectorStore(userRoot);
        try {
            drainOnce(handle, userRoot);
            // Drain twice: the second pass re-offers nothing, and the store's
            // read-time de-duplication is what keeps the numerator honest if it
            // ever did.
            drainOnce(handle, userRoot);

            const denominator = readOpportunities(userRoot).total;
            const numerator = readRecords(handle).length;
            expect(denominator).toBe(40);
            expect(numerator).toBe(34);

            const verdict = judgeCapture({
                numerator,
                denominator,
                machines: 1,
                windowDays: 1,
            });
            expect(verdict.rate).toBeCloseTo(0.85, 10);
            // Nowhere near eligible — 40 dispatches on 1 machine over 1 day.
            // The instrument works; the measurement has not happened.
            expect(verdict.eligible).toBe(false);
            expect(verdict.meetsTarget).toBeNull();
        } finally {
            handle.db.close();
        }
    });

    it('DUPLICATE SUPPRESSION: a re-drained batch does not inflate the numerator', () => {
        enableCollector(userRoot);
        const rec = {
            schema_version: COLLECTOR_SCHEMA_VERSION,
            machine_id: '3f2504e0-4f89-4d3a-9a0c-0305e82c3301',
            episode_id: 'b7c3d1e2-8a4f-4b6c-9d0e-1f2a3b4c5d6e',
            event: 'session_start',
            sequence: 1,
            outcome: 'captured',
            platform: 'claude',
            occurred_on: '2026-08-30',
            collector_version: '1.0.0',
        };
        spoolRecord(rec, userRoot);
        spoolRecord(rec, userRoot);
        spoolRecord(rec, userRoot);

        const handle = openCollectorStore(userRoot);
        try {
            drainOnce(handle, userRoot);
            const summary = readSummary(handle);
            // Three ROWS, one record. The store is append-only and de-duplicates
            // at read time, and `readSummary` reports both so the duplication is
            // observable rather than invisible — which is what makes the
            // numerator trustworthy without an insert-time unique constraint.
            expect(summary.rows).toBe(3);
            expect(readRecords(handle)).toHaveLength(1);
        } finally {
            handle.db.close();
        }
    });

    // removing_this_constraint_reds_it: make `readRecords` return every row
    // instead of collapsing on `dedup_key` — the numerator triples and the
    // capture rate can exceed 1.

    it('MALFORMED input is refused, and refusal does not silently inflate the numerator', () => {
        enableCollector(userRoot);
        spoolRecord({ not: 'a record' }, userRoot);
        const handle = openCollectorStore(userRoot);
        try {
            const result = drainOnce(handle, userRoot);
            expect(result.refused).toBe(1);
            expect(result.written).toBe(0);
            expect(readRecords(handle)).toHaveLength(0);
        } finally {
            handle.db.close();
        }
    });
});
