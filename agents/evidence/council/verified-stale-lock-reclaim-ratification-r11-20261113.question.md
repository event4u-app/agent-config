<!-- evidence-type: analysis -->

# Ratification review — the generation lock at eight file-lock sites — round 11

You are an independent reviewer for a change in the `event4u/agent-config` repository. Two files in it are on the ratification gate's list as hook-plumbing sources: `src/scripts/_lib/generation_lock.ts` (part of the hook dispatch bundle) and `src/config/hook-bundle-budget.json` (a raised byte ceiling). ADR-268 § 4 needs a two-provider verdict: an agent may change these files but may not ratify its own change. This prompt is self-contained.

subject: e07233b975456a1a7e3d4ac235b4641929248fe711a84e763e8610c7b817591a

(The digest covers the gated files at commit `1e312ac56b` on branch `feat/road-to-verified-stale-lock-reclaim`, computed with `./scripts-run src/scripts/ratification_subject` over the whole changed-file list.)

## The change

Eight cross-process file locks move from stat-then-remove or rename-aside stale breaking to a shared generation lock: breaking a stale highest generation `g` creates `g+1` exclusively, only the winner removes lower generations by name, a release ages its own generation to the epoch and removes nothing, and after each create the caller backs off if a higher generation exists or if the generation it superseded is no longer the stale one it judged.

**The claim, scoped.** Among callers that all run this protocol, no stale-lock break, release or prune lets two callers hold a lock at once, except that a non-strict holder paused past the stale threshold keeps running beside its superseder (no fencing; named at every site). Every read-modify-write writer refuses when it cannot take the lock. Not claimed: exclusion against a process still on the old code, and exclusion for the two writers that publish without a lock by design (`state_io`'s whole-file `_atomic_write_text`, and the CLI call budget after its 1 s wait; both documented and unchanged in policy).

## Round 9, round 10, and what changed

Round 9 refused 2/2 on the pruners: a pruner that judged a lock generation stale and then removed it was itself a stat-then-remove breaker (judge, pause, the family moves on and is recreated, remove the fresh generation), and removing a whole family restarted the numbering. Both seats also asked that the explorer split the pruner's filesystem steps, allow concurrent pruners, and carry the reported schedule as a test.

Fixed in `f4560ac412`:

- **No pruner judges and removes.** The session-state pruner (`state_io.ts`) and the egress-table pruner remove, by name, every generation of a retired file's lock family **except the highest**, without reading any age. Lower generations are never recreated (creation is always above the highest, or generation 0 into an empty family, and the family is never emptied), so removing one cannot touch a live holder; the highest stays, so numbering never restarts. The session-pins housekeeping sweep, which removed old files by age, now skips lock generations entirely. Cost: one empty file per lock per retired session stays; carried as roadmap step 3.6 (a retirement step, or never-reused names).
- **Explorer.** The pruner is an actor taking one filesystem step per action (list, then one remove per step). From an empty, abandoned or released start, with three callers and one pruner, and with two callers and two concurrent pruners, no schedule (≤ 3 preemptions) shows a second holder; with a paused holder (≤ 2 preemptions) every overlap is a pair.
- **Round 9's schedule as a test.** Scripted step by step: with a judge-then-remove pruner, B and C both hold; with the shipped pruner, only B.
- The recheck from round 8 stays (it also absorbs a release that removes its own generation).
- **Budget.** The dispatch bundle fits its unchanged 1,595,100 B ceiling again (1,595,005 B), so its raise is dropped; the chunk ceiling is now 35,950 B (measured 35,870 B).

Round 10 split 1-1. One seat ratified. The other refused with a schedule, reproduced here as a scripted test: A lists an empty family, creates generation 0 and pauses before its check until 0 is stale; B supersedes 0 with 1; a keep-highest pruner removes 0; B's recheck finds 0 gone and B backs off — and backing off **removed** B's generation 1, the highest, so the family emptied, A's check passed on an empty listing, and C created 0 beside A. Fixed in `1e312ac56b`: a caller that backs off **releases** its generation (ages it to the epoch) instead of removing it. With that, nobody removes a family's highest generation — a superseder removes only generations below its own, a caller that backs off releases, a pruner keeps the highest — so a family never empties once created and its numbering never restarts. The scripted test runs the schedule both ways: with removal A and C hold; with release only C does (A's check sees the released 1 above its 0 and backs off; C supersedes the released 1). A released generation counts as released for strict callers too, so they take it over rather than wait on it. The explorer's results above hold at this commit.

## What to answer

1. Does the diff contain a defect — in the helper's protocol, in any site's use of it, in the pruners, or in the budget entry? Name file and line.
2. Does the change expand any agent's authority or weaken an existing gate? Is the ceiling raise sized to the measurement?
3. Within the scoped claim, can two callers hold any of these locks at once?

End with exactly one stance line, as the last line of your reply, in plain text: no markdown, no bold, all three fields on that one line, separated by " | ":

STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>

## Budget: measurement and entry

```
✅  hook bundle: 1595005 B / 1595100 B ceiling, 1 YAML reader(s) [yaml], 343 modules
✅  chunk src/scripts/_lib/session_pins.ts: 35870 B
6323 src/scripts/hooks/state_io.ts
total 34512
4748 src/scripts/hooks/state_io.ts
2821 src/scripts/_lib/generation_lock.ts
total 35870
```

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 5b405df712..3efb655039 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -270,0 +271,10 @@
+        },
+        {
+            "date": "2026-11-13",
+            "chunk": "src/scripts/_lib/session_pins.ts",
+            "from": 34900,
+            "to": 35950,
+            "by": "agent, feat/road-to-verified-stale-lock-reclaim (road-to-verified-stale-lock-reclaim 2.1)",
+            "what_was_added": "The generation lock (`_lib/generation_lock.ts`, 2,821 B in this chunk) behind `state_io`'s file lock, which the pin capture and restore run under. The stat-then-remove reclaim it replaces let two callers that judged one abandoned guard both acquire, and an unconditional release delete the guard of a peer that had superseded a paused holder; `tests/scripts/lock_sites_interleavings.test.ts` shows both schedules on origin/main and none after. Measured by this gate's own chunk build: 34,512 B on origin/main 24f323151a, 35,870 B with the change, +1,358 B (`state_io` itself fell from 6,323 to 4,748 B; `session_pins` itself grew 38 B, which keeps its housekeeping off lock generations).",
+            "why_it_could_not_be_avoided": "Room was made first: the step executor was rewritten to tuple steps and a single try, and the release generator dropped, taking the helper from 2,925 to 2,477 B before ratification round 1 added a listing failure that throws, canonical generation names, a floor on the spin and a strict mode that never supersedes a stale holder, round 2 a bound on the generation number, the completion review a strict refusal that does not wait, and ratification round 8 a recheck that the superseded generation is still the stale one (2,821 B), and the old reclaim and its sleep helper left `state_io`. What remains is the protocol itself, which every lock site now shares; a chunk cannot share it with the dispatch bundle, so the pin chunk carries its own copy. The dispatch bundle stays under its 1,595,100 ceiling with no raise.",
+            "what_would_have_caught_it": "Nothing missed it: the gate fired on the first local reading of the change. Sized to the measurement plus 80 B."
@@ -294 +304 @@
-            "max_bytes": 34900,
+            "max_bytes": 35950,
@@ -296 +306 @@
-            "derivation": "Measured 34,414 bytes on 2026-11-09 (an unpin that matches nothing named in the brief notice too, capture under a strict file lock that never replaces an unreadable file, eligibility computed in linear time from fence, paste and injected-region spans of the original text (attributed envelopes included, opener recognition with no attribute grammar, a lead that ends at the first line containing anything tag-like or at a host frame recognised mid-prompt, a forward-only paste-tag scanner, fences read by a prefix scan, directives that were not applied counted and reported, a directive line carrying a closing tag, an attributed opener or a bare opener closed on a later line refused, checked in linear time), lone surrogates normalised, caps, lossless per-session state that is never overwritten when it cannot be read whole, a reported restore failure, pins inert in a replay (no capture, restore, restatement or subagent read), the once-per-compaction delivery and restatement coordinated across prompt and tool order with one restore record per session changed only under the per-file lock, tried once and never waited for, each delivery adding the compaction's stamp to a set of acknowledged stamps in that lock (the most recent 512), a record that exists but cannot be read left untouched and acted on by nothing on either path, one admission rule for every compaction stamp so an oversized one is unknown and never recorded, pins read inside that transaction, the tool-call restore keyed on its own stamp and never re-delivering a delivered record, a once-a-day retention prune that keeps a live session's restore record by its pin file's activity and removes a gone session's boundary and lock files, the subagent reader, activity-based retention, restore text, and the parts of `_lib/prompt_shape` and `hooks/state_io` they import). The ceiling is that reading plus about 3 %, rounded, with no growth queued. Loaded by `language-mirror` through `hooks/session_pins_loader.ts` on a prompt carrying a `pin:` or `unpin:` line, on a prompt that owes a delivery or restatement, and on the one tool call after a compaction; a missing chunk is reported on the capture turn and on the tool-call restore, and costs the pin restore, never the language restore or the dispatch."
+            "derivation": "Measured 34,414 bytes on 2026-11-09 (an unpin that matches nothing named in the brief notice too, capture under a strict file lock that never replaces an unreadable file, eligibility computed in linear time from fence, paste and injected-region spans of the original text (attributed envelopes included, opener recognition with no attribute grammar, a lead that ends at the first line containing anything tag-like or at a host frame recognised mid-prompt, a forward-only paste-tag scanner, fences read by a prefix scan, directives that were not applied counted and reported, a directive line carrying a closing tag, an attributed opener or a bare opener closed on a later line refused, checked in linear time), lone surrogates normalised, caps, lossless per-session state that is never overwritten when it cannot be read whole, a reported restore failure, pins inert in a replay (no capture, restore, restatement or subagent read), the once-per-compaction delivery and restatement coordinated across prompt and tool order with one restore record per session changed only under the per-file lock, tried once and never waited for, each delivery adding the compaction's stamp to a set of acknowledged stamps in that lock (the most recent 512), a record that exists but cannot be read left untouched and acted on by nothing on either path, one admission rule for every compaction stamp so an oversized one is unknown and never recorded, pins read inside that transaction, the tool-call restore keyed on its own stamp and never re-delivering a delivered record, a once-a-day retention prune that keeps a live session's restore record by its pin file's activity and removes a gone session's boundary and lock files, the subagent reader, activity-based retention, restore text, and the parts of `_lib/prompt_shape` and `hooks/state_io` they import). The ceiling is that reading plus about 3 %, rounded, with no growth queued. Loaded by `language-mirror` through `hooks/session_pins_loader.ts` on a prompt carrying a `pin:` or `unpin:` line, on a prompt that owes a delivery or restatement, and on the one tool call after a compaction; a missing chunk is reported on the capture turn and on the tool-call restore, and costs the pin restore, never the language restore or the dispatch. Raised 2026-11-13 to 35,950: the generation lock behind state_io's file lock (measured 35,870 B against 34,512 B on origin/main 24f323151a), plus 80 B; the raise_log entry of that date carries the reasoning."
```

## Verification at `1e312ac56b`

```
 ✓ |node| tests/scripts/state_io_lock_interleavings.test.ts (5 tests) 132ms
 ✓ |node| tests/scripts/language_mirror_hook.test.ts (111 tests) 2336ms
 ✓ |node| tests/scripts/session_pins.test.ts (243 tests) 2598ms
 ✓ |node| tests/scripts/hooks/state_io.test.ts (50 tests) 22556ms
 ✓ |node| tests/scripts/lock_sites_interleavings.test.ts (28 tests) 23520ms
 ✓ |node| tests/hooks/session_pins_dispatch.test.ts (7 tests) 49341ms
 ✓ |node| tests/scripts/generation_lock_interleavings.test.ts (34 tests) 71533ms
      Tests  478 passed (478)
      Tests  784 passed (784)
```

## `src/scripts/_lib/generation_lock.ts` (complete)

```ts
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
export function* acquireSteps(lockPath: string, staleMs: number, dir = false, breakStale = true): Generator<Step, Held | null | false, StepResult> {
    const gens = (yield ['list', lockPath]) as number[];
    const top = gens[gens.length - 1];
    let g = 0;
    if (top !== undefined) {
        const age = (yield ['age', companion(lockPath, top)]) as number | null;
        // Gone between the listing and the stat: only a superseder removes a
        // generation, so a higher one exists and holds.
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
    // always still finds it stale. Gone or fresh means a pruner retired the
    // family and numbering restarted, so a caller that created that name since
    // could hold beside us.
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
export function acquire(lockPath: string, options: AcquireOptions & { breakStale?: true }): Held | null;
export function acquire(lockPath: string, options: AcquireOptions): Held | null | false;
export function acquire(lockPath: string, options: AcquireOptions): Held | null | false {
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

## The three pruners' lock handling

```ts
// src/scripts/hooks/state_io.ts, prune_stale_session_states
      // arrives afterwards creates both anew. A guard is a generation family
      // (`<lock>`, `<lock>.<g>`; `.lock` for the language-mirror tool lock,
      // `.lock.held` for the one here) that a release ages but never removes.
      // Every member but the highest goes. The highest stays, one empty file
      // per retired lock: removing it would restart the numbering under a
      // caller still holding an old listing, and judging it stale before
      // removing it is the stat-then-remove race this lock replaced.
      for (const lock of [`${full}.lock`, `${full}.lock.held`]) {
        try {
          for (const g of (execute(["list", lock]) as number[]).slice(0, -1)) execute(["remove", companion(lock, g)]);
        } catch {
          /* never a reason to fail a prune */
        }
      }
// src/scripts/_lib/egress_session_table.ts, pruneSessionTables
            // Its lock generations but the highest go with it; the highest stays,
            // or the numbering would restart under a caller still holding an old
            // listing (see the session-state pruner in hooks/state_io.ts).
            try {
                for (const g of (execute(['list', `${file}.lock`]) as number[]).slice(0, -1)) execute(['remove', companion(`${file}.lock`, g)]);
            } catch {
                // the listing failed: nothing is removed
            }
// src/scripts/_lib/session_pins.ts, pruneStalePins sweep
        // A lock generation (`.lock.held[.<g>]`, the state_io lock these files
        // are written under) is never removed by age: the pass above keeps each
        // lock's highest one on purpose (hooks/state_io.ts). A bare `.lock` is
        // the retired sentinel of the lock before it and goes like the rest.
        if (digest === undefined || name === `${digest}.json` || /\.lock\.held(\.\d+)?$/.test(name) || fs.existsSync(path.join(dir, `${digest}.json`))) continue;
```

## Rounds 9 and 10 as scripted tests, and the explorer's pruner (from `tests/scripts/generation_lock_interleavings.test.ts`)

```ts
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
```

## `state_io.ts` lock code (doc comments omitted; round 8's prompt shows them)

```ts
function _acquire_lock(
  lock_path: string,
  options: { blocking?: boolean; strict?: boolean } = {},
): Held | false | null {
  try {
    // A strict caller's `false` (a stale holder it never supersedes) is a
    // refusal like a live peer's `null`; `false` below means unguarded.
    return acquire(`${lock_path}.held`, {
      staleMs: LOCK_STALE_MS,
      breakStale: options.strict !== true,
      waitMs: options.blocking === false ? 0 : LOCK_ACQUIRE_DEADLINE_MS,
      spinMs: LOCK_SPIN_SLEEP_MS,
    }) || null;
  } catch {
    return options.strict === true ? null : false;
  }
}

function _publish_text_locked(target: string, text: string): void {
  const tmp = target + `.tmp.${process.pid}`;
  fs.writeFileSync(tmp, text, { encoding: "utf-8" });
  fs.renameSync(tmp, target);
}

function _atomic_write_text(target: string, text: string): void {
  const held = _acquire_lock(_lock_path(path.dirname(target)));
  if (held === null) {
    _publish_text_locked(target, text);
    return;
  }
  try {
    _publish_text_locked(target, text);
  } finally {
    if (held) release(held);
  }
}
390:      breakStale: options.strict !== true,
440:  const held = _acquire_lock(_lock_path(path.dirname(target)));
448:    if (held) release(held);
986:    held = _acquire_lock(_target_lock_path(targetPath), { blocking: options.blocking ?? true, strict: options.strict === true });
993:  if (!held) return "failed";
1010:    release(held);
1031:    held = _acquire_lock(_target_lock_path(targetPath), { blocking: options.blocking ?? true });
1041:  if (!held) return "failed";
1061:    release(held);
```

## The other seven sites (`git diff -U0 origin/main...1e312ac56b -- src`, helper, budget, `state_io` and `session_pins` excluded)

```diff
diff --git a/src/scripts/_lib/egress_session_table.ts b/src/scripts/_lib/egress_session_table.ts
index 055c34bfaf..6d25528ca1 100644
--- a/src/scripts/_lib/egress_session_table.ts
+++ b/src/scripts/_lib/egress_session_table.ts
@@ -20,0 +21 @@ import * as path from 'node:path';
+import { acquire, companion, execute, release } from './generation_lock.js';
@@ -157,4 +157,0 @@ function expired(table: SessionTable, now: number): boolean {
-function sleepMs(ms: number): void {
-    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
-}
-
@@ -176 +173 @@ export interface TableTarget {
-function updateTable<T>(t: TableTarget, fn: (table: SessionTable) => T): T {
+export function updateTable<T>(t: TableTarget, fn: (table: SessionTable) => T): T {
@@ -183,15 +180,5 @@ function updateTable<T>(t: TableTarget, fn: (table: SessionTable) => T): T {
-    const lock = `${file}.lock`;
-    let fd: number | null = null;
-    for (let i = 0; fd === null; i++) {
-        try {
-            fd = fs.openSync(lock, 'wx', 0o600);
-        } catch {
-            try {
-                if (Date.now() - fs.statSync(lock).mtimeMs > LOCK_STALE_MS) fs.rmSync(lock, { force: true });
-            } catch {
-                // released meanwhile
-            }
-            if (i >= 200) throw new Error('egress session table: lock not acquired');
-            sleepMs(5);
-        }
-    }
+    // The generation lock: an abandoned lock is superseded, never removed from
+    // under a peer. Its limit, unfenced here: a holder paused past
+    // LOCK_STALE_MS writes after a peer superseded it, and the later rename wins.
+    const held = acquire(`${file}.lock`, { staleMs: LOCK_STALE_MS, waitMs: 1000, spinMs: 5 });
+    if (held === null) throw new Error('egress session table: lock not acquired');
@@ -221,2 +208 @@ function updateTable<T>(t: TableTarget, fn: (table: SessionTable) => T): T {
-        fs.closeSync(fd);
-        fs.rmSync(lock, { force: true });
+        release(held);
@@ -505,0 +492,8 @@ export function pruneSessionTables(dir: string, now: number = Date.now()): numbe
+            // Its lock generations but the highest go with it; the highest stays,
+            // or the numbering would restart under a caller still holding an old
+            // listing (see the session-state pruner in hooks/state_io.ts).
+            try {
+                for (const g of (execute(['list', `${file}.lock`]) as number[]).slice(0, -1)) execute(['remove', companion(`${file}.lock`, g)]);
+            } catch {
+                // the listing failed: nothing is removed
+            }
diff --git a/src/scripts/_lib/project_registry.ts b/src/scripts/_lib/project_registry.ts
index c512da7b8b..b931a7e2fa 100644
--- a/src/scripts/_lib/project_registry.ts
+++ b/src/scripts/_lib/project_registry.ts
@@ -20,0 +21 @@ import { canonicalOrigin, projectsDir, remoteUrl, repoIdentity } from '../code_g
+import { acquire, release } from './generation_lock.js';
@@ -118,5 +119,9 @@ const LOCK_STALE_MS = 30_000;
-function sleep(ms: number): void {
-    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
-}
-
-/** Read, change and write under the registry lock; the change sees the latest file. */
+/**
+ * Read, change and write under the registry lock; the change sees the latest file.
+ *
+ * The lock is a directory generation lock (`generation_lock.ts`): an abandoned
+ * `registry.lock` is superseded by `registry.lock.<g>`, never removed from under
+ * a peer, and the release ages its generation instead of removing it. Its limit,
+ * unfenced here: a holder paused past `LOCK_STALE_MS` writes after a peer
+ * superseded it, and the later write wins.
+ */
@@ -126,16 +131,2 @@ export function updateRegistry<T>(fn: (reg: Registry) => T, opts: RegistryOption
-    const deadline = Date.now() + LOCK_WAIT_MS;
-    for (;;) {
-        try {
-            fs.mkdirSync(lock);
-            break;
-        } catch (e) {
-            if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
-            try {
-                if (Date.now() - fs.statSync(lock).mtimeMs > LOCK_STALE_MS) fs.rmSync(lock, { recursive: true, force: true });
-            } catch {
-                /* released meanwhile */
-            }
-            if (Date.now() > deadline) throw new Error(`project registry is locked: ${lock}`);
-            sleep(25);
-        }
-    }
+    const held = acquire(lock, { staleMs: LOCK_STALE_MS, dir: true, waitMs: LOCK_WAIT_MS, spinMs: 25 });
+    if (held === null) throw new Error(`project registry is locked: ${lock}`);
@@ -148 +139 @@ export function updateRegistry<T>(fn: (reg: Registry) => T, opts: RegistryOption
-        fs.rmSync(lock, { recursive: true, force: true });
+        release(held);
diff --git a/src/scripts/advisories.ts b/src/scripts/advisories.ts
index 80a61e87a1..dd929a7192 100644
--- a/src/scripts/advisories.ts
+++ b/src/scripts/advisories.ts
@@ -66,0 +67 @@ import {
+import { release, tryAcquire, type Held } from './_lib/generation_lock.js';
@@ -161 +162,5 @@ export async function refreshMany(allRoots: string[], deps: RefreshDeps = {}): P
-    const lock = path.join(mdir, 'refresh.lock');
+    // A generation lock (`_lib/generation_lock.ts`): a refresh abandoned for ten
+    // minutes is superseded, never removed from under the run that took over.
+    // Its limit, unfenced here: a run paused past ten minutes keeps writing
+    // after a peer superseded it, and the later write wins.
+    let held: Held | null;
@@ -163 +168 @@ export async function refreshMany(allRoots: string[], deps: RefreshDeps = {}): P
-        fs.writeFileSync(lock, `${process.pid} ${now.toISOString()}\n`, { flag: 'wx' });
+        held = tryAcquire(path.join(mdir, 'refresh.lock'), { staleMs: 10 * 60000, now: () => now.getTime() });
@@ -165,32 +170,5 @@ export async function refreshMany(allRoots: string[], deps: RefreshDeps = {}): P
-        let stale = true;
-        try {
-            stale = now.getTime() - fs.statSync(lock).mtimeMs > 10 * 60000;
-        } catch {
-            /* vanished between the two calls: treat as stale */
-        }
-        let took = false;
-        if (stale) {
-            // Remove the stale lock, then take it with the same exclusive create:
-            // of two processes that both saw it stale, only one wins.
-            // Move aside only the lock that was judged stale: one another process
-            // took over in between carries a new stamp and is put back.
-            try {
-                const judged = fs.readFileSync(lock, 'utf-8');
-                const aside = `${lock}.${process.pid}.stale`;
-                fs.renameSync(lock, aside);
-                if (fs.readFileSync(aside, 'utf-8') === judged) fs.unlinkSync(aside);
-                else fs.renameSync(aside, lock);
-            } catch {
-                /* the other process removed it first */
-            }
-            try {
-                fs.writeFileSync(lock, `${process.pid} ${now.toISOString()}\n`, { flag: 'wx' });
-                took = true;
-            } catch {
-                took = false;
-            }
-        }
-        if (!took) {
-            for (const p of todo) if (p.prev !== null) results.push({ state: p.prev, fetched: false, reason: 'refresh-in-progress' });
-            return results;
-        }
+        held = null;
+    }
+    if (held === null) {
+        for (const p of todo) if (p.prev !== null) results.push({ state: p.prev, fetched: false, reason: 'refresh-in-progress' });
+        return results;
@@ -306,5 +284 @@ export async function refreshMany(allRoots: string[], deps: RefreshDeps = {}): P
-        try {
-            fs.unlinkSync(lock);
-        } catch {
-            /* already gone */
-        }
+        release(held);
diff --git a/src/scripts/ai_council/budget_guard.ts b/src/scripts/ai_council/budget_guard.ts
index 08c286b589..33061ee747 100644
--- a/src/scripts/ai_council/budget_guard.ts
+++ b/src/scripts/ai_council/budget_guard.ts
@@ -48,0 +49 @@ import * as path from 'node:path';
+import { acquire, release } from '../_lib/generation_lock.js';
@@ -633,4 +633,0 @@ const RESERVATION_LOCK_STALE_MS = 10_000;
-function _sleepMs(ms: number): void {
-    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
-}
-
@@ -638,4 +635,9 @@ function _sleepMs(ms: number): void {
- * Run `fn` holding `<ledger>.lock`, created `O_EXCL`. Unlike the counter lock
- * in `cli_call_budget.ts`, a wait that runs out returns `null` instead of
- * proceeding unlocked: a ceiling checked without the lock is the race this
- * exists to close, so the caller refuses rather than guesses.
+ * Run `fn` holding `<ledger>.lock`, a generation lock (`_lib/generation_lock.ts`):
+ * an abandoned lock is superseded, never removed from under a peer. Unlike the
+ * counter lock in `cli_call_budget.ts`, a wait that runs out returns `null`
+ * instead of proceeding unlocked: a ceiling checked without the lock is the race
+ * this exists to close, so the caller refuses rather than guesses.
+ *
+ * Limit, unfenced here: a holder paused past `RESERVATION_LOCK_STALE_MS` can
+ * append after a peer superseded it, so two reservations may both pass one
+ * ceiling check. Every critical section is a read and an append.
@@ -643 +645 @@ function _sleepMs(ms: number): void {
-function _withLedgerLock<T>(p: string, waitMs: number, fn: () => T): T | null {
+export function _withLedgerLock<T>(p: string, waitMs: number, fn: () => T): T | null {
@@ -647,20 +649,3 @@ function _withLedgerLock<T>(p: string, waitMs: number, fn: () => T): T | null {
-    const lockPath = `${p}.lock`;
-    const started = Date.now();
-    let fd: number | null = null;
-    while (fd === null) {
-        try {
-            fd = fs.openSync(lockPath, 'wx', 0o600);
-            break;
-        } catch {
-            try {
-                if (Date.now() - fs.statSync(lockPath).mtimeMs > RESERVATION_LOCK_STALE_MS) {
-                    fs.unlinkSync(lockPath);
-                }
-            } catch {
-                // Released between the failed create and the stat — retry.
-            }
-        }
-        if (Date.now() - started >= waitMs) {
-            return null;
-        }
-        _sleepMs(15);
+    const held = acquire(`${p}.lock`, { staleMs: RESERVATION_LOCK_STALE_MS, waitMs, spinMs: 15 });
+    if (held === null) {
+        return null;
@@ -671,6 +656 @@ function _withLedgerLock<T>(p: string, waitMs: number, fn: () => T): T | null {
-        fs.closeSync(fd);
-        try {
-            fs.unlinkSync(lockPath);
-        } catch {
-            // Already gone is the end state wanted.
-        }
+        release(held);
diff --git a/src/scripts/ai_council/cli_call_budget.ts b/src/scripts/ai_council/cli_call_budget.ts
index 655d464460..044110965d 100644
--- a/src/scripts/ai_council/cli_call_budget.ts
+++ b/src/scripts/ai_council/cli_call_budget.ts
@@ -19,0 +20,2 @@ import * as path from 'node:path';
+import { acquire, release, type Held } from '../_lib/generation_lock.js';
+
@@ -143,0 +146,3 @@ export function writeStateAtomically(target: string, payload: string): void {
+ *   The lock is a generation lock (`_lib/generation_lock.ts`), so a break never
+ *   removes a lock a peer holds; a holder past the one-second threshold is
+ *   superseded and keeps writing beside its successor, unfenced.
@@ -151,20 +156,6 @@ export function withStateLock<T>(target: string, fn: () => T): T {
-    const waitMs = 1000;
-    let held = false;
-    const started = _monotonicish();
-    while (_monotonicish() - started < waitMs) {
-        try {
-            fs.mkdirSync(path.dirname(lockPath), { recursive: true });
-            fs.closeSync(fs.openSync(lockPath, 'wx'));
-            held = true;
-            break;
-        } catch {
-            try {
-                if (_monotonicish() - fs.statSync(lockPath).mtimeMs > waitMs) {
-                    fs.unlinkSync(lockPath);
-                    continue;
-                }
-            } catch {
-                // Vanished between the failed create and the stat — retry.
-            }
-            _spin(20);
-        }
+    let held: Held | null = null;
+    try {
+        fs.mkdirSync(path.dirname(lockPath), { recursive: true });
+        held = acquire(lockPath, { staleMs: 1000, waitMs: 1000, spinMs: 20 });
+    } catch {
+        // No lock can be created here: proceed unlocked, as on a timeout.
@@ -175,7 +166 @@ export function withStateLock<T>(target: string, fn: () => T): T {
-        if (held) {
-            try {
-                fs.unlinkSync(lockPath);
-            } catch {
-                // A removed lock is the desired end state either way.
-            }
-        }
+        if (held !== null) release(held);
@@ -339 +324 @@ function _isObject(x: unknown): x is Record<string, unknown> {
-/** Monotonic-ish millisecond clock for lock ages and temp-file names. */
+/** Monotonic-ish millisecond clock for temp-file names. */
@@ -344,11 +328,0 @@ function _monotonicish(): number {
-/**
- * Synchronous back-off. Necessary rather than chosen: the whole booking path is
- * synchronous, so making it async to await a sub-second contention window would
- * change every caller.
- */
-function _spin(ms: number): void {
-    const until = _monotonicish() + ms;
-    while (_monotonicish() < until) {
-        // deliberate busy-wait
-    }
-}
diff --git a/src/scripts/language_mirror_hook.ts b/src/scripts/language_mirror_hook.ts
index 6ccce827ac..1d053f8fd8 100644
--- a/src/scripts/language_mirror_hook.ts
+++ b/src/scripts/language_mirror_hook.ts
@@ -99,0 +100 @@ import type { SessionPins } from "./_lib/session_pins.js";
+import { release, tryAcquire, type Held } from "./_lib/generation_lock.js";
@@ -854,2 +855,2 @@ export function _pruneStaleSessions(
- * that died holding it. Deliberately NOT retried after a break: a retry loop
- * re-opens exactly the window the lock exists to close.
+ * that died holding it. One attempt, never a wait: a busy lock returns the
+ * caller's silent value.
@@ -889,0 +891,6 @@ export const LOCK_STALE_MS = 30_000;
+ *
+ * The lock is the generation lock (`_lib/generation_lock.ts`): breaking an
+ * abandoned lock never removes a path a peer may hold. Its limit applies here
+ * unfenced: a holder paused past `LOCK_STALE_MS` writes after a peer superseded
+ * it, which the re-read of the pin inside `_writeDistance` narrows but does not
+ * close.
@@ -891 +898 @@ export const LOCK_STALE_MS = 30_000;
-function _withToolWriteLock<T>(
+export function _withToolWriteLock<T>(
@@ -899,23 +906,7 @@ function _withToolWriteLock<T>(
-  let fd: number;
-  const acquire = (): number | null => {
-    try {
-      fs.mkdirSync(path.dirname(lock), { recursive: true });
-      return fs.openSync(lock, "wx");
-    } catch (err) {
-      if ((err as NodeJS.ErrnoException).code !== "EEXIST") return null;
-      let age: number;
-      try {
-        age = now_ms - fs.statSync(lock).mtimeMs;
-      } catch {
-        return null; // vanished under us — a peer is actively working
-      }
-      if (age < LOCK_STALE_MS) return null;
-      try {
-        fs.rmSync(lock, { force: true });
-        return fs.openSync(lock, "wx");
-      } catch {
-        return null; // a peer broke it first and now holds it
-      }
-    }
-  };
-  const held = acquire();
+  let held: Held | null;
+  try {
+    fs.mkdirSync(path.dirname(lock), { recursive: true });
+    held = tryAcquire(lock, { staleMs: LOCK_STALE_MS, now: () => now_ms });
+  } catch {
+    return when_busy;
+  }
@@ -923 +913,0 @@ function _withToolWriteLock<T>(
-  fd = held;
@@ -927,10 +917 @@ function _withToolWriteLock<T>(
-    try {
-      fs.closeSync(fd);
-    } catch {
-      /* already closed */
-    }
-    try {
-      fs.rmSync(lock, { force: true });
-    } catch {
-      /* a peer broke a stale lock and owns the path now */
-    }
+    release(held);
diff --git a/src/scripts/worktree_cleanup_check.ts b/src/scripts/worktree_cleanup_check.ts
index 30e058f817..1fe66ded0d 100644
--- a/src/scripts/worktree_cleanup_check.ts
+++ b/src/scripts/worktree_cleanup_check.ts
@@ -45,0 +46 @@ import { load_agent_settings, settings_layer_states, user_global_settings_paths
+import { release, tryAcquire, type Held } from './_lib/generation_lock.js';
@@ -885,0 +887,6 @@ const LOCK_STALE_MS = 10 * 60 * 1000;
+ *
+ * A generation lock (`_lib/generation_lock.ts`): a stale lock is superseded,
+ * never renamed aside or removed while another pass may have taken it over, and
+ * the release ages this pass's own generation only. Its limit, unfenced here: a
+ * pass that outlived the stale window keeps removing beside its successor, and
+ * `git worktree remove` re-checks each tree itself.
@@ -890,30 +897,5 @@ function takeRemovalLock(mainPath: string, now: Date): (() => void) | null {
-    const file = path.join(dir, REMOVAL_LOCK);
-    // The token names THIS holder: release deletes the lock only while it is
-    // still ours, so a pass that outlived the stale window cannot delete the
-    // lock a later pass took over.
-    const token = `${process.pid} ${now.toISOString()} ${Math.random().toString(36).slice(2)}`;
-    const tryCreate = (): boolean => {
-        try {
-            fs.writeFileSync(file, `${token}\n`, { flag: 'wx' });
-            return true;
-        } catch {
-            return false;
-        }
-    };
-    if (!tryCreate()) {
-        try {
-            if (now.getTime() - fs.statSync(file).mtimeMs < LOCK_STALE_MS) return null;
-            // Unlink only the stale lock that was judged: a pass that took it over
-            // in between wrote a new token, and that lock is not ours to delete.
-            const judged = fs.readFileSync(file, 'utf-8');
-            const aside = `${file}.${process.pid}.stale`;
-            fs.renameSync(file, aside);
-            if (fs.readFileSync(aside, 'utf-8') !== judged) {
-                fs.renameSync(aside, file);
-                return null;
-            }
-            fs.unlinkSync(aside);
-        } catch {
-            return null;
-        }
-        if (!tryCreate()) return null;
+    let held: Held | null;
+    try {
+        held = tryAcquire(path.join(dir, REMOVAL_LOCK), { staleMs: LOCK_STALE_MS, now: () => now.getTime() });
+    } catch {
+        return null;
@@ -921,7 +903,3 @@ function takeRemovalLock(mainPath: string, now: Date): (() => void) | null {
-    return () => {
-        try {
-            if (fs.readFileSync(file, 'utf-8').trim() === token) fs.unlinkSync(file);
-        } catch {
-            /* already gone — a stale-lock sweep by another pass */
-        }
-    };
+    if (held === null) return null;
+    const own = held;
+    return () => release(own);
@@ -964,2 +942,2 @@ export function applyRemovals(
-    const release = takeRemovalLock(mainPath, now);
-    if (release === null) return [];
+    const unlock = takeRemovalLock(mainPath, now);
+    if (unlock === null) return [];
@@ -1043 +1021 @@ export function applyRemovals(
-        release();
+        unlock();
```
