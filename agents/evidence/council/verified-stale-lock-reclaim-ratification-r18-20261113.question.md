<!-- evidence-type: analysis -->

# Ratification review — the generation lock at eight file-lock sites — round 18

You are an independent reviewer for a change in the `event4u/agent-config` repository. Two files in it are on the ratification gate's list as hook-plumbing sources: `src/scripts/_lib/generation_lock.ts` (part of the hook dispatch bundle) and `src/config/hook-bundle-budget.json` (a raised byte ceiling). ADR-268 § 4 needs a two-provider verdict: an agent may change these files but may not ratify its own change. Everything this prompt asks about is shown in it.

subject: 947c66fbf8e18abbac9d17508250923c4c5dee2304daf51a46b384356ce54b55

(The digest covers the gated files at commit `9fe72c8e4c` on branch `feat/road-to-verified-stale-lock-reclaim`, computed with `./scripts-run src/scripts/ratification_subject` over the whole changed-file list.)

## The change

Eight cross-process file locks move from stat-then-remove or rename-aside stale breaking to a shared generation lock: breaking a stale highest generation `g` creates `g+1` exclusively, only the winner removes lower generations by name, a release ages its own generation to the epoch and removes nothing, and after each create the caller backs off — releasing, never removing, its own generation — if a higher generation exists or the generation it superseded is no longer the stale one it judged. A pruner retiring a file takes each of its existing lock families like any caller (non-strict) and releases it at once: a stale holder's generation is superseded, the ones below are removed, one released generation stays; a live holder is left alone. So nothing in the protocol removes a family's highest generation, a family never empties, and its numbering never restarts. A waiting acquire gives up on the wall clock.

**The claim, scoped.** Among callers that all run this protocol, no stale-lock break, release or prune lets two callers hold a lock at once, except that a holder paused past the stale threshold — strict or not — keeps running beside the caller that superseded it (no fencing; named at every site). `breakStale: false` (state_io's `strict`) binds only the caller that passes it; a holder is safe from supersession only on a lock every caller takes strict, as on the session-pin paths (pinned by a per-call test), where only the retention prune supersedes a holder, once its session is past retention. Every read-modify-write writer refuses when it cannot take the lock. Not claimed: exclusion against a process still on the old code, and exclusion for the two writers that publish without a lock by design (`state_io`'s whole-file `_atomic_write_text`, and the CLI call budget after its 1 s wait; both documented, unchanged in policy).

## History

Rounds 1-5 refused, each finding fixed with a test; round 7 ratified; rounds 8-12 refused or split on pruner and back-off schedules that could restart numbering and on claim wording, each fixed (rounds 9 and 10's schedules are scripted tests); round 13 had one seat time out; round 15 ratified 2/2 at `97eb163a17`.

An independent completion review then ran two more rounds on the code after round 15, and the fixes change the shipped behaviour, so this round asks again over all of it:

- **A dead strict holder blocked a reused session's pins for good.** A crashed pin holder's generation is stale but not released, a strict caller never supersedes it, and the round-15 pruner kept the highest generation unchanged. The session-state pruner now takes each existing lock family of a retired file with a normal non-strict `tryAcquire` and releases it at once — a stale holder is superseded by the protocol itself, lower generations are removed by the winner, and one released generation remains; a family with no generation is not created. This replaces the round-15 "remove all but the highest by name" loop in `state_io`; the egress pruner keeps that loop. The session-pins housekeeping sweep still never removes a lock generation.
- **The council ledger lock let a filesystem error throw** through `reserve_spend`/`close_reservation`, whose callers have no try; it now refuses (`null`) as a timed-out wait does. Test: an unlistable lock directory yields `null`, not a throw.
- **The wait deadline counted sleep, not time.** Measured: `state_io`'s 5 s blocking wait took 7.2 s on an empty directory and 11.9 s beside 5,000 files (every attempt lists the directory; every sleep overshoots). `acquire` now stops at `Date.now() >= start + waitMs`. Test: a 500 ms wait beside 2,000 files ends under 600 ms (it measured 819 ms before).
- Docs: the `state_io` header names the generation family; the pin-holder claim names the retention prune.
- **Budget.** See below; both ceilings now carry a raise.

Round 16 split 1-1. One seat ratified. The other found no mutual-exclusion defect and refused on the deadline: a sleep that crossed it was followed by one more attempt. Fixed in `93aa0bbd72`: the first attempt always runs; each sleep is capped at the time left; after each sleep the deadline is checked before any further attempt. The documented guarantee is that **no attempt starts after the deadline** — an attempt already in progress may overrun it, since synchronous filesystem calls cannot be cut short. A deterministic test (a 10 ms spin against a 5 ms deadline) counts the directory listings and finds exactly one attempt; it found two before the fix. The loop costs bytes: the dispatch bundle now measures 1,595,152 B and its ceiling rises 1,595,100 → 1,595,300 B (origin/main 1,595,013 B); the chunk measures 36,017 B under a 36,150 B ceiling. Both raise-log entries are in the budget diff below.

Round 17: one seat ratified; the other timed out, so the round does not count. The ratifying seat named two documentation points, both fixed in `9fe72c8e4c` (comments and one budget sentence; no code changed): the chunk raise entry still said the dispatch bundle needed no raise — it now names the dispatch raise and its measurement; and the wait guarantee is now stated as "the deadline is checked before every retry", noting that an attempt in progress or a process suspended between the check and the attempt may overrun it, and that `Date.now()` is the clock, so a clock step moves the deadline. The helper and the budget diff below are at `9fe72c8e4c`.

## What to answer

1. Does the diff contain a defect — in the helper's protocol, in any site's use of it, in the pruners, or in the budget entry? Name file and line.
2. Does the change expand any agent's authority or weaken an existing gate? Is the ceiling raise sized to the measurement?
3. Within the scoped claim, can two callers hold any of these locks at once?

End with exactly one stance line, as the last line of your reply, in plain text: no markdown, no bold, all three fields on that one line, separated by " | ":

STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>

## Budget: measurement and entry

```
✅  hook bundle: 1595152 B / 1595300 B ceiling, 1 YAML reader(s) [yaml], 343 modules
✅  chunk src/scripts/_lib/session_pins.ts: 36017 B
6323 src/scripts/hooks/state_io.ts
total 34512
4804 src/scripts/hooks/state_io.ts
2912 src/scripts/_lib/generation_lock.ts
total 36017
```

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 5b405df712..f2e08180dd 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -7 +7 @@
-    "max_bytes": 1595100,
+    "max_bytes": 1595300,
@@ -270,0 +271,19 @@
+        },
+        {
+            "date": "2026-11-13",
+            "chunk": "src/scripts/_lib/session_pins.ts",
+            "from": 34900,
+            "to": 36150,
+            "by": "agent, feat/road-to-verified-stale-lock-reclaim (road-to-verified-stale-lock-reclaim 2.1)",
+            "what_was_added": "The generation lock (`_lib/generation_lock.ts`, 2,912 B in this chunk) behind `state_io`'s file lock, which the pin capture and restore run under. The stat-then-remove reclaim it replaces let two callers that judged one abandoned guard both acquire, and an unconditional release delete the guard of a peer that had superseded a paused holder; `tests/scripts/lock_sites_interleavings.test.ts` shows both schedules on origin/main and none after. Measured by this gate's own chunk build: 34,512 B on origin/main 24f323151a, 36,017 B with the change, +1,505 B (`state_io` itself fell from 6,323 to 4,804 B; `session_pins` itself grew 38 B, which keeps its housekeeping off lock generations).",
+            "why_it_could_not_be_avoided": "Room was made first: the step executor was rewritten to tuple steps and a single try, and the release generator dropped, taking the helper from 2,925 to 2,477 B before ratification round 1 added a listing failure that throws, canonical generation names, a floor on the spin and a strict mode that never supersedes a stale holder, round 2 a bound on the generation number, the completion review a strict refusal that does not wait, and ratification round 8 a recheck that the superseded generation is still the stale one, the completion review a wall-clock deadline, and round 16 no attempt after it (2,912 B), and the old reclaim and its sleep helper left `state_io`. What remains is the protocol itself, which every lock site now shares; a chunk cannot share it with the dispatch bundle, so the pin chunk carries its own copy. The dispatch bundle needed its own raise for the same code (1,595,152 B against 1,595,013 B on origin/main; the raise_log entry of the same date whose `to` is 1,595,300).",
+            "what_would_have_caught_it": "Nothing missed it: the gate fired on the first local reading of the change. Sized to the measurement plus 133 B."
+        },
+        {
+            "date": "2026-11-13",
+            "from": 1595100,
+            "to": 1595300,
+            "by": "agent, feat/road-to-verified-stale-lock-reclaim (road-to-verified-stale-lock-reclaim 2.1)",
+            "what_was_added": "The generation lock (`_lib/generation_lock.ts`) behind `state_io`, the language-mirror tool lock and the egress session table, replacing their stat-then-remove reclaim, which let two callers hold after a stale break or a release. Measured by this gate: 1,595,152 B with the change against 1,595,013 B on origin/main 24f323151a, +139 B; the old lock code that left `state_io` and the language mirror pays for most of the helper.",
+            "why_it_could_not_be_avoided": "The change fitted under the old ceiling until its last two review rounds: a completion review measured `state_io`'s 5 s wait at 7.2-11.9 s, which needed a wall-clock deadline, and ratification round 16 asked that no attempt start after it, which needs a capped sleep and a check after it. Room was made first: the release wrapper and the try blocks around a release that cannot throw were removed, the pruner's lock cleanup became one acquire-and-release, and the wait loop was written in its shortest form. Sized to the measurement plus 148 B.",
+            "what_would_have_caught_it": "Nothing missed it: the gate fired on the first local reading."
@@ -294 +313 @@
-            "max_bytes": 34900,
+            "max_bytes": 36150,
@@ -296 +315 @@
-            "derivation": "Measured 34,414 bytes on 2026-11-09 (an unpin that matches nothing named in the brief notice too, capture under a strict file lock that never replaces an unreadable file, eligibility computed in linear time from fence, paste and injected-region spans of the original text (attributed envelopes included, opener recognition with no attribute grammar, a lead that ends at the first line containing anything tag-like or at a host frame recognised mid-prompt, a forward-only paste-tag scanner, fences read by a prefix scan, directives that were not applied counted and reported, a directive line carrying a closing tag, an attributed opener or a bare opener closed on a later line refused, checked in linear time), lone surrogates normalised, caps, lossless per-session state that is never overwritten when it cannot be read whole, a reported restore failure, pins inert in a replay (no capture, restore, restatement or subagent read), the once-per-compaction delivery and restatement coordinated across prompt and tool order with one restore record per session changed only under the per-file lock, tried once and never waited for, each delivery adding the compaction's stamp to a set of acknowledged stamps in that lock (the most recent 512), a record that exists but cannot be read left untouched and acted on by nothing on either path, one admission rule for every compaction stamp so an oversized one is unknown and never recorded, pins read inside that transaction, the tool-call restore keyed on its own stamp and never re-delivering a delivered record, a once-a-day retention prune that keeps a live session's restore record by its pin file's activity and removes a gone session's boundary and lock files, the subagent reader, activity-based retention, restore text, and the parts of `_lib/prompt_shape` and `hooks/state_io` they import). The ceiling is that reading plus about 3 %, rounded, with no growth queued. Loaded by `language-mirror` through `hooks/session_pins_loader.ts` on a prompt carrying a `pin:` or `unpin:` line, on a prompt that owes a delivery or restatement, and on the one tool call after a compaction; a missing chunk is reported on the capture turn and on the tool-call restore, and costs the pin restore, never the language restore or the dispatch."
+            "derivation": "Measured 34,414 bytes on 2026-11-09 (an unpin that matches nothing named in the brief notice too, capture under a strict file lock that never replaces an unreadable file, eligibility computed in linear time from fence, paste and injected-region spans of the original text (attributed envelopes included, opener recognition with no attribute grammar, a lead that ends at the first line containing anything tag-like or at a host frame recognised mid-prompt, a forward-only paste-tag scanner, fences read by a prefix scan, directives that were not applied counted and reported, a directive line carrying a closing tag, an attributed opener or a bare opener closed on a later line refused, checked in linear time), lone surrogates normalised, caps, lossless per-session state that is never overwritten when it cannot be read whole, a reported restore failure, pins inert in a replay (no capture, restore, restatement or subagent read), the once-per-compaction delivery and restatement coordinated across prompt and tool order with one restore record per session changed only under the per-file lock, tried once and never waited for, each delivery adding the compaction's stamp to a set of acknowledged stamps in that lock (the most recent 512), a record that exists but cannot be read left untouched and acted on by nothing on either path, one admission rule for every compaction stamp so an oversized one is unknown and never recorded, pins read inside that transaction, the tool-call restore keyed on its own stamp and never re-delivering a delivered record, a once-a-day retention prune that keeps a live session's restore record by its pin file's activity and removes a gone session's boundary and lock files, the subagent reader, activity-based retention, restore text, and the parts of `_lib/prompt_shape` and `hooks/state_io` they import). The ceiling is that reading plus about 3 %, rounded, with no growth queued. Loaded by `language-mirror` through `hooks/session_pins_loader.ts` on a prompt carrying a `pin:` or `unpin:` line, on a prompt that owes a delivery or restatement, and on the one tool call after a compaction; a missing chunk is reported on the capture turn and on the tool-call restore, and costs the pin restore, never the language restore or the dispatch. Raised 2026-11-13 to 36,150: the generation lock behind state_io's file lock (measured 36,017 B against 34,512 B on origin/main 24f323151a), plus 133 B; the raise_log entry of that date carries the reasoning."
```

## Verification at `93aa0bbd72`

```
 ✓ |node| tests/scripts/state_io_lock_interleavings.test.ts (5 tests) 233ms
 ✓ |node| tests/scripts/session_pins.test.ts (244 tests) 3236ms
 ✓ |node| tests/scripts/language_mirror_hook.test.ts (111 tests) 3318ms
 ✓ |node| tests/scripts/hooks/state_io.test.ts (51 tests) 15353ms
 ✓ |node| tests/scripts/lock_sites_interleavings.test.ts (29 tests) 21862ms
 ✓ |node| tests/hooks/session_pins_dispatch.test.ts (7 tests) 33836ms
 ✓ |node| tests/scripts/generation_lock_interleavings.test.ts (37 tests) 44847ms
      Tests  484 passed (484)
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
 * sleep overshoots, which overran a 5 s deadline by seconds. The deadline is
 * checked before every retry (the first attempt always runs, and each sleep is
 * capped at the time left), so no retry is begun once it has passed; an
 * attempt in progress, or a process suspended between the check and the
 * attempt, may still overrun it. `Date.now()` is the clock, so a clock step
 * moves the deadline with it.
 * A create that fails for any reason but `EEXIST` throws: whether to proceed
 * unguarded or refuse is the caller's decision.
 */
export function acquire(lockPath: string, options: AcquireOptions & { breakStale?: true }): Held | null;
export function acquire(lockPath: string, options: AcquireOptions): Held | null | false;
export function acquire(lockPath: string, options: AcquireOptions): Held | null | false {
    const end = Date.now() + (options.waitMs ?? 0);
    let held = tryAcquire(lockPath, options);
    for (let left = end - Date.now(); held === null && left > 0; left = end - Date.now()) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.min(left, options.spinMs ?? 5));
        if (Date.now() < end) held = tryAcquire(lockPath, options);
    }
    return held;
}

/** The release protocol, one step: age the caller's own generation to the epoch; remove nothing. Never throws. */
export function release(held: Held): void {
    execute(['expire', companion(held.lockPath, held.generation)]);
}
```

## `src/scripts/hooks/state_io.ts`: the lock, the whole-file writer, the read-modify-write lock lines, the pruner's lock handling (doc comments omitted)

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
394:      breakStale: options.strict !== true,
444:  const held = _acquire_lock(_lock_path(path.dirname(target)));
452:    if (held) release(held);
791:          if (held) release(held);
995:    held = _acquire_lock(_target_lock_path(targetPath), { blocking: options.blocking ?? true, strict: options.strict === true });
1002:  if (!held) return "failed";
1019:    release(held);
1040:    held = _acquire_lock(_target_lock_path(targetPath), { blocking: options.blocking ?? true });
1050:  if (!held) return "failed";
1070:    release(held);
      // The pruner takes the lock like any caller and releases it at once: a
      // stale holder's generation is superseded, the ones below it removed,
      // and one released generation stays, one empty file per retired lock.
      // Removing the highest would restart the numbering under a caller still
      // holding an old listing, and judging it stale before removing it is the
      // stat-then-remove race this lock replaced; a dead holder left in place
      // would block a strict caller of that session for good. A live holder
      // keeps its lock, and a lock that has no generation is left uncreated.
      for (const lock of [`${full}.lock`, `${full}.lock.held`]) {
        try {
          const held = (execute(["list", lock]) as number[]).length > 0 && tryAcquire(lock, { staleMs: LOCK_STALE_MS, now: () => now_ms });
          if (held) release(held);
        } catch {
          /* never a reason to fail a prune */
        }
      }
```

## The other pruners

```ts
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

## The other seven sites (`git diff -U0 origin/main...93aa0bbd72 -- src`, helper, budget, `state_io` and `session_pins` excluded)

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
index 08c286b589..0a9dc30ac8 100644
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
@@ -647,20 +649,9 @@ function _withLedgerLock<T>(p: string, waitMs: number, fn: () => T): T | null {
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
+    let held;
+    try {
+        held = acquire(`${p}.lock`, { staleMs: RESERVATION_LOCK_STALE_MS, waitMs, spinMs: 15 });
+    } catch {
+        // A lock that cannot be created or listed is a refusal too, never a throw.
+        held = null;
+    }
+    if (held === null) {
+        return null;
@@ -671,6 +662 @@ function _withLedgerLock<T>(p: string, waitMs: number, fn: () => T): T | null {
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
