<!-- evidence-type: analysis -->

# Ratification review — the session goal record and two hook-bundle ceiling raises — round 18

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it is on the ratification gate's list as a hook-plumbing source: `src/config/hook-bundle-budget.json` (two raised byte ceilings). ADR-268 § 4 needs a two-provider verdict: an agent may change this file but may not ratify its own change. Everything this prompt asks about is shown in it.

**Your reply must end with the stance line described under "What to answer".** If you would send the revision back, write `refused` on that line. Name any residual you would track as a follow-up rather than block on.

subject: 8bec2f933665fdca28450d7625ee82603f9bf8521852484b42c88a3274e4e7dd

(The digest covers the gated files at commit `d1ebe3a23b` on branch `feat/mandates-scoped-to-the-goal`, computed with `./scripts-run src/scripts/ratification_subject --files src/config/hook-bundle-budget.json`; the gate's own classifier lists that file as the only gated surface of the diff against `origin/main`.)

## The change

The owner often states an end state once ("mach weiter bis zum merge", "until merged") and the agent then re-asks before each step that serves it. This change records that sentence and repeats it:

- `src/scripts/_lib/goal_phrases.ts` — a narrow, deterministic DE + EN phrase set over the owner's own prose only. No model is asked (council decision D4, 2026-11-21).
- `src/scripts/_lib/goal_mandate.ts` — the recorder, on the existing `session-register` `user_prompt_submit` beat (no new hook concern, decision D3).
- `src/scripts/_lib/goal_mandate_store.ts` — the store reader and the one rendered line. Store: `<git-common-dir>/agent-session-mandates/<session>.json`, stop files and a stop slot beside it, and a user-level stop fallback.
- `src/scripts/hooks/subagent_constraints_hook.ts` — a subagent receives the parent session's unrevoked goal line ahead of its pins.
- `src/scripts/_lib/session_pr_watch.ts` — `default_pr_target`: when exactly one tracked PR of the session is open and the last read succeeded, the existing PR block names it as the default target for PR commands.

**What the line grants.** Nothing on its own (decision D5, council 2026-11-21). The rendered text says: "What each step may do without a fresh go-ahead is still decided by commit-policy as written; Hard-Floor reach: per blocker goal-scope-hard-floor-reach." Whether a recorded goal may stand in for this-turn confirmation of a push or merge is an open owner-reserved blocker; this change does not decide it and edits no kernel rule (decision D1). The output is a `warn` decision the dispatcher turns into a host-facing exit 0.

## History

Rounds 1-16: one seat returned `confirmed-non-expanding` or `ratified` in every round but 16; the other named one landing blocker per round from round 7, each fixed with a test. Round 17: one seat `ratified` (confidence high, no dealbreaker); the other `refused`, confirmed round-16 blocker A (prune failure) resolved, and named one remaining defect in blocker B's fix:

**Round 17 blocker — the 60-second cutoff in `beat_time()` recreated the ordering bug.** A goal hook stalled past a minute fell back to the current time and could stamp itself after a later stop. What was done (commit `d1ebe3a23b`, the new unit test seen failing first against the cutoff): the cutoff is removed; `beat_time()` returns the process start (`performance.timeOrigin`) unconditionally. The session-register beat runs in the dispatcher process the host spawns for each hook event (in-process concern; there is no daemon), so the process start is per beat whatever the stall. Tests: a unit test with `Date.now` mocked two minutes past process start still returns the process start. The end-to-end race test was strengthened as asked: a stalled control goal hook (same 4-second injected stall, no racing stop) exits 2 and records its goal, which shows the stalled path reaches the recorder; the raced goal hook, under the identical stall, exits 0 having been dropped as older than the stop, and the store holds the stop with no live goal for either renderer.

**Tracked follow-ups, not changed here:** the opener heuristic still admits a mention that opens with a request word ("Okay, the checklist mentions working until merged."); deterministic revocation will have phrasings it misses, and the goal line — shown verbatim on every turn, granting nothing — is what makes a missed one visible.

**The budget after the fixes.** Dispatch bundle 1,605,934 B (ceiling raised from 1,595,300 to 1,606,550, 616 B margin); subagent chunk 33,617 B (ceiling raised from 28,500 to 34,000, 383 B margin). The `raise_log` entries name the reading before round 1 and the final one.

## What to answer

1. Does the diff contain a defect that must block landing — in the recognizer, the store, the stop files, slot or user-level fallback, the stamp, the lock use, the hook glue, or the budget entries? Name file and line.
2. Does the change expand any agent's authority or weaken an existing gate? Are the two ceiling raises sized to the measurement and justified?
3. Is the round-17 blocker resolved?

End with exactly one stance line, as the last line of your reply, in plain text: no markdown, no bold, all three fields on that one line, separated by " | ":

STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>

## Budget: measurement

```
✅  hook bundle: 1605934 B / 1606550 B ceiling, 1 YAML reader(s) [yaml], 346 modules
✅  chunk src/scripts/hooks/subagent_constraints_hook.ts: 33617 B
```

## Tests changed after round 17

```diff
diff --git a/tests/scripts/goal_mandate.test.ts b/tests/scripts/goal_mandate.test.ts
index d126ef33a3..a666bfafed 100644
--- a/tests/scripts/goal_mandate.test.ts
+++ b/tests/scripts/goal_mandate.test.ts
@@ -8,7 +8,7 @@ import * as os from 'node:os';
 import * as path from 'node:path';
 import { pathToFileURL } from 'node:url';
 
-import { afterEach, beforeEach, describe, expect, it } from 'vitest';
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
 
 import { release, tryAcquire } from '../../src/scripts/_lib/generation_lock.js';
 import { beat_time, goal_mandate_block, observe_prompt, write_stop } from '../../src/scripts/_lib/goal_mandate.js';
@@ -494,10 +494,16 @@ describe('session-register user_prompt_submit beat — the hook carries the goal
         expect(next.additional_context).toContain('"mach weiter bis zum merge"');
     }, 120_000);
 
-    it('beat_time is the process start for a fresh process and the current time for an old one', () => {
+    // Round 17: no age cutoff — a beat that stalls past any threshold keeps the
+    // process start as its stamp.
+    it('beat_time is the process start however long the process has run', () => {
         const origin = Math.trunc(performance.timeOrigin);
-        expect(beat_time(origin + 1_000).getTime()).toBe(origin);
-        expect(beat_time(origin + 120_000).getTime()).toBe(origin + 120_000);
+        const now = vi.spyOn(Date, 'now').mockReturnValue(origin + 120_000);
+        try {
+            expect(beat_time().getTime()).toBe(origin);
+        } finally {
+            now.mockRestore();
+        }
     });
 
     // Ratification round 16: the stamp is when the hook process started, not when
@@ -506,23 +512,35 @@ describe('session-register user_prompt_submit beat — the hook carries the goal
     it('a goal hook that stalls after starting loses to a later stop that finishes first', async () => {
         const stall = path.join(root, 'stall.mjs');
         fs.writeFileSync(stall, 'const end = Date.now() + 4000; while (Date.now() < end) {}\n');
-        const envelope = (prompt: string) =>
-            JSON.stringify({ event: 'user_prompt_submit', workspace_root: root, session_id: 'hook-goal-race', platform: 'claude', payload: { cwd: root, prompt } });
-        const goalDone = new Promise<void>((resolve) => {
-            // One node process (no tsx launcher child), so the stall runs after the
-            // process started and before the hook code reaches the recorder.
-            const loader = pathToFileURL(path.join(repo, 'node_modules', 'tsx', 'dist', 'loader.mjs')).href;
-            const child = spawn(process.execPath, ['--import', loader, '--import', pathToFileURL(stall).href, hook], {
-                env,
-                stdio: ['pipe', 'ignore', 'ignore'],
+        const loader = pathToFileURL(path.join(repo, 'node_modules', 'tsx', 'dist', 'loader.mjs')).href;
+        const envelope = (session: string, prompt: string) =>
+            JSON.stringify({ event: 'user_prompt_submit', workspace_root: root, session_id: session, platform: 'claude', payload: { cwd: root, prompt } });
+        // One node process (no tsx launcher child), so the stall runs after the
+        // process started and before the hook code reaches the recorder.
+        const stalledGoal = (session: string) =>
+            new Promise<number | null>((resolve) => {
+                const child = spawn(process.execPath, ['--import', loader, '--import', pathToFileURL(stall).href, hook], {
+                    env,
+                    stdio: ['pipe', 'ignore', 'ignore'],
+                });
+                child.on('exit', (code) => resolve(code));
+                child.stdin.end(envelope(session, 'mach weiter bis zum merge'));
             });
-            child.on('exit', () => resolve());
-            child.stdin.end(envelope('mach weiter bis zum merge'));
-        });
+        // Control: the stalled hook runs to the recorder and records the goal (exit 2
+        // = it emitted the goal block), so the race below is not a hook that failed early.
+        const control = stalledGoal('hook-goal-control');
+        const raced = stalledGoal('hook-goal-race');
         await new Promise((r) => setTimeout(r, 500));
-        const stop = spawnSync(tsx, [hook], { input: envelope('stop'), encoding: 'utf8', env, timeout: 60_000 });
-        expect(stop.status).not.toBeNull();
-        await goalDone;
-        expect(goal_mandate_line(read_goal(root, 'hook-goal-race'))).toBeNull();
+        const stop = spawnSync(tsx, [hook], { input: envelope('hook-goal-race', 'stop'), encoding: 'utf8', env, timeout: 60_000 });
+        expect(stop.status === 0 || stop.status === 2).toBe(true);
+        expect(await control).toBe(2);
+        expect(read_goal(root, 'hook-goal-control')?.sentence).toBe('mach weiter bis zum merge');
+        // The raced goal ran the same path and was dropped as older than the stop:
+        // it emitted no goal block, and the store holds the stop, no live goal.
+        expect(await raced).toBe(0);
+        const rec = read_goal(root, 'hook-goal-race');
+        expect(rec?.revoked_by).toBe('stop');
+        expect(goal_mandate_line(rec)).toBeNull();
+        expect(goal_mandate_for_subagent(root, 'hook-goal-race')).toBeNull();
     }, 120_000);
 });
```

## Full diff of the bundled sources and the budget file against origin/main

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index f2e08180dd..b645033025 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1595300,
+    "max_bytes": 1606550,
     "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the `raise_log` entry whose `to` is 1,550,500, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
     "shrink_only": true,
     "shrink_only_note": "A RAISE needs a recorded reason in `raise_log` below naming what was added and why it could not be avoided. Enforced since road-to-a-ratification-fence-that-follows-its-imports 3.2: the gate reads `max_bytes` at the base revision, and a working value above it fails unless `raise_log` gained an entry whose `to` equals the new value. A lowering needs no entry. This file is also on the ratification gate's watched set, so a raise carries a record as well as a log entry.",
@@ -287,6 +287,25 @@
             "what_was_added": "The generation lock (`_lib/generation_lock.ts`) behind `state_io`, the language-mirror tool lock and the egress session table, replacing their stat-then-remove reclaim, which let two callers hold after a stale break or a release. Measured by this gate: 1,595,152 B with the change against 1,595,013 B on origin/main 24f323151a, +139 B; the old lock code that left `state_io` and the language mirror pays for most of the helper.",
             "why_it_could_not_be_avoided": "The change fitted under the old ceiling until its last two review rounds: a completion review measured `state_io`'s 5 s wait at 7.2-11.9 s, which needed a wall-clock deadline, and ratification round 16 asked that no attempt start after it, which needs a capped sleep and a check after it. Room was made first: the release wrapper and the try blocks around a release that cannot throw were removed, the pruner's lock cleanup became one acquire-and-release, and the wait loop was written in its shortest form. Sized to the measurement plus 148 B.",
             "what_would_have_caught_it": "Nothing missed it: the gate fired on the first local reading."
+        },
+        {
+            "date": "2026-11-21",
+            "from": 1595300,
+            "to": 1606550,
+            "by": "agent, feat/mandates-scoped-to-the-goal (road-to-mandates-scoped-to-the-goal 1.2 and 2.3)",
+            "what_was_added": "The session goal record on the `session-register` user_prompt_submit beat: the DE + EN goal and revoke phrase set with its owner-prose filter (`_lib/goal_phrases.ts`, 1,960 B in this bundle), the recorder (`_lib/goal_mandate.ts`, 1,275 B), the store reader and the rendered line (`_lib/goal_mandate_store.ts`, 1,349 B), the hook glue that joins the goal block with the PR block, and `default_pr_target` with its block line in `_lib/session_pr_watch.ts`. Measured by this gate at 1,600,725 B against the 1,595,300 ceiling (per-file figures from one esbuild metafile of the same flags), then 1,605,934 B after ratification rounds 1 to 17 asked for a collision-free store stem, an escaped rendering of the sentence, a mention filter on the goal side, stops kept as files of their own that no goal write can overwrite and that suppress every goal at or before them (falling back to one appended line in a stop slot created with the first goal, when the store refuses a new file, then to a file under the user-level state root both readers consult, and saying so on the turn when none can be written; a stop creates the store directory itself, so a failure there still reaches the fallbacks, and a failed prune of older stops never reports a saved stop as unsaved), a drop of writes older than the stored record (each beat stamped with the time its hook process started, not when its code reached the recorder), goal writes under the existing generation lock (a stop wins a tie, and the goal turn renders a fresh read after its write), a direct-request rule on the goal side (a goal line opens with the goal phrase or a request word, and carries no negation or reporting verb), broader revoke phrases (a line opening with stop, halt, cancel, abort or pause, after an optional polite or interjected lead-in; stop, cancel or abort with an object anywhere; 'hör auf', 'aufhören', 'abbrechen'; a stop line of any length, kept to 300 characters), a reader that suppresses the goal when the stop state cannot be read, and no default PR target without a successful read.",
+            "why_it_could_not_be_avoided": "The goal sentence has to be recorded on the prompt that carries it, and decision D3 of the roadmap reuses `session-register` rather than adding a concern, so the recognizer runs in-bundle. Room was made where it could be: the read side was split into `goal_mandate_store.ts` so the subagent chunk does not carry the phrase set or the session register, and the store stem is a local three-line function instead of an import of `_lib/session_register.ts`. Recognition is deterministic code by council decision D4, so it cannot move into the model. Sized to the round-16 measurement plus 513 B, which leaves 616 B over the final one: round 9 noted that a margin of about 300 B is below the few hundred bytes an esbuild symbol rename can move the reading by, which the derivation above names, so the margin follows the 2026-11-02 raise (516 B).",
+            "what_would_have_caught_it": "Nothing earlier: the gate fired on the first mirror run of the branch."
+        },
+        {
+            "date": "2026-11-21",
+            "chunk": "src/scripts/hooks/subagent_constraints_hook.ts",
+            "from": 28500,
+            "to": 34000,
+            "by": "agent, feat/mandates-scoped-to-the-goal (road-to-mandates-scoped-to-the-goal 2.4)",
+            "what_was_added": "The parent session's goal line handed to every subagent ahead of its pins: `goal_mandate_for_subagent` and the store reader of `_lib/goal_mandate_store.ts`, which brings `_lib/git_common_dir.ts` into this chunk. Measured 31,117 B by this gate against the 28,500 ceiling, then 33,617 B after ratification rounds 1 to 10 (the collision-free, case-folded store stem, the escaped rendering, and the reader that folds the latest stop file, the stop slot and the user-level stop fallback into the record and fails closed when it cannot read them; the fallback path comes from `_lib/user_global_paths.ts` `event4u_root`).",
+            "why_it_could_not_be_avoided": "A subagent starts without the turn the goal was typed in, and this chunk is the only carrier on claude `subagent_start`. The reader was split from the recognizer first, which took the phrase set and the session register out of the chunk (31,718 B before the split). The store sits under the shared repository metadata directory like the session PR store (decision D2), so every worktree of the repository reads one record, and resolving that directory is what the added helper does. Sized to the final measurement plus 383 B.",
+            "what_would_have_caught_it": "Nothing earlier: the growth is the feature."
         }
     ],
     "chunks": [
@@ -346,7 +365,7 @@
         },
         {
             "entry": "src/scripts/hooks/subagent_constraints_hook.ts",
-            "max_bytes": 28500,
+            "max_bytes": 34000,
             "registered_at": "2026-10-24",
             "derivation": "Measured 23,843 bytes on 2026-10-24 (the concern with the user layer of road-to-a-cold-start-paid-once D16, the shared `_lib/rule_law_section` law-extent reader, and the hook stdin reader; `yaml` external as for `chat_history`). The ceiling is that reading plus about 3 %, rounded, with no growth queued; the 2026-10-24 raise from 12,500 is the matching `raise_log` entry. road-to-a-tick-the-shipped-path-earns 2.4 under decision A9 (council, 2026-10-23): the constraint carrier ships as a lazy chunk with its own ceiling, and the dispatch ceiling is not raised. Its LAZY_CONCERNS row measured +159 bytes in the dispatch bundle (1,553,363 to 1,553,522 B, same gate run on the base and with the row), under the existing 1,554,000 ceiling, so no loader stub raise was needed. Bound on claude `subagent_start` alone; a missing chunk falls back to the spawn path and costs latency, never the digest."
         },
diff --git a/src/scripts/_lib/goal_mandate.ts b/src/scripts/_lib/goal_mandate.ts
new file mode 100644
index 0000000000..7895a7840b
--- /dev/null
+++ b/src/scripts/_lib/goal_mandate.ts
@@ -0,0 +1,151 @@
+/**
+ * The owner's goal sentence for this session — "bis zum merge", "until merged" —
+ * recorded verbatim the moment it is typed and carried into every later prompt
+ * and every subagent start.
+ *
+ * A goal the owner named in turn 3 used to be invisible by turn 30 and absent
+ * from every subagent, so the owner typed the same order again for each PR. The
+ * record makes the owner's own words visible; it does not decide what they
+ * authorise. That stays with `commit-policy` and the Hard Floor as written: the
+ * council ruled on 2026-11-21 that reading the record as a standing instruction
+ * needs the kernel text first.
+ *
+ * - **Recognition:** {@link goalSentenceIn} / {@link revocationIn} over the
+ *   owner's prose only; no model, so agent text can never populate the record.
+ * - **Store:** `goal_mandate_store.ts`; one writer (the `session-register`
+ *   concern); goal writes are atomic under the record's generation lock, stops
+ *   are files of their own beside it.
+ * - **Lifetime:** a later goal sentence replaces the record; a stop suppresses
+ *   every goal at or before its stamp, and a revoked record renders nothing.
+ * - **Failure:** never throws; an unreadable store reads as no record.
+ */
+
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+
+import { write_atomic } from './fs_atomic.js';
+import { acquire, release, type Held } from './generation_lock.js';
+import { goal_mandate_line, goal_store_file, read_goal, stop_fallback_file, type GoalRecord } from './goal_mandate_store.js';
+import { goalSentenceIn, revocationIn } from './goal_phrases.js';
+
+function write_goal(root: string, session_id: string, record: GoalRecord): void {
+    const file = goal_store_file(root, session_id);
+    if (file === null) return;
+    fs.mkdirSync(path.dirname(file), { recursive: true });
+    write_atomic(file, `${JSON.stringify(record, null, 2)}\n`);
+    // The stop slot exists from the first goal on, so a later stop can be appended
+    // to it even where the store refuses new files. `a` never truncates.
+    fs.writeFileSync(`${file}.stop`, '', { flag: 'a' });
+}
+
+/**
+ * Store a stop as a file of its own beside the record, named by its stamp, so
+ * no goal write can overwrite it and concurrent stops keep the latest; lower
+ * stops are then pruned. A store that refuses the new file takes the stop in the
+ * slot `<record>.stop`, one appended line per stop; no goal write touches either.
+ * A store that refuses the slot too appends to the user-level fallback both
+ * readers consult. Throws when none can be written.
+ */
+export function write_stop(file: string, revoke: string, now: Date): void {
+    const stamp = String(now.getTime()).padStart(13, '0');
+    const prefix = `${path.basename(file)}.stop-`;
+    const own = `${prefix}${stamp}`;
+    try {
+        fs.mkdirSync(path.dirname(file), { recursive: true });
+        fs.writeFileSync(path.join(path.dirname(file), own), revoke);
+    } catch {
+        // One append per stop, never an overwrite, so a paused older stop cannot
+        // erase a newer one; `a` adds no directory entry to an existing slot.
+        const line = `${stamp} ${revoke.replace(/\n/g, ' ')}\n`;
+        try {
+            fs.writeFileSync(`${file}.stop`, line, { flag: 'a' });
+        } catch {
+            const fallback = stop_fallback_file(file);
+            fs.mkdirSync(path.dirname(fallback), { recursive: true });
+            fs.writeFileSync(fallback, line, { flag: 'a' });
+        }
+        return;
+    }
+    // The stop is saved; pruning is housekeeping and never turns it into a failure.
+    try {
+        for (const n of fs.readdirSync(path.dirname(file))) {
+            if (n.startsWith(prefix) && n < own) fs.rmSync(path.join(path.dirname(file), n), { force: true });
+        }
+    } catch {
+        /* older stops stay; the latest still wins */
+    }
+}
+
+/**
+ * The beat's stamp: when this hook process started — the host spawns one per
+ * submitted prompt and the dispatcher runs `session-register` in-process — not
+ * when its code reached the recorder, so a beat that stalls after starting, for
+ * however long, keeps its place in the owner's order.
+ */
+export function beat_time(): Date {
+    return new Date(performance.timeOrigin);
+}
+
+/** Record a goal or a revocation from one owner prompt; return the record after it. Never throws. */
+export function observe_prompt(root: string, session_id: string, prompt: string, now: Date = new Date()): GoalRecord | null {
+    let held: Held | null | false = null;
+    try {
+        const revoke = revocationIn(prompt);
+        const goal = revoke === null ? goalSentenceIn(prompt) : null;
+        const file = goal_store_file(root, session_id);
+        if ((revoke === null && goal === null) || file === null) return read_goal(root, session_id);
+        // A goal write is a read-compare-write and runs under the record's lock, so
+        // two goal beats of one session cannot interleave; one that cannot take the
+        // lock writes nothing. A stop takes no lock: it is its own file, which a
+        // goal write cannot overwrite, and readers suppress every goal at or before
+        // the latest stop, so a goal writer that read before a stop and writes
+        // after it is suppressed too.
+        // The store directory is created on the goal path only; a stop creates it
+        // inside `write_stop`, so a failure there still reaches its fallbacks.
+        if (revoke === null) {
+            fs.mkdirSync(path.dirname(file), { recursive: true });
+            try {
+                held = acquire(`${file}.lock`, { staleMs: 5_000, waitMs: 250 });
+            } catch {
+                held = null;
+            }
+        }
+        const current = read_goal(root, session_id);
+        if (revoke === null && !held) return current;
+        // A prompt older than the stored stamp lost a race with a later one (beats
+        // of one session are not guaranteed to finish in submission order); the
+        // later owner turn stands. On equal stamps a stop wins over a goal.
+        const stored = current === null ? Number.NEGATIVE_INFINITY : Date.parse(current.revoked_at ?? current.recorded_at);
+        if (now.getTime() < stored) return current;
+        if (now.getTime() === stored && revoke === null && current?.revoked_by !== undefined) return current;
+        const at = now.toISOString();
+        if (revoke !== null) {
+            const revoked: GoalRecord = { ...(current ?? { sentence: '', recorded_at: at }), revoked_by: revoke, revoked_at: at };
+            try {
+                write_stop(file, revoke, now);
+            } catch {
+                return { ...revoked, unsaved: true };
+            }
+            return revoked;
+        }
+        write_goal(root, session_id, { sentence: goal as string, recorded_at: at });
+        // Render what a fresh read shows, so a stop saved between the read above
+        // and this write wins on this turn too, not only on the next one.
+        return read_goal(root, session_id);
+    } catch {
+        return null;
+    } finally {
+        if (held) release(held);
+    }
+}
+
+/** Observe the prompt, then render the live record as a block; null when no goal stands. */
+export function goal_mandate_block(root: string, session_id: string, prompt: string, now: Date = new Date()): string | null {
+    const record = observe_prompt(root, session_id, prompt, now);
+    if (record?.unsaved === true) {
+        const said = JSON.stringify(record.revoked_by).replace(/</g, '\\u003c');
+        return `<session-goal>\nThe owner's stop ${said} could not be saved anywhere, so later turns and subagents may still show the earlier goal: treat it as revoked for the rest of this session, and tell subagents so.\n</session-goal>`;
+    }
+    const line = goal_mandate_line(record);
+    return line === null ? null : `<session-goal>\n${line}\n</session-goal>`;
+}
diff --git a/src/scripts/_lib/goal_mandate_store.ts b/src/scripts/_lib/goal_mandate_store.ts
new file mode 100644
index 0000000000..b14d74d358
--- /dev/null
+++ b/src/scripts/_lib/goal_mandate_store.ts
@@ -0,0 +1,131 @@
+/**
+ * The read side of the session goal record — store path, reader and the rendered
+ * line — kept apart from the recognizer in `goal_mandate.ts` so the
+ * subagent-start chunk, which only reads, does not carry the phrase set or the
+ * session register.
+ *
+ * Store: `<git-common-dir>/agent-session-mandates/<session>.json`, shared by every
+ * worktree of the repository, one file per session.
+ */
+
+import { createHash } from 'node:crypto';
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+
+import { git_common_dir } from './git_common_dir.js';
+import { event4u_root } from './user_global_paths.js';
+
+export interface GoalRecord {
+    /** The owner's prose line carrying the goal phrase, verbatim. */
+    sentence: string;
+    recorded_at: string;
+    /** The owner's revoke line, verbatim; absent while the goal stands. */
+    revoked_by?: string;
+    revoked_at?: string;
+    /** Set on the turn a stop could be saved nowhere; never stored. */
+    unsaved?: boolean;
+}
+
+/**
+ * A session id reduced to a file stem that cannot leave the store directory. An
+ * id that is not already a lowercase stem gets a digest of the original
+ * appended, so two ids that reduce alike (`ses:a`, `ses_a`) or differ only in
+ * case on a case-insensitive filesystem never share a record.
+ */
+function stem(session_id: string): string {
+    const s = session_id.toLowerCase().replace(/[^a-z0-9._-]/g, '_').replace(/\.\./g, '_').slice(0, 128);
+    if (s === session_id && /[a-z0-9]/.test(s)) return s;
+    return `${s}~${createHash('sha256').update(session_id).digest('hex').slice(0, 16)}`;
+}
+
+export function goal_store_file(root: string, session_id: string): string | null {
+    if (session_id === '') return null;
+    const common = git_common_dir(root);
+    return common === null ? null : path.join(common, 'agent-session-mandates', `${stem(session_id)}.json`);
+}
+
+/**
+ * Where a stop goes when the repository store refuses it entirely: the package's
+ * user-level state root, keyed by the record path. Not the temp dir, whose root
+ * can differ between the hook that writes and the one that reads.
+ */
+export function stop_fallback_file(file: string): string {
+    return path.join(event4u_root(), 'session-mandates', `${createHash('sha256').update(file).digest('hex').slice(0, 32)}.stop`);
+}
+
+/**
+ * The latest stop beside a record: stops are files of their own,
+ * `<record>.stop-<13-digit epoch ms>` holding the owner's revoke line, so a goal
+ * write can never overwrite one and the latest is the highest name.
+ */
+export function latest_stop(file: string): { at: number; by: string } | null {
+    const dir = path.dirname(file);
+    const prefix = `${path.basename(file)}.stop-`;
+    let best: string | null = null;
+    for (const n of fs.readdirSync(dir)) {
+        if (n.startsWith(prefix) && /^\d{13}$/.test(n.slice(prefix.length)) && (best === null || n > best)) best = n;
+    }
+    let found = best === null ? null : { at: Number(best.slice(prefix.length)), by: fs.readFileSync(path.join(dir, best), 'utf-8') };
+    // The stop slot `<record>.stop`: created empty with the first goal; a stop appends one
+    // line to it when the store refuses a new file. No goal write touches it. Last,
+    // the user-level fallback for a store that refuses the slot too.
+    for (const lines of [`${file}.stop`, stop_fallback_file(file)]) {
+        let text = '';
+        try {
+            text = fs.readFileSync(lines, 'utf-8');
+        } catch (e) {
+            if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
+        }
+        for (const m of text.matchAll(/^(\d{13}) (.*)$/gm)) {
+            if (found === null || Number(m[1]) > found.at) found = { at: Number(m[1]), by: m[2] as string };
+        }
+    }
+    return found;
+}
+
+/** The record with the latest stop folded in: a goal at or before it reads as revoked. */
+export function read_goal(root: string, session_id: string): GoalRecord | null {
+    const file = goal_store_file(root, session_id);
+    if (file === null) return null;
+    let rec: GoalRecord | null = null;
+    try {
+        const o = JSON.parse(fs.readFileSync(file, 'utf-8')) as Partial<GoalRecord>;
+        if (typeof o.sentence === 'string' && typeof o.recorded_at === 'string') rec = o as GoalRecord;
+    } catch {
+        /* no record */
+    }
+    let stop: { at: number; by: string } | null;
+    try {
+        stop = latest_stop(file);
+    } catch {
+        // Stop state that cannot be read (a stop pruned between listing and
+        // reading, an unreadable entry) suppresses the goal: fail closed.
+        return rec === null ? null : { ...rec, revoked_by: '', revoked_at: rec.recorded_at };
+    }
+    if (stop === null) return rec;
+    const at = new Date(stop.at).toISOString();
+    if (rec === null) return { sentence: '', recorded_at: at, revoked_by: stop.by, revoked_at: at };
+    if (Date.parse(rec.recorded_at) > stop.at || Date.parse(rec.revoked_at ?? '') >= stop.at) return rec;
+    return { ...rec, revoked_by: stop.by, revoked_at: at };
+}
+
+/** The one line a later prompt or a subagent sees; null when no goal stands. */
+export function goal_mandate_line(record: GoalRecord | null): string | null {
+    if (record === null || record.revoked_by !== undefined) return null;
+    const when = `${record.recorded_at.slice(0, 10)} ${record.recorded_at.slice(11, 16)} UTC`;
+    // A JSON string literal with `<` escaped: the sentence can close neither its
+    // quote nor the `<session-goal>` block it is shown in.
+    const quoted = JSON.stringify(record.sentence).replace(/</g, '\\u003c');
+    return (
+        `Owner goal, recorded ${when} from the owner's own words: ${quoted}. ` +
+        'Work that serves it: commits, PR open/update, follow-up fix PRs, CI waits, cleanup. ' +
+        'What each step may do without a fresh go-ahead is still decided by commit-policy as written; ' +
+        'Hard-Floor reach: per blocker goal-scope-hard-floor-reach.'
+    );
+}
+
+/** The parent session's live goal for a subagent start, or null. */
+export function goal_mandate_for_subagent(root: string, session_id: string): string | null {
+    const line = goal_mandate_line(read_goal(root, session_id));
+    return line === null ? null : `<session-goal>\nThe session that started you carries this goal. ${line}\n</session-goal>`;
+}
diff --git a/src/scripts/_lib/goal_phrases.ts b/src/scripts/_lib/goal_phrases.ts
new file mode 100644
index 0000000000..395c931e82
--- /dev/null
+++ b/src/scripts/_lib/goal_phrases.ts
@@ -0,0 +1,145 @@
+/**
+ * The phrase set that recognises an owner goal sentence — an end state the owner
+ * named ("bis zum merge", "until merged") — and the sentences that revoke one.
+ *
+ * Deterministic on purpose: the record this feeds is a grant span, and agent
+ * text may never populate one, so recognition runs in code over the owner's own
+ * prompt and never asks a model. A paraphrase the set misses is a missed record,
+ * which costs one re-ask; a phrase the set matches wrongly arms a mandate, so the
+ * set stays narrow and the recorded sentence is shown verbatim on every turn.
+ *
+ * Shared by the transcript counter and the session hook, so the baseline and the
+ * live recognizer can never disagree about what a goal sentence is.
+ */
+
+import { humanAuthoredLead, isSyntheticPrompt, stripInjectedRegions } from './prompt_shape.js';
+
+/** Owner end-state phrases, DE and EN. */
+export const GOAL_PATTERNS: readonly RegExp[] = [
+    /\bbis\s+zum\s+merge\b/i,
+    /\bbis\s+(?:es\s+|alles\s+)?gemerged\b/i,
+    /\bmach\w*\s+(?:(?:den|einen|die)\s+)?PRs?\s+und\s+merge/i,
+    /\barbeite\s+(?:die|das|den)\s+(?:\S+\s+)?roadmaps?\s+ab\b/i,
+    /\buntil\s+(?:it\s+is\s+|it'?s\s+)?merged\b/i,
+    /\b(?:open|create|make)\s+(?:a|the)\s+PR\s+and\s+merge\b/i,
+    /\b(?:through|all\s+the\s+way)\s+to\s+(?:the\s+)?merge\b/i,
+];
+
+/** The words a direct goal request may open with, DE and EN. */
+const REQUEST_OPENER =
+    /^(?:ok(?:ay)?|ja|yes|bitte|please|dann|then|und|and|jetzt|now|so|also|mach\w*|arbeite\w*|zieh\w*|weiter|los|go|keep|work|continue|carry|open|create|make|push|take|run|do|finish|bring)\b/i;
+
+/** Owner sentences that end a recorded goal. */
+export const REVOKE_PATTERNS: readonly RegExp[] = [
+    // Broad on purpose: an over-matching revocation costs one re-ask.
+    /^\s*(?:(?:please|bitte|ok(?:ay)?|so|now|jetzt|dann|then|and|und|ja|yes|no|nein|hey|wait|warte)\b[\s,.!:;-]*)*(?:stop|stopp|halt|cancel|abort|pause)\b/i,
+    /\b(?:stop|stopp|cancel|abort)\s+(?:working|work|it|this|that|the|now|here|everything|alles|damit)\b/i,
+    /\bh(?:ö|oe)r\s+auf\b|\baufh(?:ö|oe)ren\b|\babbrechen\b/i,
+    /\bnicht\s+mergen\b/i,
+    /\bkein(?:en)?\s+merge\b/i,
+    /\b(?:don'?t|do\s+not)\s+merge\b/i,
+];
+
+/**
+ * Harness-written user-role turns beyond the ones `isSyntheticPrompt` knows: a
+ * slash-command expansion and its echo frames. A goal phrase inside one (a
+ * command body that says "bis zum merge") is the command's text, not the owner's.
+ */
+const SYNTHETIC_PREFIXES: readonly string[] = [
+    '<command-name>',
+    '<command-message>',
+    '<command-args>',
+    '<local-command-',
+    '<user-prompt-submit-hook>',
+    '[Request interrupted',
+    'Caveat:',
+    'This session is being continued from a previous conversation',
+];
+
+/** Above this length a prompt is a paste with a remark, not a goal sentence. */
+export const MAX_GOAL_PROMPT_CHARS = 1500;
+
+/**
+ * Above this length a line is prose about something else that happens to carry
+ * the phrase. It also bounds the per-prompt line under the session-register
+ * concern's registered byte budget, so a long line is skipped, never truncated.
+ */
+export const MAX_GOAL_LINE_CHARS = 300;
+
+export function isSyntheticTurn(text: string): boolean {
+    const head = text.trimStart();
+    return isSyntheticPrompt(text) || SYNTHETIC_PREFIXES.some((p) => head.startsWith(p));
+}
+
+/**
+ * The owner's own prose lines: the human-authored lead (host regions stripped,
+ * cut at the first pasted document), without fenced blocks, quoted lines and
+ * indented lines — pasted material such as logs, tool output or a quoted chat.
+ */
+export function ownerProseLines(text: string): string[] {
+    const out: string[] = [];
+    let inFence = false;
+    for (const line of humanAuthoredLead(stripInjectedRegions(text)).split('\n')) {
+        if (/^\s*(?:```|~~~)/.test(line)) {
+            inFence = !inFence;
+            continue;
+        }
+        if (inFence) continue;
+        if (/^\s*>/.test(line)) continue;
+        if (/^(?: {4}|\t)/.test(line)) continue;
+        if (line.trim() === '') continue;
+        out.push(line);
+    }
+    return out;
+}
+
+/**
+ * A goal line read as an instruction, not a mention: a question or a negated
+ * line is dropped, and quoted or backticked spans are removed before matching. Only the goal side
+ * filters — a revocation that over-matches ends a goal and costs a re-ask, the
+ * safe direction, so revocations match on the whole line.
+ */
+function instructionText(line: string): string | null {
+    // A question, a negated line ("don't keep working until merged") or reported
+    // speech ("the docs say …") is not the owner's request; a goal missed this
+    // way costs one re-ask.
+    if (line.endsWith('?')) return null;
+    if (/\b(?:nicht|kein\w*|nie|niemals|never|not|says?|said|sagt|sagte|schreibt|schrieb|meint|meinte|wrote|writes|according)\b|\bdon['’]?t\b/i.test(line)) return null;
+    const probe = line.replace(/"[^"]*"|“[^”]*”|„[^“”]*[“”]|`[^`]*`/g, ' ').replace(/^[^A-Za-zÄÖÜäöü]+/, '');
+    // A direct request opens with the goal phrase itself or a request word; a
+    // mention opens with its subject ("the checklist mentions …").
+    return GOAL_PATTERNS.some((re) => probe.search(re) === 0) || REQUEST_OPENER.test(probe) ? probe : null;
+}
+
+function proseMatches(text: string, patterns: readonly RegExp[], asInstruction: boolean): string | null {
+    // The paste cap binds the goal side only: a `stop` above a long paste is
+    // still the owner's revocation.
+    if (isSyntheticTurn(text) || (asInstruction && text.length > MAX_GOAL_PROMPT_CHARS)) return null;
+    for (const line of ownerProseLines(text)) {
+        const trimmed = line.trim();
+        // The line cap binds the goal side only; a long stop line still revokes
+        // and is kept to the cap's length.
+        if (asInstruction && trimmed.length > MAX_GOAL_LINE_CHARS) continue;
+        const probe = asInstruction ? instructionText(trimmed) : trimmed;
+        if (probe !== null && patterns.some((re) => re.test(probe))) return trimmed.slice(0, MAX_GOAL_LINE_CHARS);
+    }
+    return null;
+}
+
+/** The owner prose line carrying a goal phrase as an instruction, or null. */
+export function goalSentenceIn(text: string): string | null {
+    return proseMatches(text, GOAL_PATTERNS, true);
+}
+
+/** The owner prose line revoking a goal, or null. */
+export function revocationIn(text: string): string | null {
+    return proseMatches(text, REVOKE_PATTERNS, false);
+}
+
+export function isGoalSentence(text: string): boolean {
+    return goalSentenceIn(text) !== null;
+}
+
+export function isRevocation(text: string): boolean {
+    return revocationIn(text) !== null;
+}
diff --git a/src/scripts/_lib/session_pr_watch.ts b/src/scripts/_lib/session_pr_watch.ts
index 6db001f9c5..9688c584d7 100644
--- a/src/scripts/_lib/session_pr_watch.ts
+++ b/src/scripts/_lib/session_pr_watch.ts
@@ -149,6 +149,16 @@ export const gh_probe: PrProbe = (cwd, numbers) => {
     }
 };
 
+/**
+ * The PR a PR command takes when it was given no URL: the session's one OPEN
+ * PR. Two open PRs, or none, yield null — choosing between them is a guess the
+ * command must not make, and a merged PR is no longer a target.
+ */
+export function default_pr_target(store: PrStore): TrackedPr | null {
+    const open = store.prs.filter((p) => p.state === 'OPEN');
+    return open.length === 1 ? (open[0] as TrackedPr) : null;
+}
+
 function hhmm(iso: string): string {
     return iso.slice(11, 16);
 }
@@ -186,6 +196,7 @@ export function pr_watch_block(
             const when = p.state === 'MERGED' && p.merged_at ? ` at ${p.merged_at}` : '';
             return `- #${p.number} ${p.state}${when}${change}`;
         });
+        const target = default_pr_target(store);
         const asOf = store.probed_at === undefined ? 'never read' : `read ${hhmm(store.probed_at)} UTC`;
         const block = [
             '<session-prs>',
@@ -193,6 +204,8 @@ export function pr_watch_block(
             ...lines,
             'State them from this block, or run `gh pr view <n>` first — never from memory.',
             'A merged PR waits for nobody.',
+            // No default from a failed read: the cached state may name a PR that is no longer open.
+            ...(target === null || store.probe_failed || store.probed_at === undefined ? [] : [`Default PR target for PR commands: #${target.number} ${target.url}`]),
             '</session-prs>',
         ].join('\n');
         // Every change is in the block just rendered; keep only what can still change.
diff --git a/src/scripts/hooks/subagent_constraints_hook.ts b/src/scripts/hooks/subagent_constraints_hook.ts
index 5fee4169ff..fcffee1570 100644
--- a/src/scripts/hooks/subagent_constraints_hook.ts
+++ b/src/scripts/hooks/subagent_constraints_hook.ts
@@ -34,8 +34,9 @@
  * a plain id (a plugin's `plugin:agent`, a path) is not looked up.
  *
  * Every subagent, whatever its definition, also receives the parent session's
- * pins (`_lib/session_pins.ts`) ahead of the digest; a session without pins
- * changes nothing here.
+ * pins (`_lib/session_pins.ts`) and its unrevoked goal sentence
+ * (`_lib/goal_mandate_store.ts`) ahead of the digest; a session with neither changes
+ * nothing here.
  *
  * Ships in its own chunk (decision A9), `yaml` external like `chat_history`'s:
  * the dispatch bundle carries only its `LAZY_CONCERNS` row. Kill switch: `AGENT_CONFIG_SUBAGENT_CONSTRAINTS=off`.
@@ -47,6 +48,7 @@ import { fileURLToPath, pathToFileURL } from 'node:url';
 
 import { parse as parseYaml } from 'yaml';
 
+import { goal_mandate_for_subagent } from '../_lib/goal_mandate_store.js';
 import { lawSections, ruleBody } from '../_lib/rule_law_section.js';
 import { pinsDisabled, pinsForSubagent } from '../_lib/session_pins.js';
 import { EXIT_ALLOW, EXIT_WARN } from './exit_codes.js';
@@ -515,7 +517,11 @@ export function digestFor(envelope: unknown, env: NodeJS.ProcessEnv = process.en
         str(envelope, 'workspace_root', 'project_root') ?? str(payload, 'cwd') ?? env['CLAUDE_PROJECT_DIR'] ?? process.cwd();
     const configDir = env['CLAUDE_CONFIG_DIR'] || path.join(os.homedir(), '.claude');
     const sessionId = str(envelope, 'session_id') ?? str(payload, 'session_id');
-    const pins = pinsDisabled(env) || sessionId === null ? '' : subagentPinsText(pinsForSubagent(projectDir, sessionId));
+    const pinText = pinsDisabled(env) || sessionId === null ? '' : subagentPinsText(pinsForSubagent(projectDir, sessionId));
+    // The parent's goal sentence rides with its pins: both are the owner's own
+    // words for this session, and a subagent starts without the turn they were typed in.
+    const goal = sessionId === null ? null : goal_mandate_for_subagent(projectDir, sessionId);
+    const pins = [goal ?? '', pinText].filter((t) => t !== '').join('\n\n');
     if (!definitionSkipsInstructions(projectDir, agentType, configDir)) return pins === '' ? null : pins;
     if (pins === '') return instructionDigest(projectDir, EMISSION_MAX_BYTES, configDir);
     // Pins go first: they are the user's own words for this session, and the
diff --git a/src/scripts/session_register_hook.ts b/src/scripts/session_register_hook.ts
index c68b4f4c11..16e4394a2c 100644
--- a/src/scripts/session_register_hook.ts
+++ b/src/scripts/session_register_hook.ts
@@ -70,6 +70,7 @@ import {
     ttl_seconds_for,
     write_record,
 } from './_lib/session_register.js';
+import { beat_time, goal_mandate_block } from './_lib/goal_mandate.js';
 import { pr_watch_block } from './_lib/session_pr_watch.js';
 import { pruneAgedRefusalState, readSessionCounts } from './_lib/turn_end_refusals.js';
 import { readHookStdin } from './hooks/hook_stdin.js';
@@ -931,11 +932,20 @@ export function main(): number {
                 // The live state of PRs this session opened. `warn` is the one
                 // decision whose context reaches the model on this slot; the
                 // dispatcher turns it into a host-facing exit 0, so it never blocks.
+                // The owner's goal sentence rides the same beat: recorded from this
+                // prompt when it names an end state, repeated on every later one.
+                const prompt =
+                    payload !== null && typeof payload === 'object' && !Array.isArray(payload)
+                        ? (payload as Record<string, unknown>)['prompt']
+                        : null;
+                const goal = goal_mandate_block(root, session_id, typeof prompt === 'string' ? prompt : '', beat_time());
                 const prs = pr_watch_block(root, session_id, new Date());
-                if (prs !== null) {
-                    process.stdout.write(
-                        JSON.stringify({ decision: 'warn', reason: 'session PR state', additional_context: prs }) + '\n',
-                    );
+                const context = [goal, prs].filter((b): b is string => b !== null).join('\n\n');
+                if (context !== '') {
+                    const reason = [goal !== null ? 'session goal' : null, prs !== null ? 'session PR state' : null]
+                        .filter((r): r is string => r !== null)
+                        .join(', ');
+                    process.stdout.write(JSON.stringify({ decision: 'warn', reason, additional_context: context }) + '\n');
                     return 2;
                 }
             }
```

## Reminder

Your reply ends with the one stance line: STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>
