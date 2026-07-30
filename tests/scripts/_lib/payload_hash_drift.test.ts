// Unit tests for the payload-hash × cache-hit drift aggregator
// (road-to-cache-economy Phase 3, step 6). Fixtures built from named
// constants; every expectation derived from those constants.

import { describe, expect, it } from 'vitest';

import { aggregatePayloadHashDrift, type PayloadHashLine } from '../../../src/scripts/_lib/payload_hash_drift.js';

function line(payload_hash: string | null, cache_hit: boolean | null): PayloadHashLine {
    return { payload_hash, cache_hit };
}

describe('aggregatePayloadHashDrift', () => {
    it('empty input → zero lines, empty cohorts, no drift claim', () => {
        const r = aggregatePayloadHashDrift([]);
        expect(r.total_lines).toBe(0);
        expect(r.lines_with_data).toBe(0);
        expect(r.groups).toEqual([]);
        expect(r.stable_cohort).toEqual({ n: 0, hit_count: 0, hit_rate: null });
        expect(r.unstable_cohort).toEqual({ n: 0, hit_count: 0, hit_rate: null });
        expect(r.drift_visible).toBe(false);
    });

    it('ignores lines missing payload_hash or cache_hit, counting them in total_lines but not lines_with_data', () => {
        const lines: PayloadHashLine[] = [
            line(null, true), // no hash
            line('abc123', null), // no cache_hit
            line('abc123', true),
        ];
        const r = aggregatePayloadHashDrift(lines);
        expect(r.total_lines).toBe(3);
        expect(r.lines_with_data).toBe(1);
    });

    it('a cohort dispatched with a deliberately unstable payload shows a lower hit rate than a stable one', () => {
        // Stable cohort: the SAME hash dispatched 4 times. First is always a
        // cold write (excluded); the 3 repeats all hit -> stable hit_rate 100%.
        const stableHash = 'stable-hash-1';
        const stableLines: PayloadHashLine[] = [
            line(stableHash, false), // first occurrence — excluded from the cohort
            line(stableHash, true),
            line(stableHash, true),
            line(stableHash, true),
        ];
        // Unstable cohort: 4 DISTINCT hashes, each seen exactly once — a
        // deliberately unstable payload can never repeat-hit; half miss.
        const unstableLines: PayloadHashLine[] = [
            line('unstable-1', false),
            line('unstable-2', true),
            line('unstable-3', false),
            line('unstable-4', true),
        ];

        const r = aggregatePayloadHashDrift([...stableLines, ...unstableLines]);

        expect(r.stable_cohort.n).toBe(3); // 4 occurrences - 1 excluded first
        expect(r.stable_cohort.hit_rate).toBeCloseTo(1.0, 12);
        expect(r.unstable_cohort.n).toBe(4);
        expect(r.unstable_cohort.hit_rate).toBeCloseTo(0.5, 12);
        expect(r.drift_visible).toBe(true); // 100% > 50%
    });

    it('reports per-hash occurrence and hit-rate breakdown, sorted by occurrences descending', () => {
        const lines: PayloadHashLine[] = [
            line('h-frequent', true),
            line('h-frequent', true),
            line('h-frequent', false),
            line('h-rare', true),
        ];
        const r = aggregatePayloadHashDrift(lines);
        expect(r.groups).toEqual([
            { payload_hash: 'h-frequent', occurrences: 3, hit_count: 2, hit_rate: 2 / 3 },
            { payload_hash: 'h-rare', occurrences: 1, hit_count: 1, hit_rate: 1 },
        ]);
    });

    it('is not visible (drift_visible false) when only one cohort has data', () => {
        // Only singleton hashes -> unstable has data, stable is empty.
        const lines: PayloadHashLine[] = [line('a', true), line('b', false)];
        const r = aggregatePayloadHashDrift(lines);
        expect(r.stable_cohort.hit_rate).toBeNull();
        expect(r.unstable_cohort.hit_rate).not.toBeNull();
        expect(r.drift_visible).toBe(false);
    });

    it('is not visible when the stable cohort does not actually beat the unstable cohort', () => {
        const hash = 'flaky-hash';
        const lines: PayloadHashLine[] = [
            line(hash, true), // first — excluded
            line(hash, false), // repeat, miss
            line('singleton', true), // unstable hit_rate 100%
        ];
        const r = aggregatePayloadHashDrift(lines);
        expect(r.stable_cohort.hit_rate).toBeCloseTo(0, 12);
        expect(r.unstable_cohort.hit_rate).toBeCloseTo(1, 12);
        expect(r.drift_visible).toBe(false);
    });
});
