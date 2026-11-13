<!-- evidence-type: analysis -->

# Ratification review — the generation lock at eight file-lock sites — round 4

You are an independent reviewer for a change in the `event4u/agent-config` repository. Two files in it are on the ratification gate's list as hook-plumbing sources: `src/scripts/_lib/generation_lock.ts` (part of the hook dispatch bundle) and `src/config/hook-bundle-budget.json` (a raised byte ceiling). ADR-268 § 4 needs a two-provider verdict: an agent may change these files but may not ratify its own change.

subject: 8ff1d77099622cc3bcc4e67086ee7b4bf5b85dd521bfe9285bbe001ca80ef710

(The digest covers the gated files at commit `9cab4ccfc4` on branch `feat/road-to-verified-stale-lock-reclaim`; neither gated file changed since round 3, so the digest is the same. Computed with `./scripts-run src/scripts/ratification_subject` over the whole changed-file list.)

## The change

Round 3's prompt (`agents/evidence/council/verified-stale-lock-reclaim-ratification-r3-20261113.question.md`) carries the complete helper, the full diff of the seven other sites, `state_io`'s lock functions, the budget entry and the harness. In one line: eight cross-process file locks move from stat-then-remove or rename-aside stale breaking to a shared generation lock; the session-pins chunk ceiling rises 34,900 → 36,000 B (35,908 B measured, 34,512 B on origin/main).

## Round 3 and what changed

Refused 2/2. Both seats judged the helper and the budget entry defensible; the refusals concern the integration's claims.

1. **`_atomic_write_text` publishes when no lock is taken.** This is unchanged behaviour, and documented on origin/main. The function on origin/main and its comment, verbatim:

```ts
/**
 * A BLIND WRITE is the lesser evil here, and only here.
 *
 * `_acquire_lock` can now report that a live peer holds the lock. This writer
 * publishes anyway, because its unit of work is a whole-file replacement: the
 * publish is a `rename`, so the worst case under contention is last-writer-wins
 * on a complete, well-formed file — never a torn one. Refusing instead would
 * turn a contended write into a LOST write, and every caller here
 * (`atomic_write_json`, the dispatcher's feedback files) treats a lost write as
 * the more serious failure.
 *
 * `update_json_under_lock` takes the OPPOSITE decision on the same signal, and
 * the asymmetry is the point: a read-modify-write without exclusion produces
 * the lost UPDATE that function exists to prevent, so there it fails closed.
 * Pairing the two decisions in one place rather than picking one globally is
 * what keeps each caller's real failure mode addressed.
 *
 * This also preserves the pre-existing behaviour exactly. The old code reached
 * the same outcome by DELETING the peer's companion and proceeding, which wrote
 * the file and destroyed the peer's exclusion. This writes the file and leaves
 * the peer's lock intact.
 */
function _atomic_write_text(target: string, text: string): void {
  const lock_path = _lock_path(path.dirname(target));
  const fd = _acquire_lock(lock_path);
  if (fd === null) {
    _publish_text_locked(target, text);
    return;
  }
  try {
    _publish_text_locked(target, text);
  } finally {
    _release_lock(fd, lock_path);
  }
}
```

   The branch keeps the same branches with the new lock (`held === null` → blind whole-file rename; a held generation or `false` → publish, then release). The only behavioural difference is what `false` covers: on origin/main a non-EEXIST create error returned the fd and proceeded unguarded; now a create error or a listing error does. Its callers (`atomic_write_json`, `atomic_write_text`) are whole-file replacements whose worst case under contention is last-writer-wins on a complete file. The read-modify-write writers (`update_json_under_lock`, `update_text_under_lock`) refuse on `null`, as on origin/main. The CLI call budget's unlocked fallback after 1 s is also unchanged and documented. Neither path is claimed as excluded: the claim is that no stale-lock break or release lets two callers hold a lock, not that every writer takes one.

2. **"Every site" overstated coverage.** Corrected: the three-caller site harness runs six configurations of five modules (`state_io` non-blocking and strict, the language-mirror tool lock, the egress table, the council ledger, the project registry). The advisories refresh lock, the worktree removal lock and the CLI call budget are covered by their existing suites and by the helper's own step explorer only. The harness enumerates nested whole-caller schedules (B whole at each point of A, C whole at each point of B, plus A's pending mutation landing inside B), not every interleaving of three suspended callers; the exhaustive check is the helper's step explorer (all schedules of three callers with ≤ 3 preemptions, with sabotaged variants it must catch and a strict candidate).

3. **Strict refusal tests could pass a lock that admits nobody.** New in `9cab4ccfc4`, for every site configuration including strict: a lone caller enters the critical section, and so does the next one after the first released. `state_io.test.ts` also has "a released guard is taken over at once" for a strict caller (since round 2).

## What to answer

1. Does the diff contain a defect — in the helper's protocol, in any site's use of it, or in the budget entry? Name file and line.
2. Does the change expand any agent's authority or weaken an existing gate? Is the ceiling raise sized to the measurement?
3. Can two callers hold any of these locks at once other than the documented paused-holder residual of non-strict callers?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## `state_io.ts` at `9cab4ccfc4`: lock functions and `_atomic_write_text`

```ts
function _acquire_lock(
  lock_path: string,
  options: { blocking?: boolean; strict?: boolean } = {},
): Held | false | null {
  try {
    return acquire(`${lock_path}.held`, {
      staleMs: LOCK_STALE_MS,
      breakStale: options.strict !== true,
      waitMs: options.blocking === false ? 0 : LOCK_ACQUIRE_DEADLINE_MS,
      spinMs: LOCK_SPIN_SLEEP_MS,
    });
  } catch {
    return options.strict === true ? null : false;
  }
}

function _release_lock(held: Held | false): void {
  if (held !== false) release(held);
}

/**
 * Publish `text` at `target` atomically. CALLER MUST HOLD THE LOCK.
 *
 * Split out of `_atomic_write_text` so a read-modify-write can hold ONE lock
 * across all three steps. The lock in `_acquire_lock` is not reentrant: an
 * acquire nested inside a held lock sees its own fresh guard as a live peer and
 * waits out the 5-second deadline. That is why this is a separate function
 * rather than a nested call.
 */
function _atomic_write_text(target: string, text: string): void {
  const held = _acquire_lock(_lock_path(path.dirname(target)));
  if (held === null) {
    _publish_text_locked(target, text);
    return;
  }
  try {
    _publish_text_locked(target, text);
  } finally {
    _release_lock(held);
  }
}
```

## `src/scripts/_lib/generation_lock.ts` at `9cab4ccfc4` (complete, unchanged since round 3)

```ts
/**
 * A file or directory lock whose stale-break never removes a path another
 * caller may hold.
 *
 * Measured by `tests/scripts/generation_lock_interleavings.test.ts`; every
 * site that uses it by `tests/scripts/lock_sites_interleavings.test.ts`.
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
 * next caller supersedes it at once and generation numbers never restart. After
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
 * without a fenced write closes it.
 */
import fs from 'node:fs';
import path from 'node:path';

export interface GenerationLockOptions {
    staleMs: number;
    /**
     * `false`: never supersede a generation that went stale while held; take
     * over only one its holder released. A dead holder then blocks the lock.
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
        else fs.closeSync(fs.openSync(f, 'wx'));
        return true;
    } catch (err) {
        if (op === 'age') return null;
        if (op === 'remove' || op === 'expire') return undefined;
        if ((err as NodeJS.ErrnoException).code === 'EEXIST') return false;
        throw err;
    }
}

/** The acquire protocol, one filesystem step per yield. */
export function* acquireSteps(lockPath: string, staleMs: number, dir = false, breakStale = true): Generator<Step, Held | null, StepResult> {
    const gens = (yield ['list', lockPath]) as number[];
    const top = gens[gens.length - 1];
    let g = 0;
    if (top !== undefined) {
        const age = (yield ['age', companion(lockPath, top)]) as number | null;
        // Gone between the listing and the stat: only a superseder removes a
        // generation, so a higher one exists and holds.
        // The listing reads 15 digits at most; a generation past them would be
        // invisible to it, so the family is exhausted there rather than skipped.
        if (age === null || age < staleMs || (!breakStale && age !== Infinity) || top >= MAX_GENERATION) return null;
        g = top + 1;
    }
    if (!((yield [dir ? 'mkdir' : 'create', companion(lockPath, g)]) as boolean)) return null;
    const after = (yield ['list', lockPath]) as number[];
    if ((after[after.length - 1] ?? g) > g) {
        // Our listing was out of date and a later generation already holds.
        yield ['remove', companion(lockPath, g)];
        return null;
    }
    for (const lower of gens) yield ['remove', companion(lockPath, lower)];
    return { lockPath, generation: g };
}

/** One non-blocking attempt. Returns the held generation, or `null` when a live peer holds it. */
export function tryAcquire(lockPath: string, options: GenerationLockOptions): Held | null {
    const it = acquireSteps(lockPath, options.staleMs, options.dir, options.breakStale);
    let r = it.next();
    while (r.done !== true) r = it.next(execute(r.value, options.now));
    return r.value;
}

export interface AcquireOptions extends GenerationLockOptions {
    /** Total sleep between attempts before giving up; 0 makes exactly one attempt. */
    waitMs?: number;
    spinMs?: number;
}

/**
 * Attempt until held or until `waitMs` of sleep has been spent. The deadline
 * counts sleep, not the wall clock, so it bounds the number of attempts too.
 * A create that fails for any reason but `EEXIST` throws: whether to proceed
 * unguarded or refuse is the caller's decision.
 */
export function acquire(lockPath: string, options: AcquireOptions): Held | null {
    const spin = Math.max(1, options.spinMs ?? 5);
    for (let slept = 0; ; slept += spin) {
        const held = tryAcquire(lockPath, options);
        if (held !== null || slept >= (options.waitMs ?? 0)) return held;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, spin);
    }
}

/** The release protocol, one step: age the caller's own generation to the epoch; remove nothing. Never throws. */
export function release(held: Held): void {
    execute(['expire', companion(held.lockPath, held.generation)]);
}
```

## Test diff since round 3

```diff
diff --git a/tests/scripts/lock_sites_interleavings.test.ts b/tests/scripts/lock_sites_interleavings.test.ts
index 41332c8b83..64b75fe291 100644
--- a/tests/scripts/lock_sites_interleavings.test.ts
+++ b/tests/scripts/lock_sites_interleavings.test.ts
@@ -87,6 +87,15 @@ const SITES: Record<string, () => LockSite> = {
 describe.each(Object.keys(SITES))('%s', (name) => {
     const site = (): Harness => (harness = installHarness((SITES[name] as () => LockSite)()));
 
+    // Every refusal below would also pass a lock that never lets anyone in.
+    it('a lone caller enters, and so does the next one after its release', () => {
+        const s = (SITES[name] as () => LockSite)();
+        let entered = 0;
+        s.call(() => void (entered += 1));
+        s.call(() => void (entered += 1));
+        expect(entered).toBe(2);
+    });
+
     it('the harness reaches the lock: a lone caller passes several injection points', () => {
         expect(site().pointsOfSoloRun('abandoned')).toBeGreaterThan(2);
     });
```
