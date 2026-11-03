<!-- evidence-type: analysis -->

# Ratification review — hook-bundle ceiling raised for a shadow strike ledger — round 2

You are an independent reviewer for a change in the `event4u/agent-config` repository. `src/config/hook-bundle-budget.json` is on the ratification gate's list (hook plumbing), so the change needs a two-provider verdict under ADR-268 § 4.

subject: b10346376e34052b867966b5439b75e02fadbaf607888ae1c7a2ec6ebd853932

(The digest covers `src/config/hook-bundle-budget.json` at commit `e4341d6cfa`, computed with `./scripts-run src/scripts/ratification_subject`.)

## What the change does

The verification recorder `src/scripts/before_complete_hook.ts` (a `post_tool_use` concern that records test/lint runs per turn and clears them at the next user prompt) calls `observeStrike(...)` after its own locked state write. That writes the gitignored `agents/state/strike-ledger.json`: per agent and command, the streak of red runs sharing a normalised failure signature with an edit by that agent before each, and a verdict NEW / SAME / FIXED / FLAKY. Nothing reads the ledger back to the model, a gate, or a decision path. The bundle grows to 1,577,671 bytes; `max_bytes` goes from 1,567,400 to 1,578,200 with a `raise_log` entry.

## What changed since round 1

Round 1 (two seats) raised five points. Each is listed with what the code now does; the diff below is the full current state.

1. **Persisted entries were cast, not validated.** `coerceLedger` now rebuilds every entry from allowlisted fields (16-hex signature or null, non-negative integer counters, verdict from a closed set, boolean, parseable timestamp, bounded platform word); invalid entries and keys are dropped. Regression test: an entry carrying an extra text field, a null entry, a negative counter and a non-hash key — only the valid entry survives, no text, pruning does not throw.
2. **Edits were counted root-wide.** Edit counts are now per agent (`edits`, keyed by an agent hash); an attempt is this agent's edit, then a run. Regression test: agent b edits, agent a re-runs the same red — a's streak does not grow.
3. **The observed run was inferred.** `appendedRun` takes the newest record only when it carries this event's command and its timestamp lies within the recorder's own update; otherwise nothing is observed. Regression test for a stale record and a different command.
4. **Lock latency.** The ledger write uses `update_json_under_lock(..., { blocking: false })`: a held lock skips the observation instead of delaying the recorder.
5. **Base overage unattributed.** The `raise_log` entry now names the measured base, the previous raise's measurement, and the commits in between.

Tests: 16 fold tests, 4 hook tests, and the recorder's existing suites (88 total) pass; `tsc --noEmit` is clean.

## What to answer

1. Does the diff contain a defect — in the budget entry, or in the recorder call it pays for (a path that can change the recorder's result, a lock problem, a privacy leak into the ledger)? Name file and line.
2. Does the change expand any agent's authority, or weaken any existing gate?
3. Is the raise justified as recorded?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## The diff of the gated file and the code it pays for (`git diff origin/main...HEAD`)

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index d4a864631a..383e9cb2f6 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1567400,
+    "max_bytes": 1578200,
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
+            "to": 1578200,
+            "by": "agent, analysis/inbox-2026-11-strike (road-to-a-strike-the-session-keeps 3.2)",
+            "what_was_added": "The strike ledger on the verification recorder's post_tool_use path: `_lib/strike_ledger.ts` (signature normalisation, the SAME/NEW/FIXED/FLAKY fold over per-agent edit counters, and an allowlist rebuild of every persisted entry) and `_lib/strike_ledger_io.ts` (non-blocking locked write of agents/state/strike-ledger.json), 8,256 B. The gate measured 1,577,671 bytes; the base at b234d08480 measured 1,569,415 here, 2,015 over the 1,567,400 ceiling before this change. That base overage is the growth merged between the 2026-11-02 raise (47161a7b70, measured 1,566,892) and b234d08480: +2,523 B from the non-merge commits in that range touching bundled sources — 7742bad8c4, 5dbafe73c5, 850c3619eb, dcb61c6f98 (provider-home and profile fixes) and e8ee59465f, 8afea9f246, e00a48598f — none of which carried a raise_log entry.",
+            "why_it_could_not_be_avoided": "The ledger has to observe the run in the same hook invocation that records it: the recorder clears its runs at every turn boundary, which is the defect the ledger exists to outlive, so a later reader in another process would see nothing. A lazy chunk would need its own manifest concern (+1 on the concern_count ratchet) and a second stdin parse of the same event for 8 KB. The base overage is included rather than left red, because a ceiling below the trunk's own reading fails every branch cut from it.",
+            "what_would_have_caught_it": "For the base overage: measuring the ceiling on the merge result, as the first raise_log entry already says. For the ledger: nothing earlier — the growth is the feature. Sized to the measurement plus about 500 bytes of rebuild jitter."
         }
     ],
     "chunks": [
diff --git a/src/scripts/_lib/strike_ledger.ts b/src/scripts/_lib/strike_ledger.ts
new file mode 100644
index 0000000000..a675a03d87
--- /dev/null
+++ b/src/scripts/_lib/strike_ledger.ts
@@ -0,0 +1,268 @@
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
+    /** This agent's edit counter when this target last ran. */
+    readonly at_edit: number;
+    /** The last run was green with no edit since the red before it. */
+    readonly green_without_edit: boolean;
+    readonly last_at: string;
+    readonly platform: string;
+}
+
+/**
+ * An attempt is an edit the attempting agent made, then a run. Edits are
+ * counted per agent: a parallel subagent's edit in the shared tree may well
+ * change this agent's result, but it is not this agent's attempt, and counting
+ * it would raise a streak on a signature the agent never worked on.
+ */
+export interface StrikeLedger {
+    readonly version: 1;
+    /** Monotonic count of edit-tool calls per agent. Keys are agent hashes. */
+    readonly edits: Readonly<Record<string, number>>;
+    readonly entries: Readonly<Record<string, StrikeEntry>>;
+}
+
+export function emptyLedger(): StrikeLedger {
+    return { version: 1, edits: {}, entries: {} };
+}
+
+/** The ledger key for an agent — hashed, so no agent id is stored as text. */
+export function agentKey(agent: string): string {
+    return sha(`agent\n${agent}`);
+}
+
+function editsOf(ledger: StrikeLedger, agent: string): number {
+    return ledger.edits[agentKey(agent)] ?? 0;
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
+/** Count one edit-tool call by `agent`. */
+export function recordEdit(ledger: StrikeLedger, agent: string): StrikeLedger {
+    const k = agentKey(agent);
+    return { ...ledger, edits: { ...ledger.edits, [k]: (ledger.edits[k] ?? 0) + 1 } };
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
+    const myEdits = editsOf(ledger, ctx.agent);
+    const edited = prev === undefined || myEdits > prev.at_edit;
+    const base = { at_edit: myEdits, last_at: ctx.now, platform: ctx.platform };
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
+const HASH = /^[0-9a-f]{16}$/;
+const VERDICTS: ReadonlySet<string> = new Set(['NEW', 'SAME', 'FIXED', 'FLAKY']);
+const PLATFORM = /^[a-z0-9_-]{1,32}$/i;
+const count = (v: unknown): number | null =>
+    typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;
+
+/** One persisted entry rebuilt from its allowlisted fields, or null when any is invalid. */
+function coerceEntry(raw: unknown): StrikeEntry | null {
+    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
+    const r = raw as Record<string, unknown>;
+    const sig = r['sig'];
+    const streak = count(r['streak']);
+    const atEdit = count(r['at_edit']);
+    const verdict = r['verdict'];
+    const lastAt = r['last_at'];
+    const platform = r['platform'];
+    if (!(sig === null || (typeof sig === 'string' && HASH.test(sig)))) return null;
+    if (streak === null || atEdit === null) return null;
+    if (typeof verdict !== 'string' || !VERDICTS.has(verdict)) return null;
+    if (typeof r['green_without_edit'] !== 'boolean') return null;
+    if (typeof lastAt !== 'string' || !Number.isFinite(Date.parse(lastAt)) || lastAt.length > 40) return null;
+    if (typeof platform !== 'string' || !PLATFORM.test(platform)) return null;
+    return {
+        sig,
+        streak,
+        verdict: verdict as StrikeVerdict,
+        at_edit: atEdit,
+        green_without_edit: r['green_without_edit'] as boolean,
+        last_at: lastAt,
+        platform,
+    };
+}
+
+/**
+ * Read whatever is on disk into a ledger. Every entry is REBUILT from its
+ * allowlisted fields and an invalid one is dropped, so a file that gained text
+ * by any route — corruption, a hand edit, a future bug — cannot carry it
+ * forward through the next write.
+ */
+export function coerceLedger(raw: unknown): StrikeLedger {
+    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return emptyLedger();
+    const r = raw as Record<string, unknown>;
+    const edits: Record<string, number> = {};
+    const rawEdits = r['edits'];
+    if (typeof rawEdits === 'object' && rawEdits !== null && !Array.isArray(rawEdits)) {
+        for (const [k, v] of Object.entries(rawEdits)) {
+            const n = count(v);
+            if (HASH.test(k) && n !== null) edits[k] = n;
+        }
+    }
+    const entries: Record<string, StrikeEntry> = {};
+    const rawEntries = r['entries'];
+    if (typeof rawEntries === 'object' && rawEntries !== null && !Array.isArray(rawEntries)) {
+        for (const [k, v] of Object.entries(rawEntries)) {
+            const e = coerceEntry(v);
+            if (HASH.test(k) && e !== null) entries[k] = e;
+        }
+    }
+    return { version: 1, edits, entries };
+}
+
+function sha(text: string): string {
+    return createHash('sha256').update(text).digest('hex').slice(0, 16);
+}
diff --git a/src/scripts/_lib/strike_ledger_io.ts b/src/scripts/_lib/strike_ledger_io.ts
new file mode 100644
index 0000000000..562b8c738d
--- /dev/null
+++ b/src/scripts/_lib/strike_ledger_io.ts
@@ -0,0 +1,84 @@
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
+/**
+ * The run the recorder appended for THIS event: the newest record, and only
+ * when it carries this event's command and was written at or after the
+ * recorder's own `checked_at` minus the time one update can take. Anything else
+ * is a run from an earlier event and is never observed twice.
+ */
+export function appendedRun(state: Dict, command: string): RunRecord | null {
+    const runs = state['verification_runs'];
+    if (!Array.isArray(runs) || runs.length === 0) return null;
+    const last = runs[runs.length - 1] as unknown;
+    if (typeof last !== 'object' || last === null) return null;
+    const r = last as Dict;
+    if (r['command'] !== command.slice(0, 512)) return null;
+    const at = typeof r['at'] === 'string' ? Date.parse(r['at']) : NaN;
+    const checked = typeof state['checked_at'] === 'string' ? Date.parse(state['checked_at']) : NaN;
+    if (!Number.isFinite(at) || !Number.isFinite(checked) || checked - at > 5_000 || at > checked) return null;
+    return r as unknown as RunRecord;
+}
+
+export function observeStrike(
+    consumer_root: string,
+    envelope: Dict,
+    state: Dict,
+    event: { readonly isEdit: boolean; readonly command: string | null },
+    now: string = new Date().toISOString(),
+): void {
+    const run = event.command !== null ? appendedRun(state, event.command) : null;
+    if (!event.isEdit && run === null) return;
+    const agent = strikeAgent(envelope);
+    const rawPlatform = envelope['platform'];
+    const platform = typeof rawPlatform === 'string' && /^[a-z0-9_-]{1,32}$/i.test(rawPlatform) ? rawPlatform : 'unknown';
+    try {
+        // Non-blocking: a held ledger lock skips this observation rather than
+        // delaying the recorder. Shadow data may lose a sample; the hook may not wait.
+        update_json_under_lock<StrikeLedger>(
+            path.join(consumer_root, STRIKE_LEDGER_FILE),
+            (loaded) => {
+                let ledger = pruneLedger(coerceLedger(loaded), now);
+                if (event.isEdit) ledger = recordEdit(ledger, agent);
+                if (run !== null) ledger = observeRun(ledger, run, { agent, now, platform }).ledger;
+                return ledger;
+            },
+            { blocking: false },
+        );
+    } catch {
+        // Shadow: a ledger failure is invisible to the recorder by design.
+    }
+}
diff --git a/src/scripts/before_complete_hook.ts b/src/scripts/before_complete_hook.ts
index 1367bcda3e..1cde56e78d 100644
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
+      command: cmd !== null && cmd !== "" && mightBeVerification(cmd) ? cmd : null,
+    });
+  }
+
   if (verbose) {
     process.stderr.write(
       `verify-before-complete-hook: event=${event} ` +
```
