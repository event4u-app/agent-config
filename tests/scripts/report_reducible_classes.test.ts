/**
 * road-to-tool-results-that-leave-a-handle.md step 1.1.
 *
 * verify: this file.
 */
import { describe, expect, it } from 'vitest';

import { nearestRankP95, readCensus, selectClasses } from '../../src/scripts/report_reducible_classes.js';

function cls(tool: string, samples: number[]) {
    return { tool, count: samples.length, payload_bytes: samples.reduce((a, b) => a + b, 0), payload_samples: samples };
}

function spread(n: number, low: number, high: number): number[] {
    return Array.from({ length: n }, (_, i) => (i < n * 0.9 ? low : high));
}

describe('report_reducible_classes', () => {
    it('p95-is-nearest-rank-floor', () => {
        const samples = Array.from({ length: 100 }, (_, i) => i + 1);
        expect(nearestRankP95(samples)).toBe(96);
        expect(nearestRankP95([])).toBeNull();
    });

    it('failure-structured-class-above-threshold-is-selected', () => {
        const [v] = selectClasses({ Bash: cls('Bash', spread(100, 100, 20_000)) }, 8192);
        expect(v).toMatchObject({ tool: 'Bash', above_threshold: true, failure_structured: true, non_goal: null, selected: true });
    });

    it('failure-structured-class-below-threshold-is-not-selected', () => {
        const [v] = selectClasses({ Bash: cls('Bash', spread(100, 100, 6_282)) }, 8192);
        expect(v).toMatchObject({ p95: 6_282, above_threshold: false, selected: false });
    });

    it('large-class-without-failure-structure-is-not-selected', () => {
        const [v] = selectClasses({ Read: cls('Read', spread(100, 1_000, 42_029)) }, 8192);
        expect(v).toMatchObject({ above_threshold: true, failure_structured: false, selected: false });
    });

    it('non-goal-classes-are-never-selected', () => {
        const verdicts = selectClasses(
            {
                'Read:image': cls('Read:image', spread(100, 200_000, 600_000)),
                Edit: cls('Edit', spread(100, 265, 299)),
                Write: cls('Write', spread(100, 257, 287)),
            },
            8192,
        );
        expect(Object.fromEntries(verdicts.map((v) => [v.tool, [v.non_goal, v.selected]]))).toStrictEqual({
            'Read:image': ['K7', false],
            Edit: ['K3', false],
            Write: ['K3', false],
        });
    });

    it('legacy-census-line-is-envelope-bytes-with-delivered-unknown', () => {
        const text = [
            '{"ts":"2026-09-01T00:00:00Z","tool":"Bash","bytes":500}',
            '{"ts":"2026-10-01T00:00:00Z","tool":"Bash","raw_bytes":700,"delivered_bytes":700,"measurable":true}',
            'not json',
            '',
        ].join('\n');
        expect(readCensus(text)).toStrictEqual({
            legacy: 1,
            two_field: 1,
            unreadable: 1,
            delivered_unknown: 1,
            raw_bytes: 1_200,
            delivered_bytes_known: 700,
        });
    });
});
