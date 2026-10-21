<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-21 for branch
     drain/placeholders-20261021, round 7, committed verbatim so the verdict
     recorded beside it can be checked against what was asked. Rounds 5 and 6
     sit beside it; round 6 was never answered (cli_quota_exhausted on both seats). -->

# Modification review, round 7 — the rewrite axis, and tool-result replacement alone

You are one seat of a modification review. Roadmap `road-to-placeholders-on-the-wire`.

This round reviews the change round 6 was given and neither seat answered
(`cli_quota_exhausted`); the description below is round 6's. Since then the
branch was merged with `origin/main`, which changed two gated lines of main's own
work (`resolveConcernMain` in `dispatch_hook.ts`, a `chat_history.ts` chunk entry
in `hook-bundle-budget.json`). The diff is `origin/main..HEAD`: this change only.

Round 5 (2026-10-20, both seats `refused`, dealbreaker yes) reviewed the rewrite
axis plus three things acting on it — tool-result replacement, a prompt gate and
tool-input restoration — and asked for tool-result replacement to land alone
first. This round reviews exactly that. Restoration, the prompt gate and the
session-table minting are **removed from this change** (kept on a separate
branch for their own review); the session table module is identical to main.

Round 5's findings, and what changed for the output path:

1. `observedHostVersion` was never passed, so the drift check was unreachable.
   Now the stage reads the running version from the tail of the session
   transcript the envelope names (Claude Code stamps every line with it); a
   runtime caller that cannot observe it passes `null`, and `null` or a different
   minor version grants no `replace`. The lint passes `undefined` (it judges the
   table, not a running host).
2. No automatic disable. Now a withheld result for shape mismatch, residual hit,
   deadline breach or internal error appends a revocation to
   `agents/runtime/state/egress-revoked.json`; the capability check reads it and
   refuses that host+channel on the workspace until a person deletes the record.
   Every withheld result also raises a user-visible `systemMessage` (rotate a
   credential it carried) and a `withheld` line in `egress-rewrites.jsonl`.
3. Capability before side effects: the output path computes nothing it emits
   before the capability resolves; the per-dispatch placeholder view itself is
   the existing Phase 1 behaviour (protect/strict only, unchanged here).
4. Omitted files: the lint implementation and the budget file are in the diff
   below; test bodies are not (input ceiling), their titles are summarised.
5. `ANY_DESTINATION`, `isCategoryA`, restore-before-capability, prompt deadline,
   pruning: all belonged to the restore and prompt-gate code, which is gone.

Unchanged from round 5's description: authority is an opaque frozen
`RewriteCapability` only `resolveRewriteCapability` issues; a `replace` needs a
probe record for host, version, channel, `result: delivered`, dated the day of
the answer, with no later contradicting record. Claude's `output` (and `input`,
which nothing acts on yet) answers cite live probe records of 2026-10-20 (Claude
Code 2.1.304, `claude -p --settings <scratch file>`, no host settings file
written); their structured lines ship as `src/config/rewrite-probe-attestations.json`, <!-- ref-ignore -->
which the lint holds equal to the records. The engine chunk (loaded only when
`egress.placeholders.mode` is `protect`/`strict`; the shipped default is `off`)
carries the decision; its ceiling rises 28,000 → 44,000 with a `raise_log` entry.
The latency budget file gains one prose note stating the delta.

Bundle figures re-measured at this head after the merge: the dispatch bundle is
1,464,283 of an unchanged 1,550,000 (main moved `chat_history.ts` into a chunk);
the engine chunk is 39,294 of its 44,000 ceiling.

Gated files (`check_kernel_edit_ratified`), all in the diff below except
`host_lowering.json` (compiled from the YAML) and `hook-latency-budget.json`
(the one prose note). Subject digest at head `27241274a`:
`3e6808e3c081dc7c0a617e9073640ae83f1d7a5d2a5ba5cd9ce9d45bd6fbde8f`.

Tests at the head (titles summarised for the input ceiling; round 6's prompt,
committed beside this one, lists every title):

- `tests/scripts/_lib/egress_emission.test.ts`, 16 tests: keys and types equal
  per probed tool shape (Read, Bash, Grep, MCP); armed only in protect/strict;
  forced shape mismatch, unprovable extent, residual value, deadline breach,
  internal error and missing capability are each withheld, made visible and
  counted; the first-use explainer appears once per session; an unobserved or
  other-minor running version grants no capability; the version is read from the
  transcript tail; a withheld result for a revoking reason revokes the channel on
  the workspace until a person clears it.
- `tests/scripts/lint_hook_manifest.test.ts`, 32 rewrite-axis tests: absent and
  `offered` authorize nothing; each `replace` and `gate` prerequisite checked in
  `rewriteCapabilityGaps` is refused when it alone is missing; malformed values
  are refused; a capability-shaped object is not a capability.
- `tests/scripts/tool_result_bytes_hook.test.ts` (byte census, not gated): the
  absence pin becomes "exactly one module emits the result-rewrite field", and a
  replaced result records `delivered_bytes` different from `raw_bytes`.

Sensitivity shown red: with the shape check removed, the forced-mismatch test
failed. `tests/scripts/hooks/egress_prevention_gaps.test.ts`, through the real
dispatcher: the two tool-result gap fixtures now receive exactly one rewrite
field carrying the original keys; the typed-prompt fixture still asserts its gap.
That test writes a one-line transcript carrying a version and adds
`transcript_path` to each payload at dispatch; the fixture files are unchanged.

Comment lines are stripped from added hunks of TypeScript files.

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 1c634b3fb..e98764b8d 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -19,2 +19,12 @@
             "what_would_have_caught_it": "Measuring the ceiling against the merge result rather than the PR branch. A ceiling derived on a branch is a statement about that branch; the trunk is what the gate defends, and the two diverge exactly when several lanes land in one day."
+        },
+        {
+            "date": "2026-10-20",
+            "chunk": "src/scripts/_lib/egress_engine.ts",
+            "from": 28000,
+            "to": 44000,
+            "by": "agent, road-to-placeholders-on-the-wire Phases 3 and 5",
+            "what_was_added": "The egress stage's decision about a tool result, moved here from the dispatch bundle: whether it goes back to the host replaced (placeholders 3.1-3.4), the rewrite capability check over host_lowering's rewrite axis, its probe records, the running host's version and the workspace's revocations, and the host emission. Measured 39,126 bytes with them against 20,005 before. The ceiling is that reading plus the identifier-rule growth the engine's own entry already queued, rounded up.",
+            "why_it_could_not_be_avoided": "The same code first landed in the dispatch bundle and measured +16,365 bytes against 454 bytes of headroom there. Moving it into this chunk is the shape the 2026-10-18 council chose for the engine itself: it is loaded only when the stage's mode is protect or strict, so a default install, whose mode is off, never pays it. What stayed in the dispatch bundle is the call into the chunk and the payload stub's delivered length, which fit under the unchanged dispatch ceiling.",
+            "what_would_have_caught_it": "Nothing was missed: the composition gate reported both readings before any push. Recorded so the next reader sees that this raise is the relocated cost of a feature, not new weight in the path every hook event loads."
         }
@@ -30,3 +40,3 @@
             "entry": "src/scripts/_lib/egress_engine.ts",
-            "max_bytes": 28000,
+            "max_bytes": 44000,
             "registered_at": "2026-10-18",
diff --git a/src/scripts/_lib/egress_emission.ts b/src/scripts/_lib/egress_emission.ts
new file mode 100644
index 000000000..131d171e5
--- /dev/null
+++ b/src/scripts/_lib/egress_emission.ts
@@ -0,0 +1,374 @@
+import * as fs from "node:fs";
+import * as path from "node:path";
+
+import type { EgressStageResult } from "../hooks/egress_stage.js";
+import type { SurfaceRow } from "../hooks/host_lowering.js";
+import { BODY_KEYS, type JsonObject, type JsonValue } from "../hooks/payload_stub.js";
+import { is_replay_mode } from "../hooks/state_io.js";
+import { detect } from "./egress_rules.js";
+import { resolveRewriteCapability } from "./rewrite_capability.js";
+
+export const STAGE_WITHHELD_MARKER = "_agent_config_egress_withheld";
+
+export const REWRITE_DEADLINE_MS = 500;
+
+export type RewriteWithheld =
+  | "no-capability"
+  | "extent-unproven"
+  | "shape-mismatch"
+  | "residual-hit"
+  | "deadline"
+  | "stage-error";
+
+export type RewriteField = "updatedToolOutput" | "updatedMCPToolOutput";
+
+export type ToolOutputRewrite =
+  | {
+      readonly outcome: "emitted";
+      readonly field: RewriteField;
+      readonly value: JsonValue;
+      readonly replaced: number;
+      readonly explain?: string;
+    }
+  | { readonly outcome: "withheld"; readonly reason: RewriteWithheld; readonly replaced: number };
+
+function isObject(v: unknown): v is JsonObject {
+  return typeof v === "object" && v !== null && !Array.isArray(v);
+}
+
+function kind(v: unknown): string {
+  if (v === null) return "null";
+  if (Array.isArray(v)) return "array";
+  return typeof v;
+}
+
+export function sameShape(a: JsonValue, b: JsonValue): boolean {
+  if (kind(a) !== kind(b)) return false;
+  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => sameShape(x, b[i] as JsonValue));
+  if (isObject(a) && isObject(b)) {
+    const ka = Object.keys(a);
+    const kb = Object.keys(b);
+    return ka.length === kb.length && ka.every((k, i) => k === kb[i] && sameShape(a[k] as JsonValue, b[k] as JsonValue));
+  }
+  return true;
+}
+
+function hasWithheld(v: JsonValue): boolean {
+  if (Array.isArray(v)) return v.some(hasWithheld);
+  if (isObject(v)) return STAGE_WITHHELD_MARKER in v || Object.values(v).some((x) => hasWithheld(x as JsonValue));
+  return false;
+}
+
+function residual(v: JsonValue): boolean {
+  if (typeof v === "string") return detect(v).length > 0;
+  if (Array.isArray(v)) return v.some((x) => residual(x));
+  if (isObject(v)) return Object.values(v).some((x) => residual(x as JsonValue));
+  return false;
+}
+
+function resultKey(payload: JsonObject): string | null {
+  return BODY_KEYS.result.find((k) => payload[k] !== undefined && payload[k] !== null) ?? null;
+}
+
+export const REWRITE_FILE = path.join("agents", "runtime", "state", "egress-rewrites.jsonl");
+const TOOL_NAME = /^[A-Za-z0-9_.:-]{1,128}$/;
+
+export function recordRewrite(workspaceRoot: string, envelope: JsonObject, r: ToolOutputRewrite, replay = false): void {
+  if (replay) return;
+  const tool = isObject(envelope["payload"]) ? envelope["payload"]["tool_name"] : undefined;
+  const line = {
+    ts: new Date().toISOString(),
+    platform: String(envelope["platform"] ?? ""),
+    tool: typeof tool === "string" && TOOL_NAME.test(tool) ? tool : null,
+    outcome: r.outcome,
+    reason: r.outcome === "withheld" ? r.reason : null,
+    replaced: r.replaced,
+  };
+  try {
+    const file = path.join(workspaceRoot, REWRITE_FILE);
+    fs.mkdirSync(path.dirname(file), { recursive: true });
+    fs.appendFileSync(file, `${JSON.stringify(line)}\n`, "utf8");
+  } catch {
+  }
+}
+
+export const TOKEN_EXPLAINER =
+  "agent-config replaced listed values in this tool result with placeholder tokens such as __APIKEY_1_a1b2c3__. " +
+  "When you need such a value, copy its token exactly as written; never guess or reconstruct what it stands for.";
+
+const EXPLAINED_DIR = path.join("agents", "runtime", "state", "egress-token-explained");
+const SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/;
+
+export function firstTokenUse(workspaceRoot: string, sessionId: unknown, replay = false): boolean {
+  if (typeof sessionId !== "string" || !SESSION_ID.test(sessionId)) return true;
+  if (replay) return true;
+  const flag = path.join(workspaceRoot, EXPLAINED_DIR, sessionId);
+  try {
+    fs.mkdirSync(path.dirname(flag), { recursive: true });
+    fs.writeFileSync(flag, "", { flag: "wx" });
+    return true;
+  } catch {
+    return false;
+  }
+}
+
+export const REVOKING_REASONS: ReadonlySet<RewriteWithheld> = new Set(["shape-mismatch", "residual-hit", "deadline", "stage-error"]);
+export const REVOCATION_FILE = path.join("agents", "runtime", "state", "egress-revoked.json");
+
+type Revocation = { host: string; channel: string; reason: string; at: string };
+
+export function readRevocations(workspaceRoot: string): Revocation[] {
+  try {
+    const raw = JSON.parse(fs.readFileSync(path.join(workspaceRoot, REVOCATION_FILE), "utf8")) as unknown;
+    return Array.isArray(raw) ? (raw as Revocation[]) : [];
+  } catch {
+    return [];
+  }
+}
+
+function recordRevocation(workspaceRoot: string, r: Revocation, replay: boolean): void {
+  if (replay) return;
+  try {
+    const file = path.join(workspaceRoot, REVOCATION_FILE);
+    fs.mkdirSync(path.dirname(file), { recursive: true });
+    fs.writeFileSync(file, `${JSON.stringify([...readRevocations(workspaceRoot), r])}\n`, "utf8");
+  } catch {
+  }
+}
+
+const VERSION_IN_TRANSCRIPT = /"version":"(\d+\.\d+\.\d+)"/g;
+
+export function observedHostVersion(transcriptPath: unknown): string | null {
+  if (typeof transcriptPath !== "string" || transcriptPath === "") return null;
+  let fd: number | null = null;
+  try {
+    fd = fs.openSync(transcriptPath, "r");
+    const size = fs.fstatSync(fd).size;
+    const len = Math.min(size, 16384);
+    const buf = Buffer.alloc(len);
+    fs.readSync(fd, buf, 0, len, size - len);
+    const hits = [...buf.toString("utf8").matchAll(VERSION_IN_TRANSCRIPT)];
+    return hits.at(-1)?.[1] ?? null;
+  } catch {
+    return null;
+  } finally {
+    if (fd !== null) fs.closeSync(fd);
+  }
+}
+
+export interface RewriteDeps {
+  readonly packageRoot: string;
+  readonly today?: string;
+  readonly now?: () => number;
+  readonly observedHostVersion?: string | null;
+  readonly row?: SurfaceRow | null;
+  readonly replay?: boolean;
+  readonly capability?: typeof resolveRewriteCapability;
+}
+
+export function planToolOutputRewrite(
+  envelope: JsonObject,
+  stage: EgressStageResult,
+  deps: RewriteDeps,
+): ToolOutputRewrite | null {
+  const r = decide(envelope, stage, deps);
+  const workspaceRoot = String(envelope["workspace_root"] || process.cwd());
+  const replay = deps.replay ?? is_replay_mode();
+  if (r !== null) recordRewrite(workspaceRoot, envelope, r, replay);
+  if (r?.outcome === "withheld" && REVOKING_REASONS.has(r.reason)) {
+    const host = String(envelope["platform"] ?? "");
+    recordRevocation(workspaceRoot, { host, channel: "output", reason: r.reason, at: new Date().toISOString() }, replay);
+  }
+  return r;
+}
+
+function decide(envelope: JsonObject, stage: EgressStageResult, deps: RewriteDeps): ToolOutputRewrite | null {
+  if (envelope["event"] !== "post_tool_use") return null;
+  if (stage.mode !== "protect" && stage.mode !== "strict") return null;
+  const replaced = stage.counts.filter((c) => c.field === "result").reduce((n, c) => n + c.count, 0);
+  const refusedResult = stage.refused.some((r) => r.field === "result");
+  if (replaced === 0 && !refusedResult) return null;
+  const now = deps.now ?? Date.now;
+  const started = now();
+  try {
+    if (refusedResult) return { outcome: "withheld", reason: "extent-unproven", replaced };
+    const platform = String(envelope["platform"] ?? "");
+    const payload = isObject(envelope["payload"]) ? envelope["payload"] : {};
+    const cap = (deps.capability ?? resolveRewriteCapability)(platform, deps.row, "output", {
+      today: deps.today ?? new Date().toISOString().slice(0, 10),
+      root: deps.packageRoot,
+      observedHostVersion: deps.observedHostVersion !== undefined ? deps.observedHostVersion : observedHostVersion(payload["transcript_path"]),
+      revoked: readRevocations(String(envelope["workspace_root"] || process.cwd())),
+    });
+    if (!cap.ok || cap.capability.mode !== "replace") return { outcome: "withheld", reason: "no-capability", replaced };
+    const original = isObject(envelope["payload"]) ? envelope["payload"] : null;
+    const placeholder = isObject(stage.placeholder?.["payload"]) ? (stage.placeholder?.["payload"] as JsonObject) : null;
+    const key = original === null ? null : resultKey(original);
+    if (original === null || placeholder === null || key === null) {
+      return { outcome: "withheld", reason: "shape-mismatch", replaced };
+    }
+    const before = original[key] as JsonValue;
+    const after = placeholder[key] as JsonValue;
+    if (hasWithheld(after) || !sameShape(before, after)) return { outcome: "withheld", reason: "shape-mismatch", replaced };
+    if (residual(after)) return { outcome: "withheld", reason: "residual-hit", replaced };
+    if (now() - started > REWRITE_DEADLINE_MS) return { outcome: "withheld", reason: "deadline", replaced };
+    const tool = original["tool_name"];
+    const field: RewriteField = typeof tool === "string" && tool.startsWith("mcp__") ? "updatedMCPToolOutput" : "updatedToolOutput";
+    const told = !firstTokenUse(String(envelope["workspace_root"] || process.cwd()), original["session_id"], deps.replay ?? is_replay_mode());
+    return told
+      ? { outcome: "emitted", field, value: after, replaced }
+      : { outcome: "emitted", field, value: after, replaced, explain: TOKEN_EXPLAINER };
+  } catch {
+    return { outcome: "withheld", reason: "stage-error", replaced };
+  }
+}
+
+export function rewriteWithheldNotice(r: ToolOutputRewrite): string | null {
+  if (r.outcome !== "withheld") return null;
+  return (
+    `agent-config egress: a tool result carrying ${r.replaced} listed value(s) reached the model unreplaced ` +
+    `(${r.reason}). Treat it as disclosed and rotate a credential it carried. ` +
+    'What each channel is covered by: docs/contracts/egress-placeholders-v1.md § Coverage (agent-config hooks:status --coverage).'
+  );
+}
+
+export type EgressEmission = ToolOutputRewrite;
+
+export function deliveredBodyBytes(envelope: JsonObject, e: EgressEmission | null): ReadonlyMap<string, number> {
+  const out = new Map<string, number>();
+  if (e?.outcome !== "emitted" || !isObject(envelope["payload"])) return out;
+  const key = resultKey(envelope["payload"]);
+  if (key !== null) out.set(`${key}#`, Buffer.byteLength(typeof e.value === "string" ? e.value : JSON.stringify(e.value), "utf8"));
+  return out;
+}
+
+export interface EgressHostEmission {
+  readonly exit: number;
+  readonly stdout: string;
+  readonly stderr: string;
+}
+
+export interface EmitContext {
+  readonly event: string;
+  readonly severity: string;
+  readonly reason: string;
+  readonly hookEventName: string;
+}
+
+export function emitEgress(e: EgressEmission | null, ctx: EmitContext): EgressHostEmission | null {
+  if (e === null) return null;
+  if (ctx.event === "post_tool_use" && (e.outcome === "emitted" || e.outcome === "withheld")) {
+    const hso: Record<string, unknown> = { hookEventName: ctx.hookEventName };
+    const out: Record<string, unknown> = { hookSpecificOutput: hso };
+    const emitted = e.outcome === "emitted" && ctx.severity !== "block";
+    if (emitted) hso[e.field] = e.value;
+    else out["systemMessage"] = rewriteWithheldNotice(e.outcome === "emitted" ? { outcome: "withheld", reason: "stage-error", replaced: e.replaced } : e);
+    const label = ctx.severity === "block" ? ctx.reason || "agent-config hook reported a blocking finding" : ctx.reason;
+    const context = [emitted && e.outcome === "emitted" ? e.explain : undefined, label].filter(Boolean).join("\n\n");
+    if (context) hso["additionalContext"] = context;
+    return { exit: 0, stdout: `${JSON.stringify(out)}\n`, stderr: "" };
+  }
+  return null;
+}
+
+export interface StagePlan {
+  readonly decision: EgressEmission | null;
+  readonly delivered: ReadonlyMap<string, number>;
+  emit(severity: string, reasons: readonly string[]): EgressHostEmission | null;
+}
+
+export function planStage(
+  envelope: JsonObject,
+  stage: EgressStageResult,
+  deps: RewriteDeps,
+): { plan?: StagePlan } {
+  if (stage.placeholder === undefined) return {};
+  const decision = planToolOutputRewrite(envelope, stage, deps);
+  const event = String(envelope["event"] ?? "");
+  const row = deps.row ?? null;
+  const today = deps.today ?? new Date().toISOString().slice(0, 10);
+  const native = row !== null && row.json_shape !== "none" && row.verified !== null && row.verified.expires >= today;
+  const slot = row?.slots.get(event);
+  const plan: StagePlan = {
+    decision,
+    delivered: deliveredBodyBytes(envelope, decision),
+    emit(severity, reasons) {
+      if (!native || slot === undefined) return null;
+      const reason = reasons.map((r) => r.trim()).filter((r) => r.length > 0).join(" · ");
+      const hookEventName = slot.native.find((n) => n !== "" && n !== "null") ?? event;
+      return emitEgress(decision, { event, severity, reason, hookEventName });
+    },
+  };
+  return { plan };
+}
diff --git a/src/scripts/_lib/egress_engine.ts b/src/scripts/_lib/egress_engine.ts
index f63255728..7c195ecc5 100644
--- a/src/scripts/_lib/egress_engine.ts
+++ b/src/scripts/_lib/egress_engine.ts
@@ -1,4 +1,5 @@
 /**
- * The egress engine as one loadable unit: the rule table, the token grammar and
- * the commit scanner's reading of the table.
  *
@@ -16,3 +17,3 @@
  */
-export const ENGINE_SCHEMA = 1;
+export const ENGINE_SCHEMA = 2;
 
@@ -21 +22,7 @@ export { EgressRefusedError, replaceValues, TokenScope } from './egress_token.js
 export { scanText } from './secret_detector.js';
+export {
+    deliveredBodyBytes,
+    emitEgress,
+    planStage,
+    STAGE_WITHHELD_MARKER,
+} from './egress_emission.js';
diff --git a/src/scripts/_lib/rewrite_axis.ts b/src/scripts/_lib/rewrite_axis.ts
new file mode 100644
index 000000000..b860fedd6
--- /dev/null
+++ b/src/scripts/_lib/rewrite_axis.ts
@@ -0,0 +1,81 @@
+
+export const REWRITE_CHANNELS = ['output', 'input', 'prompt'] as const;
+export type RewriteChannel = (typeof REWRITE_CHANNELS)[number];
+export const REWRITE_CHANNEL_SLOT: Readonly<Record<RewriteChannel, string>> = {
+    output: 'post_tool_use',
+    input: 'pre_tool_use',
+    prompt: 'user_prompt_submit',
+};
+
+export const REWRITE_MODES = ['replace', 'offered', 'gate', 'none'] as const;
+export type RewriteMode = (typeof REWRITE_MODES)[number];
+
+export interface RewriteAnswer {
+    mode: string;
+    answered_at: string | null;
+    docs_url: string | null;
+    probe: string | null;
+    host_version: string | null;
+}
+
+export type ParsedAxis =
+    | { readonly ok: true; readonly answers: ReadonlyMap<string, RewriteAnswer> }
+    | { readonly ok: false; readonly error: string };
+
+function asString(v: unknown): string | null {
+    if (v === null || v === undefined) return null;
+    if (v instanceof Date) return v.toISOString().slice(0, 10);
+    return String(v);
+}
+
+export function parseRewriteAxis(where: string, raw: unknown): ParsedAxis {
+    const answers = new Map<string, RewriteAnswer>();
+    if (raw === undefined) return { ok: true, answers };
+    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
+        return { ok: false, error: `${where} \`rewrite:\` is not a mapping` };
+    }
+    for (const [ch, av] of Object.entries(raw as Record<string, unknown>)) {
+        if (typeof av !== 'object' || av === null || Array.isArray(av)) {
+            return { ok: false, error: `${where}/${ch} rewrite answer is not a mapping` };
+        }
+        const a = av as Record<string, unknown>;
+        answers.set(ch, {
+            mode: String(a['mode'] ?? ''),
+            answered_at: asString(a['answered_at']),
+            docs_url: asString(a['docs_url']),
+            probe: asString(a['probe']),
+            host_version: asString(a['host_version']),
+        });
+    }
+    return { ok: true, answers };
+}
+
+export function rewriteModeFor(row: { readonly rewrite_raw: unknown }, channel: RewriteChannel): RewriteMode | 'unstated' {
+    const parsed = parseRewriteAxis('', row.rewrite_raw);
+    const mode = parsed.ok ? parsed.answers.get(channel)?.mode : undefined;
+    return (REWRITE_MODES as readonly string[]).includes(mode ?? '') ? (mode as RewriteMode) : 'unstated';
+}
diff --git a/src/scripts/_lib/rewrite_capability.ts b/src/scripts/_lib/rewrite_capability.ts
new file mode 100644
index 000000000..c3da3f9c6
--- /dev/null
+++ b/src/scripts/_lib/rewrite_capability.ts
@@ -0,0 +1,240 @@
+import * as fs from "node:fs";
+import * as path from "node:path";
+
+import type { SurfaceRow } from "../hooks/host_lowering.js";
+import { parseRewriteAxis, REWRITE_CHANNEL_SLOT, type RewriteChannel } from "./rewrite_axis.js";
+
+export const REWRITE_PROBE_PATH = /^agents\/evidence\/analysis\/host-[a-z0-9-]+-probe-(\d{4}-\d{2}-\d{2})\.md$/;
+
+const ISSUED = new WeakSet<object>();
+
+export interface RewriteCapability {
+  readonly host: string;
+  readonly channel: RewriteChannel;
+  readonly mode: "replace" | "gate";
+  readonly probedVersion: string | null;
+  readonly expires: string;
+}
+
+export function isRewriteCapability(v: unknown): v is RewriteCapability {
+  return typeof v === "object" && v !== null && ISSUED.has(v);
+}
+
+export interface ProbeRecord {
+  readonly path: string;
+  readonly date: string;
+  readonly host: string | null;
+  readonly host_version: string | null;
+  readonly channel: string | null;
+  readonly result: string | null;
+  readonly auth_mode: string | null;
+}
+
+export const PROBE_ATTESTATIONS_REL = "src/config/rewrite-probe-attestations.json";
+
+function attestations(root: string): ProbeRecord[] {
+  try {
+    const raw = JSON.parse(fs.readFileSync(path.join(root, PROBE_ATTESTATIONS_REL), "utf-8")) as { records?: unknown };
+    return Array.isArray(raw.records) ? (raw.records as ProbeRecord[]).filter((r) => typeof r?.path === "string") : [];
+  } catch {
+    return [];
+  }
+}
+
+export function renderProbeAttestations(root: string): string {
+  const records = recordsOnDisk(root);
+  return `${JSON.stringify({ _comment: "Generated from agents/evidence/analysis/host-*-probe-*.md by lint_hook_manifest --write-probe-attestations; do not edit.", records }, null, 2)}\n`;
+}
+
+export interface CapabilityContext {
+  readonly today: string;
+  readonly root: string;
+  readonly observedHostVersion?: string | null;
+  readonly revoked?: ReadonlyArray<{ readonly host: string; readonly channel: string; readonly reason: string; readonly at: string }>;
+  readonly probes?: readonly ProbeRecord[];
+}
+
+export type CapabilityResult =
+  | { readonly ok: true; readonly capability: RewriteCapability }
+  | { readonly ok: false; readonly gaps: readonly string[] };
+
+function lineValue(lines: readonly string[], key: string): string | null {
+  const hit = lines.find((l) => l.startsWith(`${key}: `));
+  return hit === undefined ? null : hit.slice(key.length + 2).trim();
+}
+
+export function readProbeRecord(root: string, rel: string): ProbeRecord | null {
+  const m = REWRITE_PROBE_PATH.exec(rel);
+  if (m === null) return null;
+  let text: string;
+  try {
+    text = fs.readFileSync(path.join(root, rel), "utf-8");
+  } catch {
+    return attestations(root).find((a) => a.path === rel) ?? null;
+  }
+  const lines = text.split(/\r?\n/).map((l) => l.trim());
+  return {
+    path: rel,
+    date: m[1] as string,
+    host: lineValue(lines, "host"),
+    host_version: lineValue(lines, "host_version"),
+    channel: lineValue(lines, "channel"),
+    result: lineValue(lines, "result"),
+    auth_mode: lineValue(lines, "auth_mode"),
+  };
+}
+
+export function listProbeRecords(root: string): ProbeRecord[] {
+  const disk = recordsOnDisk(root);
+  return disk.length > 0 ? disk : attestations(root);
+}
+
+function recordsOnDisk(root: string): ProbeRecord[] {
+  const dir = path.join(root, "agents", "evidence", "analysis");
+  let names: string[];
+  try {
+    names = fs.readdirSync(dir);
+  } catch {
+    return [];
+  }
+  const out: ProbeRecord[] = [];
+  for (const n of names.sort()) {
+    const r = readProbeRecord(root, `agents/evidence/analysis/${n}`);
+    if (r !== null) out.push(r);
+  }
+  return out;
+}
+
+function minorOf(v: string): string {
+  return v.split(".").slice(0, 2).join(".");
+}
+
+export function rewriteCapabilityGaps(
+  host: string,
+  row: SurfaceRow,
+  channel: RewriteChannel,
+  ctx: CapabilityContext,
+): string[] {
+  const parsed = parseRewriteAxis(host, row.rewrite_raw);
+  if (!parsed.ok) return [parsed.error];
+  const answer = parsed.answers.get(channel);
+  const mode = answer?.mode;
+  if (answer === undefined || (mode !== "replace" && mode !== "gate")) {
+    return [`the answer is ${mode === undefined ? "unstated" : `'${mode}'`}, which authorizes nothing`];
+  }
+  const why: string[] = [];
+  const slotName = REWRITE_CHANNEL_SLOT[channel];
+  const slot = row.slots.get(slotName);
+  if (row.fail_policy !== "propagate") why.push(`the trampoline does not propagate (\`fail_policy: ${row.fail_policy}\`)`);
+  if (row.verified === null) why.push("the row is unverified");
+  else if (row.verified.expires < ctx.today) why.push(`the row expired ${row.verified.expires}`);
+  if (slot === undefined || !slot.native.some((n) => n !== "" && n !== "null")) {
+    why.push(`this package binds no native \`${slotName}\` event here`);
+  }
+  if (mode === "gate") {
+    if (slot !== undefined && slot.block_exit === null) why.push(`\`${slotName}\` carries no \`block_exit\``);
+    return why;
+  }
+  if (row.json_shape === "none") why.push("the row has no native envelope (`json_shape: none`)");
+  if (answer.host_version === null) why.push("the answer names no probed host version");
+  if (answer.probe === null) {
+    why.push("the answer cites no live substitution probe (use `offered` for a documented field)");
+    return why;
+  }
+  if (!REWRITE_PROBE_PATH.test(answer.probe)) {
+    why.push(`the probe ${answer.probe} is not a record under agents/evidence/analysis/ named host-<what>-probe-<date>.md`);
+    return why;
+  }
+  const rec = readProbeRecord(ctx.root, answer.probe);
+  if (rec === null) {
+    why.push(`the cited probe ${answer.probe} does not exist`);
+    return why;
+  }
+  if (answer.host_version !== null) {
+    const want: Array<[string, string | null, string]> = [
+      ["host", rec.host, host],
+      ["host_version", rec.host_version, answer.host_version],
+      ["channel", rec.channel, channel],
+      ["result", rec.result, "delivered"],
+    ];
+    const missing = want.filter(([, got, exp]) => got !== exp).map(([k, , exp]) => `\`${k}: ${exp}\``);
+    if (missing.length > 0) why.push(`the probe ${answer.probe} does not record ${missing.join(", ")}`);
+  }
+  if (answer.answered_at !== rec.date) {
+    why.push(`the answer is dated ${answer.answered_at ?? "nowhere"} and its probe ${rec.date}; a replace is answered the day it was probed`);
+  }
+  const probes = ctx.probes ?? listProbeRecords(ctx.root);
+  const later = probes.find(
+    (p) => p.path !== rec.path && p.host === host && p.channel === channel && p.date > rec.date && p.result !== "delivered",
+  );
+  if (later !== undefined) why.push(`a later probe ${later.path} records \`result: ${later.result ?? "nothing"}\``);
+  const seen = ctx.observedHostVersion;
+  if (seen === null) why.push("the running host's version is not observable, so drift from the probed version cannot be ruled out");
+  else if (seen && answer.host_version !== null && minorOf(seen) !== minorOf(answer.host_version)) {
+    why.push(`the running host is ${seen} and the probe observed ${answer.host_version}`);
+  }
+  const revoked = ctx.revoked?.find((r) => r.host === host && r.channel === channel);
+  if (revoked) why.push(`revoked on this workspace at ${revoked.at} after a ${revoked.reason}`);
+  return why;
+}
+
+export function resolveRewriteCapability(
+  host: string,
+  row: SurfaceRow | null | undefined,
+  channel: RewriteChannel,
+  ctx: CapabilityContext,
+): CapabilityResult {
+  if (row === null || row === undefined) return { ok: false, gaps: [`no lowering row for ${host}`] };
+  const gaps = rewriteCapabilityGaps(host, row, channel, ctx);
+  if (gaps.length > 0) return { ok: false, gaps };
+  const parsed = parseRewriteAxis(host, row.rewrite_raw);
+  const answer = parsed.ok ? parsed.answers.get(channel) : undefined;
+  const capability: RewriteCapability = Object.freeze({
+    host,
+    channel,
+    mode: answer?.mode as "replace" | "gate",
+    probedVersion: answer?.mode === "replace" ? answer.host_version : null,
+    expires: row.verified?.expires ?? ctx.today,
+  });
+  ISSUED.add(capability);
+  return { ok: true, capability };
+}
diff --git a/src/scripts/hooks/dispatch_hook.ts b/src/scripts/hooks/dispatch_hook.ts
index b0437af0e..69270b08f 100644
--- a/src/scripts/hooks/dispatch_hook.ts
+++ b/src/scripts/hooks/dispatch_hook.ts
@@ -1279,5 +1279,5 @@ export function main(argv?: string[]): number {
   const tool_name = _payload_tool_name(envelope);
-  // The egress stage (ADR-285) builds the placeholder view before any concern
-  // runs; `egressViewFor` decides which concern gets which view.
-  const egress = runEgressStage(envelope);
+  const egress = runEgressStage(envelope, undefined, undefined, REPO_ROOT);
   // Payload opt-in (step 2.1). One planner owns the whole decision — which
@@ -1294,2 +1294,3 @@ export function main(argv?: string[]): number {
     egress.placeholder,
+    egress.plan?.delivered,
   );
@@ -1419,3 +1420,3 @@ export function main(argv?: string[]): number {
   );
-  const emission = emitFor(
+  const emission = egress.plan?.emit(_severity_for(final_rc), decidingReasons) ?? emitFor(
     args.platform,
@@ -1427,8 +1428,4 @@ export function main(argv?: string[]): number {
   );
-  if (emission.stdout) {
-    process.stdout.write(emission.stdout);
-  }
-  if (emission.stderr) {
-    process.stderr.write(emission.stderr);
-  }
+  if (emission.stdout) process.stdout.write(emission.stdout);
+  if (emission.stderr) process.stderr.write(emission.stderr);
   return emission.exit;
diff --git a/src/scripts/hooks/egress_engine_loader.ts b/src/scripts/hooks/egress_engine_loader.ts
index f7fa84591..15af84261 100644
--- a/src/scripts/hooks/egress_engine_loader.ts
+++ b/src/scripts/hooks/egress_engine_loader.ts
@@ -36,3 +36,3 @@ export type EgressEngine = typeof Engine;
 /** The schema this loader accepts. Must equal `ENGINE_SCHEMA` in the engine. */
-export const EXPECTED_ENGINE_SCHEMA = 1;
+export const EXPECTED_ENGINE_SCHEMA = 2;
 
diff --git a/src/scripts/hooks/egress_stage.ts b/src/scripts/hooks/egress_stage.ts
index b2999e9e4..eafe4e788 100644
--- a/src/scripts/hooks/egress_stage.ts
+++ b/src/scripts/hooks/egress_stage.ts
@@ -23,2 +23,4 @@ import { isEnvKillSwitchActive } from "../_lib/env_kill_switch.js";
 import { type EgressEngine, loadEgressEngine } from "./egress_engine_loader.js";
+import type { StagePlan } from "../_lib/egress_emission.js";
+import { surfaceRow } from "./host_lowering.js";
 import { BODY_KEYS, type JsonObject, type JsonValue } from "./payload_stub.js";
@@ -94,2 +96,9 @@ export interface EgressStageResult {
   readonly refused: readonly EgressRefusal[];
+  readonly plan?: StagePlan;
 }
@@ -357,2 +366,3 @@ export function runEgressStage(
   loadEngine: () => ReturnType<typeof loadEgressEngine> = loadEgressEngine,
+  packageRoot?: string,
 ): EgressStageResult {
@@ -375,2 +385,3 @@ export function runEgressStage(
     result = { mode, placeholder, ...counted };
+    if (packageRoot) result = { ...result, ...engine.planStage(envelope, result, { packageRoot, row: surfaceRow(envelope["platform"] as string) }) };
   } catch (exc) {
@@ -405 +416,2 @@ export function publishedEgressState(claimed: PublishedState, mode: EgressMode):
 }
+
diff --git a/src/scripts/hooks/host_lowering.ts b/src/scripts/hooks/host_lowering.ts
index 446bbc52a..00ae32c8d 100644
--- a/src/scripts/hooks/host_lowering.ts
+++ b/src/scripts/hooks/host_lowering.ts
@@ -125,2 +125,8 @@ export interface SurfaceRow {
     slots: Map<string, SlotRow>;
+    rewrite_raw: unknown;
 }
@@ -197,2 +203,3 @@ function _structure(raw: Record<string, unknown> | null): HostLowering {
             surfaces.set(surface, {
+                rewrite_raw: s['rewrite'],
                 entry_shape: String(s['entry_shape'] ?? 'none'),
diff --git a/src/scripts/hooks/host_lowering.yaml b/src/scripts/hooks/host_lowering.yaml
index 3e4f6a6ee..844e7b852 100644
--- a/src/scripts/hooks/host_lowering.yaml
+++ b/src/scripts/hooks/host_lowering.yaml
@@ -103,2 +103,15 @@ hosts:
           expires: 2027-09-06
+        # What this package may do to each channel. A `replace` rests on a live
+        # probe record whose structured lines this table is checked against
+        # (rewrite_capability.ts), and authorizes nothing by itself: a stage
+        # acts only on a capability that check issues. The 2026-10-20 probe of
+        # Claude Code 2.1.304 observed a shape-preserving `updatedToolOutput`
+        # delivered for Read, Bash, Grep and an MCP tool, a mismatched one
+        # dropped in silence, and `updatedInput` delivered. `prompt` is a
+        # refusal, because UserPromptSubmit can block a prompt and cannot
+        # replace it. A row with no `rewrite:` states nothing (`unstated`).
+        rewrite:
+          output: { mode: replace, answered_at: 2026-10-20, host_version: 2.1.304, probe: agents/evidence/analysis/host-output-rewrite-probe-2026-10-20.md }
+          input:  { mode: replace, answered_at: 2026-10-20, host_version: 2.1.304, probe: agents/evidence/analysis/host-input-rewrite-probe-2026-10-20.md }
+          prompt: { mode: gate,    answered_at: 2026-09-29, docs_url: https://code.claude.com/docs/en/hooks.md }
         slots:
diff --git a/src/scripts/hooks/payload_stub.ts b/src/scripts/hooks/payload_stub.ts
index baac1fdd2..99b7d206d 100644
--- a/src/scripts/hooks/payload_stub.ts
+++ b/src/scripts/hooks/payload_stub.ts
@@ -143,2 +143,8 @@ export interface PayloadStub extends JsonObject {
   key_count?: number;
+  delivered_bytes?: number;
 }
@@ -230,2 +236,4 @@ export function makePayloadStub(
   }
+  const out = measured.get(`${key}#`);
+  if (out != null) stub.delivered_bytes = out;
   return stub;
@@ -431,2 +439,4 @@ export function planPayloadShapes(
   placeholder?: JsonObject,
+  delivered?: ReadonlyMap<string, number>,
 ): PayloadShapePlan {
@@ -443,2 +453,3 @@ export function planPayloadShapes(
       : new Map<string, number | null>();
+  for (const e of delivered ?? []) measured.set(...e);
   const shaped = new Map<string, JsonObject>();
diff --git a/src/scripts/lint_hook_manifest.ts b/src/scripts/lint_hook_manifest.ts
index c66c46cff..7ca400bae 100644
--- a/src/scripts/lint_hook_manifest.ts
+++ b/src/scripts/lint_hook_manifest.ts
@@ -37,2 +37,4 @@ import { asOf } from "./_lib/as_of.js";
 import { parseHostLowering, type HostLowering } from "./hooks/host_lowering.js";
+import { parseRewriteAxis, REWRITE_CHANNELS, REWRITE_MODES, type RewriteChannel } from "./_lib/rewrite_axis.js";
+import { listProbeRecords, PROBE_ATTESTATIONS_REL, renderProbeAttestations, rewriteCapabilityGaps } from "./_lib/rewrite_capability.js";
 import { RE_ARM_EVENTS } from "./_lib/prefix_stable_surfaces.js";
@@ -773,2 +775,75 @@ export function _check_host_lowering(
   _check_slot_answers(table, errors);
+  _check_rewrite_axis(table, errors, today);
+}
+
+function _isCalendarDate(d: string): boolean {
+  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
+  const t = new Date(`${d}T00:00:00Z`);
+  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
+}
+
+export function _check_rewrite_axis(table: HostLowering, errors: string[], today: string, root: string = REPO_ROOT): void {
+  const probes = listProbeRecords(root);
+  if (root === REPO_ROOT) {
+    let shipped = "";
+    try {
+      shipped = fs.readFileSync(path.join(root, PROBE_ATTESTATIONS_REL), "utf-8");
+    } catch {
+    }
+    if (shipped !== renderProbeAttestations(root)) {
+      errors.push(
+        `${PROBE_ATTESTATIONS_REL}: rewrite-probe-attestation-drift — the shipped copy differs from the probe records; ` +
+          "run ./scripts-run src/scripts/lint_hook_manifest --write-probe-attestations.",
+      );
+    }
+  }
+  for (const [host, surfaces] of table) {
+    for (const [surface, row] of surfaces) {
+      const axis = parseRewriteAxis(`host_lowering.yaml: ${host}/${surface}`, row.rewrite_raw);
+      if (!axis.ok) {
+        errors.push(`${axis.error}.`);
+        continue;
+      }
+      for (const [channel, answer] of axis.answers) {
+        const where = `host_lowering ${host}/${surface}/${channel}`;
+        if (!(REWRITE_CHANNELS as readonly string[]).includes(channel)) {
+          errors.push(`${where}: rewrite-axis-malformed — unknown channel; the axis has ${REWRITE_CHANNELS.join(", ")}.`);
+          continue;
+        }
+        if (!(REWRITE_MODES as readonly string[]).includes(answer.mode)) {
+          errors.push(`${where}: rewrite-axis-malformed — unknown mode '${answer.mode}'; one of ${REWRITE_MODES.join(", ")}.`);
+          continue;
+        }
+        if (answer.answered_at === null || !_isCalendarDate(answer.answered_at)) {
+          errors.push(`${where}: rewrite-axis-malformed — no \`answered_at\` calendar date; the axis is dated like every column.`);
+          continue;
+        }
+        if (answer.answered_at > today) {
+          errors.push(`${where}: rewrite-axis-malformed — \`answered_at: ${answer.answered_at}\` is after ${today}.`);
+          continue;
+        }
+        if (answer.mode === "none") continue;
+        if (answer.docs_url === null && answer.probe === null) {
+          errors.push(`${where}: rewrite-axis-malformed — '${answer.mode}' cites nothing on the answer itself; a row's docs_url says nothing about rewriting.`);
+        }
+        if (answer.mode === "offered") continue;
+        const mode = answer.mode as "replace" | "gate";
+        const why = rewriteCapabilityGaps(host, row, channel as RewriteChannel, { today, root, probes });
+        if (why.length > 0) {
+          const id = mode === "replace" ? "rewrite-toward-non-replace-host-refused" : "rewrite-gate-without-refusal";
+          errors.push(`${where}: ${id} — ${why.join("; ")}.`);
+        }
+      }
+    }
+  }
 }
@@ -1010,2 +1085,6 @@ export function main(argv: string[]): number {
       strict = true;
+    } else if (a === "--write-probe-attestations") {
+      fs.writeFileSync(path.join(REPO_ROOT, PROBE_ATTESTATIONS_REL), renderProbeAttestations(REPO_ROOT), "utf-8");
+      process.stdout.write(`lint_hook_manifest: wrote ${PROBE_ATTESTATIONS_REL}\n`);
+      return 0;
     }
```

Answer each question below, numbered 1 to 9 in this order, each on its own
numbered top-level line, then close with exactly one stance line in the form
`STANCE: <label> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>` where
<label> is one of `ratified`, `confirmed-non-expanding`, `refused`.

1. What behaviour changes, including what follows from it that the diff does not state?
2. Which authority or safety boundary becomes wider or narrower, and in which direction?
3. Does the change weaken anything that judges it — a test, a gate, a threshold, this review? The standard is quoted rather than paraphrased: the implementer never silently weakens an assertion, deletes, skips or xfails a failing test, lowers a threshold, or changes fixture semantics to fit the code. Does this change do any of those?
4. Is another host or projection left as a way around the control this change touches?
5. Can it be undone, and how — by whom, with what authority, and against which revision?
6. What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?
7. Would a smaller change do, and what does the larger one buy that the smaller one does not?
8. What does it add to standing instruction weight that every later session pays?
9. Could untrusted content steer the path this change opens, and what bounds it if so?
