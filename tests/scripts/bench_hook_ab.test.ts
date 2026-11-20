// bench_hook_ab — argument parsing and the quantile it reports
// (road-to-a-hook-system-that-pays-for-what-it-does 3.1). The timing itself is
// a measurement, not an assertion; the trace path is covered by hook_load_set.
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseArgs, quantile } from '../../internal/bench/core/bench_hook_ab.js';

describe('bench_hook_ab', () => {
    it('defaults to this checkout as the one variant, the four hot events and 30 runs', () => {
        const a = parseArgs([]);
        if (typeof a === 'string') throw new Error(a);
        expect(a.variants).toHaveLength(1);
        expect(a.variants[0]?.bundle.endsWith(path.join('dist', 'hooks', 'dispatch.js'))).toBe(true);
        expect(a.events).toEqual(['pre_tool_use', 'post_tool_use', 'user_prompt_submit', 'stop']);
        expect(a.runs).toBe(30);
        expect(a.trace).toBe(false);
    });

    it('reads variants, runs, events and --trace', () => {
        const a = parseArgs(['--variant', 'pin=/a/dist/hooks/dispatch.js', '--variant', 'head=/b/dist/hooks/dispatch.js', '--runs', '5', '--events', 'stop', '--trace']);
        if (typeof a === 'string') throw new Error(a);
        expect(a.variants.map((v) => v.label)).toEqual(['pin', 'head']);
        expect(a.runs).toBe(5);
        expect(a.events).toEqual(['stop']);
        expect(a.trace).toBe(true);
    });

    it('refuses a malformed variant, a bad run count and an unknown flag', () => {
        expect(parseArgs(['--variant', 'nolabel'])).toMatch(/label=path/);
        expect(parseArgs(['--runs', '0'])).toMatch(/positive integer/);
        expect(parseArgs(['--bogus'])).toMatch(/unknown argument/);
    });

    it('quantile is nearest-rank and leaves its input alone', () => {
        const xs = [5, 1, 4, 2, 3];
        expect(quantile(xs, 0.5)).toBe(3);
        expect(quantile(xs, 0)).toBe(1);
        expect(quantile(xs, 1)).toBe(5);
        expect(xs).toEqual([5, 1, 4, 2, 3]);
        expect(Number.isNaN(quantile([], 0.5))).toBe(true);
    });
});
