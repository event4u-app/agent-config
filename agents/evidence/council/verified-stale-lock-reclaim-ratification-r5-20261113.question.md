<!-- evidence-type: analysis -->

# Ratification review — the generation lock at eight file-lock sites — round 5

You are an independent reviewer for a change in the `event4u/agent-config` repository. Two files in it are on the ratification gate's list as hook-plumbing sources: `src/scripts/_lib/generation_lock.ts` (part of the hook dispatch bundle) and `src/config/hook-bundle-budget.json` (a raised byte ceiling). ADR-268 § 4 needs a two-provider verdict: an agent may change these files but may not ratify its own change. This prompt is self-contained: everything it asks about is shown below.

subject: bf212c32c07152c7e9e6c37cc0ded93c4490150af7ea9cf13847e878a55fbf61

(The digest covers the gated files at commit `12f5aab551` on branch `feat/road-to-verified-stale-lock-reclaim`, computed with `./scripts-run src/scripts/ratification_subject` over the whole changed-file list.)

## The change

Eight cross-process file locks move from stat-then-remove or rename-aside stale breaking to a shared generation lock: breaking a stale highest generation `g` creates `g+1` exclusively, only the winner removes lower generations by name, a release ages its own generation to the epoch and removes nothing, and after each create the caller backs off if a higher generation exists.

**The claim, scoped.** Among callers that all run this protocol, no stale-lock break or release lets two callers hold a lock at once, except that a non-strict holder paused past the stale threshold keeps running beside its superseder (no fencing; named at every site). Not claimed: exclusion against a process still on the old code (an older process sees a generation-0 holder, but can create generation 0 beside a higher one), and exclusion for writers that publish without a lock by design — `state_io`'s `_atomic_write_text` (whole-file rename, documented, unchanged in policy; shown below) and the CLI call budget after its 1 s wait (documented, unchanged).

## History

Round 1 refused 2/2: listing failures read as absence; strict callers lost never-break; `spinMs: 0` looped; non-canonical names; an overstated mixed-version comment — all fixed with tests. Round 2 refused 2/2 on unbounded generation allocation past what the listing reads — fixed (`MAX_GENERATION`), with a test. Round 3 refused 2/2 on claims: the blind write (pre-existing), "every site" coverage, and strict tests that would pass a lock admitting nobody — the claims are scoped above and a sequential-entry test added for every site configuration. Round 4 refused 2/2 because the budget entry and the integration were referenced instead of shown, and on two comments: the helper header said "every site" (now "five of the modules … exclusion holds among callers of this protocol only"), and the blind-write note did not name the unguarded `false` case (now it does). Since round 4 only comments changed (`12f5aab551`).

## What to answer

1. Does the diff contain a defect — in the helper's protocol, in any site's use of it, or in the budget entry? Name file and line.
2. Does the change expand any agent's authority or weaken an existing gate? Is the ceiling raise sized to the measurement?
3. Within the scoped claim, can two callers hold any of these locks at once?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## Budget: measurement and entry

Measured by the gate itself, `./scripts-run src/scripts/check_hook_bundle_composition`, at `12f5aab551`:

```
✅  hook bundle: 1595031 B / 1595100 B ceiling, 1 YAML reader(s) [yaml], 343 modules
✅  chunk src/scripts/_lib/session_pins.ts: 35908 B
```

Per module in the session-pins chunk (esbuild metafile `bytesInOutput`, the chunk's own build options), origin/main `24f323151a` then this branch:

```
6323 src/scripts/hooks/state_io.ts
total 34512
4954 src/scripts/hooks/state_io.ts
2691 src/scripts/_lib/generation_lock.ts
total 35908
```

The dispatch bundle on origin/main read 1,595,013 B against the same unchanged 1,595,100 B ceiling.

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 5b405df712..bb2226f570 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -270,0 +271,10 @@
+        },
+        {
+            "date": "2026-11-13",
+            "chunk": "src/scripts/_lib/session_pins.ts",
+            "from": 34900,
+            "to": 36000,
+            "by": "agent, feat/road-to-verified-stale-lock-reclaim (road-to-verified-stale-lock-reclaim 2.1)",
+            "what_was_added": "The generation lock (`_lib/generation_lock.ts`, 2,691 B in this chunk) behind `state_io`'s file lock, which the pin capture and restore run under. The stat-then-remove reclaim it replaces let two callers that judged one abandoned guard both acquire, and an unconditional release delete the guard of a peer that had superseded a paused holder; `tests/scripts/lock_sites_interleavings.test.ts` shows both schedules on origin/main and none after. Measured by this gate's own chunk build: 34,512 B on origin/main 24f323151a, 35,908 B with the change, +1,396 B (`state_io` itself fell from 6,323 to 4,954 B).",
+            "why_it_could_not_be_avoided": "Room was made first: the step executor was rewritten to tuple steps and a single try, and the release generator dropped, taking the helper from 2,925 to 2,477 B before ratification round 1 added a listing failure that throws, canonical generation names, a floor on the spin and a strict mode that never supersedes a stale holder, and round 2 a bound on the generation number (2,691 B), and the old reclaim and its sleep helper left `state_io`. What remains is the protocol itself, which every lock site now shares; a chunk cannot share it with the dispatch bundle, so the pin chunk carries its own copy. The dispatch bundle stays under its 1,595,100 ceiling with no raise.",
+            "what_would_have_caught_it": "Nothing missed it: the gate fired on the first local reading of the change. Sized to the measurement plus 92 B."
@@ -294 +304 @@
-            "max_bytes": 34900,
+            "max_bytes": 36000,
```

## Verification at `12f5aab551`

```
 ✓ |node| tests/scripts/state_io_lock_interleavings.test.ts (5 tests) 216ms
 ✓ |node| tests/scripts/session_pins.test.ts (242 tests) 2850ms
 ✓ |node| tests/scripts/language_mirror_hook.test.ts (111 tests) 2978ms
 ✓ |node| tests/scripts/generation_lock_interleavings.test.ts (19 tests) 13439ms
 ✓ |node| tests/scripts/lock_sites_interleavings.test.ts (24 tests) 18942ms
 ✓ |node| tests/scripts/hooks/state_io.test.ts (47 tests) 32473ms
 ✓ |node| tests/hooks/session_pins_dispatch.test.ts (7 tests) 36208ms
      Tests  455 passed (455)
      Tests  664 passed (664)
```

(The second count is every suite importing the egress table, the council ledger, the project registry or the CLI call budget, plus the advisories and worktree-cleanup suites.)

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

## `src/scripts/hooks/state_io.ts`: the lock, its release, and the three writers' lock lines

```ts
/**
 * Take the cross-process lock for `lock_path`, or report that it is held.
 *
 * The protocol is the generation lock (`_lib/generation_lock.ts`): a stale
 * guard is superseded by creating the next generation with `O_EXCL`, never by
 * removing the path a peer may hold, and a release ages its own generation
 * instead of removing it. The stat-then-remove reclaim it replaces let two
 * callers that judged one abandoned guard both acquire, and an unconditional
 * release delete the guard of the peer that had superseded a paused holder
 * (`tests/scripts/lock_sites_interleavings.test.ts`).
 *
 * The companion's AGE decides reclamation, never how long this caller waited:
 * reclamation needs `LOCK_STALE_MS` of inactivity, which only an abandoned lock
 * reaches. A blocking caller that reaches its deadline reports failure; a
 * non-blocking one (`post_tool_use`, which must never wait) makes one attempt,
 * and still supersedes an abandoned guard on it.
 *
 * A `strict` caller (session pins) never supersedes a guard that went stale
 * while held, only one its holder released: a superseded holder that resumes
 * would write past its successor, and for a pin that is a silently dropped
 * constraint. A dead holder therefore blocks that session's pins, each attempt
 * reported, until the retention prune. `strict` also refuses to proceed
 * without a guard when none can be created or the lock cannot be listed.
 *
 * Limit, named here because the lock cannot close it: a holder paused past
 * `LOCK_STALE_MS` keeps writing after a peer has superseded it. No caller here
 * fences its publish with the held generation; every critical section is a
 * read, a mutate and a rename, measured in milliseconds against 30 seconds.
 *
 * Returns the held generation, `null` when a live peer holds it (or a strict
 * caller could not create a guard), or `false` when a non-strict caller
 * proceeds unguarded because no guard can be created or listed (a read-only
 * mount, a vanished parent, a directory it cannot read): the failure mode there is a lost guard, and the
 * alternative is a lost write. The callers below take deliberately different
 * actions on `null`, for reasons stated at each.
 */
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
function _publish_text_locked(target: string, text: string): void {
  const tmp = target + `.tmp.${process.pid}`;
  fs.writeFileSync(tmp, text, { encoding: "utf-8" });
  fs.renameSync(tmp, target);
}

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
 * The same holds when no guard can be created or listed at all (`false`):
 * the write lands unguarded, as it did before for an uncreatable guard.
 *
 * This also preserves the pre-existing behaviour exactly. The old code reached
 * the same outcome by DELETING the peer's companion and proceeding, which wrote
 * the file and destroyed the peer's exclusion. This writes the file and leaves
 * the peer's lock intact.
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
387:      breakStale: options.strict !== true,
441:  const held = _acquire_lock(_lock_path(path.dirname(target)));
449:    _release_lock(held);
984:    held = _acquire_lock(_target_lock_path(targetPath), { blocking: options.blocking ?? true, strict: options.strict === true });
990:  if (held === null) return "failed";
1007:    _release_lock(held);
1028:    held = _acquire_lock(_target_lock_path(targetPath), { blocking: options.blocking ?? true });
1037:  if (held === null) return "failed";
1057:    _release_lock(held);
```

## The other seven sites (`git diff -U0 origin/main...12f5aab551 -- src`, helper, budget and `state_io` excluded)

```diff
diff --git a/src/scripts/_lib/egress_session_table.ts b/src/scripts/_lib/egress_session_table.ts
index 055c34bfaf..3f2f28dd04 100644
--- a/src/scripts/_lib/egress_session_table.ts
+++ b/src/scripts/_lib/egress_session_table.ts
@@ -20,0 +21 @@ import * as path from 'node:path';
+import { acquire, release } from './generation_lock.js';
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

## The site test (`tests/scripts/lock_sites_interleavings.test.ts`, complete)

The harness it uses (`tests/scripts/_lock_interleaving_harness.ts`) is not shown for size; it makes every `fs` call on a guard path an injection point, runs B whole at each point of A and C whole at each point of B, and adds a schedule where A's pending remove/utimes/rename lands inside B's critical section. It is not an exhaustive interleaving search; the helper's step explorer (all schedules of three callers with ≤ 3 preemptions) is.

```ts
// Every file lock that breaks a stale guard, run through the same three-caller
// interleaving harness (road-to-verified-stale-lock-reclaim, Phase 2).
//
// Two starts per site: an abandoned guard that two callers may both judge
// stale, and a holder that pauses past the stale threshold before it releases.
// A finding is a schedule in which two callers are inside the critical section
// at once. The paused-holder start allows exactly one overlap shape and no
// other: the paused holder itself beside the caller that superseded it, which is
// the lease-without-fencing limit every site names. Its release must never let a
// THIRD caller in beside the superseder.
//
// `state_io` runs non-blocking only: its blocking acquire is the same attempt
// repeated for up to 2,500 spins, which this nested harness pays per schedule.
// A repeat is one more caller of the protocol the explorer in
// `generation_lock_interleavings.test.ts` already covers, and the wait itself is
// tested there. The blocking variant was run red against the stat-then-remove
// code before the switch.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { _withLedgerLock } from '../../src/scripts/ai_council/budget_guard.js';
import { updateTable, sessionTablePath } from '../../src/scripts/_lib/egress_session_table.js';
import { updateRegistry } from '../../src/scripts/_lib/project_registry.js';
import { update_text_under_lock } from '../../src/scripts/hooks/state_io.js';
import { _withToolWriteLock, statePathFor } from '../../src/scripts/language_mirror_hook.js';

import { installHarness, type Harness, type LockSite } from './_lock_interleaving_harness.js';

let tmp = '';
let harness: Harness | null = null;

beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lock-sites-')));
});

afterEach(() => {
    harness?.uninstall();
    harness = null;
    fs.rmSync(tmp, { recursive: true, force: true });
});

const SITES: Record<string, () => LockSite> = {
    'state_io update_text_under_lock (non-blocking)': () => {
        const target = path.join(tmp, 'state.json');
        return {
            guardPrefix: `${target}.lock`,
            call: (body) => void update_text_under_lock(target, () => (body(), null), { blocking: false }),
        };
    },
    'state_io update_text_under_lock (strict)': () => {
        const target = path.join(tmp, 'state.json');
        return {
            guardPrefix: `${target}.lock`,
            call: (body) => void update_text_under_lock(target, () => (body(), null), { blocking: false, strict: true }),
        };
    },
    'language_mirror_hook _withToolWriteLock': () => ({
        guardPrefix: `${path.join(tmp, statePathFor('s1'))}.lock`,
        call: (body) => void _withToolWriteLock(tmp, 's1', null, () => (body(), null)),
    }),
    'egress_session_table updateTable': () => {
        const dir = path.join(tmp, 'table');
        return {
            guardPrefix: `${sessionTablePath(dir, 's1')}.lock`,
            call: (body) => void updateTable({ dir, sessionId: 's1', workspaceRoot: path.join(tmp, 'ws') }, () => body()),
        };
    },
    'budget_guard _withLedgerLock': () => {
        const ledger = path.join(tmp, 'council', 'spend.jsonl');
        return {
            guardPrefix: `${ledger}.lock`,
            call: (body) => void _withLedgerLock(ledger, 3000, () => body()),
        };
    },
    'project_registry updateRegistry': () => {
        const dir = path.join(tmp, 'projects');
        return {
            guardPrefix: path.join(dir, 'registry.lock'),
            call: (body) => void updateRegistry(() => body(), { dir }),
        };
    },
};

describe.each(Object.keys(SITES))('%s', (name) => {
    const site = (): Harness => (harness = installHarness((SITES[name] as () => LockSite)()));

    // Every refusal below would also pass a lock that never lets anyone in.
    it('a lone caller enters, and so does the next one after its release', () => {
        const s = (SITES[name] as () => LockSite)();
        let entered = 0;
        s.call(() => void (entered += 1));
        s.call(() => void (entered += 1));
        expect(entered).toBe(2);
    });

    it('the harness reaches the lock: a lone caller passes several injection points', () => {
        expect(site().pointsOfSoloRun('abandoned')).toBeGreaterThan(2);
    });

    // Each completed critical section of a site is a real write (the registry's
    // is fsynced), across a few hundred schedules.
    it('no schedule over an abandoned guard admits two holders', () => {
        expect(site().explore('abandoned')).toEqual([]);
    }, 120_000);

    it('a paused holder overlaps at most its superseder, never a third caller', () => {
        const hits = site().explore('paused-holder');
        expect(hits.filter((h) => !/→ A\+[BC]$/.test(h))).toEqual([]);
    }, 120_000);
});
```
