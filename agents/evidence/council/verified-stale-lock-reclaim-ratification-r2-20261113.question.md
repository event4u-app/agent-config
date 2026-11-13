<!-- evidence-type: analysis -->

# Ratification review — the generation lock at eight file-lock sites — round 2

You are an independent reviewer for a change in the `event4u/agent-config` repository. Two files in it are on the ratification gate's list as hook-plumbing sources: `src/scripts/_lib/generation_lock.ts` (part of the hook dispatch bundle) and `src/config/hook-bundle-budget.json` (a raised byte ceiling). ADR-268 § 4 needs a two-provider verdict: an agent may change these files but may not ratify its own change.

subject: 03fd973dc57304a44a6a25556f51cf9c4872417ca6484226d459c2dd90d5e5a0

(The digest covers the gated files at commit `bae765dc64` on branch `feat/road-to-verified-stale-lock-reclaim`, computed with `./scripts-run src/scripts/ratification_subject` over the whole changed-file list.)

## The change

Round 1's prompt, committed as `agents/evidence/council/verified-stale-lock-reclaim-ratification-r1-20261113.question.md`, describes the whole change and carries its full source diff: eight cross-process file locks (`state_io`, the language-mirror tool lock, the egress session table, the council spend ledger, the project registry, the advisories refresh lock, the worktree removal lock, the CLI call budget) move from stat-then-remove or rename-aside stale breaking to a shared generation lock, plus a three-caller interleaving harness and a raised byte ceiling for the session-pins chunk.

## Round 1 and what changed

Refused 2/2. Findings and what was done (commit `dddf6801ec`, diff below):

- **A failed listing read as "no generation" (both seats).** `execute(['list', …])` now throws on any `readdirSync` error. `acquire`/`tryAcquire` propagate it; each site already chose what an uncreatable guard means (state_io non-strict proceeds unguarded as before for an uncreatable guard, strict refuses; egress, ledger and registry throw or refuse; the CLI budget proceeds unlocked after its wait, as its contract documents). Test: a live holder exists, `readdirSync` fails with EACCES, `tryAcquire` throws and nothing is created.
- **Strict callers lost their never-break property (both seats).** New option `breakStale` (default `true`). With `false` a caller never supersedes a generation that went stale while held; it takes over only a generation its holder released. A release sets the mtime to the epoch and the `age` step reports that as `Infinity`, which distinguishes release from abandonment. `state_io` passes `breakStale: false` for strict callers; the round-0 strict tests are restored unchanged (an abandoned guard is left in place and the write refused, blocking and non-blocking; an unremovable stale guard is refused at the deadline), plus a test that a released guard is taken over at once. The step explorer gains a strict candidate: with a holder aged while it holds, no schedule (≤3 preemptions, three starts) shows any overlap.
- **`spinMs: 0` looped forever (both seats).** The spin is floored at 1 ms. Test.
- **Non-canonical generation names (one seat).** Only `[1-9][0-9]{0,14}` suffixes count. Test with `01`, `1.5`, `Infinity`, `1e3`, empty.
- **Mixed-version claim overstated (both seats).** The helper comment now says an older process sees a generation-0 holder but mixed versions on one lock are not excluded.
- **Unlocked paths remain (one seat).** Unchanged and pre-existing: `state_io`'s `_atomic_write_text` publishes a whole-file rename when a live peer holds the directory lock (documented there as a deliberate blind write), and the CLI budget proceeds unlocked after 1 s. Neither is claimed as excluded.
- Not changed: dir/file mode is per call site (each site passes one constant); mtime tampering is out of scope.

Bundle: the session-pins chunk now measures 35,889 B (origin/main 34,512 B); the ceiling raise is resized to 36,000 B and its raise-log entry updated. The dispatch bundle reads 1,595,044 B against its unchanged 1,595,100 B ceiling. All affected suites pass (1,291 tests), the site harness (18) and the helper tests (18).

## What to answer

1. Does the diff contain a defect — in the helper's protocol (including the released-versus-stale distinction), in any site's use of it, or in the budget entry? Name file and line.
2. Does the change expand any agent's authority or weaken an existing gate? Is the ceiling raise sized to the measurement?
3. Can two callers hold any of these locks at once other than the documented paused-holder residual of non-strict callers?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## `src/scripts/_lib/generation_lock.ts` at `bae765dc64` (complete)

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
                .map((n) => (n === own ? 0 : n.startsWith(`${own}.`) && /^[1-9]\d{0,14}$/.test(n.slice(own.length + 1)) ? Number(n.slice(own.length + 1)) : -1))
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
        if (age === null || age < staleMs || (!breakStale && age !== Infinity)) return null;
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

/** The release protocol, one step: age the caller's own generation to the epoch; remove nothing. */
export function release(held: Held): void {
    execute(['expire', companion(held.lockPath, held.generation)]);
}
```

## Diff since round 1 (`git diff 172edfbf84..bae765dc64 -- src tests`, helper excluded above)

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 02755de99e..0a683f43b1 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -273,11 +273,11 @@
             "date": "2026-11-13",
             "chunk": "src/scripts/_lib/session_pins.ts",
             "from": 34900,
-            "to": 35800,
+            "to": 36000,
             "by": "agent, feat/road-to-verified-stale-lock-reclaim (road-to-verified-stale-lock-reclaim 2.1)",
-            "what_was_added": "The generation lock (`_lib/generation_lock.ts`, 2,477 B in this chunk) behind `state_io`'s file lock, which the pin capture and restore run under. The stat-then-remove reclaim it replaces let two callers that judged one abandoned guard both acquire, and an unconditional release delete the guard of a peer that had superseded a paused holder; `tests/scripts/lock_sites_interleavings.test.ts` shows both schedules on origin/main and none after. Measured by this gate's own chunk build: 34,512 B on origin/main 24f323151a, 35,687 B with the change, +1,175 B (`state_io` itself fell from 6,323 to 4,947 B).",
-            "why_it_could_not_be_avoided": "Room was made first: the step executor was rewritten to tuple steps and a single try, and the release generator dropped, taking the helper from 2,925 to 2,477 B, and the old reclaim and its sleep helper left `state_io`. What remains is the protocol itself, which every lock site now shares; a chunk cannot share it with the dispatch bundle, so the pin chunk carries its own copy. The dispatch bundle stays under its 1,595,100 ceiling with no raise.",
-            "what_would_have_caught_it": "Nothing missed it: the gate fired on the first local reading of the change. Sized to the measurement plus 113 B."
+            "what_was_added": "The generation lock (`_lib/generation_lock.ts`, 2,636 B in this chunk) behind `state_io`'s file lock, which the pin capture and restore run under. The stat-then-remove reclaim it replaces let two callers that judged one abandoned guard both acquire, and an unconditional release delete the guard of a peer that had superseded a paused holder; `tests/scripts/lock_sites_interleavings.test.ts` shows both schedules on origin/main and none after. Measured by this gate's own chunk build: 34,512 B on origin/main 24f323151a, 35,889 B with the change, +1,377 B (`state_io` itself fell from 6,323 to 4,990 B).",
+            "why_it_could_not_be_avoided": "Room was made first: the step executor was rewritten to tuple steps and a single try, and the release generator dropped, taking the helper from 2,925 to 2,477 B before ratification round 1 added a listing failure that throws, canonical generation names, a floor on the spin and a strict mode that never supersedes a stale holder (2,636 B), and the old reclaim and its sleep helper left `state_io`. What remains is the protocol itself, which every lock site now shares; a chunk cannot share it with the dispatch bundle, so the pin chunk carries its own copy. The dispatch bundle stays under its 1,595,100 ceiling with no raise.",
+            "what_would_have_caught_it": "Nothing missed it: the gate fired on the first local reading of the change. Sized to the measurement plus 111 B."
         }
     ],
     "chunks": [
@@ -301,7 +301,7 @@
         },
         {
             "entry": "src/scripts/_lib/session_pins.ts",
-            "max_bytes": 35800,
+            "max_bytes": 36000,
             "registered_at": "2026-11-08",
             "derivation": "Measured 34,414 bytes on 2026-11-09 (an unpin that matches nothing named in the brief notice too, capture under a strict file lock that never replaces an unreadable file, eligibility computed in linear time from fence, paste and injected-region spans of the original text (attributed envelopes included, opener recognition with no attribute grammar, a lead that ends at the first line containing anything tag-like or at a host frame recognised mid-prompt, a forward-only paste-tag scanner, fences read by a prefix scan, directives that were not applied counted and reported, a directive line carrying a closing tag, an attributed opener or a bare opener closed on a later line refused, checked in linear time), lone surrogates normalised, caps, lossless per-session state that is never overwritten when it cannot be read whole, a reported restore failure, pins inert in a replay (no capture, restore, restatement or subagent read), the once-per-compaction delivery and restatement coordinated across prompt and tool order with one restore record per session changed only under the per-file lock, tried once and never waited for, each delivery adding the compaction's stamp to a set of acknowledged stamps in that lock (the most recent 512), a record that exists but cannot be read left untouched and acted on by nothing on either path, one admission rule for every compaction stamp so an oversized one is unknown and never recorded, pins read inside that transaction, the tool-call restore keyed on its own stamp and never re-delivering a delivered record, a once-a-day retention prune that keeps a live session's restore record by its pin file's activity and removes a gone session's boundary and lock files, the subagent reader, activity-based retention, restore text, and the parts of `_lib/prompt_shape` and `hooks/state_io` they import). The ceiling is that reading plus about 3 %, rounded, with no growth queued. Loaded by `language-mirror` through `hooks/session_pins_loader.ts` on a prompt carrying a `pin:` or `unpin:` line, on a prompt that owes a delivery or restatement, and on the one tool call after a compaction; a missing chunk is reported on the capture turn and on the tool-call restore, and costs the pin restore, never the language restore or the dispatch."
         },
diff --git a/src/scripts/hooks/state_io.ts b/src/scripts/hooks/state_io.ts
index 1e7fd369d2..4669d18eb9 100644
--- a/src/scripts/hooks/state_io.ts
+++ b/src/scripts/hooks/state_io.ts
@@ -358,10 +358,12 @@ const LOCK_SPIN_SLEEP_MS = 2;
  * non-blocking one (`post_tool_use`, which must never wait) makes one attempt,
  * and still supersedes an abandoned guard on it.
  *
- * Breaking is now safe for `strict` callers too, so they break an abandoned
- * guard like everyone else: refusing it left a dead holder blocking that
- * session's pins until the retention prune. `strict` still refuses to proceed
- * without a guard when the companion cannot be created at all.
+ * A `strict` caller (session pins) never supersedes a guard that went stale
+ * while held, only one its holder released: a superseded holder that resumes
+ * would write past its successor, and for a pin that is a silently dropped
+ * constraint. A dead holder therefore blocks that session's pins, each attempt
+ * reported, until the retention prune. `strict` also refuses to proceed
+ * without a guard when none can be created or the lock cannot be listed.
  *
  * Limit, named here because the lock cannot close it: a holder paused past
  * `LOCK_STALE_MS` keeps writing after a peer has superseded it. No caller here
@@ -370,8 +372,8 @@ const LOCK_SPIN_SLEEP_MS = 2;
  *
  * Returns the held generation, `null` when a live peer holds it (or a strict
  * caller could not create a guard), or `false` when a non-strict caller
- * proceeds unguarded because the companion cannot be created (a read-only
- * mount, a vanished parent): the failure mode there is a lost guard, and the
+ * proceeds unguarded because no guard can be created or listed (a read-only
+ * mount, a vanished parent, a directory it cannot read): the failure mode there is a lost guard, and the
  * alternative is a lost write. The callers below take deliberately different
  * actions on `null`, for reasons stated at each.
  */
@@ -382,6 +384,7 @@ function _acquire_lock(
   try {
     return acquire(`${lock_path}.held`, {
       staleMs: LOCK_STALE_MS,
+      breakStale: options.strict !== true,
       waitMs: options.blocking === false ? 0 : LOCK_ACQUIRE_DEADLINE_MS,
       spinMs: LOCK_SPIN_SLEEP_MS,
     });
diff --git a/tests/scripts/generation_lock_interleavings.test.ts b/tests/scripts/generation_lock_interleavings.test.ts
index 8fcf8bd512..dcc5e1df9b 100644
--- a/tests/scripts/generation_lock_interleavings.test.ts
+++ b/tests/scripts/generation_lock_interleavings.test.ts
@@ -13,12 +13,13 @@ import fs from 'node:fs';
 import os from 'node:os';
 import path from 'node:path';
 
-import { afterEach, beforeEach, describe, expect, it } from 'vitest';
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
 
 import {
     acquire,
     acquireSteps,
     companion,
+    execute,
     release,
     tryAcquire,
     type Held,
@@ -41,6 +42,9 @@ const CANDIDATE: Protocol = {
     },
 };
 
+/** A caller that never supersedes a guard that went stale while held. */
+const STRICT: Protocol = { acquire: (lp, staleMs) => acquireSteps(lp, staleMs, false, false), release: CANDIDATE.release };
+
 let dir = '';
 let lockPath = '';
 const NOW = 1_000_000;
@@ -57,7 +61,7 @@ function run([op, file]: Step): StepResult {
                 .sort((a, b) => a - b);
         case 'age': {
             const m = files.get(file);
-            return m === undefined ? null : NOW - m;
+            return m === undefined ? null : m === 0 ? Infinity : NOW - m;
         }
         case 'create':
         case 'mkdir':
@@ -244,6 +248,42 @@ describe('generation lock — single caller', () => {
     });
 });
 
+describe('generation lock — failures and options', () => {
+    it('a listing that fails throws instead of reading as no generation', () => {
+        const live = tryAcquire(lockPath, { staleMs: STALE_MS });
+        expect(live).not.toBeNull();
+        const spy = vi.spyOn(fs, 'readdirSync').mockImplementation(() => {
+            throw Object.assign(new Error('EACCES'), { code: 'EACCES' });
+        });
+        try {
+            expect(() => tryAcquire(lockPath, { staleMs: STALE_MS })).toThrow(/EACCES/);
+        } finally {
+            spy.mockRestore();
+        }
+        expect(fs.readdirSync(dir)).toEqual([path.basename(lockPath)]);
+    });
+
+    it('names that are not canonical generations are not generations', () => {
+        for (const n of ['01', '1.5', 'Infinity', '1e3', '']) fs.writeFileSync(`${lockPath}.${n}`, '');
+        expect(execute(['list', lockPath])).toEqual([]);
+    });
+
+    it('a zero spin still ends at the deadline', () => {
+        const a = tryAcquire(lockPath, { staleMs: STALE_MS });
+        expect(a).not.toBeNull();
+        expect(acquire(lockPath, { staleMs: STALE_MS, waitMs: 5, spinMs: 0 })).toBeNull();
+    });
+
+    it('breakStale false refuses a guard that went stale while held and takes a released one', () => {
+        const a = tryAcquire(lockPath, { staleMs: STALE_MS }) as Held;
+        const old = (Date.now() - 2 * STALE_MS) / 1000;
+        fs.utimesSync(lockPath, old, old);
+        expect(tryAcquire(lockPath, { staleMs: STALE_MS, breakStale: false })).toBeNull();
+        release(a);
+        expect(tryAcquire(lockPath, { staleMs: STALE_MS, breakStale: false })?.generation).toBe(1);
+    });
+});
+
 describe('the explorer catches what it must', () => {
     it('stat-then-remove admits two holders over an abandoned guard', () => {
         expect(explore(STAT_THEN_REMOVE, 'abandoned', false, 3)).not.toEqual([]);
@@ -259,6 +299,10 @@ describe('generation lock — every schedule of three callers', () => {
         expect(explore(CANDIDATE, start, false, 3)).toEqual([]);
     });
 
+    it.each(['empty', 'abandoned', 'released'] as const)('a caller that never breaks a stale guard admits no overlap at all, starting %s', (start) => {
+        expect(explore(STRICT, start, true, 3)).toEqual([]);
+    });
+
     it.each(['empty', 'abandoned', 'released'] as const)('with a paused holder, only the paused one overlaps, starting %s', (start) => {
         // A holder whose guard went stale while it held can overlap one
         // superseder: that is the lease without fencing the module names. What
diff --git a/tests/scripts/hooks/state_io.test.ts b/tests/scripts/hooks/state_io.test.ts
index 75437e2405..ea493d0d84 100644
--- a/tests/scripts/hooks/state_io.test.ts
+++ b/tests/scripts/hooks/state_io.test.ts
@@ -625,7 +625,20 @@ describe('update_text_under_lock — strict exclusion', () => {
 // with the next generation and removes the lower one afterwards, best-effort. A
 // stale guard that cannot be removed therefore no longer blocks anyone.
 describe('update_text_under_lock — a stale guard that cannot be removed', () => {
-    it.each([[true], [false]])('strict=%s: is superseded, and the write lands at once', (strict) => {
+    it('strict=true: is never superseded, so the write is refused at the deadline', () => {
+        const target = path.join(tmp, 'stuck-strict.json');
+        fs.writeFileSync(target, 'before\n');
+        const held = `${target}.lock.held`;
+        fs.writeFileSync(held, '');
+        const old = (Date.now() - 10 * 60 * 1000) / 1000;
+        fs.utimesSync(held, old, old);
+        const t = Date.now();
+        expect(update_text_under_lock(target, () => 'after\n', { strict: true })).toBe('failed');
+        expect(Date.now() - t).toBeLessThan(15_000);
+        expect(fs.readFileSync(target, 'utf8')).toBe('before\n');
+    }, 30_000);
+
+    it.each([[false]])('strict=%s: is superseded, and the write lands at once', (strict) => {
         const target = path.join(tmp, `stuck-${strict}.json`);
         fs.writeFileSync(target, 'before\n');
         const held = `${target}.lock.held`;
@@ -651,25 +664,33 @@ describe('update_text_under_lock — a stale guard that cannot be removed', () =
     }, 30_000);
 });
 
-// Breaking an abandoned guard used to let two reclaimers both acquire, so a
-// strict caller never broke one and a dead holder blocked its session's pins
-// until the retention prune. The generation lock breaks without that race, so a
-// strict caller now supersedes an abandoned guard like everyone else.
-describe('update_text_under_lock — a strict caller supersedes an abandoned guard', () => {
-    it.each([[true], [false]])('blocking=%s: the abandoned guard is superseded and the write lands', (blocking) => {
+// A strict caller never supersedes a guard that went stale while held: a
+// superseded holder that resumes would write past its successor. It does take
+// over a guard its holder released.
+describe('update_text_under_lock — a strict caller never reclaims a stale guard', () => {
+    it.each([[true], [false]])('blocking=%s: an abandoned guard is left in place and the write is refused', (blocking) => {
         const target = path.join(tmp, `abandoned-${blocking}.json`);
         fs.writeFileSync(target, 'before\n');
         const held = `${target}.lock.held`;
         fs.writeFileSync(held, 'abandoned');
         const old = (Date.now() - 10 * 60 * 1000) / 1000;
         fs.utimesSync(held, old, old);
+        const t = Date.now();
         const r = update_text_under_lock(target, () => 'after\n', { strict: true, blocking });
-        expect(r).toBe('written');
-        expect(fs.readFileSync(target, 'utf8')).toBe('after\n');
-        expect(fs.existsSync(held)).toBe(false);
+        expect(r).toBe('failed');
+        expect(Date.now() - t).toBeLessThan(15_000);
+        expect(fs.readFileSync(held, 'utf8')).toBe('abandoned');
+        expect(fs.readFileSync(target, 'utf8')).toBe('before\n');
+    }, 30_000);
+
+    it('a released guard is taken over at once', () => {
+        const target = path.join(tmp, 'released-strict.json');
+        expect(update_text_under_lock(target, () => 'one\n', { strict: true })).toBe('written');
+        expect(update_text_under_lock(target, () => 'two\n', { strict: true, blocking: false })).toBe('written');
+        expect(fs.readFileSync(target, 'utf8')).toBe('two\n');
     });
 
-    it('a non-strict caller reclaims it too', () => {
+    it('a non-strict caller still reclaims it', () => {
         const target = path.join(tmp, 'abandoned-lax.json');
         fs.writeFileSync(target, 'before\n');
         const held = `${target}.lock.held`;
```

## `state_io.ts` lock functions at `bae765dc64`

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
  if (held === false) return;
  try {
    release(held);
  } catch {
    /* ignore */
  }
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
```
