// Deterministic three-caller interleaving harness for the file locks in
// `src/scripts` (road-to-verified-stale-lock-reclaim, steps 1.1 and 2.x).
//
// The locks are synchronous, so a second caller cannot be scheduled between two
// filesystem calls of the first by ordinary concurrency. Instead every `fs` call
// on a path belonging to the lock is an injection point: at a chosen point a
// whole other caller runs, synchronously, nested inside the first one's call,
// and that caller may carry an injection point of its own. Enumerating the
// points gives every ordering in which one caller's run lands between two
// filesystem calls of another, with no timing at all.
//
// Sleeps are skipped and `Date.now` advances one millisecond per read while the
// harness is installed, so a caller that waits for a live peer gives up at once
// instead of after its real deadline. A guard file's age still comes from its
// real mtime, so a live guard never looks stale. A caller whose lock swallows
// every error (`state_io`) must therefore not run a waiting variant here: the
// nested give-up below would read as proceeding unguarded.
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import path from 'node:path';

type Phase = 'before' | 'after';
type Inject = Map<number, (op: string, phase: Phase, args: unknown[]) => void>;

export interface LockSite {
    /** Every path that starts with this belongs to the lock: its calls are injection points. */
    guardPrefix: string;
    /** Run one caller; `body` runs only inside its critical section. A thrown refusal is not a hold. */
    call: (body: () => void) => void;
}

const OBSERVED = ['openSync', 'statSync', 'lstatSync', 'rmSync', 'unlinkSync', 'mkdirSync', 'rmdirSync', 'readdirSync', 'utimesSync', 'renameSync', 'writeFileSync', 'readFileSync', 'linkSync'] as const;
const MUTATING = new Set(['rmSync', 'unlinkSync', 'rmdirSync', 'utimesSync', 'renameSync']);

const real = Object.fromEntries(OBSERVED.map((k) => [k, fs[k]])) as Record<(typeof OBSERVED)[number], (...a: unknown[]) => unknown>;
const realWait = Atomics.wait;
const realNow = Date.now;

export interface Harness {
    /** Every schedule over a given start; returns the schedules that let two callers hold at once. */
    explore: (start: 'abandoned' | 'paused-holder') => string[];
    /** How many injection points a lone caller passes from `start`; a sensitivity check. */
    pointsOfSoloRun: (start: 'abandoned' | 'paused-holder') => number;
    uninstall: () => void;
}

export function installHarness(site: LockSite): Harness {
    const dir = path.dirname(site.guardPrefix);
    const base = path.basename(site.guardPrefix);
    const stack: { points: number; inject: Inject }[] = [];
    const holders = new Set<string>();
    const doubles: string[] = [];

    const ours = (p: unknown): boolean => typeof p === 'string' && (p.startsWith(site.guardPrefix) || p === dir);
    const point = (op: string, phase: Phase, args: unknown[]): void => {
        const top = stack[stack.length - 1];
        if (top === undefined) return;
        const i = top.points;
        top.points += 1;
        const fn = top.inject.get(i);
        if (fn !== undefined) {
            top.inject.delete(i);
            fn(op, phase, args);
        }
    };
    for (const k of OBSERVED) {
        const f = real[k];
        (fs as unknown as Record<string, unknown>)[k] = (...a: unknown[]): unknown => {
            if (!ours(a[0])) return f(...a);
            point(k, 'before', a);
            try {
                return f(...a);
            } finally {
                point(k, 'after', a);
            }
        };
    }
    syncBuiltinESMExports();
    // A nested caller cannot see its outer holder release, so every attempt
    // after its first wait repeats the same state: it gives up instead. The
    // outermost caller keeps its full retry loop.
    Atomics.wait = ((): 'timed-out' => {
        if (stack.length > 1) throw new Error('harness: a nested caller would wait');
        return 'timed-out';
    }) as typeof Atomics.wait;
    let clock = realNow();
    Date.now = (): number => (clock += 1);

    const guards = (): string[] => {
        try {
            return (real.readdirSync(dir) as string[]).filter((n) => n.startsWith(base)).map((n) => path.join(dir, n));
        } catch {
            return [];
        }
    };
    const ageAll = (): void => {
        const old = (realNow() - 3_600_000) / 1000;
        for (const g of guards()) real.utimesSync(g, old, old);
    };
    const clear = (): void => {
        for (const g of guards()) real.rmSync(g, { recursive: true, force: true });
        holders.clear();
        doubles.length = 0;
    };

    const caller = (name: string, inject: Inject, start: string, inCs?: () => void): void => {
        stack.push({ points: 0, inject });
        try {
            site.call(() => {
                holders.add(name);
                if (holders.size > 1) doubles.push([...holders].sort().join('+'));
                point('cs', 'before', []);
                inCs?.();
                // A holder that pauses past the stale threshold before it releases.
                if (start === 'paused-holder' && name === 'A') ageAll();
                holders.delete(name);
            });
        } catch {
            // A refusal (lock not acquired) is a legitimate outcome, not a hold.
        } finally {
            stack.pop();
        }
    };

    const prepare = (start: string): void => {
        // Each schedule starts on the real clock, so the drift of earlier ones
        // never makes a live guard look stale.
        clock = realNow();
        clear();
        if (start === 'abandoned') {
            // What a lone holder has on disk inside its critical section is the
            // shape a crashed holder leaves: snapshot it, recreate it, age it.
            let shape: { p: string; isDir: boolean }[] = [];
            site.call(() => {
                shape = guards().map((p) => ({ p, isDir: (real.statSync(p) as fs.Stats).isDirectory() }));
            });
            clear();
            for (const s of shape) {
                if (s.isDir) real.mkdirSync(s.p, { recursive: true });
                else real.writeFileSync(s.p, '');
            }
            ageAll();
        }
    };

    const pointsOfSoloRun = (start: 'abandoned' | 'paused-holder'): number => {
        prepare(start);
        stack.push({ points: 0, inject: new Map() });
        const top = stack[0] as { points: number };
        try {
            site.call(() => point('cs', 'before', []));
        } catch {
            /* counted all the same */
        } finally {
            stack.pop();
        }
        return top.points;
    };

    const explore = (start: 'abandoned' | 'paused-holder'): string[] => {
        const n = pointsOfSoloRun(start);
        const hits = new Set<string>();
        for (let i = 0; i < n + 2; i += 1) {
            for (let j = -1; j < n + 2; j += 1) {
                prepare(start);
                const injectB: Inject = new Map();
                if (j >= 0) injectB.set(j, () => void caller('C', new Map(), start));
                caller('A', new Map([[i, () => void caller('B', injectB, start)]]), start);
                for (const d of doubles) hits.add(`A@${String(i)} B@${j < 0 ? '-' : String(j)} → ${d}`);
            }
            // A's pending mutation lands while B holds: B runs at A's point `i`,
            // the call A was about to make happens inside B's critical section,
            // and then C (A's continuation, or any third caller) tries.
            prepare(start);
            caller('A', new Map([[i, (op, phase, args) => {
                if (!MUTATING.has(op) || phase !== 'before') return;
                caller('B', new Map(), start, () => {
                    try {
                        real[op as (typeof OBSERVED)[number]](...args);
                    } catch {
                        /* A's own call would have failed the same way */
                    }
                    caller('C', new Map(), start);
                });
            }]]), start);
            for (const d of doubles) hits.add(`A@${String(i)} ${start === 'paused-holder' ? 'release' : 'break'}-lands-in-B → ${d}`);
        }
        return [...hits].sort();
    };

    const uninstall = (): void => {
        for (const k of OBSERVED) (fs as unknown as Record<string, unknown>)[k] = real[k];
        syncBuiltinESMExports();
        Atomics.wait = realWait;
        Date.now = realNow;
    };

    return { explore, pointsOfSoloRun, uninstall };
}
