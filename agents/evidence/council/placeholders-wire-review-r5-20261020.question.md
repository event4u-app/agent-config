<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-20 for branch
     drain/placeholders-on-the-wire-20261020, committed verbatim so the verdict
     recorded beside it can be checked against what was asked. -->

# Modification review, round 5 — the rewrite axis, and the stage that acts on it

You are one seat of a modification review. Roadmap `road-to-placeholders-on-the-wire`.
Round 4 of 2026-10-18 reviewed step 6.1 alone (a dated `rewrite:` axis per
host in `src/scripts/hooks/host_lowering.yaml`) and split: one seat
`confirmed-non-expanding`, one `refused` because `rewriteAuthorizes(row, channel)`
returned authority over a raw parsed row, so a consumer that skipped the lint
got an unchecked authorization; it also named: no runtime revocation for
host-version drift, a contradicting probe or an expired verification; a row-level
`verified.docs_url` satisfying an `offered` citation; no isolated test for the
`verified: null` prerequisite; a probe record's date not cross-checked.

What this change does, in one PR:

1. **6.1, the round-4 findings.** `rewriteAuthorizes` is gone. Authority is an
   opaque frozen `RewriteCapability` that only `resolveRewriteCapability`
   (`src/scripts/_lib/rewrite_capability.ts`) issues, after the same check the lint
   runs: propagating trampoline, current `verified` block, bound native slot; for
   `gate` a `block_exit`; for `replace` a native envelope and a probe record
   whose lines state host, host_version, channel and `result: delivered`, dated the
   day of the answer, with no later record for the same host+channel stating
   anything else, and — when the running host's version is known — the same
   minor version. `offered`/`gate` must cite on the answer itself. Each
   prerequisite has an isolated test, `verified: null` included.
2. **Phase 0, run as an agent probe** (`claude -p --settings <scratch file>` from a
   scratch dir, Claude Code 2.1.304, no host settings file written):
   `agents/evidence/analysis/host-output-rewrite-probe-2026-10-20.md` observed a
   shape-preserving `updatedToolOutput` reach the model for Read/Bash/Grep/MCP, a
   mismatched one silently dropped, and `updatedInput` delivered. So claude's
   `output` and `input` answers move to `replace` citing two records; `prompt`
   stays `gate`. The records' structured lines ship as
   `src/config/rewrite-probe-attestations.json`, which the lint holds equal to them.
3. **Phases 3–5, the stage acting on a capability** — all in the egress engine
   chunk (loaded only when `egress.placeholders.mode` is `protect`/`strict`; the
   shipped default is `off`): a tool result carrying a listed value goes back as
   `updatedToolOutput` (string leaves replaced, keys/types checked, rescanned,
   deadline; any miss emits nothing, raises a `systemMessage`, is counted); a
   prompt carrying a credential is refused via the gate with a redacted copy; a
   token in a tool input is restored only per class and sink (credential: only into
   its origin file, re-derived by keyed digest; identifier: origin, local write or a
   consequence-free call, else `ask`), never with `allow`; unknown/mangled tokens
   and reads of the session table are denied. File-tool results mint tokens into the
   value-free session table of option (b) (council 2026-10-16).
4. **Budget.** The decision code first measured +16,365 B in the dispatch bundle
   (454 B headroom); moved into the engine chunk, and after merging current main,
   the bundle is 1,549,994 of 1,550,000 (dispatch ceiling unchanged) and the chunk
   67,817 B under a ceiling raised 28,000 → 72,000 with a `raise_log` entry naming
   the chunk.

Gated files (`check_kernel_edit_ratified`): hook-bundle-budget.json,
hook-latency-budget.json, egress_emission.ts, egress_restore.ts,
egress_session_table.ts, rewrite_axis.ts, rewrite_capability.ts, dispatch_hook.ts,
host_lowering.json/.ts/.yaml. Subject digest at head `e24db97b5` (the branch merged with `origin/main`): `92c2e049234b97be88c9af91b459648576c6509b258032430fc964c43ea5ff40`.

Measured at the head: `tests/scripts/_lib/egress_emission.test.ts` 21,
`egress_restore.test.ts` 16, `egress_coverage.test.ts` 5, `egress_stage.test.ts` 22
(an end-to-end Read then Edit through the dispatcher), `egress_prevention_gaps.test.ts`
8 (the three gap fixtures inverted), `lint_hook_manifest.test.ts -t rewrite` 41,
`tool_result_bytes_hook.test.ts` pass. Sensitivity shown red for the shape check,
the ask composition and the burst bound.

Left out of the diff below to fit the input ceiling, stated so the scope is
honest: test files; `lint_hook_manifest.ts` (now calls `rewriteCapabilityGaps`
and the attestation drift check); `host_lowering.ts` (stores `rewrite_raw` and
no longer parses the axis); the two budget JSON files; `host_lowering.json`; the
engine loader and engine index (schema 2, `planStage` export); `egress_session_table.ts` (adds `withSessionScope`, an `ANY_DESTINATION` used only for an identifier restore that is then shown in an `ask`, and the token's class on a refused restore). Comment lines are
stripped from the new modules' hunks.

```diff
diff --git a/src/scripts/_lib/egress_emission.ts b/src/scripts/_lib/egress_emission.ts
new file mode 100644
index 000000000..698a8cb16
--- /dev/null
+++ b/src/scripts/_lib/egress_emission.ts
@@ -0,0 +1,504 @@
+import * as fs from "node:fs";
+import * as path from "node:path";
+
+import type { EgressStageResult } from "../hooks/egress_stage.js";
+import type { SurfaceRow } from "../hooks/host_lowering.js";
+import { BODY_KEYS, type JsonObject, type JsonValue } from "../hooks/payload_stub.js";
+import { is_replay_mode } from "../hooks/state_io.js";
+import { detect } from "./egress_rules.js";
+import { planRestore, type RestoreDeps, type RestorePlan } from "./egress_restore.js";
+import { fileOrigin, pruneSessionTables, sessionTableDir, withSessionScope } from "./egress_session_table.js";
+import { EgressRefusedError, replaceValues, type TokenScope } from "./egress_token.js";
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
+export interface RewriteDeps {
+  readonly sessionDir?: string;
+  readonly packageRoot: string;
+  readonly today?: string;
+  readonly now?: () => number;
+  readonly row?: SurfaceRow | null;
+  readonly replay?: boolean;
+  readonly elapsed?: () => number;
+  readonly capability?: typeof resolveRewriteCapability;
+}
+
+export function planToolOutputRewrite(
+  envelope: JsonObject,
+  stage: EgressStageResult,
+  deps: RewriteDeps,
+): ToolOutputRewrite | null {
+  const r = decide(envelope, stage, deps);
+  if (r !== null) recordRewrite(String(envelope["workspace_root"] || process.cwd()), envelope, r, deps.replay ?? is_replay_mode());
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
+    const cap = (deps.capability ?? resolveRewriteCapability)(platform, deps.row, "output", {
+      today: deps.today ?? new Date().toISOString().slice(0, 10),
+      root: deps.packageRoot,
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
+    `(${r.reason}). Treat it as disclosed and rotate a credential it carried.`
+  );
+}
+
+export const PROMPT_DEADLINE_MS = 1500;
+
+export function promptResidueLine(types: readonly string[], count: number): string {
+  return (
+    `It held ${count} listed value(s) of type ${types.join(", ") || "unknown"}. The text was typed into the host and may ` +
+    "still sit in its local transcript and prompt history; rotate any credential it carried."
+  );
+}
+
+export const COVERAGE_POINTER =
+  "What each channel is covered by: docs/contracts/egress-placeholders-v1.md § Coverage (agent-config hooks:status --coverage).";
+
+export type PromptGate = { readonly outcome: "refuse" | "warn"; readonly message: string };
+
+export function planPromptGate(
+  envelope: JsonObject,
+  stage: EgressStageResult,
+  deps: RewriteDeps,
+): PromptGate | null {
+  if (envelope["event"] !== "user_prompt_submit") return null;
+  if (stage.mode !== "protect" && stage.mode !== "strict") return null;
+  const counts = stage.counts.filter(
+    (c) => c.field === "prompt" && (c.class === "credential" || stage.mode === "strict"),
+  );
+  const refused = stage.refused.some((r) => r.field === "prompt");
+  const overran = (deps.elapsed ?? (() => performance.now()))() > PROMPT_DEADLINE_MS;
+  if (counts.length === 0 && !refused) return null;
+  const count = counts.reduce((n, c) => n + c.count, 0);
+  const types = [...new Set(counts.map((c) => c.type))].sort();
+  let outcome: PromptGate["outcome"] = "warn";
+  try {
+    const platform = String(envelope["platform"] ?? "");
+    const cap = (deps.capability ?? resolveRewriteCapability)(platform, deps.row, "prompt", {
+      today: deps.today ?? new Date().toISOString().slice(0, 10),
+      root: deps.packageRoot,
+    });
+    if (cap.ok && cap.capability.mode === "gate") outcome = "refuse";
+  } catch {
+    outcome = "warn";
+  }
+  const placeholder = isObject(stage.placeholder?.["payload"]) ? (stage.placeholder?.["payload"] as JsonObject) : null;
+  const copy = placeholder !== null && typeof placeholder["prompt"] === "string" ? placeholder["prompt"] : null;
+  const head =
+    outcome === "refuse"
+      ? "agent-config egress: this prompt was not sent, because it carries a listed value."
+      : "agent-config egress: this prompt carries a listed value and this host cannot refuse it, so it was sent.";
+  const body =
+    refused || overran || copy === null
+      ? "The value could not be bounded in time, so no redacted copy is offered; retype the prompt without it."
+      : `Resend this redacted copy instead:\n\n${copy}`;
+  return { outcome, message: `${head}\n${body}\n\n${COVERAGE_POINTER}\n${promptResidueLine(types, count)}` };
+}
+
+export type EgressEmission = ToolOutputRewrite | PromptGate | RestorePlan;
+
+export function planEgressEmission(
+  envelope: JsonObject,
+  stage: EgressStageResult,
+  deps: RewriteDeps,
+): EgressEmission | null {
+  if (envelope["event"] === "user_prompt_submit") return planPromptGate(envelope, stage, deps);
+  if (envelope["event"] === "pre_tool_use") return planInputRestore(envelope, deps);
+  return planToolOutputRewrite(envelope, stage, deps);
+}
+
+export function planInputRestore(envelope: JsonObject, deps: RewriteDeps, restore: RestoreDeps = {}): RestorePlan | null {
+  const plan = planRestore(envelope, {
+    ...restore,
+    ...(deps.sessionDir !== undefined ? { sessionDir: deps.sessionDir } : {}),
+    ...(deps.replay !== undefined ? { replay: deps.replay } : {}),
+  });
+  if (plan === null || plan.input === null) return plan;
+  const platform = String(envelope["platform"] ?? "");
+  const cap = (deps.capability ?? resolveRewriteCapability)(platform, deps.row, "input", {
+    today: deps.today ?? new Date().toISOString().slice(0, 10),
+    root: deps.packageRoot,
+  });
+  if (cap.ok && cap.capability.mode === "replace") return plan;
+  return { outcome: "restore", input: null, decision: "deny", reason: "agent-config egress: this host cannot restore a placeholder into a tool input, so the call was not run." };
+}
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
+  readonly blockExit: number | null;
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
+  if (ctx.event === "pre_tool_use" && e.outcome === "restore") {
+    if (ctx.severity === "block") return null;
+    const hso: Record<string, unknown> = { hookEventName: ctx.hookEventName };
+    if (e.input !== null) hso["updatedInput"] = e.input;
+    if (e.decision !== null) {
+      hso["permissionDecision"] = e.decision;
+      hso["permissionDecisionReason"] = [e.reason, ctx.reason].filter(Boolean).join("\n\n");
+    } else if (ctx.reason) hso["additionalContext"] = ctx.reason;
+    return { exit: 0, stdout: `${JSON.stringify({ hookSpecificOutput: hso })}\n`, stderr: "" };
+  }
+  if (ctx.event !== "user_prompt_submit") return null;
+  if (e.outcome === "refuse" && ctx.blockExit !== null) return { exit: ctx.blockExit, stdout: "", stderr: `${e.message}\n` };
+  if ((e.outcome === "warn" || e.outcome === "refuse") && ctx.severity !== "block") {
+    const text = [ctx.reason, e.message].filter(Boolean).join("\n\n");
+    return { exit: 0, stdout: `${JSON.stringify({ hookSpecificOutput: { hookEventName: ctx.hookEventName, additionalContext: text } })}\n`, stderr: "" };
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
+): { plan?: StagePlan; placeholder?: JsonObject; execution?: JsonObject } {
+  if (stage.placeholder === undefined) return {};
+  const minted = mintIntoSession(envelope, stage, deps);
+  const decided = minted === null ? stage : { ...stage, placeholder: minted };
+  const decision = planEgressEmission(envelope, decided, deps);
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
+      return emitEgress(decision, { event, severity, reason, blockExit: slot.block_exit, hookEventName });
+    },
+  };
+  const out: { plan: StagePlan; placeholder?: JsonObject; execution?: JsonObject } = { plan };
+  if (minted !== null) out.placeholder = minted;
+  if (decision?.outcome === "restore" && decision.input !== null && isObject(envelope["payload"])) {
+    out.execution = { ...envelope, payload: { ...envelope["payload"], tool_input: decision.input } };
+  }
+  return out;
+}
+
+let pruned = false;
+
+function pruneOncePerProcess(dir: string): void {
+  if (pruned) return;
+  pruned = true;
+  pruneSessionTables(dir);
+}
+
+const FILE_RESULT_TOOLS: ReadonlySet<string> = new Set(["Read", "Write", "Edit", "MultiEdit"]);
+
+function replaceDeepIn(v: JsonValue, scope: TokenScope): JsonValue {
+  if (typeof v === "string") return replaceValues(v, scope);
+  if (Array.isArray(v)) return v.map((x) => replaceDeepIn(x, scope));
+  if (isObject(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, replaceDeepIn(x as JsonValue, scope)]));
+  return v;
+}
+
+export function mintIntoSession(envelope: JsonObject, stage: EgressStageResult, deps: RewriteDeps): JsonObject | null {
+  if (envelope["event"] !== "post_tool_use" || stage.placeholder === undefined) return null;
+  const payload = isObject(envelope["payload"]) ? envelope["payload"] : null;
+  const input = payload !== null && isObject(payload["tool_input"]) ? payload["tool_input"] : null;
+  const tool = payload?.["tool_name"];
+  const file = input?.["file_path"];
+  const sessionId = payload?.["session_id"];
+  if (payload === null || typeof tool !== "string" || !FILE_RESULT_TOOLS.has(tool)) return null;
+  if (typeof file !== "string" || typeof sessionId !== "string" || sessionId === "") return null;
+  const key = resultKey(payload);
+  if (key === null || !stage.counts.some((c) => c.field === "result")) return null;
+  try {
+    const workspaceRoot = String(envelope["workspace_root"] || process.cwd());
+    pruneOncePerProcess(deps.sessionDir ?? sessionTableDir());
+    const origin = fileOrigin(path.resolve(workspaceRoot, file), { tool, field: key, operation: "read" });
+    const target = { dir: deps.sessionDir ?? sessionTableDir(), sessionId, workspaceRoot, origin };
+    const value = withSessionScope(target, (scope) => {
+      try {
+        return replaceDeepIn(payload[key] as JsonValue, scope);
+      } catch (exc) {
+        if (exc instanceof EgressRefusedError) return { [STAGE_WITHHELD_MARKER]: true, rule: exc.rule };
+        throw exc;
+      }
+    });
+    const base = stage.placeholder["payload"];
+    return { ...stage.placeholder, payload: { ...(isObject(base) ? base : payload), [key]: value } };
+  } catch {
+    return null;
+  }
+}
diff --git a/src/scripts/_lib/egress_restore.ts b/src/scripts/_lib/egress_restore.ts
new file mode 100644
index 000000000..74cfbf57e
--- /dev/null
+++ b/src/scripts/_lib/egress_restore.ts
@@ -0,0 +1,225 @@
+import { createHash } from "node:crypto";
+import * as fs from "node:fs";
+import * as path from "node:path";
+
+import { isCategoryA } from "../hooks/category_a.js";
+import type { JsonObject, JsonValue } from "../hooks/payload_stub.js";
+import { is_replay_mode } from "../hooks/state_io.js";
+import type { EgressRule } from "./egress_rules.js";
+import {
+  ANY_DESTINATION,
+  fileDestination,
+  type OriginReading,
+  type OriginDescriptor,
+  restoreToken,
+  sessionTableDir,
+} from "./egress_session_table.js";
+import { parseTokens } from "./egress_token.js";
+
+export const MODEL_BOUND_TOOLS: ReadonlySet<string> = new Set(["Task", "Agent"]);
+export const FILE_WRITE_TOOLS: ReadonlySet<string> = new Set(["Edit", "MultiEdit", "Write", "NotebookEdit"]);
+
+export const RESTORE_BURST = 8;
+export const RESTORE_WINDOW_MS = 60_000;
+export const RESTORE_AUDIT_FILE = path.join("agents", "runtime", "state", "egress-restores.jsonl");
+
+const LOOSE_TOKEN = /__\s*([A-Z][A-Z0-9]{1,15})\s*_\s*([1-9][0-9]{0,5})\s*_\s*([0-9a-f]{6})\s*(?:_\s*v\s*([2-9]|[1-9][0-9])\s*)?__/g;
+const GRAMMAR_REMNANT = /__\s*[A-Z][A-Z0-9]{1,15}\s*_\s*\d+\s*_/;
+
+export type RestoreSink = "origin-file" | "consequence-free" | "other";
+
+export interface RestoreAuditLine {
+  ts: string;
+  session: string;
+  class: string;
+  type: string;
+  number: number;
+  tool: string | null;
+  sink: RestoreSink;
+  decision: "restore" | "ask" | "deny";
+}
+
+export interface RestorePlan {
+  readonly outcome: "restore";
+  readonly input: JsonObject | null;
+  readonly decision: "ask" | "deny" | null;
+  readonly reason: string;
+}
+
+export interface RestoreDeps {
+  readonly sessionDir?: string;
+  readonly readOrigin?: (o: OriginDescriptor) => OriginReading;
+  readonly rules?: readonly EgressRule[];
+  readonly now?: number;
+  readonly replay?: boolean;
+}
+
+function isObject(v: unknown): v is JsonObject {
+  return typeof v === "object" && v !== null && !Array.isArray(v);
+}
+
+function strings(v: JsonValue, out: string[]): void {
+  if (typeof v === "string") out.push(v);
+  else if (Array.isArray(v)) for (const x of v) strings(x, out);
+  else if (isObject(v)) for (const x of Object.values(v)) strings(x as JsonValue, out);
+}
+
+function mapStrings(v: JsonValue, fn: (s: string) => string): JsonValue {
+  if (typeof v === "string") return fn(v);
+  if (Array.isArray(v)) return v.map((x) => mapStrings(x, fn));
+  if (isObject(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mapStrings(x as JsonValue, fn)]));
+  return v;
+}
+
+export function canonicalizeTokens(text: string): string {
+  return text.replace(LOOSE_TOKEN, (_m, t: string, n: string, fp: string, v: string | undefined) =>
+    v === undefined ? `__${t}_${n}_${fp}__` : `__${t}_${n}_${fp}_v${v}__`,
+  );
+}
+
+function sessionHash(id: string): string {
+  return createHash("sha256").update(`session\u0000${id}`).digest("hex").slice(0, 16);
+}
+
+function recentRestores(file: string, session: string, now: number): number {
+  let text: string;
+  try {
+    text = fs.readFileSync(file, "utf8");
+  } catch {
+    return 0;
+  }
+  let n = 0;
+  for (const line of text.split("\n").slice(-500)) {
+    try {
+      const l = JSON.parse(line) as RestoreAuditLine;
+      if (l.session === session && now - Date.parse(l.ts) <= RESTORE_WINDOW_MS) n += 1;
+    } catch {
+    }
+  }
+  return n;
+}
+
+function audit(file: string, lines: readonly RestoreAuditLine[]): void {
+  if (lines.length === 0) return;
+  try {
+    fs.mkdirSync(path.dirname(file), { recursive: true });
+    fs.appendFileSync(file, lines.map((l) => `${JSON.stringify(l)}\n`).join(""), "utf8");
+  } catch {
+  }
+}
+
+const deny = (reason: string): RestorePlan => ({ outcome: "restore", input: null, decision: "deny", reason });
+
+export function planRestore(envelope: JsonObject, deps: RestoreDeps = {}): RestorePlan | null {
+  if (envelope["event"] !== "pre_tool_use") return null;
+  const payload = isObject(envelope["payload"]) ? envelope["payload"] : null;
+  const input = payload !== null && isObject(payload["tool_input"]) ? payload["tool_input"] : null;
+  if (payload === null || input === null) return null;
+  try {
+    return decide(envelope, payload, input, deps);
+  } catch {
+    return deny("agent-config egress: the placeholders in this call could not be checked, so it was not run.");
+  }
+}
+
+function decide(envelope: JsonObject, payload: JsonObject, input: JsonObject, deps: RestoreDeps): RestorePlan | null {
+  const dir = deps.sessionDir ?? sessionTableDir();
+  const texts: string[] = [];
+  strings(input, texts);
+  if (texts.some((t) => t.includes(dir) || t.includes(path.join("runtime", "egress-sessions")))) {
+    return deny("agent-config egress: the placeholder session table is not readable by the agent.");
+  }
+  const tool = typeof payload["tool_name"] === "string" ? payload["tool_name"] : "";
+  const canonical = mapStrings(input, canonicalizeTokens) as JsonObject;
+  const all: string[] = [];
+  strings(canonical, all);
+  const tokens = [...new Set(all.flatMap((t) => parseTokens(t).map((p) => t.slice(p.start, p.end))))];
+  const remnant = all.some((t) => GRAMMAR_REMNANT.test(t.replace(/__[A-Z][A-Z0-9]{1,15}_[1-9][0-9]{0,5}_[0-9a-f]{6}(?:_v[0-9]{1,2})?__/g, "")));
+  if (tokens.length === 0 && !remnant) return null;
+  if (MODEL_BOUND_TOOLS.has(tool)) return null;
+  if (remnant) return deny("agent-config egress: this call carries a placeholder that does not parse; it was not guessed and not run.");
+  const sessionId = typeof payload["session_id"] === "string" ? payload["session_id"] : "";
+  const filePath = typeof input["file_path"] === "string" ? input["file_path"] : null;
+  const destination = FILE_WRITE_TOOLS.has(tool) && filePath !== null ? fileDestination(filePath) : `tool:${tool}`;
+  const workingTree = String(envelope["workspace_root"] || process.cwd());
+  const consequenceFree = isCategoryA(tool, input, workingTree);
+  const now = deps.now ?? Date.now();
+  const session = sessionHash(sessionId);
+  const values = new Map<string, string>();
+  const lines: RestoreAuditLine[] = [];
+  let decision: RestorePlan["decision"] = null;
+  const reasons: string[] = [];
+  const req = { dir, sessionId, now, ...(deps.rules ? { rules: deps.rules } : {}), ...(deps.readOrigin ? { readOrigin: deps.readOrigin } : {}) };
+  for (const token of tokens) {
+    const parsed = parseTokens(token)[0];
+    const base = { ts: new Date(now).toISOString(), session, type: parsed?.type ?? "", number: parsed?.number ?? 0, tool: tool || null };
+    let r = restoreToken(token, { ...req, destination });
+    let sink: RestoreSink = r.ok ? "origin-file" : "other";
+    if (!r.ok && r.outcome === "DESTINATION_MISMATCH" && r.class === "credential") {
+      lines.push({ ...base, class: "credential", sink: "other", decision: "deny" });
+      audit(path.join(workingTree, RESTORE_AUDIT_FILE), deps.replay ?? is_replay_mode() ? [] : lines);
+      return deny(
+        "agent-config egress: a credential placeholder restores only into the file it was read from. " +
+          "Reference the variable by name (`$NAME`, `process.env.NAME`) instead of its value.",
+      );
+    }
+    if (!r.ok && r.outcome === "DESTINATION_MISMATCH" && r.class === "identifier") {
+      r = restoreToken(token, { ...req, destination: ANY_DESTINATION });
+      sink = consequenceFree || FILE_WRITE_TOOLS.has(tool) ? "consequence-free" : "other";
+    }
+    if (!r.ok) {
+      lines.push({ ...base, class: r.outcome === "UNRESOLVED" ? "unknown" : (r.class ?? "unknown"), sink, decision: "deny" });
+      audit(path.join(workingTree, RESTORE_AUDIT_FILE), deps.replay ?? is_replay_mode() ? [] : lines);
+      return deny(`agent-config egress: ${r.message} The call was not run.`);
+    }
+    const asks = r.class === "identifier" && sink === "other";
+    if (asks) {
+      decision = "ask";
+      reasons.push(`${r.type} ${r.number}`);
+    }
+    values.set(token, r.value);
+    lines.push({ ...base, class: r.class, sink, decision: asks ? "ask" : "restore" });
+  }
+  const file = path.join(workingTree, RESTORE_AUDIT_FILE);
+  if (decision === null && recentRestores(file, session, now) + lines.length > RESTORE_BURST) {
+    decision = "ask";
+    reasons.push("a burst of restores");
+  }
+  if (!(deps.replay ?? is_replay_mode())) audit(file, lines);
+  const restored = mapStrings(canonical, (t) => {
+    let out = t;
+    for (const [token, value] of values) out = out.split(token).join(value);
+    return out;
+  }) as JsonObject;
+  const reason =
+    decision === "ask" ? `agent-config egress: this call restores ${reasons.join(", ")} outside its origin; confirm the value shown.` : "";
+  return { outcome: "restore", input: restored, decision, reason };
+}
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
index 000000000..60cda8542
--- /dev/null
+++ b/src/scripts/_lib/rewrite_capability.ts
@@ -0,0 +1,231 @@
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
+  if (seen && answer.host_version !== null && minorOf(seen) !== minorOf(answer.host_version)) {
+    why.push(`the running host is ${seen} and the probe observed ${answer.host_version}`);
+  }
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
index 5faf7f0e9..62a51be0f 100644
--- a/src/scripts/hooks/dispatch_hook.ts
+++ b/src/scripts/hooks/dispatch_hook.ts
@@ -1280,3 +1280,3 @@ export function main(argv?: string[]): number {
-  // The egress stage (ADR-285) builds the placeholder view before any concern
-  // runs; `egressViewFor` decides which concern gets which view.
-  const egress = runEgressStage(envelope);
+  const egress = runEgressStage(envelope, undefined, undefined, REPO_ROOT);
@@ -1292 +1292 @@ export function main(argv?: string[]): number {
-    envelope,
+    egress.execution ?? envelope,
@@ -1294,0 +1295 @@ export function main(argv?: string[]): number {
+    egress.plan?.delivered,
@@ -1420 +1421 @@ export function main(argv?: string[]): number {
-  const emission = emitFor(
+  const emission = egress.plan?.emit(_severity_for(final_rc), decidingReasons) ?? emitFor(
@@ -1428,6 +1429,2 @@ export function main(argv?: string[]): number {
-  if (emission.stdout) {
-    process.stdout.write(emission.stdout);
-  }
-  if (emission.stderr) {
-    process.stderr.write(emission.stderr);
-  }
+  if (emission.stdout) process.stdout.write(emission.stdout);
+  if (emission.stderr) process.stderr.write(emission.stderr);
diff --git a/src/scripts/hooks/egress_stage.ts b/src/scripts/hooks/egress_stage.ts
index b2999e9e4..c64815799 100644
--- a/src/scripts/hooks/egress_stage.ts
+++ b/src/scripts/hooks/egress_stage.ts
@@ -23,0 +24,2 @@ import { type EgressEngine, loadEgressEngine } from "./egress_engine_loader.js";
+import type { StagePlan } from "../_lib/egress_emission.js";
+import { surfaceRow } from "./host_lowering.js";
@@ -94,0 +97,9 @@ export interface EgressStageResult {
+  readonly plan?: StagePlan;
+  readonly execution?: JsonObject;
@@ -357,0 +369 @@ export function runEgressStage(
+  packageRoot?: string,
@@ -375,0 +388 @@ export function runEgressStage(
+    if (packageRoot) result = { ...result, ...engine.planStage(envelope, result, { packageRoot, row: surfaceRow(envelope["platform"] as string) }) };
@@ -405,0 +419 @@ export function publishedEgressState(claimed: PublishedState, mode: EgressMode):
+
diff --git a/src/scripts/hooks/host_lowering.yaml b/src/scripts/hooks/host_lowering.yaml
index 3e4f6a6ee..844e7b852 100644
--- a/src/scripts/hooks/host_lowering.yaml
+++ b/src/scripts/hooks/host_lowering.yaml
@@ -103,0 +104,13 @@ hosts:
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
diff --git a/src/scripts/hooks/payload_stub.ts b/src/scripts/hooks/payload_stub.ts
index baac1fdd2..99b7d206d 100644
--- a/src/scripts/hooks/payload_stub.ts
+++ b/src/scripts/hooks/payload_stub.ts
@@ -143,0 +144,6 @@ export interface PayloadStub extends JsonObject {
+  delivered_bytes?: number;
@@ -230,0 +237,2 @@ export function makePayloadStub(
+  const out = measured.get(`${key}#`);
+  if (out != null) stub.delivered_bytes = out;
@@ -431,0 +440,2 @@ export function planPayloadShapes(
+  delivered?: ReadonlyMap<string, number>,
@@ -443,0 +454 @@ export function planPayloadShapes(
+  for (const e of delivered ?? []) measured.set(...e);

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
