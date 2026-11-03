<!-- evidence-type: analysis -->

# Ratification review — hook-bundle ceiling raised for a shadow strike ledger — round 4

You are an independent reviewer for a change in the `event4u/agent-config` repository. `src/config/hook-bundle-budget.json` is on the ratification gate's list (hook plumbing), so the change needs a two-provider verdict under ADR-268 § 4.

subject: 65fd6b47a16205367efef8f6d0f11b6f0a46bf37fc92a38cd1629d1b43b47844

(The digest covers `src/config/hook-bundle-budget.json` at commit `fd78202263`, computed with `./scripts-run src/scripts/ratification_subject`.)

## What the change does

The verification recorder `src/scripts/before_complete_hook.ts` (a `post_tool_use` concern that records test/lint runs per turn and clears them at the next user prompt) hands the run record it appends for an event to a shadow strike ledger, the gitignored `agents/state/strike-ledger.json`: per agent and command, red runs on one normalised failure signature, and a verdict NEW / SAME / FIXED / FLAKY. Nothing reads the ledger back to the model, a gate, or a decision path. The bundle grows to 1,578,057 bytes; `max_bytes` goes from 1,567,400 to 1,578,600 with a `raise_log` entry.

## What changed since round 3

Round 3 (two seats) found two defects:

1. **Counter continuity.** An edit counter evicted by the TTL or the cap while its entry lived restarted below the entry's `at_edit`. Entries now carry `agent` (the agent key); `pruneLedger` keeps every counter a surviving entry depends on, and applies the TTL and an idle cap (64) only to counters with no entry. Regression test: a counter 8 days idle whose entry stays fresh, plus 70 newer idle agents — the counter survives and the next edited red counts (seen red when the owned-counter rule is disabled).
2. **Caps after insert.** The I/O now folds the event's edit and run first and prunes the completed ledger. Regression test through the real hook: a file pre-filled to the entry cap stays at the cap after a new run (seen red when pruning runs first).

This round's diff includes the test files.

## What to answer

1. Does the diff contain a defect — in the budget entry, or in the recorder call it pays for (a path that can change the recorder's result, a lock problem, a privacy leak into the ledger)? Name file and line.
2. Does the change expand any agent's authority, or weaken any existing gate?
3. Is the raise justified as recorded?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## The diff (`git diff origin/main...HEAD`, gated file, the code it pays for, and its tests)

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index d4a864631a..7b2f75fa0a 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1567400,
+    "max_bytes": 1578600,
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
+            "to": 1578600,
+            "by": "agent, analysis/inbox-2026-11-strike (road-to-a-strike-the-session-keeps 3.2)",
+            "what_was_added": "The strike ledger on the verification recorder's post_tool_use path: `_lib/strike_ledger.ts` (signature normalisation, the SAME/NEW/FIXED/FLAKY fold over per-agent edit counters, TTL expiry and size caps, with every edit counter a surviving entry depends on kept, and an allowlist rebuild of every persisted entry) and `_lib/strike_ledger_io.ts` (non-blocking locked write of agents/state/strike-ledger.json, fed the run the recorder appended), 8,642 B. The gate measured 1,578,057 bytes; the base at b234d08480 measured 1,569,415 here, 2,015 over the 1,567,400 ceiling before this change. That base overage is the growth merged between the 2026-11-02 raise (47161a7b70, measured 1,566,892) and b234d08480: +2,523 B from the non-merge commits in that range touching bundled sources — 7742bad8c4, 5dbafe73c5, 850c3619eb, dcb61c6f98 (provider-home and profile fixes) and e8ee59465f, 8afea9f246, e00a48598f — none of which carried a raise_log entry.",
+            "why_it_could_not_be_avoided": "The ledger has to observe the run in the same hook invocation that records it: the recorder clears its runs at every turn boundary, which is the defect the ledger exists to outlive, so a later reader in another process would see nothing. A lazy chunk would need its own manifest concern (+1 on the concern_count ratchet) and a second stdin parse of the same event for 8 KB. The base overage is included rather than left red, because a ceiling below the trunk's own reading fails every branch cut from it.",
+            "what_would_have_caught_it": "For the base overage: measuring the ceiling on the merge result, as the first raise_log entry already says. For the ledger: nothing earlier — the growth is the feature. Sized to the measurement plus about 500 bytes of rebuild jitter."
         }
     ],
     "chunks": [
diff --git a/src/scripts/_lib/strike_ledger.ts b/src/scripts/_lib/strike_ledger.ts
new file mode 100644
index 0000000000..5cc5e529ca
--- /dev/null
+++ b/src/scripts/_lib/strike_ledger.ts
@@ -0,0 +1,325 @@
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
+ * from a run. Agent ids and commands are PSEUDONYMISED by a truncated hash, not
+ * anonymised: someone holding a candidate id can recompute its key.
+ *
+ * BOUNDED. Entries and per-agent edit counters both expire after the TTL, and
+ * each map is capped (oldest dropped first), so the file the recorder parses
+ * and rewrites on its hot path cannot grow with the number of subagents.
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
+    /**
+     * Red runs on one signature: the first observed red is the baseline strike
+     * (1), and each later red counts only when this agent edited before it.
+     */
+    readonly streak: number;
+    readonly verdict: StrikeVerdict;
+    /** This agent's edit counter when this target last ran. */
+    readonly at_edit: number;
+    /** The last run was green with no edit since the red before it. */
+    readonly green_without_edit: boolean;
+    readonly last_at: string;
+    readonly platform: string;
+    /** `agentKey` of the agent this entry counts for — ties it to its edit counter. */
+    readonly agent: string;
+}
+
+/**
+ * An attempt is an edit the attempting agent made, then a run. Edits are
+ * counted per agent: a parallel subagent's edit in the shared tree may well
+ * change this agent's result, but it is not this agent's attempt, and counting
+ * it would raise a streak on a signature the agent never worked on.
+ */
+export interface EditCounter {
+    readonly n: number;
+    readonly last_at: string;
+}
+
+export interface StrikeLedger {
+    readonly version: 1;
+    /** Monotonic count of edit-tool calls per agent. Keys are agent hashes. */
+    readonly edits: Readonly<Record<string, EditCounter>>;
+    readonly entries: Readonly<Record<string, StrikeEntry>>;
+}
+
+/**
+ * Size bounds. Entries: at most MAX_ENTRIES, oldest dropped first. Edit
+ * counters: every agent that owns a surviving entry keeps its counter — an
+ * entry's `at_edit` is a position on that counter, so evicting the counter
+ * while the entry lives would restart it below the baseline and hide the next
+ * attempts — plus at most MAX_IDLE_AGENTS counters with no entry. So the file
+ * holds at most MAX_ENTRIES + MAX_IDLE_AGENTS counters.
+ */
+export const MAX_ENTRIES = 256;
+export const MAX_IDLE_AGENTS = 64;
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
+    return ledger.edits[agentKey(agent)]?.n ?? 0;
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
+export function recordEdit(ledger: StrikeLedger, agent: string, now: string): StrikeLedger {
+    const k = agentKey(agent);
+    const n = (ledger.edits[k]?.n ?? 0) + 1;
+    return { ...ledger, edits: { ...ledger.edits, [k]: { n, last_at: now } } };
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
+    const base = { at_edit: myEdits, last_at: ctx.now, platform: ctx.platform, agent: agentKey(ctx.agent) };
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
+/** The newest `max` of a map keyed by anything with a `last_at`, all within the TTL. */
+function keepRecent<T extends { readonly last_at: string }>(
+    map: Readonly<Record<string, T>>,
+    cutoff: number,
+    max: number,
+): Record<string, T> {
+    return Object.fromEntries(
+        Object.entries(map)
+            .map(([k, v]) => [k, v, Date.parse(v.last_at)] as const)
+            .filter(([, , t]) => Number.isFinite(t) && t >= cutoff)
+            .sort((a, b) => b[2] - a[2])
+            .slice(0, max)
+            .map(([k, v]) => [k, v]),
+    );
+}
+
+/**
+ * Drop entries untouched for longer than the TTL and cap them; then keep every
+ * edit counter a surviving entry depends on, and at most MAX_IDLE_AGENTS of the
+ * rest, within the TTL. Run on the COMPLETED ledger, after the event's edit and
+ * run were folded in, so the bounds hold for what is written.
+ */
+export function pruneLedger(ledger: StrikeLedger, now: string, ttlDays = STRIKE_TTL_DAYS): StrikeLedger {
+    const cutoff = Date.parse(now) - ttlDays * 86_400_000;
+    const entries = keepRecent(ledger.entries, cutoff, MAX_ENTRIES);
+    const owners = new Set(Object.values(entries).map((e) => e.agent));
+    const owned = Object.fromEntries(Object.entries(ledger.edits).filter(([k]) => owners.has(k)));
+    const idle = keepRecent(
+        Object.fromEntries(Object.entries(ledger.edits).filter(([k]) => !owners.has(k))),
+        cutoff,
+        MAX_IDLE_AGENTS,
+    );
+    return { ...ledger, edits: { ...owned, ...idle }, entries };
+}
+
+const HASH = /^[0-9a-f]{16}$/;
+const VERDICTS: ReadonlySet<string> = new Set(['NEW', 'SAME', 'FIXED', 'FLAKY']);
+const PLATFORM = /^[a-z0-9_-]{1,32}$/i;
+const validTime = (v: unknown): v is string =>
+    typeof v === 'string' && v.length <= 40 && Number.isFinite(Date.parse(v));
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
+    if (!validTime(lastAt)) return null;
+    if (typeof platform !== 'string' || !PLATFORM.test(platform)) return null;
+    const agent = r['agent'];
+    if (typeof agent !== 'string' || !HASH.test(agent)) return null;
+    return {
+        agent,
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
+    const edits: Record<string, EditCounter> = {};
+    const rawEdits = r['edits'];
+    if (typeof rawEdits === 'object' && rawEdits !== null && !Array.isArray(rawEdits)) {
+        for (const [k, v] of Object.entries(rawEdits)) {
+            if (!HASH.test(k) || typeof v !== 'object' || v === null || Array.isArray(v)) continue;
+            const n = count((v as Record<string, unknown>)['n']);
+            const at = (v as Record<string, unknown>)['last_at'];
+            if (n !== null && validTime(at)) edits[k] = { n, last_at: at };
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
index 0000000000..96f1aba5dd
--- /dev/null
+++ b/src/scripts/_lib/strike_ledger_io.ts
@@ -0,0 +1,67 @@
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
+export function observeStrike(
+    consumer_root: string,
+    envelope: Dict,
+    event: { readonly isEdit: boolean; readonly run: Dict | null },
+    now: string = new Date().toISOString(),
+): void {
+    // `run` is the record the recorder appended for THIS event, handed over by
+    // the recorder itself — never looked up in its state, where an earlier
+    // event's record of the same command would be indistinguishable.
+    const run = event.run !== null && typeof event.run['command'] === 'string' ? (event.run as unknown as RunRecord) : null;
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
+                let ledger = coerceLedger(loaded);
+                if (event.isEdit) ledger = recordEdit(ledger, agent, now);
+                if (run !== null) ledger = observeRun(ledger, run, { agent, now, platform }).ledger;
+                return pruneLedger(ledger, now);
+            },
+            { blocking: false },
+        );
+    } catch {
+        // Shadow: a ledger failure is invisible to the recorder by design.
+    }
+}
diff --git a/src/scripts/before_complete_hook.ts b/src/scripts/before_complete_hook.ts
index 1367bcda3e..274a031885 100644
--- a/src/scripts/before_complete_hook.ts
+++ b/src/scripts/before_complete_hook.ts
@@ -75,6 +75,7 @@ import {
   type QualityRun,
 } from "./_lib/touched_file_quality.js";
 import { runnerOf } from "./_lib/verification_evidence.js";
+import { observeStrike } from "./_lib/strike_ledger_io.js";
 import { resolve_toolchain } from "../agent-src/templates/scripts/work_engine/stack/runner.js";
 
 // NOTE: the Python docstring says `agents/runtime/state/`, but the code
@@ -760,6 +761,7 @@ function _update(
   envelope: StateDict,
   quality: { runs: QualityRun[]; source: string } | null = null,
   assetRender: AssetRenderRecord | AssetRenderGap | null = null,
+  onRunRecorded: ((run: StateDict) => void) | null = null,
 ): StateDict {
   const session_id = (envelope["session_id"] || state["session_id"] || "") as string;
   if (session_id && session_id !== state["session_id"]) {
@@ -903,7 +905,7 @@ function _update(
       const runs = Array.isArray(state["verification_runs"])
         ? [...(state["verification_runs"] as unknown[])]
         : [];
-      runs.push({
+      const recorded: StateDict = {
         command: cmd.slice(0, 512),
         tool,
         exit_code: exit.code,
@@ -920,7 +922,9 @@ function _update(
         runner: runnerOf(cmd),
         after_edits: _asInt(state["edits_this_turn"]),
         at: _now(),
-      });
+      };
+      runs.push(recorded);
+      onRunRecorded?.(recorded);
       // The NEWEST are kept for detector C, which asks whether a pass follows
       // the last edit. Detector F asks a question the head answers — was there a
       // red before the green — so the cap keeps the FIRST failing record too,
@@ -1028,6 +1032,9 @@ export function run(
   // `state` is captured for the verbose line below; the value that lands is the
   // one computed inside the lock, from state read inside the lock.
   let state: StateDict = {};
+  // The run THIS event appended, handed out by the recorder itself — the
+  // strike ledger observes exactly it and never infers one from the state.
+  let appendedRun: StateDict | null = null;
   // Three-state result (state_io § Three states, not two). This mutator NEVER
   // returns null, so `skipped` is unreachable here — but it is handled with
   // `written` rather than lumped with `failed`, because the two have opposite
@@ -1043,7 +1050,9 @@ export function run(
     // treats a missing counter as 0 and the `=== true` guards treat a missing
     // flag as false, so every assertion would still pass while `schema_version`
     // and an explicit `ci_last: null` vanished from a freshly created file.
-    state = _update({ ..._empty_state(), ...loaded } as StateDict, event, envelope, quality, assetRender);
+    state = _update({ ..._empty_state(), ...loaded } as StateDict, event, envelope, quality, assetRender, (r) => {
+      appendedRun = r;
+    });
     return state;
   });
   if (outcome === "failed") {
@@ -1079,6 +1088,21 @@ export function run(
     }
   }
 
+  // The strike ledger, SHADOW.
+  // It reads the run this hook just recorded (one capture, two readers) and
+  // keeps a streak per target that survives the turn reset above. Its own file,
+  // its own lock, and a failure there never touches this hook's exit code.
+  if (event === "post_tool_use") {
+    const pl = envelope["payload"];
+    const [tool] = _extract_command(
+      typeof pl === "object" && pl !== null && !Array.isArray(pl) ? (pl as StateDict) : {},
+    );
+    observeStrike(consumer_root, envelope, {
+      isEdit: tool !== null && EDIT_TOOLS.has(tool),
+      run: appendedRun,
+    });
+  }
+
   if (verbose) {
     process.stderr.write(
       `verify-before-complete-hook: event=${event} ` +
diff --git a/tests/scripts/strike_ledger.test.ts b/tests/scripts/strike_ledger.test.ts
new file mode 100644
index 0000000000..e5ab56fe81
--- /dev/null
+++ b/tests/scripts/strike_ledger.test.ts
@@ -0,0 +1,209 @@
+/**
+ * Strike ledger — signature and fold.
+ *
+ * Synthetic runs only. Each verdict is asserted from both sides: the case that
+ * must produce it and the nearest case that must not.
+ */
+import { describe, expect, it } from 'vitest';
+
+import {
+    MAX_IDLE_AGENTS,
+    agentKey,
+    coerceLedger,
+    emptyLedger,
+    failureSignature,
+    observeRun,
+    pruneLedger,
+    recordEdit,
+    targetKey,
+    type StrikeLedger,
+} from '../../src/scripts/_lib/strike_ledger.js';
+import type { RunRecord } from '../../src/scripts/_lib/verification_evidence.js';
+
+const CMD = 'npx vitest run tests/a.test.ts';
+
+function red(failing: string, duration = '1.23s', line = 12): RunRecord {
+    return {
+        command: CMD,
+        runner: 'vitest',
+        exit_code: 1,
+        stdout_tail:
+            // Drift sits INSIDE the failure-bearing lines, where the signature reads it.
+            ` FAIL  tests/a.test.ts > ${failing} ${duration}\n` +
+            `AssertionError: expected 2 to be 3 at tests/a.test.ts:${String(line)}:9 (2026-11-03T10:${String(line).padStart(2, '0')}:01Z, 0x7f${String(line)}a)\n` +
+            `      Tests  1 failed | 4 passed (5)\n   Duration  ${duration} (transform 40ms)\n` +
+            `   Start at  10:${String(line).padStart(2, '0')}:01\n`,
+        stderr_tail: '',
+    };
+}
+
+const green: RunRecord = {
+    command: CMD,
+    runner: 'vitest',
+    exit_code: 0,
+    stdout_tail: '      Tests  5 passed (5)\n',
+    stderr_tail: '',
+};
+
+const ctx = (n: number) => ({ agent: 'main', now: `2026-11-03T10:00:${String(n).padStart(2, '0')}Z`, platform: 'claude' });
+
+function step(l: StrikeLedger, run: RunRecord, n: number, edit = true) {
+    const before = edit ? recordEdit(l, 'main', ctx(n).now) : l;
+    return observeRun(before, run, ctx(n));
+}
+
+describe('failureSignature', () => {
+    it('is stable across duration, timestamp and line-number drift', () => {
+        expect(failureSignature(red('adds', '1.23s', 12))).toBe(failureSignature(red('adds', '9.80s', 47)));
+    });
+
+    it('differs when a different test fails', () => {
+        expect(failureSignature(red('adds'))).not.toBe(failureSignature(red('subtracts')));
+    });
+
+    it('differs when the failure count differs', () => {
+        const two = { ...red('adds'), stdout_tail: red('adds').stdout_tail?.replace('1 failed', '2 failed') };
+        expect(failureSignature(red('adds'))).not.toBe(failureSignature(two));
+    });
+});
+
+describe('observeRun — the ledger verdicts', () => {
+    it('red, edit, same red → SAME with streak 2', () => {
+        let r = step(emptyLedger(), red('adds'), 1);
+        expect(r.verdict).toBe('NEW');
+        r = step(r.ledger, red('adds', '2.0s', 30), 2);
+        expect(r.verdict).toBe('SAME');
+        expect(r.ledger.entries[targetKey('main', green)]?.streak).toBe(2);
+    });
+
+    it('a re-run with no edit between is not a new attempt', () => {
+        let r = step(emptyLedger(), red('adds'), 1);
+        r = step(r.ledger, red('adds'), 2, false);
+        expect(r.verdict).toBe('SAME');
+        expect(r.ledger.entries[targetKey('main', green)]?.streak).toBe(1);
+    });
+
+    it('a different failure is NEW and restarts the streak — progress, not looping', () => {
+        let r = step(emptyLedger(), red('adds'), 1);
+        r = step(r.ledger, red('adds'), 2);
+        r = step(r.ledger, red('subtracts'), 3);
+        expect(r.verdict).toBe('NEW');
+        expect(r.ledger.entries[targetKey('main', green)]?.streak).toBe(1);
+    });
+
+    it('red then green after an edit → FIXED, streak 0', () => {
+        let r = step(emptyLedger(), red('adds'), 1);
+        r = step(r.ledger, green, 2);
+        expect(r.verdict).toBe('FIXED');
+        expect(r.ledger.entries[targetKey('main', green)]?.streak).toBe(0);
+    });
+
+    it('red / green / red with no edit → FLAKY, and the streak does not grow', () => {
+        let r = step(emptyLedger(), red('adds'), 1);
+        r = step(r.ledger, green, 2, false);
+        r = step(r.ledger, red('adds'), 3, false);
+        expect(r.verdict).toBe('FLAKY');
+        expect(r.ledger.entries[targetKey('main', green)]?.streak).toBe(1);
+    });
+
+    it('red / green / red WITH an edit before the second red is not FLAKY', () => {
+        let r = step(emptyLedger(), red('adds'), 1);
+        r = step(r.ledger, green, 2);
+        r = step(r.ledger, red('adds'), 3);
+        expect(r.verdict).toBe('NEW');
+    });
+
+    it('two agents on the same command keep separate streaks', () => {
+        let l = recordEdit(emptyLedger(), 'a', ctx(0).now);
+        l = observeRun(l, red('adds'), { ...ctx(1), agent: 'a' }).ledger;
+        l = recordEdit(l, 'b', ctx(1).now);
+        l = observeRun(l, red('adds'), { ...ctx(2), agent: 'b' }).ledger;
+        expect(l.entries[targetKey('a', green)]?.streak).toBe(1);
+        expect(l.entries[targetKey('b', green)]?.streak).toBe(1);
+    });
+
+    it("another agent's edit is not this agent's attempt", () => {
+        let l = recordEdit(emptyLedger(), 'a', ctx(0).now);
+        l = observeRun(l, red('adds'), { ...ctx(1), agent: 'a' }).ledger;
+        l = recordEdit(l, 'b', ctx(1).now); // b edits the shared tree; a only re-runs
+        const r = observeRun(l, red('adds'), { ...ctx(2), agent: 'a' });
+        expect(r.verdict).toBe('SAME');
+        expect(r.ledger.entries[targetKey('a', green)]?.streak).toBe(1);
+    });
+
+    it('an instrument gap leaves the ledger untouched', () => {
+        const l = step(emptyLedger(), red('adds'), 1).ledger;
+        const gap: RunRecord = { ...green, exit_code: null };
+        const r = observeRun(l, gap, ctx(2));
+        expect(r.verdict).toBeNull();
+        expect(r.ledger).toBe(l);
+    });
+});
+
+describe('ledger lifetime and shape', () => {
+    it('a later session within the TTL inherits the streak; an older one is pruned', () => {
+        let r = step(emptyLedger(), red('adds'), 1);
+        r = step(r.ledger, red('adds'), 2);
+        const later = pruneLedger(r.ledger, '2026-11-08T10:00:00Z');
+        expect(later.entries[targetKey('main', green)]?.streak).toBe(2);
+        expect(pruneLedger(r.ledger, '2026-11-11T10:00:00Z').entries).toEqual({});
+    });
+
+    it('rebuilds persisted entries from allowlisted fields and drops invalid ones', () => {
+        const good = step(emptyLedger(), red('adds'), 1).ledger;
+        const [key, entry] = Object.entries(good.entries)[0] ?? [];
+        const raw = {
+            edits: { ...good.edits, notahash: { n: 3, last_at: '2026-11-03T10:00:00Z' }, deadbeefdeadbeef: { n: -1, last_at: '2026-11-03T10:00:00Z' } },
+            entries: {
+                [key as string]: { ...entry, stdout_tail: 'SECRET token=abc' },
+                ffffffffffffffff: null,
+                eeeeeeeeeeeeeeee: { ...entry, streak: -2 },
+                'not a key': entry,
+            },
+        };
+        const back = coerceLedger(raw);
+        expect(Object.keys(back.entries)).toEqual([key]);
+        expect(JSON.stringify(back)).not.toMatch(/SECRET|notahash|deadbeefdeadbeef/);
+        expect(() => pruneLedger(back, '2026-11-04T00:00:00Z')).not.toThrow();
+    });
+
+    it('caps idle edit counters, newest kept, and expires them after the TTL', () => {
+        let l = emptyLedger();
+        for (let i = 0; i < MAX_IDLE_AGENTS + 10; i += 1) {
+            l = recordEdit(l, `sub-${String(i)}`, `2026-11-03T10:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}Z`);
+        }
+        const capped = pruneLedger(l, '2026-11-03T12:00:00Z');
+        expect(Object.keys(capped.edits)).toHaveLength(MAX_IDLE_AGENTS);
+        expect(capped.edits[agentKey(`sub-${String(MAX_IDLE_AGENTS + 9)}`)]).toBeDefined();
+        expect(capped.edits[agentKey('sub-0')]).toBeUndefined();
+        expect(pruneLedger(l, '2026-11-20T00:00:00Z').edits).toEqual({});
+    });
+
+    it('a counter whose entry survives is never evicted — by the TTL or by the idle cap', () => {
+        // main edits 10 times on day 0, then only re-runs for 8 days: the entry
+        // stays fresh, the counter does not. Then 70 idle subagents arrive.
+        let l = emptyLedger();
+        for (let i = 0; i < 10; i += 1) l = recordEdit(l, 'main', '2026-11-01T00:00:00Z');
+        l = observeRun(l, red('adds'), { ...ctx(1), now: '2026-11-01T00:00:01Z' }).ledger;
+        l = observeRun(l, red('adds'), { ...ctx(2), now: '2026-11-08T23:00:00Z' }).ledger;
+        for (let i = 0; i < MAX_IDLE_AGENTS + 6; i += 1) l = recordEdit(l, `idle-${String(i)}`, '2026-11-09T00:00:00Z');
+        l = pruneLedger(l, '2026-11-09T00:00:00Z');
+        expect(l.edits[agentKey('main')]?.n).toBe(10);
+        l = recordEdit(l, 'main', '2026-11-09T00:00:01Z');
+        const r = observeRun(l, red('adds'), { ...ctx(3), now: '2026-11-09T00:00:02Z' });
+        expect(r.verdict).toBe('SAME');
+        expect(r.ledger.entries[targetKey('main', green)]?.streak).toBe(2);
+    });
+
+    it('the first observed red is the baseline strike, without an edit before it', () => {
+        const r = observeRun(emptyLedger(), red('adds'), ctx(1));
+        expect(r.verdict).toBe('NEW');
+        expect(r.ledger.entries[targetKey('main', green)]?.streak).toBe(1);
+    });
+
+    it('stores no text from the run', () => {
+        const r = step(emptyLedger(), red('adds'), 1);
+        const json = JSON.stringify(r.ledger);
+        expect(json).not.toMatch(/AssertionError|adds|tests\/a\.test\.ts|vitest/);
+    });
+});
diff --git a/tests/scripts/strike_ledger_hook.test.ts b/tests/scripts/strike_ledger_hook.test.ts
new file mode 100644
index 0000000000..fc4e1aef98
--- /dev/null
+++ b/tests/scripts/strike_ledger_hook.test.ts
@@ -0,0 +1,85 @@
+/**
+ * The strike ledger through the real
+ * recorder: a streak survives the turn reset and a session change, while the
+ * recorder's own turn-scoped runs are still cleared.
+ */
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
+import { beforeEach, describe, expect, it } from 'vitest';
+
+import { run } from '../../src/scripts/before_complete_hook.js';
+import { MAX_ENTRIES, STRIKE_LEDGER_FILE, type StrikeLedger } from '../../src/scripts/_lib/strike_ledger.js';
+
+let tmp: string;
+beforeEach(() => {
+    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'strike-'));
+});
+
+const RED = 'FAIL  tests/a.test.ts > adds\nAssertionError: expected 2 to be 3\n      Tests  1 failed | 4 passed (5)\n';
+const GREEN = '      Tests  5 passed (5)\n';
+
+function send(session: string, event: string, payload: Record<string, unknown> = {}): void {
+    run(JSON.stringify({ event, session_id: session, platform: 'claude', payload }), { consumer_root: tmp });
+}
+const bash = (s: string, out: string, exit: number) =>
+    send(s, 'post_tool_use', {
+        tool_name: 'Bash',
+        tool_input: { command: 'npx vitest run' },
+        tool_response: { stdout: out, stderr: '', exit_code: exit },
+    });
+const edit = (s: string) => send(s, 'post_tool_use', { tool_name: 'Edit', tool_input: { file_path: 'src/a.ts' } });
+const ledger = (): StrikeLedger => JSON.parse(fs.readFileSync(path.join(tmp, STRIKE_LEDGER_FILE), 'utf8')) as StrikeLedger;
+const only = () => Object.values(ledger().entries)[0];
+
+describe('strike ledger via before_complete_hook', () => {
+    it('counts the same red across a turn reset and a new session', () => {
+        bash('s1', RED, 1);
+        expect(only()?.streak).toBe(1);
+        send('s1', 'user_prompt_submit'); // turn reset clears the recorder's runs
+        edit('s1');
+        bash('s1', RED, 1);
+        expect(only()).toMatchObject({ streak: 2, verdict: 'SAME' });
+
+        edit('s2');
+        bash('s2', RED, 1);
+        expect(only()).toMatchObject({ streak: 3, verdict: 'SAME', platform: 'claude' });
+    });
+
+    it('a green after an edit resets the streak', () => {
+        bash('s1', RED, 1);
+        edit('s1');
+        bash('s1', GREEN, 0);
+        expect(only()).toMatchObject({ streak: 0, verdict: 'FIXED' });
+    });
+
+    it('a non-verifying command never writes the ledger', () => {
+        send('s1', 'post_tool_use', { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: { stdout: 'a', exit_code: 0 } });
+        expect(fs.existsSync(path.join(tmp, STRIKE_LEDGER_FILE))).toBe(false);
+    });
+
+    it('never re-observes a run an earlier event appended — same command, inside any time window', () => {
+        bash('s1', RED, 1);
+        edit('s1'); // an edit-only event right after: nothing is observed again
+        edit('s1');
+        expect(only()).toMatchObject({ streak: 1, verdict: 'NEW' });
+        // and a non-verifying Bash event does not re-observe the red either
+        send('s1', 'post_tool_use', { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: { stdout: 'a', exit_code: 0 } });
+        expect(only()).toMatchObject({ streak: 1, verdict: 'NEW' });
+    });
+
+    it('the written file honours the entry cap after this event is folded in', () => {
+        const entries: Record<string, unknown> = {};
+        for (let i = 0; i < MAX_ENTRIES; i += 1) {
+            entries[i.toString(16).padStart(16, '0')] = {
+                sig: null, streak: 0, verdict: 'FIXED', at_edit: 0, green_without_edit: false,
+                last_at: new Date(Date.now() - 1000 * (i + 10)).toISOString(), platform: 'claude', agent: 'a'.repeat(16),
+            };
+        }
+        fs.mkdirSync(path.join(tmp, 'agents/state'), { recursive: true });
+        fs.writeFileSync(path.join(tmp, STRIKE_LEDGER_FILE), JSON.stringify({ version: 1, edits: {}, entries }));
+        bash('s1', RED, 1);
+        expect(Object.keys(ledger().entries)).toHaveLength(MAX_ENTRIES);
+    });
+});
```
