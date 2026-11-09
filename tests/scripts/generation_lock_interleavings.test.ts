// The schedules that found two holders in `state_io`'s lock
// (`state_io_lock_interleavings.test.ts`), run against the generation-lock
// candidate of road-to-verified-stale-lock-reclaim step 1.2. Every filesystem
// call the candidate makes inside the lock directory is an injection point.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { release, tryAcquire } from '../../src/scripts/_lib/generation_lock.js';

const STALE_MS = 30_000;
type Op = 'open' | 'stat' | 'rm' | 'readdir' | 'utimes' | 'cs';
type Inject = Map<number, (op: Op, phase: 'before' | 'after') => void>;

const real = {
    openSync: fs.openSync,
    statSync: fs.statSync,
    rmSync: fs.rmSync,
    readdirSync: fs.readdirSync,
    utimesSync: fs.utimesSync,
};

let dir = '';
let lockPath = '';
const stack: { points: number; inject: Inject }[] = [];
const holders = new Set<string>();
let maxHolders = 0;
const doubleHolds: string[] = [];

function point(op: Op, phase: 'before' | 'after'): void {
    const top = stack[stack.length - 1];
    if (top === undefined) return;
    const i = top.points;
    top.points += 1;
    const fn = top.inject.get(i);
    if (fn !== undefined) {
        top.inject.delete(i);
        fn(op, phase);
    }
}

function observed<A extends unknown[], R>(op: Op, f: (...a: A) => R): (...a: A) => R {
    return (...a: A): R => {
        if (String(a[0]).startsWith(dir)) {
            point(op, 'before');
            try {
                return f(...a);
            } finally {
                point(op, 'after');
            }
        }
        return f(...a);
    };
}

function caller(name: string, inject: Inject, inCs?: () => void): boolean {
    stack.push({ points: 0, inject });
    try {
        const held = tryAcquire(lockPath, { staleMs: STALE_MS });
        if (held === null) return false;
        holders.add(name);
        if (holders.size > 1) doubleHolds.push([...holders].sort().join('+'));
        maxHolders = Math.max(maxHolders, holders.size);
        point('cs', 'before');
        inCs?.();
        holders.delete(name);
        release(held);
        return true;
    } finally {
        stack.pop();
    }
}

type Start = 'empty' | 'abandoned' | 'released';

function setUp(start: Start): void {
    holders.clear();
    maxHolders = 0;
    doubleHolds.length = 0;
    for (const n of real.readdirSync(dir)) real.rmSync(path.join(dir, n), { force: true });
    if (start === 'empty') return;
    const g = path.join(dir, 'lock.held.3');
    fs.writeFileSync(g, '');
    const t = start === 'released' ? 0 : (Date.now() - 2 * STALE_MS) / 1000;
    real.utimesSync(g, t, t);
}

function soloPoints(start: Start): number {
    setUp(start);
    const probe = { points: 0, inject: new Map() as Inject };
    stack.push(probe);
    try {
        const held = tryAcquire(lockPath, { staleMs: STALE_MS });
        point('cs', 'before');
        if (held !== null) release(held);
    } finally {
        stack.pop();
    }
    return probe.points;
}

function explore(start: Start): string[] {
    const n = soloPoints(start) + 2;
    const hits: string[] = [];
    const note = (label: string): void => {
        if (maxHolders > 1) hits.push(`${start} ${label} → ${doubleHolds.join(', ')}`);
    };
    for (let i = 0; i < n; i += 1) {
        for (let j = -1; j < n; j += 1) {
            setUp(start);
            const injectB: Inject = new Map();
            if (j >= 0) injectB.set(j, () => void caller('C', new Map()));
            caller('A', new Map([[i, () => void caller('B', injectB)]]));
            note(`A@${String(i)} B@${String(j)}`);
            // A's pending mutation lands inside B's critical section; then C.
            setUp(start);
            const injectB2: Inject = new Map();
            if (j >= 0) injectB2.set(j, () => void caller('C', new Map()));
            caller('A', new Map([[i, (op, phase) => {
                if (phase !== 'before' || (op !== 'rm' && op !== 'open' && op !== 'utimes')) return;
                caller('B', injectB2, () => caller('C', new Map()));
            }]]));
            note(`A@${String(i)} B-holds-across-A B@${String(j)}`);
        }
    }
    return hits;
}

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-lock-'));
    lockPath = path.join(dir, 'lock');
    fs.openSync = observed('open', real.openSync) as typeof fs.openSync;
    fs.statSync = observed('stat', real.statSync) as typeof fs.statSync;
    fs.rmSync = observed('rm', real.rmSync) as typeof fs.rmSync;
    fs.readdirSync = observed('readdir', real.readdirSync) as typeof fs.readdirSync;
    fs.utimesSync = observed('utimes', real.utimesSync) as typeof fs.utimesSync;
});

afterEach(() => {
    Object.assign(fs, real);
    real.rmSync(dir, { recursive: true, force: true });
});

describe('generation lock — the schedules that broke state_io', () => {
    it('acquires, excludes a live peer, and is acquirable again after release', () => {
        setUp('empty');
        const a = tryAcquire(lockPath, { staleMs: STALE_MS });
        expect(a).not.toBeNull();
        expect(tryAcquire(lockPath, { staleMs: STALE_MS })).toBeNull();
        release(a as NonNullable<typeof a>);
        const b = tryAcquire(lockPath, { staleMs: STALE_MS });
        expect(b?.generation).toBe((a?.generation ?? 0) + 1);
    });

    it.each(['empty', 'abandoned', 'released'] as const)('no schedule admits two holders, starting %s', (start) => {
        expect(explore(start)).toEqual([]);
    });

    it('a paused holder superseded after the stale threshold does not let a third caller in', () => {
        setUp('empty');
        caller('A', new Map(), () => {
            const [g] = real.readdirSync(dir);
            const t = (Date.now() - 2 * STALE_MS) / 1000;
            real.utimesSync(path.join(dir, String(g)), t, t);
            holders.delete('A'); // A's work is done; only its release is pending
            caller('B', new Map(), () => caller('C', new Map()));
            holders.add('A');
        });
        expect(maxHolders).toBe(1);
    });
});
