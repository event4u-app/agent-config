<!-- evidence-type: analysis -->

# Ratification review — hook-bundle ceiling raised for a shadow strike ledger — round 1

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it, `src/config/hook-bundle-budget.json`, is on the ratification gate's list (hook plumbing), so the change needs a two-provider verdict under ADR-268 § 4: an agent may change that file but may not ratify its own change.

subject: 5b67ec8884b7dbe1d4503d6ca544160eec8ce2fe1c7578f0f0e7739a4eac3c14

(The digest covers `src/config/hook-bundle-budget.json` at commit `7fe5aca982`, computed with `./scripts-run src/scripts/ratification_subject`.)

## Background

`hook-bundle-budget.json` holds the byte ceiling of the self-hosted hook bundle `dist/hooks/dispatch.js`, which every hook event loads. It is shrink-only: a raise needs a `raise_log` entry naming what was added.

## What the change does

1. The verification recorder `src/scripts/before_complete_hook.ts` (a `post_tool_use` concern that records test/lint runs per turn and clears them at the next user prompt) now also calls `observeStrike(...)` after its own locked state write. That writes `agents/state/strike-ledger.json` (gitignored) under its own file lock: per agent and command, the streak of red runs that share a normalised failure signature with an edit before each, and a verdict NEW / SAME / FIXED / FLAKY. Entries hold hashes, counts, a verdict word, a timestamp and a host name; entries older than 7 days are pruned. Every error in that path is swallowed; the recorder's exit code and behaviour do not change. Nothing reads the ledger back to the model, any gate, or any decision path — it is shadow instrumentation.
2. The bundle grew from 1,569,415 bytes (the base at `b234d08480`, measured locally) to 1,575,465 bytes. The base was already 2,015 bytes over the 1,567,400 ceiling.
3. `max_bytes` goes from 1,567,400 to 1,576,000, with a `raise_log` entry.

Tests: 13 unit tests for the fold (each verdict from both sides, a test that no run text is stored), 3 tests through the real hook (streak survives the turn reset and a new session; a non-verifying command writes nothing). Removing the call makes the hook tests fail.

## What to answer

1. Does the diff contain a defect — in the budget entry, or in the recorder call it pays for (a path that can change the recorder's result, a lock problem, a privacy leak into the ledger)? Name file and line.
2. Does the change expand any agent's authority, or weaken any existing gate?
3. Is the raise justified as recorded, or should the bytes have been found elsewhere?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## The diff of the gated file and the code it pays for

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index d4a864631a..a985825262 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1567400,
+    "max_bytes": 1576000,
     "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the `raise_log` entry whose `to` is 1,550,500, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
     "shrink_only": true,
     "shrink_only_note": "A RAISE needs a recorded reason in `raise_log` below naming what was added and why it could not be avoided. Enforced since road-to-a-ratification-fence-that-follows-its-imports 3.2: the gate reads `max_bytes` at the base revision, and a working value above it fails unless `raise_log` gained an entry whose `to` equals the new value. A lowering needs no entry. This file is also on the ratification gate's watched set, so a raise carries a record as well as a log entry.",
@@ -154,6 +154,15 @@
             "what_was_added": "Profile awareness on the session-register path, which runs on session_start: `session_profile` in `_lib/session_register.ts` (reads only the environment) plus `install/agentSwitchProfile.ts` (2,033 B), newly pulled into the bundle so the profile is parsed by the one existing matching rule rather than a second copy; and `_lib/provider_home.ts` (903 B), the single resolver for `CLAUDE_CONFIG_DIR` / `CODEX_HOME` that `claude_plugin.claude_config_dir` now delegates to. Measured 1,566,892 bytes by the gate, 4,892 over the 1,562,000 ceiling; the base sat at 1,561,506.",
             "why_it_could_not_be_avoided": "Room was looked for first: `sessions_cli.ts` (16,380 B) rides in through `env_session_id` and `other_worktree_branches_detailed`, but extracting those is an unrelated refactor of two hooks and a CLI; the schema-flag code added to it is tree-shaken because the bundled entry never reaches `cmd_list`. Inlining a reduced agent-switch path match would save about 1.5 KB at the cost of a second matching rule that drifts from the first. The profile must be recorded when the session registers, in the hook, because a later reader runs in another process with another environment.",
             "what_would_have_caught_it": "Nothing earlier: the growth is the feature. Sized to the measurement plus about 500 bytes of rebuild jitter."
+        },
+        {
+            "date": "2026-11-03",
+            "from": 1567400,
+            "to": 1576000,
+            "by": "agent, analysis/inbox-2026-11-strike (road-to-a-strike-the-session-keeps 3.2)",
+            "what_was_added": "The strike ledger on the verification recorder's post_tool_use path: `_lib/strike_ledger.ts` (signature normalisation and the SAME/NEW/FIXED/FLAKY fold) and `_lib/strike_ledger_io.ts` (locked write of agents/state/strike-ledger.json), 6,050 B. The gate measured 1,575,465 bytes; the base at b234d08480 already measured 1,569,415 here, 2,015 over the 1,567,400 ceiling before this change, from growth merged after the 2026-11-02 raise.",
+            "why_it_could_not_be_avoided": "The ledger has to observe the run in the same hook invocation that records it: the recorder clears its runs at every turn boundary, which is the defect the ledger exists to outlive, so a later reader in another process would see nothing. A lazy chunk would need its own manifest concern (+1 on the concern_count ratchet) and a second stdin parse of the same event for 6 KB. The base overage is included rather than left red, because a ceiling below the trunk's own reading fails every branch cut from it.",
+            "what_would_have_caught_it": "For the base overage: measuring the ceiling on the merge result, as the first raise_log entry already says. For the ledger: nothing earlier — the growth is the feature. Sized to the measurement plus about 500 bytes of rebuild jitter."
         }
     ],
     "chunks": [
diff --git a/src/scripts/_lib/strike_ledger.ts b/src/scripts/_lib/strike_ledger.ts
new file mode 100644
index 0000000000..060f9989ce
--- /dev/null
+++ b/src/scripts/_lib/strike_ledger.ts
@@ -0,0 +1,201 @@
+/**
+ * The strike ledger — the counter the fix-loop ladder never had.
+ *
+ * `execution.fix_loop_max` and its three bands live in prose; until this file
+ * nothing counted an attempt. Red runs were recorded per TURN and cleared at the
+ * next prompt, so "it still fails" after a turn or a compact restarted at zero
+ * and band 2 ("repeating the approach is the same attempt again") was not
+ * observable. The ledger reads the run the verification recorder already
+ * captured — one capture, two readers — and keeps, per agent and target, how
+ * many consecutive attempts ended on the same failure.
+ *
+ * SHADOW. Nothing here reaches the model; the ledger is read by tests until a
+ * measured shadow window decides whether it may speak at a band boundary.
+ *
+ * PRIVACY BY SHAPE. An entry holds hashes, counts, a verdict word, a timestamp
+ * and a host name. The recorder keeps 4 KiB output tails per run; a file that
+ * outlives the session must not inherit them, so no field here can hold text
+ * from a run.
+ */
+import { createHash } from 'node:crypto';
+
+import { classifyRun, type InvalidRunReason, type RunRecord } from './verification_evidence.js';
+
+export const STRIKE_LEDGER_FILE = 'agents/state/strike-ledger.json';
+/** Entries untouched for longer than this are dropped: a stale streak is not an attempt. */
+export const STRIKE_TTL_DAYS = 7;
+
+export type StrikeVerdict = 'NEW' | 'SAME' | 'FIXED' | 'FLAKY';
+
+export interface StrikeEntry {
+    /** Failure signature of the last red run, or null after a green one. */
+    readonly sig: string | null;
+    /** Consecutive attempts — red runs with an edit before them — on one signature. */
+    readonly streak: number;
+    readonly verdict: StrikeVerdict;
+    /** The ledger's edit counter when this target last ran. */
+    readonly at_edit: number;
+    /** The last run was green with no edit since the red before it. */
+    readonly green_without_edit: boolean;
+    readonly last_at: string;
+    readonly platform: string;
+}
+
+export interface StrikeLedger {
+    readonly version: 1;
+    /** Monotonic count of edit-tool calls this consumer root has seen. */
+    readonly edits_total: number;
+    readonly entries: Readonly<Record<string, StrikeEntry>>;
+}
+
+export function emptyLedger(): StrikeLedger {
+    return { version: 1, edits_total: 0, entries: {} };
+}
+
+/** Reasons that mean the run executed and failed, as opposed to an instrument gap. */
+const RED_REASONS: ReadonlySet<InvalidRunReason> = new Set<InvalidRunReason>([
+    'nonzero_exit_without_test_failure',
+    'fixture_or_load_failure',
+    'timeout_or_killed',
+]);
+
+/** `red`, `green`, or null when the run says nothing about the tree. */
+export function runOutcome(run: RunRecord): 'red' | 'green' | null {
+    const v = classifyRun(run);
+    if (v.kind === 'PASS_EVIDENCE_OK') return 'green';
+    if (v.kind === 'FAIL_EVIDENCE') return 'red';
+    return RED_REASONS.has(v.reason) ? 'red' : null;
+}
+
+const FAILURE_LINE = /\b(fail(ed|ure|ing)?|error|assert\w*|panic|exception)\b|[×✗✖]/i;
+const MAX_SIG_LINES = 20;
+
+/**
+ * One output line with everything that varies between two runs of the same
+ * failure removed: durations, timestamps, hex addresses, temp paths, and
+ * line/column positions (which drift whenever the file is edited above them).
+ */
+export function normaliseFailureLine(line: string): string {
+    return line
+        .replace(/\x1b\[[0-9;]*m/g, '')
+        .replace(/\b\d{4}-\d{2}-\d{2}[T ][\d:.]+Z?\b/g, '<ts>')
+        .replace(/\b\d{1,2}:\d{2}:\d{2}(\.\d+)?\b/g, '<ts>')
+        .replace(/\b0x[0-9a-f]+\b/gi, '<hex>')
+        .replace(/(\/(private\/)?(tmp|var\/folders)\/|[A-Za-z]:\\Temp\\)\S*/gi, '<tmp>')
+        .replace(/\b\d+(\.\d+)?\s?(ms|s|sec|seconds|m|min)\b/gi, '<dur>')
+        .replace(/([\w.-]+\.\w+)[:(]\d+([:,]\d+)?\)?/g, '$1')
+        .replace(/\s+/g, ' ')
+        .trim();
+}
+
+/**
+ * The failure signature: runner plus the normalised failure-bearing lines.
+ *
+ * Two runs share a signature when the same targets fail the same way; a
+ * different failing test, a different error code, or a different failure count
+ * gives a different one.
+ */
+export function failureSignature(run: RunRecord): string {
+    const text = `${run.stdout_tail ?? ''}\n${run.stderr_tail ?? ''}`;
+    const lines = [
+        ...new Set(
+            text
+                .split('\n')
+                .filter((l) => FAILURE_LINE.test(l))
+                .map(normaliseFailureLine)
+                .filter((l) => l.length > 0),
+        ),
+    ].slice(0, MAX_SIG_LINES);
+    const basis = lines.length > 0 ? lines.join('\n') : `exit:${String(run.exit_code)}`;
+    return sha(`${run.runner ?? ''}\n${basis}`);
+}
+
+/** The target a run attempts: agent plus the command with volatile flags kept. */
+export function targetKey(agent: string, run: RunRecord): string {
+    return sha(`${agent}\n${run.command.replace(/\s+/g, ' ').trim()}`);
+}
+
+/** Count one edit-tool call. */
+export function recordEdit(ledger: StrikeLedger): StrikeLedger {
+    return { ...ledger, edits_total: ledger.edits_total + 1 };
+}
+
+export interface ObserveContext {
+    readonly agent: string;
+    readonly now: string;
+    readonly platform: string;
+}
+
+/**
+ * Fold one recorded run into the ledger.
+ *
+ * Returns the ledger unchanged for a run that says nothing about the tree
+ * (an instrument gap or a non-verifying command), so a gap never resets a streak.
+ */
+export function observeRun(
+    ledger: StrikeLedger,
+    run: RunRecord,
+    ctx: ObserveContext,
+): { ledger: StrikeLedger; verdict: StrikeVerdict | null } {
+    const outcome = runOutcome(run);
+    if (outcome === null) return { ledger, verdict: null };
+
+    const key = targetKey(ctx.agent, run);
+    const prev = ledger.entries[key];
+    const edited = prev === undefined || ledger.edits_total > prev.at_edit;
+    const base = { at_edit: ledger.edits_total, last_at: ctx.now, platform: ctx.platform };
+
+    let next: StrikeEntry;
+    if (outcome === 'green') {
+        if (prev === undefined || prev.sig === null) {
+            next = { ...base, sig: null, streak: 0, verdict: 'FIXED', green_without_edit: false };
+        } else if (!edited) {
+            // Green with nothing changed since the red: the red may come back.
+            // Keep the red's signature and streak so a returning red reads FLAKY.
+            next = { ...base, sig: prev.sig, streak: prev.streak, verdict: 'FIXED', green_without_edit: true };
+        } else {
+            next = { ...base, sig: null, streak: 0, verdict: 'FIXED', green_without_edit: false };
+        }
+    } else {
+        const sig = failureSignature(run);
+        if (prev !== undefined && prev.green_without_edit && !edited && prev.sig === sig) {
+            next = { ...base, sig, streak: prev.streak, verdict: 'FLAKY', green_without_edit: false };
+        } else if (prev !== undefined && prev.sig === sig) {
+            // A re-run with no edit between is not a new attempt.
+            next = { ...base, sig, streak: edited ? prev.streak + 1 : prev.streak, verdict: 'SAME', green_without_edit: false };
+        } else {
+            next = { ...base, sig, streak: 1, verdict: 'NEW', green_without_edit: false };
+        }
+    }
+    return {
+        ledger: { ...ledger, entries: { ...ledger.entries, [key]: next } },
+        verdict: next.verdict,
+    };
+}
+
+/** Drop entries untouched for longer than the TTL. */
+export function pruneLedger(ledger: StrikeLedger, now: string, ttlDays = STRIKE_TTL_DAYS): StrikeLedger {
+    const cutoff = Date.parse(now) - ttlDays * 86_400_000;
+    const entries = Object.fromEntries(
+        Object.entries(ledger.entries).filter(([, e]) => {
+            const t = Date.parse(e.last_at);
+            return Number.isFinite(t) && t >= cutoff;
+        }),
+    );
+    return { ...ledger, entries };
+}
+
+/** Read whatever is on disk into a ledger, discarding anything malformed. */
+export function coerceLedger(raw: unknown): StrikeLedger {
+    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return emptyLedger();
+    const r = raw as Record<string, unknown>;
+    const edits = typeof r['edits_total'] === 'number' && r['edits_total'] >= 0 ? r['edits_total'] : 0;
+    const entries = typeof r['entries'] === 'object' && r['entries'] !== null && !Array.isArray(r['entries'])
+        ? (r['entries'] as Record<string, StrikeEntry>)
+        : {};
+    return { version: 1, edits_total: edits, entries };
+}
+
+function sha(text: string): string {
+    return createHash('sha256').update(text).digest('hex').slice(0, 16);
+}
diff --git a/src/scripts/_lib/strike_ledger_io.ts b/src/scripts/_lib/strike_ledger_io.ts
new file mode 100644
index 0000000000..2a7b0805f1
--- /dev/null
+++ b/src/scripts/_lib/strike_ledger_io.ts
@@ -0,0 +1,70 @@
+/**
+ * Persisting the strike ledger from the verification recorder.
+ *
+ * Kept apart from the pure fold in `strike_ledger.ts` so the fold is testable
+ * without a filesystem, and so the recorder carries one call rather than the
+ * ledger's I/O. Every failure here is swallowed: the ledger is shadow
+ * instrumentation and must never change what the recorder does or returns.
+ */
+import path from 'node:path';
+
+import { update_json_under_lock } from '../hooks/state_io.js';
+import {
+    STRIKE_LEDGER_FILE,
+    coerceLedger,
+    observeRun,
+    pruneLedger,
+    recordEdit,
+    type StrikeLedger,
+} from './strike_ledger.js';
+import type { RunRecord } from './verification_evidence.js';
+
+type Dict = Record<string, unknown>;
+
+/**
+ * Who made the attempt. A subagent's payload names it; everything else is the
+ * main session. Parallel subagents must not count each other's strikes.
+ */
+export function strikeAgent(envelope: Dict): string {
+    const pl = envelope['payload'];
+    const payload = typeof pl === 'object' && pl !== null && !Array.isArray(pl) ? (pl as Dict) : {};
+    for (const v of [payload['agent_id'], payload['agentId'], envelope['agent_id']]) {
+        if (typeof v === 'string' && v.trim() !== '') return v.trim();
+    }
+    return 'main';
+}
+
+/** The run the recorder appended for this event, if it appended one. */
+function lastRun(state: Dict): RunRecord | null {
+    const runs = state['verification_runs'];
+    if (!Array.isArray(runs) || runs.length === 0) return null;
+    const last = runs[runs.length - 1] as unknown;
+    if (typeof last !== 'object' || last === null) return null;
+    const r = last as Dict;
+    return typeof r['command'] === 'string' ? (r as unknown as RunRecord) : null;
+}
+
+export function observeStrike(
+    consumer_root: string,
+    envelope: Dict,
+    state: Dict,
+    event: { readonly isEdit: boolean; readonly recorded: boolean },
+    now: string = new Date().toISOString(),
+): void {
+    if (!event.isEdit && !event.recorded) return;
+    const run = event.recorded ? lastRun(state) : null;
+    if (!event.isEdit && run === null) return;
+    const platform = typeof envelope['platform'] === 'string' ? envelope['platform'] : 'unknown';
+    try {
+        update_json_under_lock<StrikeLedger>(path.join(consumer_root, STRIKE_LEDGER_FILE), (loaded) => {
+            let ledger = pruneLedger(coerceLedger(loaded), now);
+            if (event.isEdit) ledger = recordEdit(ledger);
+            if (run !== null) {
+                ledger = observeRun(ledger, run, { agent: strikeAgent(envelope), now, platform }).ledger;
+            }
+            return ledger;
+        });
+    } catch {
+        // Shadow: a ledger failure is invisible to the recorder by design.
+    }
+}
diff --git a/src/scripts/before_complete_hook.ts b/src/scripts/before_complete_hook.ts
index 1367bcda3e..cef971616b 100644
--- a/src/scripts/before_complete_hook.ts
+++ b/src/scripts/before_complete_hook.ts
@@ -75,6 +75,7 @@ import {
   type QualityRun,
 } from "./_lib/touched_file_quality.js";
 import { runnerOf } from "./_lib/verification_evidence.js";
+import { observeStrike } from "./_lib/strike_ledger_io.js";
 import { resolve_toolchain } from "../agent-src/templates/scripts/work_engine/stack/runner.js";
 
 // NOTE: the Python docstring says `agents/runtime/state/`, but the code
@@ -1079,6 +1080,21 @@ export function run(
     }
   }
 
+  // The strike ledger, SHADOW.
+  // It reads the run this hook just recorded (one capture, two readers) and
+  // keeps a streak per target that survives the turn reset above. Its own file,
+  // its own lock, and a failure there never touches this hook's exit code.
+  if (event === "post_tool_use") {
+    const pl = envelope["payload"];
+    const [tool, cmd] = _extract_command(
+      typeof pl === "object" && pl !== null && !Array.isArray(pl) ? (pl as StateDict) : {},
+    );
+    observeStrike(consumer_root, envelope, state, {
+      isEdit: tool !== null && EDIT_TOOLS.has(tool),
+      recorded: cmd !== null && cmd !== "" && mightBeVerification(cmd),
+    });
+  }
+
   if (verbose) {
     process.stderr.write(
       `verify-before-complete-hook: event=${event} ` +
```
