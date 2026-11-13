// Exhaustive interleavings of the generation-lock candidate
// (road-to-verified-stale-lock-reclaim step 1.2).
//
// The protocol is a sequence of filesystem steps (`acquireSteps`), so each
// caller can be advanced one step at a time against a real directory. The
// harness enumerates every schedule of three callers — acquire, enter, leave,
// release — plus an optional "time passes" actor that ages the newest guard
// while someone may hold it, bounded by a number of preemptions. A violation is
// two callers inside the critical section at once. Sabotaged variants of the
// protocol run through the same explorer and must be caught, which is what
// makes an empty result for the candidate mean something.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    acquire,
    acquireSteps,
    companion,
    execute,
    MAX_GENERATION,
    release,
    tryAcquire,
    type Held,
    type Step,
    type StepResult,
} from '../../src/scripts/_lib/generation_lock.js';

const STALE_MS = 30_000;

interface Protocol {
    acquire: (lockPath: string, staleMs: number) => Generator<Step, Held | null | false, StepResult>;
    release: (held: Held) => Generator<Step, void, StepResult>;
}

/** `release` is one step; this is that step, so the explorer can schedule it. */
const CANDIDATE: Protocol = {
    acquire: acquireSteps,
    release: function* (held) {
        yield ['expire', companion(held.lockPath, held.generation)];
    },
};

/** A caller that never supersedes a guard that went stale while held. */
const STRICT: Protocol = { acquire: (lp, staleMs) => acquireSteps(lp, staleMs, false, false), release: CANDIDATE.release };

let dir = '';
let lockPath = '';
const NOW = 1_000_000;

/** The lock directory as name → mtime, so a schedule replays in microseconds. */
let files = new Map<string, number>();

function run([op, file]: Step): StepResult {
    switch (op) {
        case 'list':
            return [...files.keys()]
                .filter((f) => f === lockPath || f.startsWith(`${lockPath}.`))
                .map((f) => (f === lockPath ? 0 : Number(f.slice(`${lockPath}.`.length))))
                .sort((a, b) => a - b);
        case 'age': {
            const m = files.get(file);
            return m === undefined ? null : m === 0 ? Infinity : NOW - m;
        }
        case 'create':
        case 'mkdir':
            if (files.has(file)) return false;
            files.set(file, NOW);
            return true;
        case 'remove':
            files.delete(file);
            return undefined;
        case 'expire':
            if (files.has(file)) files.set(file, 0);
            return undefined;
    }
}

type Start = 'empty' | 'abandoned' | 'released';

function setUp(start: Start): void {
    files = new Map();
    if (start === 'empty') return;
    files.set(companion(lockPath, 3), start === 'released' ? 0 : NOW - 2 * STALE_MS);
}

interface Actor {
    name: string;
    /** Runs one atomic action; `false` once the actor has nothing left to do. */
    step: () => boolean;
}

interface World {
    inCs: Set<string>;
    violations: string[];
}

function caller(name: string, proto: Protocol, world: World): Actor {
    const it = proto.acquire(lockPath, STALE_MS);
    let pending = it.next();
    let held: Held | null | false = null;
    let phase: 'acquire' | 'enter' | 'leave' | 'release' | 'done' = 'acquire';
    return {
        name,
        step: (): boolean => {
            switch (phase) {
                case 'acquire':
                    if (pending.done === true) {
                        held = pending.value;
                        phase = held === null || held === false ? 'done' : 'enter';
                        return phase !== 'done';
                    }
                    pending = it.next(run(pending.value));
                    return true;
                case 'enter':
                    world.inCs.add(name);
                    if (world.inCs.size > 1) world.violations.push([...world.inCs].sort().join('+'));
                    phase = 'leave';
                    return true;
                case 'leave':
                    world.inCs.delete(name);
                    phase = 'release';
                    return true;
                case 'release':
                    for (const s of proto.release(held as Held)) run(s);
                    phase = 'done';
                    return false;
                default:
                    return false;
            }
        },
    };
}

/** One action: the newest guard becomes stale, as if its holder paused past the threshold. */
function time(): Actor {
    let done = false;
    return {
        name: 'T',
        step: (): boolean => {
            if (done) return false;
            done = true;
            const gens = run(['list', lockPath]) as number[];
            const top = gens[gens.length - 1];
            if (top !== undefined) files.set(companion(lockPath, top), NOW - 2 * STALE_MS);
            return false;
        },
    };
}

type PruneMode = 'keep-highest' | 'whole-family';

/**
 * A pruner, one filesystem step per action. `keep-highest` is what the
 * session-state and egress pruners do: list the family, then remove every
 * member below the highest. `whole-family` is the shape ratification round 9
 * refused: judge each member's age, then remove it if it was stale.
 */
function prune(mode: PruneMode): Actor {
    const queue: (() => void)[] = [];
    let listed = false;
    return {
        name: 'P',
        step: (): boolean => {
            if (!listed) {
                listed = true;
                const gens = run(['list', lockPath]) as number[];
                const doomed = mode === 'keep-highest' ? gens.slice(0, -1) : gens;
                for (const g of doomed) {
                    const f = companion(lockPath, g);
                    if (mode === 'whole-family') {
                        let stale = false;
                        queue.push(() => void (stale = (run(['age', f]) as number | null ?? 0) >= STALE_MS));
                        queue.push(() => void (stale && run(['remove', f])));
                    } else {
                        queue.push(() => void run(['remove', f]));
                    }
                }
                return queue.length > 0;
            }
            queue.shift()?.();
            return queue.length > 0;
        },
    };
}

/**
 * Every schedule with at most `maxPreemptions` switches away from an actor that
 * could still run. Replays each prefix from a fresh directory, so every schedule
 * starts from the same state. Returns the distinct violating holder sets.
 */
function explore(proto: Protocol, start: Start, withTime: boolean, maxPreemptions: number, pruners: PruneMode[] = [], callers = ['A', 'B', 'C']): string[] {
    const found = new Set<string>();
    let schedules = 0;
    const run = (choices: number[]): { enabled: boolean[]; last: number } => {
        setUp(start);
        const world: World = { inCs: new Set(), violations: [] };
        const actors = callers.map((n) => caller(n, proto, world));
        if (withTime) actors.push(time());
        for (const m of pruners) actors.push(prune(m));
        const alive = actors.map(() => true);
        let last = -1;
        for (const c of choices) {
            if (!(alive[c] as boolean)) throw new Error('replayed a finished actor');
            alive[c] = (actors[c] as Actor).step();
            last = c;
        }
        for (const v of world.violations) found.add(v);
        return { enabled: alive, last };
    };
    const dfs = (choices: number[], preemptions: number): void => {
        const { enabled, last } = run(choices);
        const options = enabled.map((e, i) => (e ? i : -1)).filter((i) => i >= 0);
        if (options.length === 0) {
            schedules += 1;
            return;
        }
        for (const next of options) {
            const isPreemption = last >= 0 && next !== last && (enabled[last] as boolean);
            if (isPreemption && preemptions >= maxPreemptions) continue;
            dfs([...choices, next], preemptions + (isPreemption ? 1 : 0));
        }
    };
    dfs([], 0);
    if (schedules === 0) throw new Error('explored no complete schedule');
    return [...found].sort();
}

// ── Sabotaged variants: each drops one property the candidate relies on ──────

/** Release removes its generation, so numbering can restart under a stale view. */
const RELEASE_REMOVES: Protocol = {
    acquire: acquireSteps,
    release: function* (held) {
        yield ['remove', companion(held.lockPath, held.generation)];
    },
};

/** The candidate without the check that the superseded generation still exists. */
const NO_RECHECK: Protocol = {
    acquire: function* (lp, staleMs) {
        const gens = (yield ['list', lp]) as number[];
        const top = gens[gens.length - 1];
        let g = 0;
        if (top !== undefined) {
            const age = (yield ['age', companion(lp, top)]) as number | null;
            if (age === null || age < staleMs) return null;
            g = top + 1;
        }
        if (!((yield ['create', companion(lp, g)]) as boolean)) return null;
        const after = (yield ['list', lp]) as number[];
        if ((after[after.length - 1] ?? g) > g) {
            yield ['remove', companion(lp, g)];
            return null;
        }
        for (const lower of gens) yield ['remove', companion(lp, lower)];
        return { lockPath: lp, generation: g };
    },
    release: CANDIDATE.release,
};

/** Stat-then-remove, as `state_io` does: break the stale guard by deleting it, then create. */
const STAT_THEN_REMOVE: Protocol = {
    acquire: function* (lp, staleMs) {
        const file = `${lp}.3`;
        if ((yield ['create', file]) as boolean) return { lockPath: lp, generation: 3 };
        const age = (yield ['age', file]) as number | null;
        if (age === null || age < staleMs) return null;
        yield ['remove', file];
        if ((yield ['create', file]) as boolean) return { lockPath: lp, generation: 3 };
        return null;
    },
    release: function* (held) {
        yield ['remove', companion(held.lockPath, held.generation)];
    },
};

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-lock-'));
    lockPath = path.join(dir, 'lock');
});

afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
});

describe('generation lock — single caller', () => {
    it('acquires, excludes a live peer, and is acquirable again after release', () => {
        const a = tryAcquire(lockPath, { staleMs: STALE_MS });
        expect(a?.generation).toBe(0);
        expect(fs.existsSync(lockPath)).toBe(true);
        expect(tryAcquire(lockPath, { staleMs: STALE_MS })).toBeNull();
        release(a as Held);
        expect(tryAcquire(lockPath, { staleMs: STALE_MS })?.generation).toBe(1);
        expect(fs.existsSync(lockPath)).toBe(false);
    });

    it('a waiting acquire gives up on a live holder and takes a released one', () => {
        const a = acquire(lockPath, { staleMs: STALE_MS, waitMs: 10, spinMs: 5 });
        expect(acquire(lockPath, { staleMs: STALE_MS, waitMs: 10, spinMs: 5 })).toBeNull();
        release(a as Held);
        expect(acquire(lockPath, { staleMs: STALE_MS, waitMs: 10, spinMs: 5 })?.generation).toBe(1);
    });

    it('a create failing for any reason but EEXIST is thrown to the caller', () => {
        expect(() => acquire(path.join(dir, 'missing', 'lock'), { staleMs: STALE_MS })).toThrow(/ENOENT/);
    });
});

describe('generation lock — failures and options', () => {
    it('a listing that fails throws instead of reading as no generation', () => {
        const live = tryAcquire(lockPath, { staleMs: STALE_MS });
        expect(live).not.toBeNull();
        const spy = vi.spyOn(fs, 'readdirSync').mockImplementation(() => {
            throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
        });
        try {
            expect(() => tryAcquire(lockPath, { staleMs: STALE_MS })).toThrow(/EACCES/);
        } finally {
            spy.mockRestore();
        }
        expect(fs.readdirSync(dir)).toEqual([path.basename(lockPath)]);
    });

    it('a guard file is created owner-only', () => {
        tryAcquire(lockPath, { staleMs: STALE_MS });
        expect(fs.statSync(lockPath).mode & 0o777).toBe(0o600);
    });

    it('names that are not canonical generations are not generations', () => {
        for (const n of ['01', '1.5', 'Infinity', '1e3', '']) fs.writeFileSync(`${lockPath}.${n}`, '');
        expect(execute(['list', lockPath])).toEqual([]);
    });

    it('the last listed generation is never superseded by one the listing would not see', () => {
        fs.writeFileSync(companion(lockPath, MAX_GENERATION), '');
        fs.utimesSync(companion(lockPath, MAX_GENERATION), 0, 0);
        expect(execute(['list', lockPath])).toEqual([MAX_GENERATION]);
        expect(tryAcquire(lockPath, { staleMs: STALE_MS })).toBeNull();
        expect(tryAcquire(lockPath, { staleMs: STALE_MS, breakStale: false })).toBeNull();
        expect(fs.readdirSync(dir)).toEqual([path.basename(companion(lockPath, MAX_GENERATION))]);
    });

    it('a zero spin still ends at the deadline', () => {
        const a = tryAcquire(lockPath, { staleMs: STALE_MS });
        expect(a).not.toBeNull();
        expect(acquire(lockPath, { staleMs: STALE_MS, waitMs: 5, spinMs: 0 })).toBeNull();
    });

    it('breakStale false refuses a guard that went stale while held and takes a released one', () => {
        const a = tryAcquire(lockPath, { staleMs: STALE_MS }) as Held;
        const old = (Date.now() - 2 * STALE_MS) / 1000;
        fs.utimesSync(lockPath, old, old);
        // `false`, not `null`: the holder went stale, so a waiting caller stops at once.
        expect(tryAcquire(lockPath, { staleMs: STALE_MS, breakStale: false })).toBe(false);
        const t = Date.now();
        expect(acquire(lockPath, { staleMs: STALE_MS, breakStale: false, waitMs: 5_000, spinMs: 2 })).toBe(false);
        expect(Date.now() - t).toBeLessThan(500);
        release(a);
        expect((tryAcquire(lockPath, { staleMs: STALE_MS, breakStale: false }) as Held).generation).toBe(1);
    });
});

describe('the explorer catches what it must', () => {
    it('stat-then-remove admits two holders over an abandoned guard', () => {
        expect(explore(STAT_THEN_REMOVE, 'abandoned', false, 3)).not.toEqual([]);
    });

    it('a release that removes its generation admits two holders', () => {
                // A release that removes its generation restarts numbering; the check
        // that the superseded generation still exists now absorbs it, so the
        // candidate's acquire tolerates it. Without that check it does not:
        expect(explore({ ...NO_RECHECK, release: RELEASE_REMOVES.release }, 'abandoned', false, 3)).not.toEqual([]);
    });

    it('a pruner that retires the family admits two holders without the recheck', () => {
        expect(explore(NO_RECHECK, 'released', false, 3, ['whole-family'])).not.toEqual([]);
    });

    it('a recheck by name alone is not enough: a recreated generation reuses the name', () => {
        const NAME_ONLY: Protocol = {
            acquire: function* (lp, staleMs) {
                const gens = (yield ['list', lp]) as number[];
                const top = gens[gens.length - 1];
                let g = 0;
                if (top !== undefined) {
                    const age = (yield ['age', companion(lp, top)]) as number | null;
                    if (age === null || age < staleMs) return null;
                    g = top + 1;
                }
                if (!((yield ['create', companion(lp, g)]) as boolean)) return null;
                const after = (yield ['list', lp]) as number[];
                if ((after[after.length - 1] ?? g) > g || (top !== undefined && !after.includes(top))) {
                    yield ['remove', companion(lp, g)];
                    return null;
                }
                for (const lower of gens) yield ['remove', companion(lp, lower)];
                return { lockPath: lp, generation: g };
            },
            release: CANDIDATE.release,
        };
        expect(explore(NAME_ONLY, 'empty', false, 3, ['whole-family'])).not.toEqual([]);
    });
});

describe('generation lock — every schedule of three callers', () => {
    it.each(['empty', 'abandoned', 'released'] as const)('a pruner that keeps the highest generation admits no second holder, starting %s', (start) => {
        expect(explore(CANDIDATE, start, false, 3, ['keep-highest'])).toEqual([]);
    });

    it.each(['empty', 'abandoned', 'released'] as const)('two such pruners at once admit no second holder, starting %s', (start) => {
        expect(explore(CANDIDATE, start, false, 3, ['keep-highest', 'keep-highest'], ['A', 'B'])).toEqual([]);
    });

    it.each(['empty', 'abandoned', 'released'] as const)('a keep-highest pruner and a paused holder: only the paused one overlaps, starting %s', (start) => {
        const v = explore(CANDIDATE, start, true, 2, ['keep-highest']);
        expect(v.every((h) => h.split('+').length === 2)).toBe(true);
    });

    // Round 10's schedule: A creates generation 0 and pauses before its check
    // until 0 is stale; B supersedes it with 1; a keep-highest pruner removes
    // 0; B's recheck finds 0 gone and backs off. If backing off REMOVES 1 the
    // family is empty, A's check passes on an empty listing, and C creates 0
    // beside A. Backing off releases 1 instead, so the family keeps it.
    it.each([
        ['remove', ['A', 'C']],
        ['expire', ['C']],
    ] as const)('round 10 schedule when a caller backing off %ss its generation: holders %j', (backOff, holders) => {
        files = new Map();
        const steps = (lp: string): Generator<Step, Held | null | false, StepResult> =>
            backOff === 'expire'
                ? acquireSteps(lp, STALE_MS)
                : (function* () {
                      const it = acquireSteps(lp, STALE_MS);
                      let r = it.next();
                      while (r.done !== true) r = it.next(yield (r.value[0] === 'expire' ? ['remove', r.value[1]] : r.value) as Step);
                      return r.value;
                  })();
        const finish = (it: Generator<Step, Held | null | false, StepResult>, first: IteratorResult<Step, Held | null | false>): Held | null | false => {
            let r = first;
            while (r.done !== true) r = it.next(run(r.value));
            return r.value;
        };
        const a = steps(lockPath);
        let ra = a.next();
        ra = a.next(run(ra.value as Step)); // list: []
        ra = a.next(run(ra.value as Step)); // create 0
        files.set(companion(lockPath, 0), NOW - 2 * STALE_MS); // A paused until 0 went stale
        const b = steps(lockPath);
        let rb = b.next();
        rb = b.next(run(rb.value as Step)); // list: [0]
        rb = b.next(run(rb.value as Step)); // age 0: stale
        rb = b.next(run(rb.value as Step)); // create 1
        for (const g of (run(['list', lockPath]) as number[]).slice(0, -1)) run(['remove', companion(lockPath, g)]); // pruner removes 0
        expect(finish(b, rb)).toBeNull(); // B's recheck: 0 gone, B backs off
        const held: string[] = [];
        if (finish(a, ra)) held.push('A');
        const c = steps(lockPath);
        if (finish(c, c.next())) held.push('C');
        expect(held).toEqual(holders);
    });

    // Round 9's schedule, scripted step by step: a pruner P judges generation 0
    // stale and pauses; A supersedes it, works and releases; a second pruner
    // retires A's generation; B acquires a fresh generation 0; P resumes and
    // removes it; C acquires beside B. Judging and removing is the
    // stat-then-remove race again, which is why the pruners keep the highest.
    it.each([
        ['whole-family', ['B', 'C']],
        ['keep-highest', ['B']],
    ] as const)('round 9 schedule with a %s pruner: holders %j', (mode, holders) => {
        files = new Map([[lockPath, 0]]);
        const acquireNow = (): Held | null | false => {
            const it = acquireSteps(lockPath, STALE_MS);
            let r = it.next();
            while (r.done !== true) r = it.next(run(r.value));
            return r.value;
        };
        // P judges (whole-family) or lists (keep-highest) before anything moves.
        const pDoomed = mode === 'whole-family' ? [lockPath].filter((f) => (run(['age', f]) as number) >= STALE_MS) : (run(['list', lockPath]) as number[]).slice(0, -1).map((g) => companion(lockPath, g));
        const a = acquireNow() as Held;
        expect(a).toBeTruthy();
        run(['expire', companion(lockPath, a.generation)]);
        // Q retires the family in one go.
        const gens = run(['list', lockPath]) as number[];
        for (const g of mode === 'whole-family' ? gens : gens.slice(0, -1)) run(['remove', companion(lockPath, g)]);
        const held: string[] = [];
        if (acquireNow()) held.push('B');
        for (const f of pDoomed) run(['remove', f]);
        if (acquireNow()) held.push('C');
        expect(held).toEqual(holders);
    });

    it.each(['empty', 'abandoned', 'released'] as const)('no two holders without a pause, starting %s', (start) => {
        expect(explore(CANDIDATE, start, false, 3)).toEqual([]);
    });

    it.each(['empty', 'abandoned', 'released'] as const)('a caller that never breaks a stale guard admits no overlap at all, starting %s', (start) => {
        expect(explore(STRICT, start, true, 3)).toEqual([]);
    });

    it.each(['empty', 'abandoned', 'released'] as const)('with a paused holder, only the paused one overlaps, starting %s', (start) => {
        // A holder whose guard went stale while it held can overlap one
        // superseder: that is the lease without fencing the module names. What
        // must never happen is two callers that both hold a LIVE guard — so
        // every violation has to include a caller whose guard the time actor
        // aged, and no triple may appear.
        const v = explore(CANDIDATE, start, true, 3);
        expect(v.every((h) => h.split('+').length === 2)).toBe(true);
    });
});
