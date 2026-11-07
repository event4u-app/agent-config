/**
 * The minimal-prompt arm is the floor an asset has to beat, so a report that
 * carries it compares the package and the kernel rules against it, and the arm
 * against vanilla. The rows are arm-guarded: a stored report without the arm
 * re-scores exactly as before.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { FIXED_INJECTIONS } from '../../internal/bench/core/_lib/bench_ab_arms.js';

import { analyse, to_markdown } from '../../internal/bench/core/bench_ab_v2_stats.js';

const run = (cap: boolean, disc: number) => ({ capability_pass: cap, discipline_score: disc, discipline_pass: disc >= 1, errored: false });
const rec = (id: string, arms: Record<string, [boolean, number]>) => ({
    id,
    arms: Object.fromEntries(Object.entries(arms).map(([a, [c, d]]) => [a, [run(c, d)]])),
});
const RECORDS = [
    rec('t1', { vanilla: [true, 0], 'minimal-prompt': [true, 1], package: [true, 1] }),
    rec('t2', { vanilla: [true, 0], 'minimal-prompt': [true, 0], package: [true, 1] }),
    rec('t3', { vanilla: [false, 0], 'minimal-prompt': [true, 1], package: [true, 1] }),
];
const labels = (a: Record<string, unknown>): string[] => (a['comparisons'] as Array<Record<string, unknown>>).map((c) => String(c['label']));

describe('minimal-prompt comparisons', () => {
    it('a mini report with vanilla, minimal-prompt and package renders package vs minimal-prompt', () => {
        const payload = { stamp: 'test', model: null, seeds: 1, arms: ['vanilla', 'minimal-prompt', 'package'], records: RECORDS };
        const a = analyse(payload);
        expect(labels(a)).toEqual(expect.arrayContaining(['package over the minimal prompt', 'minimal prompt lift']));
        const md = to_markdown(a, payload);
        expect(md).toContain('`package` vs `minimal-prompt`');
        expect(md).toContain('`minimal-prompt` vs `vanilla`');
    });
    it('the kernel rules are compared with the minimal prompt when both ran', () => {
        const recs = [rec('t1', { 'rules-kernel-dc': [true, 1], 'minimal-prompt': [true, 0] })];
        expect(labels(analyse({ arms: ['rules-kernel-dc', 'minimal-prompt'], records: recs }))).toContain('kernel+downstream rules over the minimal prompt');
    });
    it('without the minimal-prompt arm none of the three rows appears', () => {
        const recs = RECORDS.map((r) => ({ ...r, arms: { vanilla: r.arms['vanilla'], package: r.arms['package'] } }));
        const l = labels(analyse({ arms: ['vanilla', 'package'], records: recs }));
        expect(l).toEqual(['package lift']);
    });
    it('the text is frozen in docs/benchmark.md exactly as the arm injects it', () => {
        const doc = fs.readFileSync(path.resolve(import.meta.dirname, '..', '..', 'docs', 'benchmark.md'), 'utf-8');
        const block = /\{#minimal-prompt-baseline\}[\s\S]*?```text\n([\s\S]*?)\n```/.exec(doc)?.[1];
        expect(block).toBe(FIXED_INJECTIONS['minimal']);
    });
});
