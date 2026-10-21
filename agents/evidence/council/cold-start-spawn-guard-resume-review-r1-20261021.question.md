<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-21 for branch
     drain/cold-start-probes-20261021, round 1, committed verbatim so the
     verdict recorded beside it can be checked against what was asked. -->

# Modification review, round 1 — spawn-guard-shadow also records resumes and a reuse verdict

You are one seat of a modification review. `check_kernel_edit_ratified`
classifies this diff as touching hook plumbing, because it changes the tool
list of one concern in `src/scripts/hook_manifest.yaml` and its compiled
sibling `hook_manifest.json`. Review subject (from `ratification_subject` at
revision `46f9d8eb4`):
`07a8fab614b6fc07d3c7c5a95925eafca388ca88bdad62d75fd316820c68fcb6`.

## What changed

Roadmap `road-to-a-cold-start-paid-once`, step 3.3. The concern
`spawn-guard-shadow` is a `pre_tool_use` concern with `effect: telemetry`,
`severity: advisory` and `fail_closed: false`. On each bound tool call it
appends one line to a local, gitignored subagent ledger, and it exits 0. Before
this change it was bound to `Agent` and `Task`. This change:

1. Adds `SendMessage` to the concern's `tools:` list. On that tool the line
   records `dispatch_kind: 'resume'`, and evaluates the existing candidate
   concurrency thresholds against the same open-dispatch count a spawn reads.
2. On `Agent` / `Task`, adds a `reuse` field computed by the new pure
   `shadowReuseVerdict()` in `src/scripts/_lib/worker_reuse.ts`.
   - When the host capability row's `worker_resume` is false, the field is
     `fresh` with reason `host_resume_unobserved`. This is the production state
     on every host today, because no registry row sets `worker_resume`.
   - When `worker_resume` is true and no worker register is supplied, the reason
     is `worker_register_unrecorded`.
   - Otherwise the field is `would_resume` with the first eligible worker's name,
     or `fresh` with the union of refusal reasons from the existing
     `decideWorkerReuse()`.
   - The hook takes an optional third parameter, used by the tests to supply a
     register.
3. Adds `resume_admission: 'counted' | 'unobserved'` to every line, `counted`
   only on platform `claude`.

## The host observations it rests on

These come from Claude Code 2.1.306 on 2026-10-21, child sessions in empty
projects, recorded in
`agents/evidence/investigations/host-continuation-observations-2026-10.md`:

- `PreToolUse` fires on the `SendMessage` call that resumes a finished
  subagent, and a deny returned there is honoured.
- With `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=1`, a second fresh spawn was
  refused while one subagent ran, but a resume was admitted in the same window.

## How to read the branch

The branch is `drain/cold-start-probes-20261021`. If you can reach it:
`git diff origin/main...drain/cold-start-probes-20261021 -- src/scripts/hook_manifest.yaml src/scripts/hook_manifest.json src/scripts/hooks/spawn_guard_shadow_hook.ts src/scripts/_lib/worker_reuse.ts tests/hooks/spawn_guard_shadow.test.ts tests/scripts/_lib_worker_reuse.test.ts`.
The same diff is included below. The JSON sibling changes one line, which
mirrors the YAML tool list.

## The question

Does this change, as written, do what it states without expanding the agent's
authority, and is it correct? Return:

- **verdict:** one of `ratified`, `confirmed-non-expanding` or `refused`.
- **findings:** each with a severity (blocking or non-blocking), the file and
  line, and what would resolve it.

## The diff

```diff
diff --git a/src/scripts/_lib/worker_reuse.ts b/src/scripts/_lib/worker_reuse.ts
index 2e3100b4d..26d5ff2ef 100644
--- a/src/scripts/_lib/worker_reuse.ts
+++ b/src/scripts/_lib/worker_reuse.ts
@@ -126,6 +126,46 @@ export function eligibleWorkers(workers: readonly WorkerState[], context: ReuseC
     return workers.filter((w) => decideWorkerReuse(w, context).verdict === 'resume').map((w) => w.name);
 }
 
+/**
+ * Reasons the shadow guard can record before any worker is compared: the host
+ * offers no resume, no worker register was recorded, or the register is empty.
+ * An unrecorded register is NOT an empty one — conflating them would let a
+ * missing writer read as "no worker was ever eligible".
+ */
+export type ShadowPreconditionReason = 'host_resume_unobserved' | 'worker_register_unrecorded' | 'no_candidate';
+
+export type ShadowReuseVerdict =
+    | { verdict: 'would_resume'; name: string; reasons: [] }
+    | { verdict: 'fresh'; name: null; reasons: Array<RefusalReason | ShadowPreconditionReason> };
+
+export interface ShadowReuseInput {
+    /** The host row's `worker_resume`; false means nothing below is read. */
+    host_resume: boolean;
+    /** The register view, or null when none was recorded. */
+    workers: readonly WorkerState[] | null;
+    context: ReuseContext | null;
+}
+
+/**
+ * The verdict `spawn-guard-shadow` records for one spawn: the first eligible
+ * worker by name, or `fresh` with every candidate's refusal reasons, each once,
+ * in condition order.
+ */
+export function shadowReuseVerdict(input: ShadowReuseInput): ShadowReuseVerdict {
+    if (!input.host_resume) return { verdict: 'fresh', name: null, reasons: ['host_resume_unobserved'] };
+    if (input.workers === null || input.context === null) {
+        return { verdict: 'fresh', name: null, reasons: ['worker_register_unrecorded'] };
+    }
+    if (input.workers.length === 0) return { verdict: 'fresh', name: null, reasons: ['no_candidate'] };
+    const seen = new Set<RefusalReason>();
+    for (const w of input.workers) {
+        const d = decideWorkerReuse(w, input.context);
+        if (d.verdict === 'resume' && d.name !== null) return { verdict: 'would_resume', name: d.name, reasons: [] };
+        for (const r of d.reasons) seen.add(r);
+    }
+    return { verdict: 'fresh', name: null, reasons: REFUSAL_REASONS.filter((r) => seen.has(r)) };
+}
+
 export type SuccessorBrief =
     | { kind: 'resume'; name: string }
     | { kind: 'fresh' }
diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index ece9e52e9..a0f2a4cd8 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
@@ -1416,7 +1416,9 @@ concerns:
     fail_closed: false
     severity: advisory
     effect: telemetry
-    tools: [Agent, Task]
+    # SendMessage: a resume is admitted past the host's spawn cap, so the guard
+    # counts it with the spawns (road-to-a-cold-start-paid-once 1.5, 3.3).
+    tools: [Agent, Task, SendMessage]
   # road-to-source-first-frontend Phase 3 Steps 1-2 — source-first gate, SHADOW
   # ONLY, per docs/contracts/concern-activation-policy.md. On every
   # capture-shaped tool call it appends one `source_first_gate_shadow` line
diff --git a/src/scripts/hooks/spawn_guard_shadow_hook.ts b/src/scripts/hooks/spawn_guard_shadow_hook.ts
index 60f7a31ab..19e989ab1 100644
--- a/src/scripts/hooks/spawn_guard_shadow_hook.ts
+++ b/src/scripts/hooks/spawn_guard_shadow_hook.ts
@@ -3,10 +3,12 @@
  * Spawn-guard — SHADOW ONLY (road-to-subagent-lifecycle-integrity Phase 3
  * Step 1, activated per `docs/contracts/concern-activation-policy.md`).
  *
- * What it does: on every `Agent` / `Task` tool call, read the open-dispatch
- * set the Phase-1 ledger maintains, and append one `spawn_guard_shadow` line
- * recording what a guard WOULD have done at several candidate thresholds.
- * It emits nothing to the model and it never blocks. Exit is always 0.
+ * What it does: on every `Agent` / `Task` call and every resume (`SendMessage`),
+ * read the open-dispatch set the Phase-1 ledger maintains, and append one
+ * `spawn_guard_shadow` line recording what a guard WOULD have done at several
+ * candidate thresholds; a spawn also records whether a warm worker would have
+ * been re-tasked instead (`reuse`). It emits nothing to the model and it never
+ * blocks. Exit is always 0.
  *
  * ── Why shadow and not warn ───────────────────────────────────────────────
  *
@@ -46,13 +48,16 @@
  * rides along as context and becomes a real measurement only when Phase 0
  * Step 4 establishes whether `agent_id` reaches a PreToolUse payload.
  *
- * PRIVACY BY CONSTRUCTION: counts and candidate verdicts only. No prompt, no
- * agent id, no tool input — the record type has no field able to hold any.
+ * PRIVACY BY CONSTRUCTION: counts, candidate verdicts, and a reuse verdict whose
+ * only free string is a worker's durable name from the register — never read
+ * from the tool input. No prompt, no message, no recipient, no agent id.
  */
 import * as fs from 'node:fs';
 import * as path from 'node:path';
 import { fileURLToPath, pathToFileURL } from 'node:url';
 
+import { probeHostCapabilities } from '../_lib/host_capability.js';
+import { shadowReuseVerdict, type ReuseContext, type WorkerState } from '../_lib/worker_reuse.js';
 import { appendLedgerLine, openRecordStats, resolveConsumerRoot } from './subagent_ledger_hook.js';
 import { readHookStdin } from './hook_stdin.js';
 import { EXIT_ALLOW } from './exit_codes.js';
@@ -67,6 +72,31 @@ function isObject(v: unknown): v is JsonObject {
 /** The two subagent-dispatch tool names this repo has observed across hosts. */
 export const DISPATCH_TOOL_NAMES: ReadonlySet<string> = new Set(['Agent', 'Task']);
 
+/**
+ * The tool that re-tasks a finished worker. The host's concurrency cap checks
+ * new spawns only and admits a resume past it, so a guard that counted spawns
+ * only would undercount exactly the runs the host does not bound. A resume is
+ * recorded against the same candidates.
+ */
+export const RESUME_TOOL_NAMES: ReadonlySet<string> = new Set(['SendMessage']);
+
+/**
+ * Platforms where `pre_tool_use` was observed firing on the resume tool, with a
+ * deny honoured there. Elsewhere the line says the resume half is unobserved.
+ */
+export const RESUME_ADMISSION_OBSERVED: ReadonlySet<string> = new Set(['claude']);
+
+/**
+ * Inputs to the reuse verdict. Production passes none: `host_resume` comes
+ * from the host row, and no worker register is recorded yet, which the verdict
+ * names as `worker_register_unrecorded` rather than reading as empty.
+ */
+export interface ShadowDeps {
+    host_resume?: boolean;
+    workers?: readonly WorkerState[] | null;
+    context?: ReuseContext | null;
+}
+
 /** One candidate guard configuration under shadow evaluation. */
 export interface Candidate {
     readonly label: string;
@@ -136,12 +166,23 @@ function extractToolName(payload: JsonObject): string | null {
     return typeof v === 'string' && v ? v : null;
 }
 
-export function processEnvelope(envelope: JsonValue, consumerRoot: string): number {
+export function processEnvelope(envelope: JsonValue, consumerRoot: string, deps: ShadowDeps = {}): number {
     try {
         if (!isObject(envelope)) return EXIT_ALLOW;
         const payload = unwrapPayload(envelope);
         const toolName = extractToolName(payload);
-        if (toolName === null || !DISPATCH_TOOL_NAMES.has(toolName)) return EXIT_ALLOW;
+        if (toolName === null) return EXIT_ALLOW;
+        const isResume = RESUME_TOOL_NAMES.has(toolName);
+        if (!isResume && !DISPATCH_TOOL_NAMES.has(toolName)) return EXIT_ALLOW;
+        const platform = typeof envelope['platform'] === 'string' ? envelope['platform'] : null;
+        // Only the verdict's label and reason codes reach disk — never the tool input.
+        const reuse = isResume
+            ? null
+            : shadowReuseVerdict({
+                  host_resume: deps.host_resume ?? probeHostCapabilities(platform).worker_resume,
+                  workers: deps.workers ?? null,
+                  context: deps.context ?? null,
+              });
 
         const stats = openRecordStats(consumerRoot);
         // Pre-spawn there is no agent id to resolve a parent from; the deepest
@@ -168,6 +209,9 @@ export function processEnvelope(envelope: JsonValue, consumerRoot: string): numb
             ledger_present: stats.ledger_present,
             stale_open_excluded: stats.stale_excluded,
             candidates: verdicts.map((v) => ({ label: v.label, would_deny: v.would_deny, on: v.on })),
+            dispatch_kind: isResume ? 'resume' : 'spawn',
+            resume_admission: platform !== null && RESUME_ADMISSION_OBSERVED.has(platform) ? 'counted' : 'unobserved',
+            ...(reuse === null ? {} : { reuse }),
             // Shadow posture is a property of this file, not of a setting —
             // there is no code path here that can deny.
             posture: 'shadow',
diff --git a/tests/hooks/spawn_guard_shadow.test.ts b/tests/hooks/spawn_guard_shadow.test.ts
index a6fd64206..3cdf7fbd3 100644
--- a/tests/hooks/spawn_guard_shadow.test.ts
+++ b/tests/hooks/spawn_guard_shadow.test.ts
@@ -18,6 +18,7 @@ import {
     processEnvelope,
 } from '../../src/scripts/hooks/spawn_guard_shadow_hook.js';
 import { LEDGER_DIR, OPEN_SUBDIR } from '../../src/scripts/hooks/subagent_ledger_hook.js';
+import type { ReuseContext, WorkerState } from '../../src/scripts/_lib/worker_reuse.js';
 
 let root: string;
 
@@ -86,6 +87,110 @@ describe('spawn-guard-shadow — posture', () => {
     });
 });
 
+function agentCall(subagentType: string): Record<string, unknown> {
+    return {
+        schema_version: 1,
+        platform: 'claude',
+        event: 'pre_tool_use',
+        payload: { tool_name: 'Agent', tool_input: { subagent_type: subagentType, prompt: 'SECRET-PROMPT-BODY' } },
+    };
+}
+
+function resumeCall(to: string): Record<string, unknown> {
+    return {
+        schema_version: 1,
+        platform: 'claude',
+        event: 'pre_tool_use',
+        payload: { tool_name: 'SendMessage', tool_input: { to, message: 'SECRET-MESSAGE-BODY' } },
+    };
+}
+
+const NOW = Date.parse('2026-10-21T12:00:00.000Z');
+const WORKER: WorkerState = {
+    name: 'billing-worker',
+    domain: 'ac-worker',
+    reuse: 'continuity',
+    last_request_at_ms: NOW - 60_000,
+    cache_ttl_ms: 300_000,
+    transcript_tokens: 20_000,
+    capsule_watermark_tokens: 48_000,
+    compacted: false,
+    worktree: '/repo/wt',
+    branch_head: 'abc1234',
+    skill_set_signature: 'sig-1',
+    package_version: '9.40.0',
+};
+const CONTEXT: ReuseContext = {
+    domain: 'ac-worker',
+    now_ms: NOW,
+    observed_fresh_cold_start_tokens: 240_000,
+    worktree: '/repo/wt',
+    branch_head: 'abc1234',
+    skill_set_signature: 'sig-1',
+    package_version: '9.40.0',
+};
+
+describe('spawn-guard-shadow — reuse verdict and resumes (cold-start 3.3)', () => {
+    it('records-would-resume-and-never-denies', () => {
+        for (let i = 0; i < 12; i++) plantOpen(`open${i}`, 1);
+        const exit = processEnvelope(agentCall('ac-worker'), root, {
+            host_resume: true,
+            workers: [WORKER],
+            context: CONTEXT,
+        });
+        expect(exit).toBe(0);
+        const line = ledgerLines()[0]!;
+        expect(line.dispatch_kind).toBe('spawn');
+        expect(line.reuse).toEqual({ verdict: 'would_resume', name: 'billing-worker', reasons: [] });
+        expect(line.posture).toBe('shadow');
+
+        // The refusal path records its reasons and is just as unable to deny.
+        expect(
+            processEnvelope(agentCall('ac-worker'), root, {
+                host_resume: true,
+                workers: [{ ...WORKER, compacted: true }],
+                context: CONTEXT,
+            }),
+        ).toBe(0);
+        expect(ledgerLines()[1]!.reuse).toEqual({ verdict: 'fresh', name: null, reasons: ['compacted'] });
+    });
+
+    it('production default on claude: no worker_resume in the row, so every spawn records host_resume_unobserved', () => {
+        processEnvelope(agentCall('ac-worker'), root);
+        expect(ledgerLines()[0]!.reuse).toEqual({ verdict: 'fresh', name: null, reasons: ['host_resume_unobserved'] });
+    });
+
+    it('a resume is recorded and counted against the same candidates as a spawn', () => {
+        for (let i = 0; i < 4; i++) plantOpen(`open${i}`, 1);
+        expect(processEnvelope(resumeCall('billing-worker'), root)).toBe(0);
+        const line = ledgerLines()[0]!;
+        expect(line.tool).toBe('SendMessage');
+        expect(line.dispatch_kind).toBe('resume');
+        expect(line.concurrent_open).toBe(4);
+        const n2m4 = (line.candidates as Array<{ label: string; would_deny: boolean }>).find((c) => c.label === 'n2m4');
+        expect(n2m4!.would_deny).toBe(true);
+        // A resume is not a reuse decision; it carries no verdict of its own.
+        expect(line).not.toHaveProperty('reuse');
+    });
+
+    it('records where the resume half is counted and where it is not observed', () => {
+        processEnvelope(agentCall('ac-worker'), root);
+        processEnvelope({ ...agentCall('ac-worker'), platform: 'cursor' }, root);
+        const [claude, other] = ledgerLines();
+        expect(claude!.resume_admission).toBe('counted');
+        expect(other!.resume_admission).toBe('unobserved');
+    });
+
+    it('keeps tool input off disk: no prompt, no message, no recipient', () => {
+        processEnvelope(agentCall('ac-worker'), root);
+        processEnvelope(resumeCall('billing-worker'), root);
+        const raw = JSON.stringify(ledgerLines());
+        expect(raw).not.toContain('SECRET-PROMPT-BODY');
+        expect(raw).not.toContain('SECRET-MESSAGE-BODY');
+        expect(raw).not.toContain('billing-worker');
+    });
+});
+
 describe('spawn-guard-shadow — the candidate spread', () => {
     it('evaluates every candidate, not just the pre-registered pair', () => {
         processEnvelope(toolCall('Agent'), root);
diff --git a/tests/scripts/_lib_worker_reuse.test.ts b/tests/scripts/_lib_worker_reuse.test.ts
index fb46a9e81..182eb3e31 100644
--- a/tests/scripts/_lib_worker_reuse.test.ts
+++ b/tests/scripts/_lib_worker_reuse.test.ts
@@ -12,6 +12,7 @@ import {
     eligibleWorkers,
     REFUSAL_REASONS,
     RETIRING_REASONS,
+    shadowReuseVerdict,
     type RefusalReason,
     type ReuseContext,
     type WorkerState,
@@ -115,6 +116,53 @@ describe('the register is a view', () => {
     });
 });
 
+describe('shadowReuseVerdict — what the spawn guard records', () => {
+    it('host-without-resume-records-fresh-before-reading-any-worker', () => {
+        // AC-1: a host whose row lacks worker_resume changes nothing — not even
+        // with a perfectly eligible worker in hand.
+        const v = shadowReuseVerdict({ host_resume: false, workers: [worker()], context: context() });
+        expect(v).toEqual({ verdict: 'fresh', name: null, reasons: ['host_resume_unobserved'] });
+    });
+
+    it('an unrecorded register is named, never read as an empty one', () => {
+        for (const input of [
+            { workers: null, context: context() },
+            { workers: [worker()], context: null },
+        ]) {
+            expect(shadowReuseVerdict({ host_resume: true, ...input }).reasons).toEqual(['worker_register_unrecorded']);
+        }
+        expect(shadowReuseVerdict({ host_resume: true, workers: [], context: context() }).reasons).toEqual([
+            'no_candidate',
+        ]);
+    });
+
+    it('records the first eligible worker by name', () => {
+        const v = shadowReuseVerdict({
+            host_resume: true,
+            workers: [worker({ name: 'ac-worker-search', domain: 'search' }), worker()],
+            context: context(),
+        });
+        expect(v).toEqual({ verdict: 'would_resume', name: 'ac-worker-billing', reasons: [] });
+    });
+
+    it('a refusal carries every candidate reason once, in condition order', () => {
+        const v = shadowReuseVerdict({
+            host_resume: true,
+            workers: [worker({ compacted: true }), worker({ reuse: 'never' }), worker({ compacted: true })],
+            context: context(),
+        });
+        expect(v).toEqual({ verdict: 'fresh', name: null, reasons: ['compacted', 'not_continuity'] });
+    });
+
+    it('agrees with decideWorkerReuse on every single-reason fixture', () => {
+        for (const [reason, change] of Object.entries(ONE_FAILURE)) {
+            const v = shadowReuseVerdict({ host_resume: true, workers: [worker(change.w)], context: context(change.c) });
+            expect(v.verdict, reason).toBe('fresh');
+            expect(v.reasons, reason).toEqual(decideWorkerReuse(worker(change.w), context(change.c)).reasons);
+        }
+    });
+});
+
 function capsule(over: Partial<WorkerCapsule> = {}): WorkerCapsule {
     return {
         summary: 'Billing slice half done.',
```
