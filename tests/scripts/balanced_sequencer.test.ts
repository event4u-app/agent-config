import { describe, expect, it } from 'vitest';

import { assignShards, medianWeight, osKey } from '../_lib/balanced-sequencer.js';

const files = [...Array(40).keys()].map((i) => `tests/f${String(i).padStart(2, '0')}.test.ts`);
const weights: Record<string, number> = Object.fromEntries(files.map((f, i) => [f, (i * 37) % 23 + 1]));
weights['tests/f07.test.ts'] = 300; // one dominant file, like build_proof

describe('assignShards — duration balance without losing a file', () => {
    it('puts every file in exactly one shard', () => {
        const shards = assignShards(files, 4, weights);
        const all = shards.flat();
        expect(all.sort()).toEqual([...files].sort());
        expect(new Set(all).size).toBe(files.length);
    });

    it('is stable: the same input gives the same assignment', () => {
        expect(assignShards(files, 4, weights)).toEqual(assignShards([...files].reverse(), 4, weights));
    });

    it('places a file the manifest has never seen instead of skipping it', () => {
        const shards = assignShards([...files, 'tests/brand_new.test.ts'], 4, weights);
        expect(shards.flat()).toContain('tests/brand_new.test.ts');
    });

    it('isolates the dominant file and balances the rest better than equal counts', () => {
        const shards = assignShards(files, 4, weights);
        const load = shards.map((s) => s.reduce((n, f) => n + (weights[f] ?? 0), 0));
        const heavy = shards.findIndex((s) => s.includes('tests/f07.test.ts'));
        expect(shards[heavy]).toEqual(['tests/f07.test.ts']);
        const rest = load.filter((_, i) => i !== heavy);
        expect(Math.max(...rest) - Math.min(...rest)).toBeLessThanOrEqual(23);
    });
});

describe('helpers', () => {
    it('medianWeight never returns zero for an empty manifest', () => {
        expect(medianWeight({})).toBe(1);
        expect(medianWeight({ a: 1, b: 3, c: 10 })).toBe(3);
    });

    it('maps darwin to macos and everything else to ubuntu', () => {
        expect(osKey('darwin')).toBe('macos');
        expect(osKey('linux')).toBe('ubuntu');
    });
});
