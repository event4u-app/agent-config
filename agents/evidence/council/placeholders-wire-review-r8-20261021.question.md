<!-- evidence-type: analysis -->

<!-- Round 8 prompt, 2026-10-21, branch drain/placeholders-20261021, verbatim. -->

# Modification review, round 8 — tool-result replacement on Claude Code

You are one seat of a modification review. Roadmap `road-to-placeholders-on-the-wire`,
steps 6.1 (a dated rewrite axis in `host_lowering.yaml`) and 3.1–3.4 (replace
listed values in a tool result with tokens via `updatedToolOutput`). Tool-input
restoration and the prompt gate are not part of this change.

## What the change does

In `egress.placeholders.mode` `protect`/`strict` (shipped default `off`), a
`post_tool_use` result carrying a listed value goes back to Claude Code as
`updatedToolOutput` (`updatedMCPToolOutput` for MCP tools): the original object,
string leaves replaced, nothing else. Authority is an opaque frozen
`RewriteCapability` that only `resolveRewriteCapability` issues, from a
lowering-row answer citing a live probe record (Claude Code 2.1.304,
2026-10-20), the running host's version (same minor) and the workspace's
revocations. The decision lives in the engine chunk, loaded only in
`protect`/`strict`.

## Round 7 (2026-10-21, both seats refused, dealbreaker yes) and what changed

1. **The log said `emitted` before the decision was final.** Now the decision is
   made final once, at the last point that can change it, and the log line, the
   revocation and the per-session explainer flag are written then
   (`finalizeRewrite`). On a slot that honours no block — Claude Code's
   `post_tool_use` has `block_exit: null` — a "block" reaches the host only as
   context and cannot stop the result from being shown, so it no longer
   suppresses the replacement (withholding it would disclose the value and stop
   nothing); finality is reached before the concerns run, and
   `delivered_bytes` is published from it. On a slot that honours a block the
   decision is finalized at emission, a block finalizing it as
   `withheld (block-precedence)`, and no `delivered_bytes` is published before
   that. ADR-285 says "a block outranks a rewrite" on the premise "the call does
   not run"; an amendment, binding only if this review ratifies it, states the
   rule applies where a block stops something. An emitted replacement whose log
   line cannot be written is withheld (`audit-unwritable`). `emitEgress` now
   only renders a final decision and changes no outcome.
2. **The version came from any file the envelope named.** Now only the
   top-level `version` field of the session's own transcript counts, and only
   when the path resolves, after links, inside the host's `projects` directory
   (`CLAUDE_CONFIG_DIR`, else `~/.claude`) and is named `<session_id>.jsonl`.
   Anything else is unobserved, which grants no `replace`. The envelope is the
   host process's stdin; model content reaches this path only as result strings.
   Same-minor matching is deliberate: patch releases ship near-daily (2.1.304
   probed, 2.1.306 running today); a minor change revokes.
3. **Revocations failed open and were read-modify-write.** Now an append-only
   `egress-revoked.jsonl`, one `O_APPEND` line per revocation, so concurrent hook
   processes lose none. A file that exists and cannot be read, or holds a line
   that is not a revocation, revokes every channel. A failed revocation write is
   stated in the user-visible message, which asks for `mode: off`.
4. **Unbounded traversal; no rollback criteria.** A result above 50,000 JSON
   nodes is withheld (`oversize`) before it is walked. The contract now states
   rollback criteria: a listed value model-visible after an `emitted` line, a
   revoking reason that recurs after a person cleared it, a revocation with no
   matching cause in the log → `mode: off`; a later probe recording anything but
   `delivered` withdraws the `replace` answer.

A workspace that is not an absolute directory emits and writes nothing.

**Judging standards, stated rather than left to inference.** (a) The engine
chunk's byte ceiling rose 28,000 → 44,000 through the budget file's own
`raise_log` rule (measured 42,271 now); the dispatch bundle ceiling is unchanged
(1,464,283 of 1,550,000). (b) One test assertion changed meaning: "a block
outranks it" on `post_tool_use` is replaced by "on a slot that honours no block,
a block does not suppress the replacement" plus a new test that on a
block-capable slot a block is recorded as withheld at emission and never as
emitted. (c) The real-dispatch gap test now places its one-line transcript under
a temporary `CLAUDE_CONFIG_DIR/projects/p/<session_id>.jsonl` instead of a bare
temp file, because the path is now checked; the fixture files are unchanged.
(d) The version test passes session id and config dir.

## Tests at this head (all passing)

`tests/scripts/_lib/egress_emission.test.ts`, 29 tests. New since round 7, each
seen red before the fix:
- on a slot that honours no block, a block does not suppress the replacement: the result is shown either way
- on a block-capable slot a block is recorded as withheld at emission, never as emitted, and no delivered length is published
- emit is final once: a second call records nothing new
- an audit record that cannot be written withholds the rewrite
- a workspace that is not a directory withholds and writes no record
- a result larger than the traversal bound is withheld before it is walked
- a transcript outside the host's projects directory, or named for another session, yields no version (including a symlink pointing out)
- only a top-level version counts; one inside a tool input or a string does not
- a corrupt revocation record fails closed: the channel is revoked
- revocations are appended, so two recorded one after another are both kept

The round-7 tests are unchanged except (b)–(d) above. The lint, coverage,
real-dispatch gap (two tool-result fixtures get exactly one rewrite field) and
byte-census tests pass.

## The diff

`origin/main..HEAD` for the gated files, comment lines stripped from added
TypeScript hunks. Subject digest at head `ff23e2ad4`:
`27d9a925bd6917d23be64bc5785a2ed362e81fa315724d01c2c8ae96aa16d209`.
**Omitted for the input ceiling:** `lint_hook_manifest.ts` (byte-identical to the
version in round 7's committed prompt, `placeholders-wire-review-r7-20261021.question.md`;
it judges the table and runs in no hook), the compiled `host_lowering.json`, and
the one prose note added to `hook-latency-budget.json`.

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
index 000000000..e9cbbdbef
--- /dev/null
+++ b/src/scripts/_lib/egress_emission.ts
@@ -0,0 +1,495 @@
+import * as fs from "node:fs";
+import * as os from "node:os";
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
+export const MAX_RESULT_NODES = 50_000;
+
+export type RewriteWithheld =
+  | "no-capability"
+  | "no-workspace"
+  | "extent-unproven"
+  | "oversize"
+  | "shape-mismatch"
+  | "residual-hit"
+  | "deadline"
+  | "stage-error"
+  | "audit-unwritable"
+  | "block-precedence"
+  | "no-emission";
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
+  | {
+      readonly outcome: "withheld";
+      readonly reason: RewriteWithheld;
+      readonly replaced: number;
+      readonly unrevoked?: true;
+    };
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
+export function recordRewrite(workspaceRoot: string, envelope: JsonObject, r: ToolOutputRewrite, replay = false): boolean {
+  if (replay) return true;
+  const tool = isObject(envelope["payload"]) ? envelope["payload"]["tool_name"] : undefined;
+  const line = {
+    ts: new Date().toISOString(),
+    platform: String(envelope["platform"] ?? ""),
+    tool: typeof tool === "string" && TOOL_NAME.test(tool) ? tool : null,
+    outcome: r.outcome,
+    reason: r.outcome === "withheld" ? r.reason : null,
+    replaced: r.replaced,
+  };
+  return appendLine(path.join(workspaceRoot, REWRITE_FILE), line);
+}
+
+function appendLine(file: string, line: object): boolean {
+  try {
+    fs.mkdirSync(path.dirname(file), { recursive: true });
+    fs.appendFileSync(file, `${JSON.stringify(line)}\n`, "utf8");
+    return true;
+  } catch {
+    return false;
+  }
+}
+
+export function resolveWorkspace(envelope: JsonObject): string | null {
+  const raw = envelope["workspace_root"];
+  const candidate = typeof raw === "string" && raw !== "" ? raw : process.cwd();
+  if (!path.isAbsolute(candidate)) return null;
+  try {
+    const real = fs.realpathSync(candidate);
+    return fs.statSync(real).isDirectory() ? real : null;
+  } catch {
+    return null;
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
+export const REVOCATION_FILE = path.join("agents", "runtime", "state", "egress-revoked.jsonl");
+
+type Revocation = { host: string; channel: string; reason: string; at: string };
+
+export function readRevocations(workspaceRoot: string): Revocation[] {
+  let text: string;
+  try {
+    text = fs.readFileSync(path.join(workspaceRoot, REVOCATION_FILE), "utf8");
+  } catch (e) {
+    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
+    return [ALL_REVOKED];
+  }
+  const out: Revocation[] = [];
+  for (const l of text.split("\n")) {
+    if (l.trim() === "") continue;
+    try {
+      const r = JSON.parse(l) as Partial<Revocation>;
+      if (typeof r.host !== "string" || typeof r.channel !== "string") return [ALL_REVOKED];
+      out.push({ host: r.host, channel: r.channel, reason: String(r.reason ?? ""), at: String(r.at ?? "") });
+    } catch {
+      return [ALL_REVOKED];
+    }
+  }
+  return out;
+}
+
+const ALL_REVOKED: Revocation = { host: "*", channel: "*", reason: "revocation-state-unreadable", at: "" };
+
+const SESSION_FILE = /^[A-Za-z0-9_-]{1,128}$/;
+const SEMVER = /^\d+\.\d+\.\d+$/;
+
+function claudeConfigDir(): string {
+  return process.env["CLAUDE_CONFIG_DIR"] || path.join(os.homedir(), ".claude");
+}
+
+export function observedHostVersion(transcriptPath: unknown, sessionId: unknown, configDir: string = claudeConfigDir()): string | null {
+  if (typeof transcriptPath !== "string" || transcriptPath === "") return null;
+  if (typeof sessionId !== "string" || !SESSION_FILE.test(sessionId)) return null;
+  let fd: number | null = null;
+  try {
+    const projects = fs.realpathSync(path.join(configDir, "projects"));
+    const real = fs.realpathSync(transcriptPath);
+    if (!real.startsWith(projects + path.sep) || path.basename(real) !== `${sessionId}.jsonl`) return null;
+    fd = fs.openSync(real, "r");
+    const size = fs.fstatSync(fd).size;
+    const len = Math.min(size, 65536);
+    const buf = Buffer.alloc(len);
+    fs.readSync(fd, buf, 0, len, size - len);
+    const lines = buf.toString("utf8").split("\n");
+    if (len < size) lines.shift();
+    for (const l of lines.reverse()) {
+      if (l.trim() === "") continue;
+      try {
+        const v = (JSON.parse(l) as Record<string, unknown>)["version"];
+        if (typeof v === "string" && SEMVER.test(v)) return v;
+      } catch {
+      }
+    }
+    return null;
+  } catch {
+    return null;
+  } finally {
+    if (fd !== null) fs.closeSync(fd);
+  }
+}
+
+function nodeCountExceeds(v: JsonValue, limit: number): boolean {
+  let n = 0;
+  const stack: JsonValue[] = [v];
+  while (stack.length > 0) {
+    const x = stack.pop() as JsonValue;
+    if (++n > limit) return true;
+    if (Array.isArray(x)) for (const y of x) stack.push(y);
+    else if (isObject(x)) for (const y of Object.values(x)) stack.push(y as JsonValue);
+  }
+  return false;
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
+  const d = decideToolOutputRewrite(envelope, stage, deps);
+  return d === null ? null : finalizeRewrite(envelope, d, deps);
+}
+
+export function finalizeRewrite(
+  envelope: JsonObject,
+  decided: ToolOutputRewrite,
+  deps: RewriteDeps,
+  override?: RewriteWithheld,
+): ToolOutputRewrite {
+  const replay = deps.replay ?? is_replay_mode();
+  const workspace = resolveWorkspace(envelope);
+  let r: ToolOutputRewrite = override !== undefined && decided.outcome === "emitted"
+    ? { outcome: "withheld", reason: override, replaced: decided.replaced }
+    : decided;
+  if (workspace === null) {
+    return r.outcome === "withheld" ? r : { outcome: "withheld", reason: "no-workspace", replaced: r.replaced };
+  }
+  if (!recordRewrite(workspace, envelope, r, replay) && r.outcome === "emitted") {
+    r = { outcome: "withheld", reason: "audit-unwritable", replaced: r.replaced };
+    recordRewrite(workspace, envelope, r, replay);
+  }
+  if (r.outcome === "emitted") {
+    const payload = isObject(envelope["payload"]) ? envelope["payload"] : {};
+    if (firstTokenUse(workspace, payload["session_id"], replay)) r = { ...r, explain: TOKEN_EXPLAINER };
+  }
+  if (r.outcome === "withheld" && REVOKING_REASONS.has(r.reason) && !replay) {
+    const host = String(envelope["platform"] ?? "");
+    if (!appendLine(path.join(workspace, REVOCATION_FILE), { host, channel: "output", reason: r.reason, at: new Date().toISOString() })) {
+      r = { ...r, unrevoked: true };
+    }
+  }
+  return r;
+}
+
+export function decideToolOutputRewrite(envelope: JsonObject, stage: EgressStageResult, deps: RewriteDeps): ToolOutputRewrite | null {
+  if (envelope["event"] !== "post_tool_use") return null;
+  if (stage.mode !== "protect" && stage.mode !== "strict") return null;
+  const replaced = stage.counts.filter((c) => c.field === "result").reduce((n, c) => n + c.count, 0);
+  const refusedResult = stage.refused.some((r) => r.field === "result");
+  if (replaced === 0 && !refusedResult) return null;
+  const now = deps.now ?? Date.now;
+  const started = now();
+  try {
+    if (refusedResult) return { outcome: "withheld", reason: "extent-unproven", replaced };
+    const workspace = resolveWorkspace(envelope);
+    if (workspace === null) return { outcome: "withheld", reason: "no-workspace", replaced };
+    const platform = String(envelope["platform"] ?? "");
+    const payload = isObject(envelope["payload"]) ? envelope["payload"] : {};
+    const revoked = readRevocations(workspace).map((r) => (r.host === "*" ? { ...r, host: platform, channel: "output" } : r));
+    const cap = (deps.capability ?? resolveRewriteCapability)(platform, deps.row, "output", {
+      today: deps.today ?? new Date().toISOString().slice(0, 10),
+      root: deps.packageRoot,
+      observedHostVersion:
+        deps.observedHostVersion !== undefined ? deps.observedHostVersion : observedHostVersion(payload["transcript_path"], payload["session_id"]),
+      revoked,
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
+    if (nodeCountExceeds(before, MAX_RESULT_NODES) || nodeCountExceeds(after, MAX_RESULT_NODES)) {
+      return { outcome: "withheld", reason: "oversize", replaced };
+    }
+    if (hasWithheld(after) || !sameShape(before, after)) return { outcome: "withheld", reason: "shape-mismatch", replaced };
+    if (residual(after)) return { outcome: "withheld", reason: "residual-hit", replaced };
+    if (now() - started > REWRITE_DEADLINE_MS) return { outcome: "withheld", reason: "deadline", replaced };
+    const tool = original["tool_name"];
+    const field: RewriteField = typeof tool === "string" && tool.startsWith("mcp__") ? "updatedMCPToolOutput" : "updatedToolOutput";
+    return { outcome: "emitted", field, value: after, replaced };
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
+    (r.unrevoked
+      ? "The channel could not be disabled on this workspace; set egress.placeholders.mode to off until the cause is found. "
+      : "") +
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
+  if (e === null || ctx.event !== "post_tool_use") return null;
+  const hso: Record<string, unknown> = { hookEventName: ctx.hookEventName };
+  const out: Record<string, unknown> = { hookSpecificOutput: hso };
+  if (e.outcome === "emitted") hso[e.field] = e.value;
+  else out["systemMessage"] = rewriteWithheldNotice(e);
+  const label = ctx.severity === "block" ? ctx.reason || "agent-config hook reported a blocking finding" : ctx.reason;
+  const context = [e.outcome === "emitted" ? e.explain : undefined, label].filter(Boolean).join("\n\n");
+  if (context) hso["additionalContext"] = context;
+  return { exit: 0, stdout: `${JSON.stringify(out)}\n`, stderr: "" };
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
+  const decided = decideToolOutputRewrite(envelope, stage, deps);
+  const event = String(envelope["event"] ?? "");
+  const row = deps.row ?? null;
+  const today = deps.today ?? new Date().toISOString().slice(0, 10);
+  const native = row !== null && row.json_shape !== "none" && row.verified !== null && row.verified.expires >= today;
+  const slot = row?.slots.get(event);
+  const carries = native && slot !== undefined;
+  const blockCapable = slot?.block_exit !== null && slot?.block_exit !== undefined;
+  let final: ToolOutputRewrite | null | undefined =
+    decided === null ? null : !carries ? finalizeRewrite(envelope, decided, deps, "no-emission") : blockCapable ? undefined : finalizeRewrite(envelope, decided, deps);
+  const plan: StagePlan = {
+    get decision() {
+      return final === undefined ? decided : final;
+    },
+    delivered: final === undefined ? new Map() : deliveredBodyBytes(envelope, final),
+    emit(severity, reasons) {
+      if (final === undefined) final = finalizeRewrite(envelope, decided as ToolOutputRewrite, deps, severity === "block" ? "block-precedence" : undefined);
+      if (!carries || slot === undefined) return null;
+      const reason = reasons.map((r) => r.trim()).filter((r) => r.length > 0).join(" · ");
+      const hookEventName = slot.native.find((n) => n !== "" && n !== "null") ?? event;
+      return emitEgress(final, { event, severity, reason, hookEventName });
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
