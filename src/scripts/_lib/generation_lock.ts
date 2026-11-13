/**
 * A file or directory lock whose stale-break never removes a path another
 * caller may hold.
 *
 * Measured by `tests/scripts/generation_lock_interleavings.test.ts`; five of
 * the modules that use it also by `tests/scripts/lock_sites_interleavings.test.ts`.
 * Exclusion holds among callers of this protocol only (see generation 0 below).
 *
 * The guard is a family `<guard>`, `<guard>.1`, `<guard>.2`, …: generation 0 is
 * the bare path each caller passes, the name its stat-then-remove lock used. An
 * older process therefore sees a generation-0 holder, but nothing more: once a
 * higher generation holds, it can create generation 0 beside it, so mixed
 * versions on one lock are not excluded. The holder is whoever created the
 * highest generation. Acquiring creates generation 0 when none exists; breaking a stale highest generation `g` creates `g + 1` with
 * `O_EXCL` — two breakers race on one name, so exactly one wins — and only the
 * winner then removes the generations below its own, by name. A release never
 * removes anything: it ages the caller's own generation to the epoch, so the
 * next caller supersedes it at once. Nobody removes the highest generation —
 * a superseder removes only those below its own, a caller that backs off
 * releases its own, and a pruner keeps the highest — so a family never
 * empties and its numbering never restarts. After
 * every create the caller checks that no higher generation exists, and backs
 * off if one does. A listing that fails throws rather than reading as "no
 * generation", which would let a caller create beside a live holder.
 *
 * The protocol is written as a sequence of filesystem steps (`acquireSteps`)
 * so the interleaving harness can run several callers step by step against a
 * real directory; `tryAcquire` drives the same steps synchronously.
 *
 * What it does not do: a holder paused past the stale threshold keeps running
 * after a peer superseded it. That is a lease without fencing, and no lock
 * without a fenced write closes it. It holds for every holder, strict or not:
 * `breakStale: false` stops the caller that passes it from superseding, and
 * protects a holder only on a lock every caller takes that way.
 */
import fs from 'node:fs';
import path from 'node:path';

export interface GenerationLockOptions {
    staleMs: number;
    /**
     * `false`: never supersede a generation that went stale while held; take
     * over only one its holder released. A dead holder then blocks the lock.
     * It binds this caller only; a holder is safe from supersession only if
     * every caller of the lock passes it.
     */
    breakStale?: boolean;
    /** Each generation is a directory (`mkdir`) instead of a file. */
    dir?: boolean;
    /** Clock, injectable for tests. */
    now?: () => number;
}

export interface Held {
    readonly lockPath: string;
    readonly generation: number;
}

/** One filesystem step: `create` makes a file, `mkdir` a directory, both exclusively. */
export type Step = readonly ['list' | 'age' | 'create' | 'mkdir' | 'remove' | 'expire', string];

/** What a step returns: a generation list, an age in ms (`null` when absent, `Infinity` once released), or whether a create won. */
export type StepResult = number[] | number | null | boolean | undefined;

/** The highest generation the listing recognises (`[1-9][0-9]{0,14}`). */
export const MAX_GENERATION = 999_999_999_999_999;

export function companion(lockPath: string, g: number): string {
    return g === 0 ? lockPath : `${lockPath}.${String(g)}`;
}

/**
 * Execute one step against the real filesystem. A create that lost the race is
 * `false`; any other create or listing failure is the caller's to judge.
 * Elsewhere a failure reads as absence: a vanished guard has no age, and a
 * lower or expired generation left behind holds nothing.
 */
export function execute([op, f]: Step, now: () => number = Date.now): StepResult {
    try {
        if (op === 'list') {
            const own = path.basename(f);
            return fs
                .readdirSync(path.dirname(f))
                .map((n) => (n === own ? 0 : /^\.[1-9]\d{0,14}$/.test(n.slice(own.length)) && n.startsWith(own) ? Number(n.slice(own.length + 1)) : -1))
                .filter((g) => g >= 0)
                .sort((a, b) => a - b);
        }
        if (op === 'age') {
            const m = fs.statSync(f).mtimeMs;
            return m === 0 ? Infinity : now() - m;
        }
        if (op === 'remove') return void fs.rmSync(f, { recursive: true, force: true });
        if (op === 'expire') return void fs.utimesSync(f, 0, 0);
        if (op === 'mkdir') fs.mkdirSync(f);
        else fs.closeSync(fs.openSync(f, 'wx', 0o600));
        return true;
    } catch (err) {
        if (op === 'age') return null;
        if (op === 'remove' || op === 'expire') return undefined;
        if ((err as NodeJS.ErrnoException).code === 'EEXIST') return false;
        throw err;
    }
}

/** The acquire protocol, one filesystem step per yield. */
export function* acquireSteps(lockPath: string, staleMs: number, dir = false, breakStale = true): Generator<Step, Held | null | false, StepResult> {
    const gens = (yield ['list', lockPath]) as number[];
    const top = gens[gens.length - 1];
    let g = 0;
    if (top !== undefined) {
        const age = (yield ['age', companion(lockPath, top)]) as number | null;
        // Gone between the listing and the stat: a superseder removed it, so a
        // higher one exists (a pruner removes only below the highest, too).
        // The listing reads 15 digits at most; a generation past them would be
        // invisible to it, so the family is exhausted there rather than skipped.
        if (age === null || age < staleMs || top >= MAX_GENERATION) return null;
        // Stale while held, and this caller never supersedes that: `false`, so
        // a waiting caller stops at once instead of retrying a guard that stays.
        if (!breakStale && age !== Infinity) return false;
        g = top + 1;
    }
    if (!((yield [dir ? 'mkdir' : 'create', companion(lockPath, g)]) as boolean)) return null;
    const after = (yield ['list', lockPath]) as number[];
    // Back off if our listing was out of date and a later generation holds, or
    // if the generation we superseded is no longer the stale one we judged:
    // only its superseder removes it, and only after this check, so a winner
    // always still finds it stale — unless a pruner removed it once our
    // generation stood above it, which costs one wasted attempt, never a second
    // holder. Fresh, or gone without a pruner, means something outside the
    // protocol removed the family's highest generation (an older process, a
    // manual delete); numbering may then have restarted, and a caller that
    // created that name since could hold beside us.
    const again = top === undefined ? staleMs : ((yield ['age', companion(lockPath, top)]) as number | null) ?? 0;
    if ((after[after.length - 1] ?? g) > g || again < staleMs) {
        // Release, never remove: ours may be the highest generation, and the
        // family must never empty, or numbering restarts (as above).
        yield ['expire', companion(lockPath, g)];
        return null;
    }
    for (const lower of gens) yield ['remove', companion(lockPath, lower)];
    return { lockPath, generation: g };
}

/**
 * One non-blocking attempt. Returns the held generation, `null` when a live
 * peer holds it, or `false` (only with `breakStale: false`) when the holder
 * went stale without releasing.
 */
export function tryAcquire(lockPath: string, options: GenerationLockOptions & { breakStale?: true }): Held | null;
export function tryAcquire(lockPath: string, options: GenerationLockOptions): Held | null | false;
export function tryAcquire(lockPath: string, options: GenerationLockOptions): Held | null | false {
    const it = acquireSteps(lockPath, options.staleMs, options.dir, options.breakStale);
    let r = it.next();
    while (r.done !== true) r = it.next(execute(r.value, options.now));
    return r.value;
}

export interface AcquireOptions extends GenerationLockOptions {
    /** Wall-clock time to keep attempting before giving up; 0 makes exactly one attempt. */
    waitMs?: number;
    spinMs?: number;
}

/**
 * Attempt until held or until `waitMs` has passed on the wall clock — not
 * until the sleeps add up to it: every attempt lists the directory and every
 * sleep overshoots, which overran a 5 s deadline by seconds.
 * A create that fails for any reason but `EEXIST` throws: whether to proceed
 * unguarded or refuse is the caller's decision.
 */
export function acquire(lockPath: string, options: AcquireOptions & { breakStale?: true }): Held | null;
export function acquire(lockPath: string, options: AcquireOptions): Held | null | false;
export function acquire(lockPath: string, options: AcquireOptions): Held | null | false {
    const end = Date.now() + (options.waitMs ?? 0);
    for (;;) {
        const held = tryAcquire(lockPath, options);
        if (held !== null || Date.now() >= end) return held;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.max(1, options.spinMs ?? 5));
    }
}

/** The release protocol, one step: age the caller's own generation to the epoch; remove nothing. Never throws. */
export function release(held: Held): void {
    execute(['expire', companion(held.lockPath, held.generation)]);
}
