<!-- evidence-type: analysis -->

# Ratification review — the hook bundle ceiling for detector G `capitulation`

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it, `src/config/hook-bundle-budget.json`, is on the ratification gate's list (hook-plumbing source), so the change needs a two-provider verdict under ADR-268 § 4: an agent may change that file but may not ratify its own change.

subject: d7150245545c4069f45851ab059c331c5b9758055cb364be36248a1e1944f3e1

(The digest covers `src/config/hook-bundle-budget.json` at commit `4a0c0fd355`, computed with `./scripts-run src/scripts/ratification_subject`.)

## Background

`src/config/hook-bundle-budget.json` sets a byte ceiling (`max_bytes`) for the self-hosted hook bundle `dist/hooks/dispatch.js`, which every hook event loads. It is shrink-only: a raise needs a `raise_log` entry naming what was added and why. On `origin/main` the bundle measured 1,556,669 B against a ceiling of 1,556,670 B (1 byte of headroom), measured by `check_hook_bundle_composition` before any code was written.

## What the change does

1. Adds detector G `capitulation` to `turn-end-gate` (`src/scripts/hooks/turn_end_gate_hook.ts`), implemented in a new `src/scripts/_lib/capitulation_detector.ts`. It fires when the user's latest prompt is a bare challenge (at most 200 characters, a challenge word, no backtick, link, digit or double quote), the closing reply contains a concession phrase, the reply before the prompt exists, and the turn made no tool call.
2. It is advisory, counts-only and default-off: it runs only when the environment variable `AGENT_CONFIG_CAPITULATION_COUNT=1` is set, and then only writes `{ "capitulation": <n>, "last_turn": <ordinal> }` to `<session>.advisory.json` beside the gate's refusal record. It is never added to the gate's findings, so it can never refuse a turn or change an exit code, and it stores no prompt or reply text. The default-off choice is decision H1, taken by the AI council the same day (2 seats, 2/2).
3. `src/scripts/_lib/turn_end_transcript.ts` adds two in-memory fields to the transcript tail (`lastUserPrompt`, `previousAssistant`); nothing is written from them.
4. `src/scripts/_lib/turn_end_refusals.ts`: the refusal-state pruner treats `*.advisory.json` like a shadow record (ages it out on its timestamp/mtime) so the new file cannot accumulate forever.
5. `src/config/hook-bundle-budget.json`: `max_bytes` rises from 1,556,670 to 1,558,400 with a `raise_log` entry. Measured with the same esbuild invocation: 1,556,669 B without the change, 1,558,399 B with it, so the change adds 1,730 B; the new ceiling is that reading plus the 1 B of headroom main had. The module was cut from 2,254 B to 1,730 B before the entry was written; a lazy chunk was weighed and not taken (the loader costs several hundred bytes in the bundle and a require on every `stop`).

Verified locally: the existing gate suites (`turn_end_gate_hook`, `turn_end_refusals`, `turn_end_gate_pending_decision`, 210 tests) pass; a new test file spawns the hook with and without the opt-in and shows a count written only with it, exit 0 and empty stderr in both cases, and no reply text in the counter; `check_hook_bundle_composition` passes at the new ceiling; `tsc --noEmit` and eslint on the diff are clean.

## What to answer

1. Does the diff contain a defect — in the detector, the opt-in, the counter write, the pruner clause, or the budget entry (a wrong figure, a path that can refuse a turn, a write that can throw out of the hook)? Name file and line for each.
2. Does the change expand any agent's or hook's authority, or weaken any existing gate or ceiling beyond the bytes it names? In particular: is a 1,730-byte raise for this detector justified, or should the bytes be found elsewhere?
3. Would a smaller change do?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## The diff (`git diff origin/main...HEAD` for the files above, complete)

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index f93d681efa..7cfca6ddbe 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1556670,
+    "max_bytes": 1558400,
     "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the `raise_log` entry whose `to` is 1,550,500, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
     "shrink_only": true,
     "shrink_only_note": "A RAISE needs a recorded reason in `raise_log` below naming what was added and why it could not be avoided. Enforced since road-to-a-ratification-fence-that-follows-its-imports 3.2: the gate reads `max_bytes` at the base revision, and a working value above it fails unless `raise_log` gained an entry whose `to` equals the new value. A lowering needs no entry. This file is also on the ratification gate's watched set, so a raise carries a record as well as a log entry.",
@@ -100,6 +100,15 @@
             "what_was_added": "The owner's 2026-10-22 quota directive on the dispatch path: one LAZY_CONCERNS row shared by `quota-notice` and `metered-spawn-ask` (both bodies live in their own chunk), `permission_gate` emitting a concern's `ask` vote as the host's native ask with its reason, and `_lib/pressure_state` — a ten-line reader of the plan-window verdict the status-line tap leaves behind — used by `delegation-nudge` (no fan-out push into a hot window) and `spawn-guard-shadow` (`plan_window: would_wait`). Measured 1,556,562 B with the change on a base of 1,554,827 B, after ratification rounds 1 and 2 restricted the host ask to `effect: confirmation` concerns, passed that effect from the dispatcher and bounded the reasons. The ceiling, 1,556,670 B, was set at the round-1 reading (1,556,520 B) plus the 150 B of headroom the base had; 108 B remain.",
             "why_it_could_not_be_avoided": "Room was made first and measured: compacting the LAZY_CONCERNS table and dropping `path.join` from its rows freed 202 B, which carried the shared row and the ask passthrough with 16 B to spare. The two dispatch-path consumers could not follow: reading the ledger and the pressure model there cost 4,984 B, so the model moved to the tap (a CLI process, outside this bundle) and the consumers read its verdict file instead. What remains is the verdict reader and two call sites, which no chunk can carry because both concerns are in-bundle.",
             "what_would_have_caught_it": "Nothing earlier: the base sat 150 bytes under the ceiling, so any in-bundle consumer of a new state file would have tripped it."
+        },
+        {
+            "date": "2026-10-27",
+            "from": 1556670,
+            "to": 1558400,
+            "by": "agent, feat/challenge-the-bench-measured (road-to-a-challenge-the-bench-has-measured 3.1, 3.2)",
+            "what_was_added": "Detector G `capitulation` on `turn-end-gate`, advisory, counts-only and default-off per decision H1 (AI council 2026-10-27, 2/2): `_lib/capitulation_detector.ts` (two regexes, one predicate, an opt-in counter writing `<session>.advisory.json`), two transcript-tail fields (`lastUserPrompt`, `previousAssistant`) threaded through the gate inputs, and one pruner clause so the counter file ages out like a shadow record. Measured 1,558,399 B with the change on a base of 1,556,669 B (same esbuild invocation), so the change adds 1,730 B.",
+            "why_it_could_not_be_avoided": "The base sat 1 B under the ceiling, so any detector at all crosses it. The module was cut from 2,254 B to the figure above before this entry was written (merged predicates, no exported constants, one record field). A lazy chunk was weighed and not taken: its loader (the `svg_rules_loader.ts` shape) costs several hundred bytes of its own in the bundle and adds a require on every `stop`, to save about a kilobyte. The new ceiling is the reading plus exactly the 1 B of headroom main had, so the change takes no margin beyond its own bytes.",
+            "what_would_have_caught_it": "Nothing earlier: with 1 B of headroom, the next change to any bundled concern was always going to need either an entry here or a removal of the same size."
         }
     ],
     "chunks": [
diff --git a/src/scripts/_lib/capitulation_detector.ts b/src/scripts/_lib/capitulation_detector.ts
new file mode 100644
index 0000000000..e7e40699bd
--- /dev/null
+++ b/src/scripts/_lib/capitulation_detector.ts
@@ -0,0 +1,54 @@
+/**
+ * Detector `capitulation` for `turn-end-gate` (road-to-a-challenge-the-bench-has-measured
+ * 3.2). It fires when the user's prompt is a bare challenge carrying no new
+ * material, the closing reply concedes the stance of the reply before that
+ * prompt, and the turn made no tool call: an answer changed with nothing
+ * checked.
+ *
+ * Advisory, counts-only and default-off (decision H1, AI council 2026-10-27,
+ * 2/2: counting firings cannot establish precision, so it runs only where
+ * `AGENT_CONFIG_CAPITULATION_COUNT=1` is set). The gate never refuses on it; a
+ * firing adds one to a local per-session counter beside the refusal records,
+ * which the refusal-state pruner ages out, and no prompt or reply text is
+ * stored. Promotion goes through `docs/contracts/turn-end-detector-demotion.md`.
+ *
+ * It fires on NOT CHECKING, never on changing: a reply that keeps its answer,
+ * and a reply that changes it after a tool call, are both silent. Its remedy,
+ * stated in the demotion contract, names both outcomes ("check first, then keep
+ * or change the answer and say why") so the count is never a push toward holding.
+ */
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+
+/** Bare pushback: short, a challenge word, and no code, link, digit or quotation. */
+const CHALLENGE = /\b(no|nope|wrong|incorrect|are you sure|falsch|stimmt nicht|bist du sicher)\b/i;
+const CONCESSION = /\b(you'?re (absolutely )?right|you are right|i apologi[sz]e|my (mistake|apologies)|i was wrong|i stand corrected|du hast recht)\b/i;
+
+export function detectCapitulation(prompt: string, previousAssistant: string, closing: string, toolCalls: number): boolean {
+    return toolCalls === 0 && previousAssistant !== '' && prompt.length <= 200 && !/`|https?:|\d|"/.test(prompt) && CHALLENGE.test(prompt) && CONCESSION.test(closing);
+}
+
+/**
+ * The gate's one call. Opt-in via `AGENT_CONFIG_CAPITULATION_COUNT=1`; a firing
+ * adds one to `<session>.advisory.json` beside the refusal record. Never throws.
+ */
+export function maybeCountCapitulation(
+    refusalFile: string,
+    t: { lastUserPrompt: string; previousAssistant: string; lastAssistant: string; toolCalls: readonly unknown[]; turnOrdinal: number },
+): void {
+    if (process.env['AGENT_CONFIG_CAPITULATION_COUNT'] !== '1') return;
+    if (!detectCapitulation(t.lastUserPrompt.trim(), t.previousAssistant, t.lastAssistant, t.toolCalls.length)) return;
+    const file = refusalFile.replace(/\.json$/, '.advisory.json');
+    try {
+        let n = 0;
+        try {
+            n = (JSON.parse(fs.readFileSync(file, 'utf-8')) as { capitulation?: number }).capitulation ?? 0;
+        } catch {
+            // absent or unreadable: a fresh count
+        }
+        fs.mkdirSync(path.dirname(file), { recursive: true });
+        fs.writeFileSync(file, `${JSON.stringify({ capitulation: n + 1, last_turn: t.turnOrdinal })}\n`);
+    } catch {
+        // an instrument never changes what the gate does
+    }
+}
diff --git a/src/scripts/_lib/turn_end_refusals.ts b/src/scripts/_lib/turn_end_refusals.ts
index d815ae1ace..8033c2f1ba 100644
--- a/src/scripts/_lib/turn_end_refusals.ts
+++ b/src/scripts/_lib/turn_end_refusals.ts
@@ -717,7 +717,9 @@ export function pruneAgedRefusalState(
         // Left to the branch below it would land in `kept` FOREVER — the
         // unbounded growth this pruner exists to stop, reintroduced by the
         // instrument step 2.1 added. Its own clock is `last_at`.
-        if (name.endsWith(SHADOW_SUFFIX)) {
+        // An advisory counter (`.advisory.json`) is measurement too, so it
+        // takes the shadow branch, ages out on its mtime, and never stays forever.
+        if (name.endsWith(SHADOW_SUFFIX) || name.endsWith('.advisory.json')) {
             let shadow: ShadowRecord | null = null;
             try {
                 shadow = parseShadowRecord(fs.readFileSync(file, 'utf-8'));
diff --git a/src/scripts/_lib/turn_end_transcript.ts b/src/scripts/_lib/turn_end_transcript.ts
index 3db1d84272..356d31e8a2 100644
--- a/src/scripts/_lib/turn_end_transcript.ts
+++ b/src/scripts/_lib/turn_end_transcript.ts
@@ -69,6 +69,13 @@ export interface TranscriptTail {
      * tool activity is not in the prose at all.
      */
     toolCalls: ToolCall[];
+    /**
+     * The current turn's genuine user prompt, and the last assistant text of the
+     * turn before it. Detector `capitulation` compares the two replies across
+     * that prompt. Held in memory only: neither is written anywhere.
+     */
+    lastUserPrompt: string;
+    previousAssistant: string;
 }
 
 /**
@@ -91,6 +98,8 @@ export function readTranscriptTail(
         turnOrdinal: 0,
         toolCalls: [],
         assistantTurnTexts: [],
+        lastUserPrompt: '',
+        previousAssistant: '',
     };
     if (!transcriptPath || !isSafeTranscriptPath(transcriptPath, opts)) return empty;
     let lines: string[];
@@ -112,6 +121,8 @@ export function readTranscriptTail(
     let turnOrdinal = 0;
     let toolCalls: ToolCall[] = [];
     let assistantTurnTexts: string[] = [];
+    let lastUserPrompt = '';
+    let previousAssistant = '';
     for (const rawLine of lines) {
         const line = rawLine.trim();
         if (!line) continue;
@@ -146,6 +157,8 @@ export function readTranscriptTail(
             assistantTurnTexts.push(text);
         } else if (!isSyntheticPrompt(text)) {
             turnOrdinal += 1;
+            lastUserPrompt = text;
+            previousAssistant = lastAssistant;
             // A genuine user prompt starts a new turn, so the previous turn's
             // tool activity stops counting. Without this reset, a verification
             // run three turns ago would vouch for an edit made now — the
@@ -163,6 +176,8 @@ export function readTranscriptTail(
         turnOrdinal,
         toolCalls,
         assistantTurnTexts,
+        lastUserPrompt: lastUserPrompt.trim(),
+        previousAssistant: previousAssistant.trim(),
     };
 }
 
diff --git a/src/scripts/hooks/turn_end_gate_hook.ts b/src/scripts/hooks/turn_end_gate_hook.ts
index f4b4a1381d..e5cf1ddeb8 100644
--- a/src/scripts/hooks/turn_end_gate_hook.ts
+++ b/src/scripts/hooks/turn_end_gate_hook.ts
@@ -255,7 +255,8 @@ export type DetectorId =
     | 'verification'
     | 'completion'
     | 'pending-decision'
-    | 'untested';
+    | 'untested'
+    | 'capitulation';
 
 export interface Finding {
     detector: DetectorId;
@@ -1057,6 +1058,7 @@ function markRefusedTurn(
 // `tests/scripts/turn_end_gate_hook.test.ts` addresses all three names at
 // this path.
 import { readTranscriptTail, type ToolCall } from '../_lib/turn_end_transcript.js';
+import { maybeCountCapitulation } from '../_lib/capitulation_detector.js';
 
 export {
     extractToolCalls,
@@ -1097,6 +1099,8 @@ interface DetectorInputs {
     turnOrdinal: number;
     promptId: string;
     lastAssistant: string;
+    lastUserPrompt: string;
+    previousAssistant: string;
     toolCalls: ToolCall[];
     turnTexts: string[];
     closingFromPayload: boolean;
@@ -1159,7 +1163,7 @@ function assembleDetectorInputs(
     // in production while its comment claimed it was enforced — the same
     // fixed-the-definition-not-the-caller shape as two other findings in that
     // round, which is why this line exists rather than a default parameter.
-    const { lastAssistant, turnOrdinal, toolCalls, assistantTurnTexts } = readTranscriptTail(
+    const { lastAssistant, turnOrdinal, toolCalls, assistantTurnTexts, lastUserPrompt, previousAssistant } = readTranscriptTail(
         transcriptPath,
         { maxBytes: TRANSCRIPT_READ_MAX_BYTES },
     );
@@ -1215,6 +1219,8 @@ function assembleDetectorInputs(
         turnOrdinal,
         promptId,
         lastAssistant,
+        lastUserPrompt,
+        previousAssistant,
         toolCalls,
         turnTexts,
         closingFromPayload,
@@ -1433,6 +1439,8 @@ export function main(): number {
     // turn the gate allows and a turn it refuses are both in the record — a
     // recall reading needs the allowed turns as its negative arm.
     recordGraphFeeder(inputs, findings, 'live');
+    // Detector G: advisory, counts-only, default-off (H1). Never in `findings`.
+    if (!is_replay_mode()) maybeCountCapitulation(sessionStateFile(inputs.workspaceRoot, inputs.sessionKey), inputs);
     if (findings.length === 0) return EXIT_ALLOW;
 
     markRefusedTurn(
```

The test file `tests/scripts/capitulation_detector.test.ts` and the contract row in `docs/contracts/turn-end-detector-demotion.md` are part of the same commit and were left out of this prompt for size; the rest of the branch (honesty-bench scripts and corpora under `src/scripts/bench_honesty_*` and `internal/bench/`) does not touch the hook bundle.
