/**
 * A file lock whose stale-break never removes a path another caller may hold.
 *
 * Candidate for `road-to-verified-stale-lock-reclaim` step 1.2, measured by
 * `tests/scripts/generation_lock_interleavings.test.ts` against the same
 * three-caller schedules that found two holders in `state_io`'s lock.
 *
 * The guard is a family of companions `<lock>.held.<g>`. The holder is whoever
 * created the highest generation. Acquiring creates generation 1 when none
 * exists; breaking a stale highest generation `g` creates `g + 1` with
 * `O_EXCL` — two breakers race on one name, so exactly one wins — and only the
 * winner then removes the generations below its own, by name. A release never
 * removes anything: it ages the caller's own generation to the epoch, so the
 * next caller supersedes it at once and generation numbers never restart. After
 * every create the caller checks that no higher generation exists, and backs
 * off if one does. So no remove ever lands on a guard that is still the
 * holder's, which is the stat-then-remove window.
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

const SUFFIX = '.held.';

function generations(lockPath: string): number[] {
    const dir = path.dirname(lockPath);
    const prefix = path.basename(lockPath) + SUFFIX;
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    return names
        .filter((n) => n.startsWith(prefix) && /^\d+$/.test(n.slice(prefix.length)))
        .map((n) => Number(n.slice(prefix.length)))
        .sort((a, b) => a - b);
}

function companion(lockPath: string, g: number): string {
    return `${lockPath}${SUFFIX}${String(g)}`;
}

function createExclusive(file: string): boolean {
    try {
        fs.closeSync(fs.openSync(file, 'wx', 0o644));
        return true;
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'EEXIST') return false;
        throw err;
    }
}

/** One non-blocking attempt. Returns the held generation, or `null` when a live peer holds it. */
export function tryAcquire(lockPath: string, options: GenerationLockOptions): Held | null {
    const now = options.now ?? Date.now;
    const gens = generations(lockPath);
    const top = gens[gens.length - 1];
    if (top === undefined) return claim(lockPath, 1, []);
    let age: number;
    try {
        age = now() - fs.statSync(companion(lockPath, top)).mtimeMs;
    } catch {
        // Gone between the listing and the stat: only a superseder removes a
        // generation, so a higher one exists and holds.
        return null;
    }
    if (age < options.staleMs) return null;
    return claim(lockPath, top + 1, gens);
}

function claim(lockPath: string, g: number, below: readonly number[]): Held | null {
    if (!createExclusive(companion(lockPath, g))) return null;
    const after = generations(lockPath);
    if ((after[after.length - 1] ?? g) > g) {
        // Our listing was out of date and a later generation already holds.
        fs.rmSync(companion(lockPath, g), { force: true });
        return null;
    }
    for (const lower of below) fs.rmSync(companion(lockPath, lower), { force: true });
    return { lockPath, generation: g };
}

/** Release ages the caller's own generation to the epoch; it removes nothing. */
export function release(held: Held): void {
    try {
        fs.utimesSync(companion(held.lockPath, held.generation), 0, 0);
    } catch {
        // Already superseded and removed: nothing of ours is left to release.
    }
}
