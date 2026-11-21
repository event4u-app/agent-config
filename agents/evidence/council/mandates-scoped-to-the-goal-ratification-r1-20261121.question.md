<!-- evidence-type: analysis -->

# Ratification review — the session goal record and two hook-bundle ceiling raises — round 1

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it is on the ratification gate's list as a hook-plumbing source: `src/config/hook-bundle-budget.json` (two raised byte ceilings). ADR-268 § 4 needs a two-provider verdict: an agent may change this file but may not ratify its own change. Everything this prompt asks about is shown in it.

subject: 8b7f212d33bd8024b2fb33f118a040c70b309c3806e7f3b093dd6a1321983a43

(The digest covers the gated files at commit `764ebae305` on branch `feat/mandates-scoped-to-the-goal`, computed with `./scripts-run src/scripts/ratification_subject --files src/config/hook-bundle-budget.json`; the gate's own classifier lists that file as the only gated surface of the diff against `origin/main`.)

## The change

The owner often states an end state once ("mach weiter bis zum merge", "until merged") and the agent then re-asks before each step that serves it. This change records that sentence and repeats it:

- `src/scripts/_lib/goal_phrases.ts` — a narrow, deterministic DE + EN phrase set over the owner's own prose only (host frames, slash-command expansions, pastes over 1,500 characters and lines over 300 characters are skipped). No model is asked, so agent text can never populate the record (council decision D4, 2026-11-21).
- `src/scripts/_lib/goal_mandate.ts` — the recorder, run on the existing `session-register` `user_prompt_submit` beat (no new hook concern, decision D3). A later goal sentence replaces the record; a revoke sentence ("stop", "nicht mergen", "don't merge") keeps it with `revoked_by` set, and a revoked record renders nothing.
- `src/scripts/_lib/goal_mandate_store.ts` — the store reader and the one rendered line, split out so the subagent chunk carries only the read side. Store: `<git-common-dir>/agent-session-mandates/<session>.json`, one file per session, one writer, atomic writes, never throws.
- `src/scripts/hooks/subagent_constraints_hook.ts` — a subagent receives the parent session's unrevoked goal line ahead of its pins.
- `src/scripts/_lib/session_pr_watch.ts` — `default_pr_target`: when exactly one tracked PR of the session is open, the existing PR block names it as the default target for PR commands.

**What the line grants.** Nothing on its own (decision D5, council 2026-11-21). The rendered text says: "What each step may do without a fresh go-ahead is still decided by commit-policy as written; Hard-Floor reach: per blocker goal-scope-hard-floor-reach." The Hard-Floor question (whether a recorded goal may stand in for this-turn confirmation of a push or merge) is an open owner-reserved blocker; this change does not decide it and edits no kernel rule (decision D1). The output is a `warn` decision whose context the dispatcher turns into a host-facing exit 0, so it never blocks.

**The budget.** The dispatch bundle grows from the 1,595,300 B ceiling to a measured 1,600,725 B (ceiling raised to 1,601,000, +275 B margin); the subagent chunk from the 28,500 B ceiling to a measured 31,117 B (ceiling 31,500, about 1 % margin). Each raise carries a `raise_log` entry naming what was added, why it could not be avoided and what was done to shrink it first (the read side was split from the recognizer, which took the chunk from 31,718 B to 31,117 B; the store stem is a local function instead of an import of the session register).

## What to answer

1. Does the diff contain a defect — in the recognizer, the store, the hook glue, or the budget entries? Name file and line.
2. Does the change expand any agent's authority or weaken an existing gate? Are the two ceiling raises sized to the measurement and justified?
3. Can agent-written text, a pasted transcript or a slash-command body arm a goal record?

End with exactly one stance line, as the last line of your reply, in plain text: no markdown, no bold, all three fields on that one line, separated by " | ":

STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>

## Budget: measurement

```
✅  hook bundle: 1600725 B / 1601000 B ceiling, 1 YAML reader(s) [yaml], 346 modules
✅  chunk src/scripts/hooks/subagent_constraints_hook.ts: 31117 B
```

## Full diff of the bundled sources and the budget file against origin/main

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index f2e08180dd..26a52f7414 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1595300,
+    "max_bytes": 1601000,
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
+            "to": 1601000,
+            "by": "agent, feat/mandates-scoped-to-the-goal (road-to-mandates-scoped-to-the-goal 1.2 and 2.3)",
+            "what_was_added": "The session goal record on the `session-register` user_prompt_submit beat: the DE + EN goal and revoke phrase set with its owner-prose filter (`_lib/goal_phrases.ts`, 1,960 B in this bundle), the recorder (`_lib/goal_mandate.ts`, 1,275 B), the store reader and the rendered line (`_lib/goal_mandate_store.ts`, 1,349 B), the hook glue that joins the goal block with the PR block, and `default_pr_target` with its block line in `_lib/session_pr_watch.ts`. Measured by this gate at 1,600,725 B against the 1,595,300 ceiling; per-file figures from one esbuild metafile of the same flags.",
+            "why_it_could_not_be_avoided": "The goal sentence has to be recorded on the prompt that carries it, and decision D3 of the roadmap reuses `session-register` rather than adding a concern, so the recognizer runs in-bundle. Room was made where it could be: the read side was split into `goal_mandate_store.ts` so the subagent chunk does not carry the phrase set or the session register, and the store stem is a local three-line function instead of an import of `_lib/session_register.ts`. Recognition is deterministic code by council decision D4, so it cannot move into the model. Sized to the measurement plus 275 B.",
+            "what_would_have_caught_it": "Nothing earlier: the gate fired on the first mirror run of the branch."
+        },
+        {
+            "date": "2026-11-21",
+            "chunk": "src/scripts/hooks/subagent_constraints_hook.ts",
+            "from": 28500,
+            "to": 31500,
+            "by": "agent, feat/mandates-scoped-to-the-goal (road-to-mandates-scoped-to-the-goal 2.4)",
+            "what_was_added": "The parent session's goal line handed to every subagent ahead of its pins: `goal_mandate_for_subagent` and the store reader of `_lib/goal_mandate_store.ts`, which brings `_lib/git_common_dir.ts` into this chunk. Measured 31,117 B by this gate against the 28,500 ceiling.",
+            "why_it_could_not_be_avoided": "A subagent starts without the turn the goal was typed in, and this chunk is the only carrier on claude `subagent_start`. The reader was split from the recognizer first, which took the phrase set and the session register out of the chunk (31,718 B before the split). The store sits under the shared repository metadata directory like the session PR store (decision D2), so every worktree of the repository reads one record, and resolving that directory is what the added helper does. Sized to the measurement plus about 1 %.",
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
index 0000000000..409eaf6225
--- /dev/null
+++ b/src/scripts/_lib/goal_mandate.ts
@@ -0,0 +1,62 @@
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
+ *   concern), atomic writes.
+ * - **Lifetime:** a later goal sentence replaces the record; a revoke sentence
+ *   keeps it with `revoked_by` set, and a revoked record renders nothing.
+ * - **Failure:** never throws; an unreadable store reads as no record.
+ */
+
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+
+import { write_atomic } from './fs_atomic.js';
+import { goal_mandate_line, goal_store_file, read_goal, type GoalRecord } from './goal_mandate_store.js';
+import { goalSentenceIn, revocationIn } from './goal_phrases.js';
+
+
+function write_goal(root: string, session_id: string, record: GoalRecord): void {
+    const file = goal_store_file(root, session_id);
+    if (file === null) return;
+    fs.mkdirSync(path.dirname(file), { recursive: true });
+    write_atomic(file, `${JSON.stringify(record, null, 2)}\n`);
+}
+
+/** Record a goal or a revocation from one owner prompt; return the record after it. Never throws. */
+export function observe_prompt(root: string, session_id: string, prompt: string, now: Date = new Date()): GoalRecord | null {
+    try {
+        const current = read_goal(root, session_id);
+        const revoke = revocationIn(prompt);
+        if (revoke !== null) {
+            if (current === null || current.revoked_by !== undefined) return current;
+            const revoked: GoalRecord = { ...current, revoked_by: revoke, revoked_at: now.toISOString() };
+            write_goal(root, session_id, revoked);
+            return revoked;
+        }
+        const goal = goalSentenceIn(prompt);
+        if (goal === null) return current;
+        const record: GoalRecord = { sentence: goal, recorded_at: now.toISOString() };
+        write_goal(root, session_id, record);
+        return record;
+    } catch {
+        return null;
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
index 0000000000..5eafd01645
--- /dev/null
+++ b/src/scripts/_lib/goal_mandate_store.ts
@@ -0,0 +1,65 @@
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
+/** A session id reduced to a file stem that cannot leave the store directory. */
+function stem(session_id: string): string {
+    const s = session_id.replace(/[^A-Za-z0-9._-]/g, '_').replace(/\.\./g, '_').slice(0, 128);
+    return /[A-Za-z0-9]/.test(s) ? s : 'unknown-session';
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
+    return (
+        `Owner goal, recorded ${when} from the owner's own words: "${record.sentence}". ` +
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
index 0000000000..7835248596
--- /dev/null
+++ b/src/scripts/_lib/goal_phrases.ts
@@ -0,0 +1,115 @@
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
+function proseMatches(text: string, patterns: readonly RegExp[]): string | null {
+    if (isSyntheticTurn(text) || text.length > MAX_GOAL_PROMPT_CHARS) return null;
+    for (const line of ownerProseLines(text)) {
+        const trimmed = line.trim();
+        if (trimmed.length > MAX_GOAL_LINE_CHARS) continue;
+        if (patterns.some((re) => re.test(trimmed))) return trimmed;
+    }
+    return null;
+}
+
+/** The owner prose line carrying a goal phrase, or null. */
+export function goalSentenceIn(text: string): string | null {
+    return proseMatches(text, GOAL_PATTERNS);
+}
+
+/** The owner prose line revoking a goal, or null. */
+export function revocationIn(text: string): string | null {
+    return proseMatches(text, REVOKE_PATTERNS);
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
index 6db001f9c5..515ea11ef2 100644
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
@@ -193,6 +204,7 @@ export function pr_watch_block(
             ...lines,
             'State them from this block, or run `gh pr view <n>` first — never from memory.',
             'A merged PR waits for nobody.',
+            ...(target === null ? [] : [`Default PR target for PR commands: #${target.number} ${target.url}`]),
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
