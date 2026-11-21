<!-- evidence-type: analysis -->

# Ratification review — the session goal record and two hook-bundle ceiling raises — round 4

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it is on the ratification gate's list as a hook-plumbing source: `src/config/hook-bundle-budget.json` (two raised byte ceilings). ADR-268 § 4 needs a two-provider verdict: an agent may change this file but may not ratify its own change. Everything this prompt asks about is shown in it. Your reply must end with the stance line described under "What to answer"; a reply without it cannot be counted, and three earlier replies from one seat were lost that way.

subject: a93776d887dc65ba38107808b297c496cb2f5fd4380d11ae4e6c2b5529e6e830

(The digest covers the gated files at commit `8221bfff07` on branch `feat/mandates-scoped-to-the-goal`, computed with `./scripts-run src/scripts/ratification_subject --files src/config/hook-bundle-budget.json`; the gate's own classifier lists that file as the only gated surface of the diff against `origin/main`.)

## The change

The owner often states an end state once ("mach weiter bis zum merge", "until merged") and the agent then re-asks before each step that serves it. This change records that sentence and repeats it:

- `src/scripts/_lib/goal_phrases.ts` — a narrow, deterministic DE + EN phrase set over the owner's own prose only. No model is asked (council decision D4, 2026-11-21).
- `src/scripts/_lib/goal_mandate.ts` — the recorder, on the existing `session-register` `user_prompt_submit` beat (no new hook concern, decision D3).
- `src/scripts/_lib/goal_mandate_store.ts` — the store reader and the one rendered line. Store: `<git-common-dir>/agent-session-mandates/<session>.json`.
- `src/scripts/hooks/subagent_constraints_hook.ts` — a subagent receives the parent session's unrevoked goal line ahead of its pins.
- `src/scripts/_lib/session_pr_watch.ts` — `default_pr_target`: when exactly one tracked PR of the session is open, the existing PR block names it as the default target for PR commands.

**What the line grants.** Nothing on its own (decision D5, council 2026-11-21). The rendered text says: "What each step may do without a fresh go-ahead is still decided by commit-policy as written; Hard-Floor reach: per blocker goal-scope-hard-floor-reach." Whether a recorded goal may stand in for this-turn confirmation of a push or merge is an open owner-reserved blocker; this change does not decide it and edits no kernel rule (decision D1). The output is a `warn` decision the dispatcher turns into a host-facing exit 0.

## History

Rounds 1-3: one seat returned `confirmed-non-expanding` each time (round 3: confidence high, no dealbreaker). The other gave no stance line each time and argued against the revision; every point it raised was fixed with a test or answered. Round 3's points and what was done with each (commit `8221bfff07`, each new test seen failing first):

(a) **Read-compare-write was not atomic** (a goal beat could read, a stop write its marker, then the goal beat overwrite it). Fixed: the read, the stamp comparison and the write now run under the repository's existing generation lock (`_lib/generation_lock.ts`, already in the dispatch bundle via `state_io`) at `<record>.lock`, `staleMs` 5 s, `waitMs` 250 ms. A beat that finds the lock held writes nothing. A store where no lock can be created at all (an unwritable directory) blocks a goal write but lets a revocation go ahead unguarded: ending a goal is the direction that cannot widen what an agent does. Test: with the lock held by another caller a `stop` writes nothing; after release it revokes.
(b) **T1 stop, T3 stop, T2 goal** accepted the T2 goal, because a second stop did not advance the marker. Fixed: every newer stop rewrites the marker with its own `revoked_at`. Test: exactly that sequence leaves no goal line and `revoked_at` = T3.
(c) **The deletion fallback discards the ordering stamp.** Answered, and now stated in the code comment: removal is the last resort after the atomic write and an in-place overwrite both failed, i.e. the file cannot be written at all; removing it ends the goal for every reader, and the stamp goes with it. A record that can be neither overwritten nor removed stays as it was.
(d) **Equal timestamps.** Stated in the code: on equal stamps the beat that writes last wins; with the lock, the beats are serialized.
(e) **Negated goal phrases** ("Don't keep working until merged.") armed a record. Fixed: a goal line carrying a negation (`nicht`, `kein…`, `nie`, `niemals`, `never`, `not`, `don't`) arms nothing; a goal missed this way costs one re-ask. Tests: three negated forms, DE and EN, record nothing.
(f) **The comment over `write_revocation` promised more than the fallbacks guarantee.** Fixed: it now names the residual.
(g) **PR commands verifying the target.** The default is advisory context; the PR commands that read it (`fix/pr-comments`, `fix/pr-comments-loop`, `prepare-for-review`) name the target they use in one line before acting, and the block says `state unverified` after a failed probe.
(h) **Declarative mentions** ("The docs say to keep working until merged.") still arm a record. Unchanged, for the reason given in round 3: telling a reported instruction from a given one is not decidable by a phrase set, D4 chose a deterministic set so agent text can never populate the record, and the line is shown verbatim on every turn and grants nothing.

**The budget after the fixes.** Dispatch bundle 1,602,398 B (ceiling raised from 1,595,300 to 1,602,700, +302 B margin); subagent chunk 31,354 B (ceiling raised from 28,500 to 31,500, 146 B margin). The `raise_log` entries name the reading before round 1 and the final one.

## What to answer

1. Does the diff contain a defect — in the recognizer, the store, the lock use, the hook glue, or the budget entries? Name file and line.
2. Does the change expand any agent's authority or weaken an existing gate? Are the two ceiling raises sized to the measurement and justified?
3. Were the round-3 points (a)–(h) resolved or answered adequately?

End with exactly one stance line, as the last line of your reply, in plain text: no markdown, no bold, all three fields on that one line, separated by " | ":

STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>

## Budget: measurement

```
✅  hook bundle: 1602398 B / 1602700 B ceiling, 1 YAML reader(s) [yaml], 346 modules
✅  chunk src/scripts/hooks/subagent_constraints_hook.ts: 31354 B
```

## Tests added after round 3

```diff
diff --git a/tests/scripts/goal_mandate.test.ts b/tests/scripts/goal_mandate.test.ts
index 941c89b717..e50856d8f7 100644
--- a/tests/scripts/goal_mandate.test.ts
+++ b/tests/scripts/goal_mandate.test.ts
@@ -9,6 +9,7 @@ import * as path from 'node:path';
 
 import { afterEach, beforeEach, describe, expect, it } from 'vitest';
 
+import { release, tryAcquire } from '../../src/scripts/_lib/generation_lock.js';
 import { goal_mandate_block, observe_prompt } from '../../src/scripts/_lib/goal_mandate.js';
 import { goal_mandate_line, read_goal } from '../../src/scripts/_lib/goal_mandate_store.js';
 
@@ -76,6 +77,41 @@ describe('observe_prompt — goal sentences', () => {
         expect(read_goal(root, 's1')?.sentence).toBe('until merged');
     });
 
+    // Ratification round 3: every newer stop advances the marker.
+    it('a goal older than the latest of two stops is dropped (T1 stop, T3 stop, T2 goal)', () => {
+        const T2 = new Date('2026-11-21T11:00:00Z');
+        const T3 = new Date('2026-11-21T12:00:00Z');
+        observe_prompt(root, 's1', 'stop', T1);
+        observe_prompt(root, 's1', 'halt', T3);
+        observe_prompt(root, 's1', 'mach weiter bis zum merge', T2);
+        expect(goal_mandate_line(read_goal(root, 's1'))).toBeNull();
+        expect(read_goal(root, 's1')?.revoked_at).toBe(T3.toISOString());
+    });
+
+    // Ratification round 3: the read-compare-write runs under the record's lock.
+    it('writes nothing while another writer holds the record lock', () => {
+        observe_prompt(root, 's1', 'until merged', T0);
+        const held = tryAcquire(path.join(root, '.git', 'agent-session-mandates', 's1.json.lock'), { staleMs: 60_000 });
+        expect(held).not.toBeNull();
+        try {
+            observe_prompt(root, 's1', 'stop', T1);
+            expect(read_goal(root, 's1')?.revoked_by).toBeUndefined();
+        } finally {
+            if (held) release(held);
+        }
+        observe_prompt(root, 's1', 'stop', T1);
+        expect(read_goal(root, 's1')?.revoked_by).toBe('stop');
+    });
+
+    // Ratification round 3: a negated goal phrase is not a goal.
+    it.each(["Don't keep working until merged.", 'arbeite nicht bis zum merge', 'never go all the way to merge'])(
+        'records nothing for the negated %j',
+        (prompt) => {
+            observe_prompt(root, 's1', prompt, T0);
+            expect(read_goal(root, 's1')).toBeNull();
+        },
+    );
+
     it('a leading stop above a long paste still revokes', () => {
         observe_prompt(root, 's1', 'mach weiter bis zum merge', T0);
         observe_prompt(root, 's1', `stop\n\n${'log line\n'.repeat(400)}`, T1);
```

## Full diff of the bundled sources and the budget file against origin/main

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index f2e08180dd..886a61bcda 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1595300,
+    "max_bytes": 1602700,
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
+            "to": 1602700,
+            "by": "agent, feat/mandates-scoped-to-the-goal (road-to-mandates-scoped-to-the-goal 1.2 and 2.3)",
+            "what_was_added": "The session goal record on the `session-register` user_prompt_submit beat: the DE + EN goal and revoke phrase set with its owner-prose filter (`_lib/goal_phrases.ts`, 1,960 B in this bundle), the recorder (`_lib/goal_mandate.ts`, 1,275 B), the store reader and the rendered line (`_lib/goal_mandate_store.ts`, 1,349 B), the hook glue that joins the goal block with the PR block, and `default_pr_target` with its block line in `_lib/session_pr_watch.ts`. Measured by this gate at 1,600,725 B against the 1,595,300 ceiling (per-file figures from one esbuild metafile of the same flags), then 1,602,398 B after ratification rounds 1 to 3 asked for a collision-free store stem, an escaped rendering of the sentence, a mention filter on the goal side, a revocation that overwrites or removes the record when its atomic write fails (a record that can be neither stays as it was), a revocation marker on an empty store advanced by every newer stop, a drop of writes older than the stored record, the record read-compare-write under the existing generation lock, a negation filter on the goal side, and an unverified mark on a default PR target read from a failed probe.",
+            "why_it_could_not_be_avoided": "The goal sentence has to be recorded on the prompt that carries it, and decision D3 of the roadmap reuses `session-register` rather than adding a concern, so the recognizer runs in-bundle. Room was made where it could be: the read side was split into `goal_mandate_store.ts` so the subagent chunk does not carry the phrase set or the session register, and the store stem is a local three-line function instead of an import of `_lib/session_register.ts`. Recognition is deterministic code by council decision D4, so it cannot move into the model. Sized to the final measurement plus 302 B.",
+            "what_would_have_caught_it": "Nothing earlier: the gate fired on the first mirror run of the branch."
+        },
+        {
+            "date": "2026-11-21",
+            "chunk": "src/scripts/hooks/subagent_constraints_hook.ts",
+            "from": 28500,
+            "to": 31500,
+            "by": "agent, feat/mandates-scoped-to-the-goal (road-to-mandates-scoped-to-the-goal 2.4)",
+            "what_was_added": "The parent session's goal line handed to every subagent ahead of its pins: `goal_mandate_for_subagent` and the store reader of `_lib/goal_mandate_store.ts`, which brings `_lib/git_common_dir.ts` into this chunk. Measured 31,117 B by this gate against the 28,500 ceiling, then 31,354 B after ratification rounds 1 and 2 (the collision-free, case-folded store stem and the escaped rendering).",
+            "why_it_could_not_be_avoided": "A subagent starts without the turn the goal was typed in, and this chunk is the only carrier on claude `subagent_start`. The reader was split from the recognizer first, which took the phrase set and the session register out of the chunk (31,718 B before the split). The store sits under the shared repository metadata directory like the session PR store (decision D2), so every worktree of the repository reads one record, and resolving that directory is what the added helper does. Sized to the first measurement plus about 1 %, which leaves 146 B over the final one.",
+            "what_would_have_caught_it": "Nothing earlier: the growth is the feature."
         }
     ],
     "chunks": [
@@ -346,7 +365,7 @@
         },
         {
             "entry": "src/scripts/hooks/subagent_constraints_hook.ts",
-            "max_bytes": 28500,
+            "max_bytes": 31500,
             "registered_at": "2026-10-24",
             "derivation": "Measured 23,843 bytes on 2026-10-24 (the concern with the user layer of road-to-a-cold-start-paid-once D16, the shared `_lib/rule_law_section` law-extent reader, and the hook stdin reader; `yaml` external as for `chat_history`). The ceiling is that reading plus about 3 %, rounded, with no growth queued; the 2026-10-24 raise from 12,500 is the matching `raise_log` entry. road-to-a-tick-the-shipped-path-earns 2.4 under decision A9 (council, 2026-10-23): the constraint carrier ships as a lazy chunk with its own ceiling, and the dispatch ceiling is not raised. Its LAZY_CONCERNS row measured +159 bytes in the dispatch bundle (1,553,363 to 1,553,522 B, same gate run on the base and with the row), under the existing 1,554,000 ceiling, so no loader stub raise was needed. Bound on claude `subagent_start` alone; a missing chunk falls back to the spawn path and costs latency, never the digest."
         },
diff --git a/src/scripts/_lib/goal_mandate.ts b/src/scripts/_lib/goal_mandate.ts
new file mode 100644
index 0000000000..6230d2b16f
--- /dev/null
+++ b/src/scripts/_lib/goal_mandate.ts
@@ -0,0 +1,108 @@
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
+ *   concern), atomic writes under the record's generation lock.
+ * - **Lifetime:** a later goal sentence replaces the record; a revoke sentence
+ *   keeps it with `revoked_by` set, and a revoked record renders nothing.
+ * - **Failure:** never throws; an unreadable store reads as no record.
+ */
+
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+
+import { write_atomic } from './fs_atomic.js';
+import { acquire, release, type Held } from './generation_lock.js';
+import { goal_mandate_line, goal_store_file, read_goal, type GoalRecord } from './goal_mandate_store.js';
+import { goalSentenceIn, revocationIn } from './goal_phrases.js';
+
+function write_goal(root: string, session_id: string, record: GoalRecord): void {
+    const file = goal_store_file(root, session_id);
+    if (file === null) return;
+    fs.mkdirSync(path.dirname(file), { recursive: true });
+    write_atomic(file, `${JSON.stringify(record, null, 2)}\n`);
+}
+
+/**
+ * Write a revocation: the atomic write, else an in-place overwrite (a directory
+ * that refuses a new file may still allow it), else removing the record. A
+ * record that can be neither overwritten nor removed stays as it was; a removed
+ * one takes its ordering stamp with it.
+ */
+function write_revocation(root: string, session_id: string, record: GoalRecord): void {
+    try {
+        write_goal(root, session_id, record);
+        return;
+    } catch {
+        /* fall through */
+    }
+    const file = goal_store_file(root, session_id);
+    if (file === null) return;
+    try {
+        fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
+    } catch {
+        fs.rmSync(file, { force: true });
+    }
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
+        // The read-compare-write runs under the record's lock, so two beats of one
+        // session cannot interleave; a beat that finds it held writes nothing. A
+        // lock that cannot be created at all (an unwritable store) blocks a goal
+        // but not a revocation, which then goes ahead unguarded: ending a goal is
+        // the direction that cannot widen what an agent does.
+        fs.mkdirSync(path.dirname(file), { recursive: true });
+        let unlockable = false;
+        try {
+            held = acquire(`${file}.lock`, { staleMs: 5_000, waitMs: 250 });
+        } catch {
+            unlockable = true;
+        }
+        const current = read_goal(root, session_id);
+        if (!held && !(unlockable && revoke !== null)) return current;
+        // A prompt older than the stored stamp lost a race with a later one (beats
+        // of one session are not guaranteed to finish in submission order); the
+        // later owner turn stands. Equal stamps: the beat that writes last wins.
+        const stored = current === null ? Number.NEGATIVE_INFINITY : Date.parse(current.revoked_at ?? current.recorded_at);
+        if (now.getTime() < stored) return current;
+        const at = now.toISOString();
+        if (revoke !== null) {
+            // Written on an empty store too, and advanced by every newer stop, so a
+            // goal from a prompt older than the latest stop is dropped above.
+            const revoked: GoalRecord = { ...(current ?? { sentence: '', recorded_at: at }), revoked_by: revoke, revoked_at: at };
+            write_revocation(root, session_id, revoked);
+            return revoked;
+        }
+        const record: GoalRecord = { sentence: goal as string, recorded_at: at };
+        write_goal(root, session_id, record);
+        return record;
+    } catch {
+        return null;
+    } finally {
+        if (held) release(held);
+    }
+}
+
+/** Observe the prompt, then render the live record as a block; null when no goal stands. */
+export function goal_mandate_block(root: string, session_id: string, prompt: string, now: Date = new Date()): string | null {
+    const line = goal_mandate_line(observe_prompt(root, session_id, prompt, now));
+    return line === null ? null : `<session-goal>\n${line}\n</session-goal>`;
+}
diff --git a/src/scripts/_lib/goal_mandate_store.ts b/src/scripts/_lib/goal_mandate_store.ts
new file mode 100644
index 0000000000..914fd033fe
--- /dev/null
+++ b/src/scripts/_lib/goal_mandate_store.ts
@@ -0,0 +1,75 @@
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
+
+export interface GoalRecord {
+    /** The owner's prose line carrying the goal phrase, verbatim. */
+    sentence: string;
+    recorded_at: string;
+    /** The owner's revoke line, verbatim; absent while the goal stands. */
+    revoked_by?: string;
+    revoked_at?: string;
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
+export function read_goal(root: string, session_id: string): GoalRecord | null {
+    try {
+        const file = goal_store_file(root, session_id);
+        if (file === null) return null;
+        const o = JSON.parse(fs.readFileSync(file, 'utf-8')) as Partial<GoalRecord>;
+        if (typeof o.sentence !== 'string' || typeof o.recorded_at !== 'string') return null;
+        return o as GoalRecord;
+    } catch {
+        return null;
+    }
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
index 0000000000..93477cf706
--- /dev/null
+++ b/src/scripts/_lib/goal_phrases.ts
@@ -0,0 +1,131 @@
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
+/** Owner sentences that end a recorded goal. */
+export const REVOKE_PATTERNS: readonly RegExp[] = [
+    /^\s*(?:stop|stopp|halt)\s*(?:[.!,;:]|$)/i,
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
+    // A question or a negated line ("don't keep working until merged") is not a
+    // goal; a goal missed this way costs one re-ask.
+    if (line.endsWith('?') || /\b(?:nicht|kein\w*|nie|niemals|never|not)\b|\bdon['’]?t\b/i.test(line)) return null;
+    return line.replace(/"[^"]*"|“[^”]*”|„[^“”]*[“”]|`[^`]*`/g, ' ');
+}
+
+function proseMatches(text: string, patterns: readonly RegExp[], asInstruction: boolean): string | null {
+    // The paste cap binds the goal side only: a `stop` above a long paste is
+    // still the owner's revocation.
+    if (isSyntheticTurn(text) || (asInstruction && text.length > MAX_GOAL_PROMPT_CHARS)) return null;
+    for (const line of ownerProseLines(text)) {
+        const trimmed = line.trim();
+        if (trimmed.length > MAX_GOAL_LINE_CHARS) continue;
+        const probe = asInstruction ? instructionText(trimmed) : trimmed;
+        if (probe !== null && patterns.some((re) => re.test(probe))) return trimmed;
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
index 6db001f9c5..2722e1c4b4 100644
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
@@ -193,6 +204,12 @@ export function pr_watch_block(
             ...lines,
             'State them from this block, or run `gh pr view <n>` first — never from memory.',
             'A merged PR waits for nobody.',
+            ...(target === null
+                ? []
+                : [
+                      `Default PR target for PR commands: #${target.number} ${target.url}` +
+                          (store.probe_failed ? ` (state unverified — run \`gh pr view ${target.number}\` first)` : ''),
+                  ]),
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
index c68b4f4c11..cf5c263ef7 100644
--- a/src/scripts/session_register_hook.ts
+++ b/src/scripts/session_register_hook.ts
@@ -70,6 +70,7 @@ import {
     ttl_seconds_for,
     write_record,
 } from './_lib/session_register.js';
+import { goal_mandate_block } from './_lib/goal_mandate.js';
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
+                const goal = goal_mandate_block(root, session_id, typeof prompt === 'string' ? prompt : '', new Date());
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
