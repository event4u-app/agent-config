/**
 * Stat-index (road-to-retrieval-substrate-hardening B5a).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { clear, scanCached, statSignature } from '../../src/scripts/_lib/stat_index.js';

let dir = '';
beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stat-'));
});
afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
});

const write = (name: string, body: string): string => {
    const p = path.join(dir, name);
    fs.writeFileSync(p, body);
    return p;
};

describe('statSignature', () => {
    it('is stable for an unchanged file set', () => {
        const a = write('a.txt', 'x');
        const b = write('b.txt', 'yy');
        expect(statSignature([a, b])).toBe(statSignature([b, a])); // order-independent
    });
    it('changes when a file grows', () => {
        const a = write('a.txt', 'x');
        const before = statSignature([a]);
        write('a.txt', 'xxxxx');
        expect(statSignature([a])).not.toBe(before);
    });
    it('changes when a file is added or removed', () => {
        const a = write('a.txt', 'x');
        const one = statSignature([a]);
        const b = write('b.txt', 'y');
        expect(statSignature([a, b])).not.toBe(one);
    });
});

describe('scanCached', () => {
    it('computes on a miss, then serves the cache on an unchanged set', () => {
        const a = write('a.txt', 'x');
        const cache = path.join(dir, 'cache-v1.json');
        let computes = 0;
        const run = (): number => scanCached(cache, [a], () => { computes += 1; return computes; });
        expect(run()).toBe(1);
        expect(run()).toBe(1); // cache hit — compute not re-run
        expect(computes).toBe(1);
    });

    it('recomputes when the file set changes', () => {
        const a = write('a.txt', 'x');
        const cache = path.join(dir, 'cache-v1.json');
        let computes = 0;
        const run = (): number => scanCached(cache, [a], () => { computes += 1; return computes; });
        expect(run()).toBe(1);
        write('a.txt', 'changed');
        expect(run()).toBe(2); // signature changed → recompute
    });

    it('--force bypasses the cache', () => {
        const a = write('a.txt', 'x');
        const cache = path.join(dir, 'cache-v1.json');
        let computes = 0;
        const run = (force: boolean): number => scanCached(cache, [a], () => { computes += 1; return computes; }, force);
        run(false);
        expect(run(true)).toBe(2);
    });

    it('clear() drops the cache so the next call recomputes', () => {
        const a = write('a.txt', 'x');
        const cache = path.join(dir, 'cache-v1.json');
        let computes = 0;
        const run = (): number => scanCached(cache, [a], () => { computes += 1; return computes; });
        run();
        clear(cache);
        expect(run()).toBe(2);
    });
});
