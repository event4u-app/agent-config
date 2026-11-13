// Deterministic interleaving harness for the `state_io` file lock
// (road-to-verified-stale-lock-reclaim step 1.1). It pinned the stat-then-remove
// defect; since step 2.1 `state_io` runs the generation lock and the list is
// empty. Every lock site runs the generalised harness in
// `lock_sites_interleavings.test.ts`.
//
// The lock code is synchronous, so a second caller cannot be scheduled between
// two of its filesystem calls by ordinary concurrency. Instead every call on the
// `.held` companion is an injection point: at a chosen point a whole other
// caller runs, synchronously, nested inside the first one's call, and that
// caller may carry an injection point of its own. Enumerating the points gives
// every ordering in which one caller's run lands between two filesystem calls of
// another — with no timing at all. The code under test is the real
// `update_text_under_lock`; only `fs` is observed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LOCK_STALE_MS, update_text_under_lock } from '../../src/scripts/hooks/state_io.js';

type Op = 'open' | 'stat' | 'rm' | 'cs';
type Inject = Map<number, (op: Op, phase: 'before' | 'after') => void>;

const real = { openSync: fs.openSync, statSync: fs.statSync, rmSync: fs.rmSync };

let dir = '';
let target = '';
let held = '';
const stack: { name: string; points: number; inject: Inject }[] = [];
const holders = new Set<string>();
let maxHolders = 0;
const doubleHolds: string[][] = [];

function point(op: Op = 'cs', phase: 'before' | 'after' = 'before'): void {
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
        if (/\.held(\.\d+)?$/.test(String(a[0]))) {
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

/** One caller: acquire, critical section (itself a point), release. */
function caller(name: string, inject: Inject, strict: boolean, inCs?: () => void): string {
    stack.push({ name, points: 0, inject });
    try {
        return update_text_under_lock(
            target,
            () => {
                holders.add(name);
                if (holders.size > 1) doubleHolds.push([...holders].sort());
                maxHolders = Math.max(maxHolders, holders.size);
                point();
                inCs?.();
                holders.delete(name);
                return null;
            },
            { blocking: false, strict },
        );
    } finally {
        stack.pop();
    }
}

function abandon(): void {
    fs.writeFileSync(held, '');
    const old = (Date.now() - 2 * LOCK_STALE_MS) / 1000;
    fs.utimesSync(held, old, old);
}

function reset(): void {
    holders.clear();
    maxHolders = 0;
    doubleHolds.length = 0;
    for (const n of fs.readdirSync(dir)) if (n.startsWith(path.basename(held))) real.rmSync(path.join(dir, n), { force: true });
}

function pointsOfSoloRun(strict: boolean): number {
    reset();
    abandon();
    stack.push({ name: 'probe', points: 0, inject: new Map() });
    const top = stack[0] as { points: number };
    try {
        update_text_under_lock(target, () => {
            point();
            return null;
        }, { blocking: false, strict });
    } finally {
        stack.pop();
    }
    return top.points;
}

/**
 * Every schedule of three callers over an abandoned lock: A runs; at A's point
 * `i` B runs whole; at B's point `j` (or never) C runs whole. Returns the
 * schedules in which two callers were inside the critical section at once.
 */
function exploreAbandoned(strict: boolean): string[] {
    const n = pointsOfSoloRun(strict);
    const hits: string[] = [];
    for (let i = 0; i < n + 2; i += 1) {
        for (let j = -1; j < n + 2; j += 1) {
            reset();
            abandon();
            const injectB: Inject = new Map();
            if (j >= 0) injectB.set(j, () => void caller('C', new Map(), strict));
            caller('A', new Map([[i, () => void caller('B', injectB, strict)]]), strict);
            if (maxHolders > 1) hits.push(`A@${String(i)} B@${j < 0 ? '-' : String(j)} → ${doubleHolds.map((h) => h.join('+')).join(', ')}`);
        }
        // A's pending remove lands while B holds: B runs at A's point `i`, and
        // inside B's critical section the remove A was about to make happens,
        // after which C (standing for A's continuation, or any third caller)
        // tries to acquire.
        reset();
        abandon();
        caller('A', new Map([[i, (op, phase) => {
            if (op !== 'rm' || phase !== 'before') return;
            caller('B', new Map(), strict, () => {
                real.rmSync(held, { force: true });
                caller('C', new Map(), strict);
            });
        }]]), strict);
        if (maxHolders > 1) hits.push(`A@${String(i)} rm-lands-in-B → ${doubleHolds.map((h) => h.join('+')).join(', ')}`);
    }
    return hits;
}

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lock-interleave-'));
    target = path.join(dir, 'state.json');
    held = `${target}.lock.held`;
    fs.openSync = observed('open', real.openSync) as typeof fs.openSync;
    fs.statSync = observed('stat', real.statSync) as typeof fs.statSync;
    fs.rmSync = observed('rm', real.rmSync) as typeof fs.rmSync;
});

afterEach(() => {
    fs.openSync = real.openSync;
    fs.statSync = real.statSync;
    fs.rmSync = real.rmSync;
    real.rmSync(dir, { recursive: true, force: true });
});

describe('state_io lock — three callers over an abandoned lock', () => {
    it('the harness is sensitive: a lone caller holds alone and sees its points', () => {
        expect(pointsOfSoloRun(false)).toBeGreaterThan(4);
        reset();
        abandon();
        expect(caller('A', new Map(), false)).toBe('skipped');
        expect(maxHolders).toBe(1);
    });

    it('a breaking caller (non-strict) admits no second holder', () => {
        const hits = exploreAbandoned(false);
        if (process.env['LOCK_HARNESS_PRINT'] === '1') process.stdout.write(`${hits.join('\n')}\n`);
        expect(hits).toEqual([]);
    });

    it('a strict caller admits no second holder', () => {
        expect(exploreAbandoned(true)).toEqual([]);
    });
});

describe('state_io lock — a release that lands while a peer holds', () => {
    // A holds and is paused past the stale threshold; at A's release, B breaks
    // A's aged guard and acquires; inside B's critical section A's pending
    // remove lands and deletes B's guard; C then acquires beside B.
    function releaseRace(strict: boolean): number {
        reset();
        caller(
            'A',
            new Map(),
            strict,
            () => {
                const old = (Date.now() - 2 * LOCK_STALE_MS) / 1000;
                fs.utimesSync(held, old, old);
                holders.delete('A'); // A has finished its work; only its release is pending
                caller('B', new Map(), strict, () => {
                    real.rmSync(held, { force: true }); // A's release, landing now
                    caller('C', new Map(), strict);
                });
                holders.add('A');
            },
        );
        return maxHolders;
    }

    it('non-strict: the landing release removes nothing B holds', () => {
        expect(releaseRace(false)).toBe(1);
    });

    it('strict: the landing release removes nothing B holds', () => {
        expect(releaseRace(true)).toBe(1);
    });
});
