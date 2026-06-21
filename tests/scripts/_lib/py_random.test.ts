// Tests for src/scripts/_lib/py_random.ts (py2ts Phase 1).
//
// PyRandom is a bit-exact reproduction of CPython's `random.Random` (MT19937).
// There is NO py_random.py source — the Python side is the stdlib `random`
// module, so the oracle is real CPython spawned via `python3 -c …`. Every
// assertion compares the TS lib against the live CPython stream for the two
// surfaces the prediction-pool simulators consume: `random()` sequences and
// `shuffle()`. getrandbits (the k>32 general case) is also cross-checked even
// though the sims only ever hit k<=32 via small-list shuffles.
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { PyRandom } from '../../../src/scripts/_lib/py_random.js';

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

function py(code: string): string {
    const r = spawnSync('python3', ['-c', code], { encoding: 'utf8' });
    if (r.status !== 0) {
        throw new Error(`python3 failed: ${r.stderr}`);
    }
    return r.stdout.trim();
}

describe.runIf(hasPython3())('PyRandom — CPython MT19937 parity', () => {
    const seeds = [0, 1, 7, 42, 123456789, 2147483647];

    it.each(seeds)('random() sequence matches CPython for seed=%s', (seed) => {
        const oracle = py(
            `import random,json;r=random.Random(${seed});print(json.dumps([repr(r.random()) for _ in range(20)]))`,
        );
        const expected = JSON.parse(oracle) as string[];
        const r = new PyRandom(seed);
        const got: string[] = [];
        for (let i = 0; i < 20; i += 1) {
            // repr(float) is the shortest round-trippable decimal; JS String()
            // on a double produces the same shortest form for these values.
            got.push(String(r.random()));
        }
        expect(got).toEqual(expected);
    });

    const shuffleCases: Array<[number, number]> = [
        [1, 5],
        [1, 10],
        [1, 25],
        [7, 10],
        [42, 8],
        [42, 25],
        [99, 50],
        [12345, 16],
    ];

    it.each(shuffleCases)('shuffle() matches CPython for seed=%s size=%s', (seed, size) => {
        const oracle = py(
            `import random,json;r=random.Random(${seed});l=list(range(${size}));r.shuffle(l);print(json.dumps(l))`,
        );
        const expected = JSON.parse(oracle) as number[];
        const r = new PyRandom(seed);
        const list = Array.from({ length: size }, (_, i) => i);
        r.shuffle(list);
        expect(list).toEqual(expected);
    });

    const bitsCases: Array<[number, number]> = [
        [1, 8],
        [1, 32],
        [1, 40],
        [1, 64],
        [7, 53],
        [42, 100],
    ];

    it.each(bitsCases)('getrandbits(%s bits) matches CPython for seed=%s', (seed, k) => {
        const expected = py(`import random;r=random.Random(${seed});print(r.getrandbits(${k}))`);
        const r = new PyRandom(seed);
        const got = r.getrandbits(k);
        expect(String(got)).toBe(expected);
    });

    it('large (negative-equivalent abs) seed matches CPython random()', () => {
        const seed = 9007199254740881; // a large safe integer
        const oracle = py(
            `import random,json;r=random.Random(${seed});print(json.dumps([repr(r.random()) for _ in range(5)]))`,
        );
        const expected = JSON.parse(oracle) as string[];
        const r = new PyRandom(seed);
        const got = Array.from({ length: 5 }, () => String(r.random()));
        expect(got).toEqual(expected);
    });
});
