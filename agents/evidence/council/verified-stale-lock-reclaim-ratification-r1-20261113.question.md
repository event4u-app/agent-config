<!-- evidence-type: analysis -->

# Ratification review — the generation lock at eight file-lock sites — round 1

You are an independent reviewer for a change in the `event4u/agent-config` repository. Two files in it are on the ratification gate's list as hook-plumbing sources: `src/scripts/_lib/generation_lock.ts` (now part of the hook dispatch bundle) and `src/config/hook-bundle-budget.json` (a raised byte ceiling). ADR-268 § 4 needs a two-provider verdict: an agent may change these files but may not ratify its own change.

subject: 1a9023d15252fbcff2ed907e2ea7ea4d1729478574b651766ca22b26410f585a

(The digest covers the gated files at commit `091ce7cacd` on branch `feat/road-to-verified-stale-lock-reclaim`, computed with `./scripts-run src/scripts/ratification_subject` over the whole changed-file list.)

## Background

Several cross-process file locks in `src/scripts` broke a stale lock by stat-then-remove (read the guard's mtime, then remove the path) or by renaming the guard aside and back. Two callers that judge one abandoned guard can then both acquire, and an unconditional release can delete the guard of a peer that superseded a paused holder. An earlier council round (55) rejected a rename-aside repair. A prior step of this roadmap chose a filesystem "generation lock" (`_lib/generation_lock.ts`): breaking a stale highest generation `g` creates `g+1` with `O_EXCL`, only the winner removes lower generations by name, a release ages its own generation to the epoch instead of removing anything, and after each create the caller backs off if a higher generation exists. Its documented residual: a holder paused past the stale threshold keeps running beside the caller that superseded it (no fencing).

## What the change does

1. **Helper (`_lib/generation_lock.ts`).** Generation 0 is now the bare guard path each caller passes (the name its old lock used), later generations are `<path>.<g>`. New `acquire()` retries `tryAcquire` until a deadline counted in accumulated sleep (bounding attempts). A `dir` option makes each generation a `mkdir`. Removal of lower generations is best-effort. Steps became tuples to save bytes; the release is one `expire` step.
2. **Sites moved to it:** `hooks/state_io.ts` (all three writers; non-strict callers still proceed unguarded when no guard can be created at all; strict callers now break an abandoned guard too, where before they refused), `language_mirror_hook.ts` tool-write lock (one attempt), `_lib/egress_session_table.ts` (1 s wait), `ai_council/budget_guard.ts` ledger lock (3 s wait, refuses on timeout), `_lib/project_registry.ts` (directory generations), `advisories.ts` refresh lock and `worktree_cleanup_check.ts` removal lock (both were rename-aside), `ai_council/cli_call_budget.ts` (its break compared `performance.now()` with an epoch mtime and never fired; it still proceeds unlocked after its 1 s wait, as documented before). Each site's comment names the unfenced residual.
3. **Budget.** The `session_pins` conditional chunk ceiling rises 34,900 → 35,800 B (measured 34,512 → 35,687 B: helper +2,477, `state_io` −1,376). The dispatch bundle reads 1,594,842 B against its unchanged 1,595,100 ceiling.
4. **Tests.** A three-caller interleaving harness (`tests/scripts/_lock_interleaving_harness.ts`) makes every `fs` call on a lock's guard an injection point and runs caller B at each point of A and caller C at each point of B, plus a schedule where A's pending remove/utimes/rename lands inside B's critical section; starts are an abandoned guard and a holder that ages its own guard before releasing. `tests/scripts/lock_sites_interleavings.test.ts` runs it on six configurations of five sites: on `origin/main` 12 cases failed (e.g. `A@8 break-lands-in-B → B+C`), all pass on the branch. The helper's exhaustive step explorer (≤3 preemptions, with sabotaged variants that must be caught) passes. Existing suites for every touched module pass (state_io, session pins, language mirror, egress, budget guard, registry, advisories, worktree cleanup, CLI budget).

Not in this diff and recorded as open roadmap steps: four further locks of the same defect class (`roadmap_slug_lock.ts`, `upgrade_unattended.ts`, `collector_supervision.ts`, `quota_notice_hook.ts`).

## What to answer

1. Does the diff contain a defect — in the helper's protocol, in any site's use of it (wrong guard name, a path that proceeds without the lock, a lost error, an unbounded loop), or in the budget entry? Name file and line.
2. Does the change expand any agent's authority or weaken an existing gate? In particular: is the ceiling raise sized to the measurement, and does the strict-caller change in `state_io` weaken a safety property it held?
3. Can two callers hold any of these locks at once other than the documented paused-holder residual?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## What this prompt leaves out

Test files are listed by `--stat` only; the roadmap file diff is omitted. Source diffs use one line of context. The branch can be read with `git diff origin/main...feat/road-to-verified-stale-lock-reclaim`.

```
 .../road-to-verified-stale-lock-reclaim.md         |  33 +++-
 tests/scripts/_lock_interleaving_harness.ts        | 199 +++++++++++++++++++++
 .../scripts/generation_lock_interleavings.test.ts  |  62 ++++---
 tests/scripts/hooks/state_io.test.ts               |  54 +++---
 tests/scripts/language_mirror_hook.test.ts         |   8 +-
 tests/scripts/lock_sites_interleavings.test.ts     | 104 +++++++++++
 tests/scripts/session_pins.test.ts                 |  12 +-
 tests/scripts/state_io_lock_interleavings.test.ts  |  24 +--
 8 files changed, 417 insertions(+), 79 deletions(-)
```

## `src/scripts/_lib/generation_lock.ts` at `091ce7cacd` (complete)

```ts
/**
 * A file or directory lock whose stale-break never removes a path another
 * caller may hold.
 *
 * Measured by `tests/scripts/generation_lock_interleavings.test.ts`; every
 * site that uses it by `tests/scripts/lock_sites_interleavings.test.ts`.
 *
 * The guard is a family `<guard>`, `<guard>.1`, `<guard>.2`, …: generation 0 is
 * the bare path each caller passes, which is the name its stat-then-remove lock
 * used, so a process still running that older code sees a first-generation
 * holder. The holder is whoever created the highest generation. Acquiring creates generation 0 when
 * none exists; breaking a stale highest generation `g` creates `g + 1` with
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

/** What a step returns: a generation list, an age in ms (`null` when absent), or whether a create won. */
export type StepResult = number[] | number | null | boolean | undefined;

export function companion(lockPath: string, g: number): string {
    return g === 0 ? lockPath : `${lockPath}.${String(g)}`;
}

/**
 * Execute one step against the real filesystem. A create that lost the race is
 * `false`, and any other create failure is the caller's to judge. Elsewhere a
 * failure reads as absence: no listing is no generation, a vanished guard has
 * no age, and a lower or expired generation left behind holds nothing.
 */
export function execute([op, f]: Step, now: () => number = Date.now): StepResult {
    try {
        if (op === 'list') {
            const own = path.basename(f);
            return fs
                .readdirSync(path.dirname(f))
                .map((n) => (n === own ? 0 : n.startsWith(`${own}.`) ? Number(n.slice(own.length + 1)) : -1))
                .filter((g) => g >= 0)
                .sort((a, b) => a - b);
        }
        if (op === 'age') return now() - fs.statSync(f).mtimeMs;
        if (op === 'remove') return void fs.rmSync(f, { recursive: true, force: true });
        if (op === 'expire') return void fs.utimesSync(f, 0, 0);
        if (op === 'mkdir') fs.mkdirSync(f);
        else fs.closeSync(fs.openSync(f, 'wx'));
        return true;
    } catch (err) {
        if (op === 'list') return [];
        if (op === 'age') return null;
        if (op !== 'create' && op !== 'mkdir') return undefined;
        if ((err as NodeJS.ErrnoException).code === 'EEXIST') return false;
        throw err;
    }
}

/** The acquire protocol, one filesystem step per yield. */
export function* acquireSteps(lockPath: string, staleMs: number, dir = false): Generator<Step, Held | null, StepResult> {
    const gens = (yield ['list', lockPath]) as number[];
    const top = gens[gens.length - 1];
    let g = 0;
    if (top !== undefined) {
        const age = (yield ['age', companion(lockPath, top)]) as number | null;
        // Gone between the listing and the stat: only a superseder removes a
        // generation, so a higher one exists and holds.
        if (age === null || age < staleMs) return null;
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
    const it = acquireSteps(lockPath, options.staleMs, options.dir);
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
    const spin = options.spinMs ?? 5;
    for (let slept = 0; ; slept += spin) {
        const held = tryAcquire(lockPath, options);
        if (held !== null || slept >= (options.waitMs ?? 0)) return held;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, spin);
    }
}

/** The release protocol, one step: age the caller's own generation to the epoch; remove nothing. */
export function release(held: Held): void {
    execute(['expire', companion(held.lockPath, held.generation)]);
}
```

## Source diff (`git diff -U1 origin/main...HEAD -- src ':!src/scripts/_lib/generation_lock.ts'`)

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 5b405df712..02755de99e 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -270,2 +270,12 @@
             "what_would_have_caught_it": "Nothing missed it: the gate fired on the first mirror run of the change, as it is meant to."
+        },
+        {
+            "date": "2026-11-13",
+            "chunk": "src/scripts/_lib/session_pins.ts",
+            "from": 34900,
+            "to": 35800,
+            "by": "agent, feat/road-to-verified-stale-lock-reclaim (road-to-verified-stale-lock-reclaim 2.1)",
+            "what_was_added": "The generation lock (`_lib/generation_lock.ts`, 2,477 B in this chunk) behind `state_io`'s file lock, which the pin capture and restore run under. The stat-then-remove reclaim it replaces let two callers that judged one abandoned guard both acquire, and an unconditional release delete the guard of a peer that had superseded a paused holder; `tests/scripts/lock_sites_interleavings.test.ts` shows both schedules on origin/main and none after. Measured by this gate's own chunk build: 34,512 B on origin/main 24f323151a, 35,687 B with the change, +1,175 B (`state_io` itself fell from 6,323 to 4,947 B).",
+            "why_it_could_not_be_avoided": "Room was made first: the step executor was rewritten to tuple steps and a single try, and the release generator dropped, taking the helper from 2,925 to 2,477 B, and the old reclaim and its sleep helper left `state_io`. What remains is the protocol itself, which every lock site now shares; a chunk cannot share it with the dispatch bundle, so the pin chunk carries its own copy. The dispatch bundle stays under its 1,595,100 ceiling with no raise.",
+            "what_would_have_caught_it": "Nothing missed it: the gate fired on the first local reading of the change. Sized to the measurement plus 113 B."
         }
@@ -293,3 +303,3 @@
             "entry": "src/scripts/_lib/session_pins.ts",
-            "max_bytes": 34900,
+            "max_bytes": 35800,
             "registered_at": "2026-11-08",
diff --git a/src/scripts/_lib/egress_session_table.ts b/src/scripts/_lib/egress_session_table.ts
index 055c34bfaf..3f2f28dd04 100644
--- a/src/scripts/_lib/egress_session_table.ts
+++ b/src/scripts/_lib/egress_session_table.ts
@@ -20,2 +20,3 @@ import * as path from 'node:path';
 
+import { acquire, release } from './generation_lock.js';
 import { detect, EGRESS_RULES, type EgressClass, type EgressRule, type EgressSpan } from './egress_rules.js';
@@ -156,6 +157,2 @@ function expired(table: SessionTable, now: number): boolean {
 
-function sleepMs(ms: number): void {
-    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
-}
-
 const LOCK_STALE_MS = 5000;
@@ -175,3 +172,3 @@ export interface TableTarget {
 /** Read-modify-write under an exclusive lock; the file is written whole and renamed into place. */
-function updateTable<T>(t: TableTarget, fn: (table: SessionTable) => T): T {
+export function updateTable<T>(t: TableTarget, fn: (table: SessionTable) => T): T {
     const rel = path.relative(path.resolve(t.workspaceRoot ?? process.cwd()), path.resolve(t.dir));
@@ -182,17 +179,7 @@ function updateTable<T>(t: TableTarget, fn: (table: SessionTable) => T): T {
     const file = sessionTablePath(t.dir, t.sessionId);
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
     try {
@@ -220,4 +207,3 @@ function updateTable<T>(t: TableTarget, fn: (table: SessionTable) => T): T {
     } finally {
-        fs.closeSync(fd);
-        fs.rmSync(lock, { force: true });
+        release(held);
     }
diff --git a/src/scripts/_lib/project_registry.ts b/src/scripts/_lib/project_registry.ts
index c512da7b8b..b931a7e2fa 100644
--- a/src/scripts/_lib/project_registry.ts
+++ b/src/scripts/_lib/project_registry.ts
@@ -20,2 +20,3 @@ import * as path from 'node:path';
 import { canonicalOrigin, projectsDir, remoteUrl, repoIdentity } from '../code_graph/repo_identity.js';
+import { acquire, release } from './generation_lock.js';
 import { git_common_dir } from './git_common_dir.js';
@@ -117,7 +118,11 @@ const LOCK_STALE_MS = 30_000;
 
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
 export function updateRegistry<T>(fn: (reg: Registry) => T, opts: RegistryOptions = {}): T {
@@ -125,18 +130,4 @@ export function updateRegistry<T>(fn: (reg: Registry) => T, opts: RegistryOption
     fs.mkdirSync(path.dirname(lock), { recursive: true });
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
     try {
@@ -147,3 +138,3 @@ export function updateRegistry<T>(fn: (reg: Registry) => T, opts: RegistryOption
     } finally {
-        fs.rmSync(lock, { recursive: true, force: true });
+        release(held);
     }
diff --git a/src/scripts/advisories.ts b/src/scripts/advisories.ts
index 80a61e87a1..dd929a7192 100644
--- a/src/scripts/advisories.ts
+++ b/src/scripts/advisories.ts
@@ -66,2 +66,3 @@ import {
 } from './_lib/advisory_verdicts.js';
+import { release, tryAcquire, type Held } from './_lib/generation_lock.js';
 import { readRegistry, recordProject } from './_lib/project_registry.js';
@@ -160,38 +161,15 @@ export async function refreshMany(allRoots: string[], deps: RefreshDeps = {}): P
     fs.mkdirSync(mdir, { recursive: true });
-    const lock = path.join(mdir, 'refresh.lock');
+    // A generation lock (`_lib/generation_lock.ts`): a refresh abandoned for ten
+    // minutes is superseded, never removed from under the run that took over.
+    // Its limit, unfenced here: a run paused past ten minutes keeps writing
+    // after a peer superseded it, and the later write wins.
+    let held: Held | null;
     try {
-        fs.writeFileSync(lock, `${process.pid} ${now.toISOString()}\n`, { flag: 'wx' });
+        held = tryAcquire(path.join(mdir, 'refresh.lock'), { staleMs: 10 * 60000, now: () => now.getTime() });
     } catch {
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
     }
@@ -305,7 +283,3 @@ export async function refreshMany(allRoots: string[], deps: RefreshDeps = {}): P
     } finally {
-        try {
-            fs.unlinkSync(lock);
-        } catch {
-            /* already gone */
-        }
+        release(held);
     }
diff --git a/src/scripts/ai_council/budget_guard.ts b/src/scripts/ai_council/budget_guard.ts
index 08c286b589..33061ee747 100644
--- a/src/scripts/ai_council/budget_guard.ts
+++ b/src/scripts/ai_council/budget_guard.ts
@@ -48,2 +48,3 @@ import * as path from 'node:path';
 
+import { acquire, release } from '../_lib/generation_lock.js';
 import * as user_global_paths from '../_lib/user_global_paths.js';
@@ -632,13 +633,14 @@ const RESERVATION_LOCK_STALE_MS = 10_000;
 
-function _sleepMs(ms: number): void {
-    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
-}
-
 /**
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
  */
-function _withLedgerLock<T>(p: string, waitMs: number, fn: () => T): T | null {
+export function _withLedgerLock<T>(p: string, waitMs: number, fn: () => T): T | null {
     if (!_ensureLedgerDir(p)) {
@@ -646,22 +648,5 @@ function _withLedgerLock<T>(p: string, waitMs: number, fn: () => T): T | null {
     }
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
     }
@@ -670,8 +655,3 @@ function _withLedgerLock<T>(p: string, waitMs: number, fn: () => T): T | null {
     } finally {
-        fs.closeSync(fd);
-        try {
-            fs.unlinkSync(lockPath);
-        } catch {
-            // Already gone is the end state wanted.
-        }
+        release(held);
     }
diff --git a/src/scripts/ai_council/cli_call_budget.ts b/src/scripts/ai_council/cli_call_budget.ts
index 655d464460..044110965d 100644
--- a/src/scripts/ai_council/cli_call_budget.ts
+++ b/src/scripts/ai_council/cli_call_budget.ts
@@ -19,2 +19,4 @@ import * as path from 'node:path';
 
+import { acquire, release, type Held } from '../_lib/generation_lock.js';
+
 /**
@@ -143,2 +145,5 @@ export function writeStateAtomically(target: string, payload: string): void {
  * - **Stale-lock breaking.** A crashed holder must not wedge the counter forever.
+ *   The lock is a generation lock (`_lib/generation_lock.ts`), so a break never
+ *   removes a lock a peer holds; a holder past the one-second threshold is
+ *   superseded and keeps writing beside its successor, unfenced.
  * - **In-process calls need none of this** — the callers are synchronous and Node
@@ -150,22 +155,8 @@ export function withStateLock<T>(target: string, fn: () => T): T {
     const lockPath = `${target}.lock`;
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
     }
@@ -174,9 +165,3 @@ export function withStateLock<T>(target: string, fn: () => T): T {
     } finally {
-        if (held) {
-            try {
-                fs.unlinkSync(lockPath);
-            } catch {
-                // A removed lock is the desired end state either way.
-            }
-        }
+        if (held !== null) release(held);
     }
@@ -338,3 +323,3 @@ function _isObject(x: unknown): x is Record<string, unknown> {
 
-/** Monotonic-ish millisecond clock for lock ages and temp-file names. */
+/** Monotonic-ish millisecond clock for temp-file names. */
 function _monotonicish(): number {
@@ -343,12 +328 @@ function _monotonicish(): number {
 
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
diff --git a/src/scripts/hooks/state_io.ts b/src/scripts/hooks/state_io.ts
index 43f560081d..1e7fd369d2 100644
--- a/src/scripts/hooks/state_io.ts
+++ b/src/scripts/hooks/state_io.ts
@@ -28,11 +28,10 @@
  * --------------------
- * - Node has no `flock`. We emulate the exclusive lock with an
- *   `O_CREAT | O_EXCL` lockfile (`.dispatcher.lock`) acquired with a
- *   bounded spin, then released by truncating back to empty so the
- *   sentinel file still lives alongside the target (the Python `fcntl`
- *   path leaves the lock file in place too). The atomic publish is the
+ * - Node has no `flock`. The exclusive lock is the generation lock
+ *   (`_lib/generation_lock.ts`): `O_CREAT | O_EXCL` companions
+ *   `.dispatcher.lock.held[.<g>]` acquired with a bounded spin; a release
+ *   ages its own companion and leaves it in place. The atomic publish is the
  *   `renameSync`; torn-write risk is bounded the same way as POSIX.
- * - The lock file lives under `agents/runtime/state/` which is gitignored.
- * - The lock is process-scoped, not session-scoped: each call opens,
- *   locks, writes, releases, closes. No long-lived file handles.
+ * - The lock files live under `agents/runtime/state/` which is gitignored.
+ * - The lock is process-scoped, not session-scoped: each call locks,
+ *   writes, releases. No long-lived file handles.
  */
@@ -43,2 +42,4 @@ import path from "node:path";
 
+import { acquire, release, type Held } from "../_lib/generation_lock.js";
+
 export const LOCK_BASENAME = ".dispatcher.lock";
@@ -342,8 +343,2 @@ const LOCK_SPIN_SLEEP_MS = 2;
 
-/** Real sleep without async — `Atomics.wait` on a throwaway buffer. */
-function _sleep(ms: number): void {
-  const sab = new Int32Array(new SharedArrayBuffer(4));
-  Atomics.wait(sab, 0, 0, ms);
-}
-
 /**
@@ -351,53 +346,32 @@ function _sleep(ms: number): void {
  *
- * Node has no `flock`, so exclusion comes from an `O_EXCL` companion
- * (`<lock>.held`) removed on release; the visible sentinel is kept.
- *
- * ## What was wrong before, precisely
- *
- * The reclaim branch was commented `// Stale companion — reclaim it` and
- * examined the companion in NO way: no mtime, no age, no owner. It fired on
- * `Date.now() - start > deadlineMs` — a property of how long THIS caller had
- * waited, not of the companion's health. So it was a patience check wearing the
- * name of a staleness check, and a caller that merely waited long enough
- * deleted a perfectly live peer's lock.
- *
- * Two consequences followed, and the second is the worse one:
- *
- *   - `start` was never reset before `continue`, and the deadline test sat
- *     BEFORE the sleep. So the first timeout made the sleep permanently
- *     unreachable: every later iteration took the reclaim branch and looped
- *     with no pause at all. A pauseless spin was the end state of any call that
- *     touched the deadline once.
- *   - Two callers both past their deadline evicted each other's companion
- *     without bound — each one's "reclaim" destroyed the exclusion the other
- *     had just acquired, so neither held a lock while both believed they did.
- *
- * ## What holds now
- *
- * The companion's AGE decides reclamation, and nothing else. A fresh companion
- * is never removed, by any caller, at any wait duration — a blocking caller
- * that reaches its deadline reports failure instead of evicting. Reclamation
- * requires `LOCK_STALE_MS` of inactivity, which only an abandoned lock reaches,
- * so mutual eviction is gone rather than merely rarer.
- *
- * Every retry path either sleeps or has just made real progress (the companion
- * vanished, or a genuinely abandoned one was removed), so no path reaches a
- * sleepless retry loop.
- *
- * ## `blocking: false` — the hot-path acquire
- *
- * `post_tool_use` runs on every tool call and must never wait. A non-blocking
- * caller returns on the first `EEXIST` with no spin at all, so it cannot cross
- * a deadline — which makes the reclaim branch UNREACHABLE for it rather than
- * merely rarer. That is why the roadmap treats the non-blocking acquire as
- * subsuming the reclaim fix rather than complementing it; the reclaim fix is
- * still needed for the blocking callers, which is why both landed.
- *
- * An abandoned companion is still reclaimed on the non-blocking path: skipping
- * that would let one crashed process wedge the hot path for 30 seconds, which
- * is the wedge the never-block contract exists to prevent.
- *
- * Returns the sentinel fd, or `null` when the lock is held by a live peer.
- * `null` is NOT a failure to handle generically — the two callers below take
- * deliberately opposite actions on it, for reasons stated at each.
+ * The protocol is the generation lock (`_lib/generation_lock.ts`): a stale
+ * guard is superseded by creating the next generation with `O_EXCL`, never by
+ * removing the path a peer may hold, and a release ages its own generation
+ * instead of removing it. The stat-then-remove reclaim it replaces let two
+ * callers that judged one abandoned guard both acquire, and an unconditional
+ * release delete the guard of the peer that had superseded a paused holder
+ * (`tests/scripts/lock_sites_interleavings.test.ts`).
+ *
+ * The companion's AGE decides reclamation, never how long this caller waited:
+ * reclamation needs `LOCK_STALE_MS` of inactivity, which only an abandoned lock
+ * reaches. A blocking caller that reaches its deadline reports failure; a
+ * non-blocking one (`post_tool_use`, which must never wait) makes one attempt,
+ * and still supersedes an abandoned guard on it.
+ *
+ * Breaking is now safe for `strict` callers too, so they break an abandoned
+ * guard like everyone else: refusing it left a dead holder blocking that
+ * session's pins until the retention prune. `strict` still refuses to proceed
+ * without a guard when the companion cannot be created at all.
+ *
+ * Limit, named here because the lock cannot close it: a holder paused past
+ * `LOCK_STALE_MS` keeps writing after a peer has superseded it. No caller here
+ * fences its publish with the held generation; every critical section is a
+ * read, a mutate and a rename, measured in milliseconds against 30 seconds.
+ *
+ * Returns the held generation, `null` when a live peer holds it (or a strict
+ * caller could not create a guard), or `false` when a non-strict caller
+ * proceeds unguarded because the companion cannot be created (a read-only
+ * mount, a vanished parent): the failure mode there is a lost guard, and the
+ * alternative is a lost write. The callers below take deliberately different
+ * actions on `null`, for reasons stated at each.
  */
@@ -406,102 +380,18 @@ function _acquire_lock(
   options: { blocking?: boolean; strict?: boolean } = {},
-): number | null {
-  const blocking = options.blocking ?? true;
-  // Open (and keep) the sentinel lock file with O_CREAT | O_RDWR — never
-  // truncated, just an fd, exactly like the Python fcntl path. The file
-  // stays on disk alongside the target after release.
-  const fd = fs.openSync(lock_path, "a", 0o644);
-  const held = lock_path + ".held";
-  const give_up = (): null => {
-    try {
-      fs.closeSync(fd);
-    } catch {
-      /* ignore */
-    }
-    return null;
-  };
-  const start = Date.now();
-  for (;;) {
-    try {
-      const heldFd = fs.openSync(held, "wx", 0o644);
-      fs.closeSync(heldFd);
-      return fd;
-    } catch (err) {
-      if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
-        // Unexpected error (a read-only mount, a vanished parent) — proceed
-        // without the companion guard rather than wedge the never-block hook
-        // contract. Pre-existing behaviour, deliberately retained: the failure
-        // mode here is a lost guard, and the alternative is a lost write.
-        // `strict` callers (session pins) prefer the reported failure: a write
-        // without exclusion can silently drop a user's constraint.
-        return options.strict === true ? give_up() : fd;
-      }
-      // EEXIST: somebody holds it. Decide from the COMPANION, never from how
-      // long we have waited.
-      let age_ms: number;
-      try {
-        age_ms = Date.now() - fs.statSync(held).mtimeMs;
-      } catch {
-        // Usually vanished between the open and the stat — the holder just
-        // released. But a guard that persistently refuses both creation and
-        // stat (a dangling symlink, a denied directory) would spin here
-        // forever, so this retry is paced and bounded like every other — and a
-        // non-blocking caller does not wait for it at all.
-        if (!blocking) return give_up();
-        _sleep(LOCK_SPIN_SLEEP_MS);
-        if (Date.now() - start > LOCK_ACQUIRE_DEADLINE_MS) return give_up();
-        continue;
-      }
-      if (age_ms >= LOCK_STALE_MS && options.strict === true) {
-        // Two callers that judge the same abandoned guard can both remove it
-        // and both acquire (stat-then-remove deletes whatever is there by
-        // then). A strict caller prefers a reported failure: it never breaks a
-        // guard. Session pins are the only strict caller, so an abandoned
-        // guard there blocks that session's pins (each attempt reported) until
-        // the retention prune removes the gone session's files.
-        return give_up();
-      }
-      if (age_ms >= LOCK_STALE_MS) {
-        // A genuine staleness check: the companion itself has been untouched
-        // for longer than any live critical section here can last. Removing it
-        // is progress, so the immediate retry is bounded.
-        let removed = true;
-        try {
-          fs.rmSync(held, { force: true });
-        } catch {
-          // A peer reclaimed it first (the retry sees the new one), or it cannot
-          // be removed at all — then retrying at once would spin forever.
-          removed = false;
-        }
-        if (removed) continue;
-        if (!blocking) return give_up();
-        _sleep(LOCK_SPIN_SLEEP_MS);
-        if (Date.now() - start > LOCK_ACQUIRE_DEADLINE_MS) return give_up();
-        continue;
-      }
-      // A LIVE peer holds it.
-      if (!blocking) {
-        return give_up();
-      }
-      if (Date.now() - start > LOCK_ACQUIRE_DEADLINE_MS) {
-        // Waited long enough. Report failure — never evict a fresh companion,
-        // which is exactly the eviction that made two impatient callers destroy
-        // each other's exclusion.
-        return give_up();
-      }
-      _sleep(LOCK_SPIN_SLEEP_MS);
-    }
-  }
-}
-
-function _release_lock(fd: number, lock_path: string): void {
+): Held | false | null {
   try {
-    fs.closeSync(fd);
+    return acquire(`${lock_path}.held`, {
+      staleMs: LOCK_STALE_MS,
+      waitMs: options.blocking === false ? 0 : LOCK_ACQUIRE_DEADLINE_MS,
+      spinMs: LOCK_SPIN_SLEEP_MS,
+    });
   } catch {
-    /* ignore */
+    return options.strict === true ? null : false;
   }
-  // Drop the O_EXCL companion so the next writer can re-acquire; the
-  // visible `.dispatcher.lock` sentinel is left in place (the fcntl path
-  // keeps its lock file alongside the target too).
+}
+
+function _release_lock(held: Held | false): void {
+  if (held === false) return;
   try {
-    fs.rmSync(lock_path + ".held", { force: true });
+    release(held);
   } catch {
@@ -515,8 +405,6 @@ function _release_lock(fd: number, lock_path: string): void {
  * Split out of `_atomic_write_text` so a read-modify-write can hold ONE lock
- * across all three steps. The `O_EXCL` companion in `_acquire_lock` is not
- * reentrant: nesting an acquire inside a held lock spins to the 5-second
- * deadline, reclaims its own companion as stale, and proceeds — so it would
- * "work" while costing five seconds per call and silently dropping the mutual
- * exclusion it was there for. That is why this is a separate function rather
- * than a nested call.
+ * across all three steps. The lock in `_acquire_lock` is not reentrant: an
+ * acquire nested inside a held lock sees its own fresh guard as a live peer and
+ * waits out the 5-second deadline. That is why this is a separate function
+ * rather than a nested call.
  */
@@ -551,5 +439,4 @@ function _publish_text_locked(target: string, text: string): void {
 function _atomic_write_text(target: string, text: string): void {
-  const lock_path = _lock_path(path.dirname(target));
-  const fd = _acquire_lock(lock_path);
-  if (fd === null) {
+  const held = _acquire_lock(_lock_path(path.dirname(target)));
+  if (held === null) {
     _publish_text_locked(target, text);
@@ -560,3 +447,3 @@ function _atomic_write_text(target: string, text: string): void {
   } finally {
-    _release_lock(fd, lock_path);
+    _release_lock(held);
   }
@@ -885,6 +772,9 @@ export function prune_stale_session_states(
       // so no live writer can be holding a lock for it — and a writer that
-      // arrives afterwards creates both anew.
-      for (const suffix of [".lock", ".lock.held"]) {
+      // arrives afterwards creates both anew. The guard is a generation family
+      // (`.lock.held`, `.lock.held.<g>`), so every member goes.
+      const own = path.basename(full);
+      for (const n of entries) {
+        if (n !== `${own}.lock` && n !== `${own}.lock.held` && !n.startsWith(`${own}.lock.held.`)) continue;
         try {
-          fs.rmSync(`${full}${suffix}`, { force: true });
+          fs.rmSync(path.join(dir, n), { force: true });
         } catch {
@@ -1090,6 +980,5 @@ export function update_text_under_lock(
   // `atomic_write_text` in the state dir.
-  const lock_path = _target_lock_path(targetPath);
-  let fd: number | null;
+  let held: Held | false | null;
   try {
-    fd = _acquire_lock(lock_path, { blocking: options.blocking ?? true, strict: options.strict === true });
+    held = _acquire_lock(_target_lock_path(targetPath), { blocking: options.blocking ?? true, strict: options.strict === true });
   } catch {
@@ -1099,3 +988,3 @@ export function update_text_under_lock(
   // exclusion is the truncating write this function exists to prevent.
-  if (fd === null) return "failed";
+  if (held === null) return "failed";
   try {
@@ -1116,3 +1005,3 @@ export function update_text_under_lock(
   } finally {
-    _release_lock(fd, lock_path);
+    _release_lock(held);
   }
@@ -1135,6 +1024,5 @@ export function update_json_under_lock<T>(
   // reason and for why `_atomic_write_text` deliberately keeps the shared one.
-  const lock_path = _target_lock_path(targetPath);
-  let fd: number | null;
+  let held: Held | false | null;
   try {
-    fd = _acquire_lock(lock_path, { blocking: options.blocking ?? true });
+    held = _acquire_lock(_target_lock_path(targetPath), { blocking: options.blocking ?? true });
   } catch {
@@ -1147,3 +1035,3 @@ export function update_json_under_lock<T>(
   // action on both (stay silent), and a state nobody branches on goes stale.
-  if (fd === null) return "failed";
+  if (held === null) return "failed";
   try {
@@ -1167,3 +1055,3 @@ export function update_json_under_lock<T>(
   } finally {
-    _release_lock(fd, lock_path);
+    _release_lock(held);
   }
diff --git a/src/scripts/language_mirror_hook.ts b/src/scripts/language_mirror_hook.ts
index 6ccce827ac..a98d5c88d6 100644
--- a/src/scripts/language_mirror_hook.ts
+++ b/src/scripts/language_mirror_hook.ts
@@ -99,2 +99,3 @@ import { admitStamp, readRestoreRecord, restoreOwed } from "./_lib/session_pins_
 import type { SessionPins } from "./_lib/session_pins.js";
+import { release, tryAcquire, type Held } from "./_lib/generation_lock.js";
 
@@ -853,4 +854,4 @@ export function _pruneStaleSessions(
  * A whole hook run is milliseconds, so anything this old belongs to a process
- * that died holding it. Deliberately NOT retried after a break: a retry loop
- * re-opens exactly the window the lock exists to close.
+ * that died holding it. One attempt, never a wait: a busy lock returns the
+ * caller's silent value.
  */
@@ -889,4 +890,10 @@ export const LOCK_STALE_MS = 30_000;
  * § 6.2 refuses.
+ *
+ * The lock is the generation lock (`_lib/generation_lock.ts`): breaking an
+ * abandoned lock never removes a path a peer may hold. Its limit applies here
+ * unfenced: a holder paused past `LOCK_STALE_MS` writes after a peer superseded
+ * it, which the re-read of the pin inside `_writeDistance` narrows but does not
+ * close.
  */
-function _withToolWriteLock<T>(
+export function _withToolWriteLock<T>(
   consumer_root: string,
@@ -898,27 +905,10 @@ function _withToolWriteLock<T>(
   const lock = `${path.join(consumer_root, statePathFor(session_id))}.lock`;
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
   if (held === null) return when_busy;
-  fd = held;
   try {
@@ -927,10 +917,5 @@ function _withToolWriteLock<T>(
     try {
-      fs.closeSync(fd);
-    } catch {
-      /* already closed */
-    }
-    try {
-      fs.rmSync(lock, { force: true });
+      release(held);
     } catch {
-      /* a peer broke a stale lock and owns the path now */
+      /* the next caller supersedes an unreleased generation once it is stale */
     }
diff --git a/src/scripts/worktree_cleanup_check.ts b/src/scripts/worktree_cleanup_check.ts
index 30e058f817..1fe66ded0d 100644
--- a/src/scripts/worktree_cleanup_check.ts
+++ b/src/scripts/worktree_cleanup_check.ts
@@ -45,2 +45,3 @@ import { parse as parseYaml } from 'yaml';
 import { load_agent_settings, settings_layer_states, user_global_settings_paths } from './_lib/agent_settings.js';
+import { release, tryAcquire, type Held } from './_lib/generation_lock.js';
 import { read_live_records, register_dir } from './_lib/session_register.js';
@@ -885,2 +886,8 @@ const LOCK_STALE_MS = 10 * 60 * 1000;
  * remove the same tree; the second one simply does nothing this time.
+ *
+ * A generation lock (`_lib/generation_lock.ts`): a stale lock is superseded,
+ * never renamed aside or removed while another pass may have taken it over, and
+ * the release ages this pass's own generation only. Its limit, unfenced here: a
+ * pass that outlived the stale window keeps removing beside its successor, and
+ * `git worktree remove` re-checks each tree itself.
  */
@@ -889,40 +896,11 @@ function takeRemovalLock(mainPath: string, now: Date): (() => void) | null {
     if (dir === null) return null;
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
     }
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
 }
@@ -963,4 +941,4 @@ export function applyRemovals(
     if (rows.length === 0) return [];
-    const release = takeRemovalLock(mainPath, now);
-    if (release === null) return [];
+    const unlock = takeRemovalLock(mainPath, now);
+    if (unlock === null) return [];
     const outcomes: RemovalOutcome[] = [];
@@ -1042,3 +1020,3 @@ export function applyRemovals(
     } finally {
-        release();
+        unlock();
     }
```
