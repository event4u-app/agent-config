/**
 * A file lock whose stale-break never removes a path another caller may hold.
 *
 * Candidate for `road-to-verified-stale-lock-reclaim` step 1.2, measured by
 * `tests/scripts/generation_lock_interleavings.test.ts`.
 *
 * The guard is a family of companions `<lock>.held.<g>`. The holder is whoever
 * created the highest generation. Acquiring creates generation 1 when none
 * exists; breaking a stale highest generation `g` creates `g + 1` with
 * `O_EXCL` — two breakers race on one name, so exactly one wins — and only the
 * winner then removes the generations below its own, by name. A release never
 * removes anything: it ages the caller's own generation to the epoch, so the
 * next caller supersedes it at once and generation numbers never restart. After
 * every create the caller checks that no higher generation exists, and backs
 * off if one does.
 *
 * The protocol is written as a sequence of filesystem steps (`acquireSteps`)
 * so the interleaving harness can run several callers step by step against a
 * real directory; `tryAcquire` drives the same steps synchronously.
 *
 * What it does not do: a holder paused past the stale threshold keeps running
 * after a peer superseded it. That is a lease without fencing, and no lock
 * without a fenced write closes it.
 */
import fs from 'node:fs';
import path from 'node:path';

export interface GenerationLockOptions {
    staleMs: number;
    /** Clock, injectable for tests. */
    now?: () => number;
}

export interface Held {
    readonly lockPath: string;
    readonly generation: number;
}

export type Step =
    | { op: 'list'; lockPath: string }
    | { op: 'age'; file: string }
    | { op: 'create'; file: string }
    | { op: 'remove'; file: string }
    | { op: 'expire'; file: string };

/** What a step returns: a generation list, an age in ms (`null` when absent), or whether a create won. */
export type StepResult = number[] | number | null | boolean | undefined;

const SUFFIX = '.held.';

export function companion(lockPath: string, g: number): string {
    return `${lockPath}${SUFFIX}${String(g)}`;
}

/** Execute one step against the real filesystem. */
export function execute(step: Step, now: () => number = Date.now): StepResult {
    switch (step.op) {
        case 'list': {
            const prefix = path.basename(step.lockPath) + SUFFIX;
            let names: string[];
            try {
                names = fs.readdirSync(path.dirname(step.lockPath));
            } catch {
                return [];
            }
            return names
                .filter((n) => n.startsWith(prefix) && /^\d+$/.test(n.slice(prefix.length)))
                .map((n) => Number(n.slice(prefix.length)))
                .sort((a, b) => a - b);
        }
        case 'age':
            try {
                return now() - fs.statSync(step.file).mtimeMs;
            } catch {
                return null;
            }
        case 'create':
            try {
                fs.closeSync(fs.openSync(step.file, 'wx', 0o644));
                return true;
            } catch (err) {
                if ((err as NodeJS.ErrnoException).code === 'EEXIST') return false;
                throw err;
            }
        case 'remove':
            fs.rmSync(step.file, { force: true });
            return undefined;
        case 'expire':
            try {
                fs.utimesSync(step.file, 0, 0);
            } catch {
                // Already superseded and removed: nothing of ours is left.
            }
            return undefined;
    }
}

/** The acquire protocol, one filesystem step per yield. */
export function* acquireSteps(lockPath: string, staleMs: number): Generator<Step, Held | null, StepResult> {
    const gens = (yield { op: 'list', lockPath }) as number[];
    const top = gens[gens.length - 1];
    let g = 1;
    if (top !== undefined) {
        const age = (yield { op: 'age', file: companion(lockPath, top) }) as number | null;
        // Gone between the listing and the stat: only a superseder removes a
        // generation, so a higher one exists and holds.
        if (age === null || age < staleMs) return null;
        g = top + 1;
    }
    if (!((yield { op: 'create', file: companion(lockPath, g) }) as boolean)) return null;
    const after = (yield { op: 'list', lockPath }) as number[];
    if ((after[after.length - 1] ?? g) > g) {
        // Our listing was out of date and a later generation already holds.
        yield { op: 'remove', file: companion(lockPath, g) };
        return null;
    }
    for (const lower of gens) yield { op: 'remove', file: companion(lockPath, lower) };
    return { lockPath, generation: g };
}

/** One non-blocking attempt. Returns the held generation, or `null` when a live peer holds it. */
export function tryAcquire(lockPath: string, options: GenerationLockOptions): Held | null {
    const it = acquireSteps(lockPath, options.staleMs);
    let r = it.next();
    while (r.done !== true) r = it.next(execute(r.value, options.now));
    return r.value;
}

/** The release protocol: age the caller's own generation to the epoch; remove nothing. */
export function* releaseSteps(held: Held): Generator<Step, void, StepResult> {
    yield { op: 'expire', file: companion(held.lockPath, held.generation) };
}

export function release(held: Held): void {
    for (const step of releaseSteps(held)) execute(step);
}
