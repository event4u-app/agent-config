/**
 * What the egress stage asks the host to do with an event (ADR-285): replace a
 * tool result, or refuse a prompt. Contract: docs/contracts/egress-placeholders-v1.md.
 *
 * A rewrite is emitted only when the stage ran in `protect` or `strict`, the
 * result carried a listed value, the host's lowering row yields a
 * `RewriteCapability` for the `output` channel, and the replaced object passes
 * its own checks: the same keys and types as the original with only string
 * leaves changed, and no listed value left in it. Every other outcome emits no
 * rewrite and is counted, because a result that carried a value and reached the
 * model unreplaced is a leak whether this module or the host dropped it.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import type { EgressStageResult } from "../hooks/egress_stage.js";
import type { SurfaceRow } from "../hooks/host_lowering.js";
import { BODY_KEYS, type JsonObject, type JsonValue } from "../hooks/payload_stub.js";
import { is_replay_mode } from "../hooks/state_io.js";
import { detect } from "./egress_rules.js";
import { planRestore, type RestoreDeps, type RestorePlan } from "./egress_restore.js";
import { fileOrigin, pruneSessionTables, sessionTableDir, withSessionScope } from "./egress_session_table.js";
import { EgressRefusedError, replaceValues, type TokenScope } from "./egress_token.js";
import { resolveRewriteCapability } from "./rewrite_capability.js";

/**
 * Equal to `WITHHELD_MARKER` in the stage, which this chunk cannot import
 * without carrying the stage's settings reader; a test holds the two equal.
 */
export const STAGE_WITHHELD_MARKER = "_agent_config_egress_withheld";

/** Well inside the host's own hook timeout: a host timeout shows the original. */
export const REWRITE_DEADLINE_MS = 500;

export type RewriteWithheld =
  | "no-capability"
  | "extent-unproven"
  | "shape-mismatch"
  | "residual-hit"
  | "deadline"
  | "stage-error";

/** The host field a replaced result travels in; MCP tools have their own. */
export type RewriteField = "updatedToolOutput" | "updatedMCPToolOutput";

export type ToolOutputRewrite =
  | {
      readonly outcome: "emitted";
      readonly field: RewriteField;
      readonly value: JsonValue;
      readonly replaced: number;
      /** The one line telling the model what a token is, on the session's first rewrite only (3.4). */
      readonly explain?: string;
    }
  | { readonly outcome: "withheld"; readonly reason: RewriteWithheld; readonly replaced: number };

function isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function kind(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

/** Same keys in the same order, same types at every node, arrays of the same length. */
export function sameShape(a: JsonValue, b: JsonValue): boolean {
  if (kind(a) !== kind(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => sameShape(x, b[i] as JsonValue));
  if (isObject(a) && isObject(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k, i) => k === kb[i] && sameShape(a[k] as JsonValue, b[k] as JsonValue));
  }
  return true;
}

function hasWithheld(v: JsonValue): boolean {
  if (Array.isArray(v)) return v.some(hasWithheld);
  if (isObject(v)) return STAGE_WITHHELD_MARKER in v || Object.values(v).some((x) => hasWithheld(x as JsonValue));
  return false;
}

function residual(v: JsonValue): boolean {
  if (typeof v === "string") return detect(v).length > 0;
  if (Array.isArray(v)) return v.some((x) => residual(x));
  if (isObject(v)) return Object.values(v).some((x) => residual(x as JsonValue));
  return false;
}

function resultKey(payload: JsonObject): string | null {
  return BODY_KEYS.result.find((k) => payload[k] !== undefined && payload[k] !== null) ?? null;
}

/** One fixed-field line per decided result; the dropped-replacement count is the `withheld` lines. */
export const REWRITE_FILE = path.join("agents", "runtime", "state", "egress-rewrites.jsonl");
const TOOL_NAME = /^[A-Za-z0-9_.:-]{1,128}$/;

export function recordRewrite(workspaceRoot: string, envelope: JsonObject, r: ToolOutputRewrite, replay = false): void {
  if (replay) return;
  const tool = isObject(envelope["payload"]) ? envelope["payload"]["tool_name"] : undefined;
  const line = {
    ts: new Date().toISOString(),
    platform: String(envelope["platform"] ?? ""),
    tool: typeof tool === "string" && TOOL_NAME.test(tool) ? tool : null,
    outcome: r.outcome,
    reason: r.outcome === "withheld" ? r.reason : null,
    replaced: r.replaced,
  };
  try {
    const file = path.join(workspaceRoot, REWRITE_FILE);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify(line)}\n`, "utf8");
  } catch {
    // observability never breaks the hook
  }
}

/**
 * Said once per session, beside the first replaced result. Whether it earns its
 * bytes is measured (3.4); if it does not, it is removed rather than kept.
 */
export const TOKEN_EXPLAINER =
  "agent-config replaced listed values in this tool result with placeholder tokens such as __APIKEY_1_a1b2c3__. " +
  "When you need such a value, copy its token exactly as written; never guess or reconstruct what it stands for.";

const EXPLAINED_DIR = path.join("agents", "runtime", "state", "egress-token-explained");
const SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** True the first time a session asks; a session id that is not id-shaped is always told. */
export function firstTokenUse(workspaceRoot: string, sessionId: unknown, replay = false): boolean {
  if (typeof sessionId !== "string" || !SESSION_ID.test(sessionId)) return true;
  if (replay) return true;
  const flag = path.join(workspaceRoot, EXPLAINED_DIR, sessionId);
  try {
    fs.mkdirSync(path.dirname(flag), { recursive: true });
    fs.writeFileSync(flag, "", { flag: "wx" });
    return true;
  } catch {
    return false;
  }
}

export interface RewriteDeps {
  /** The session table directory; the user-global one when absent. */
  readonly sessionDir?: string;
  readonly packageRoot: string;
  readonly today?: string;
  readonly now?: () => number;
  /** The host's lowering row; absent means no capability on any channel. */
  readonly row?: SurfaceRow | null;
  /** A replay run writes no record and no per-session flag; read from the environment when absent. */
  readonly replay?: boolean;
  /** Milliseconds this hook process has run, against the prompt deadline; `performance.now()` when absent. */
  readonly elapsed?: () => number;
  readonly capability?: typeof resolveRewriteCapability;
}

/**
 * The rewrite for a `post_tool_use` event, or `null` when there is nothing to
 * decide: another event, a mode that replaces nothing, or a result with no
 * listed value. Never throws.
 */
export function planToolOutputRewrite(
  envelope: JsonObject,
  stage: EgressStageResult,
  deps: RewriteDeps,
): ToolOutputRewrite | null {
  const r = decide(envelope, stage, deps);
  if (r !== null) recordRewrite(String(envelope["workspace_root"] || process.cwd()), envelope, r, deps.replay ?? is_replay_mode());
  return r;
}

function decide(envelope: JsonObject, stage: EgressStageResult, deps: RewriteDeps): ToolOutputRewrite | null {
  if (envelope["event"] !== "post_tool_use") return null;
  if (stage.mode !== "protect" && stage.mode !== "strict") return null;
  const replaced = stage.counts.filter((c) => c.field === "result").reduce((n, c) => n + c.count, 0);
  const refusedResult = stage.refused.some((r) => r.field === "result");
  if (replaced === 0 && !refusedResult) return null;
  const now = deps.now ?? Date.now;
  const started = now();
  try {
    if (refusedResult) return { outcome: "withheld", reason: "extent-unproven", replaced };
    const platform = String(envelope["platform"] ?? "");
    const cap = (deps.capability ?? resolveRewriteCapability)(platform, deps.row, "output", {
      today: deps.today ?? new Date().toISOString().slice(0, 10),
      root: deps.packageRoot,
    });
    if (!cap.ok || cap.capability.mode !== "replace") return { outcome: "withheld", reason: "no-capability", replaced };
    const original = isObject(envelope["payload"]) ? envelope["payload"] : null;
    const placeholder = isObject(stage.placeholder?.["payload"]) ? (stage.placeholder?.["payload"] as JsonObject) : null;
    const key = original === null ? null : resultKey(original);
    if (original === null || placeholder === null || key === null) {
      return { outcome: "withheld", reason: "shape-mismatch", replaced };
    }
    const before = original[key] as JsonValue;
    const after = placeholder[key] as JsonValue;
    if (hasWithheld(after) || !sameShape(before, after)) return { outcome: "withheld", reason: "shape-mismatch", replaced };
    if (residual(after)) return { outcome: "withheld", reason: "residual-hit", replaced };
    if (now() - started > REWRITE_DEADLINE_MS) return { outcome: "withheld", reason: "deadline", replaced };
    const tool = original["tool_name"];
    const field: RewriteField = typeof tool === "string" && tool.startsWith("mcp__") ? "updatedMCPToolOutput" : "updatedToolOutput";
    const told = !firstTokenUse(String(envelope["workspace_root"] || process.cwd()), original["session_id"], deps.replay ?? is_replay_mode());
    return told
      ? { outcome: "emitted", field, value: after, replaced }
      : { outcome: "emitted", field, value: after, replaced, explain: TOKEN_EXPLAINER };
  } catch {
    return { outcome: "withheld", reason: "stage-error", replaced };
  }
}

/**
 * The line the host shows the user when a result that carried a listed value
 * reached the model unreplaced. Counts and a reason only, never a value.
 */
export function rewriteWithheldNotice(r: ToolOutputRewrite): string | null {
  if (r.outcome !== "withheld") return null;
  return (
    `agent-config egress: a tool result carrying ${r.replaced} listed value(s) reached the model unreplaced ` +
    `(${r.reason}). Treat it as disclosed and rotate a credential it carried.`
  );
}

/**
 * The whole hook process — start-up, bundle load and scan — must answer well
 * before the host's timeout, because a host timeout sends the prompt.
 */
export const PROMPT_DEADLINE_MS = 1500;

/**
 * The residue the refusal states (5.2). Fixed wording, types and counts only:
 * refusing a prompt does not unsay what was typed into the host.
 */
export function promptResidueLine(types: readonly string[], count: number): string {
  return (
    `It held ${count} listed value(s) of type ${types.join(", ") || "unknown"}. The text was typed into the host and may ` +
    "still sit in its local transcript and prompt history; rotate any credential it carried."
  );
}

/** Where the refusal sends a reader who asks what else is and is not covered. */
export const COVERAGE_POINTER =
  "What each channel is covered by: docs/contracts/egress-placeholders-v1.md § Coverage (agent-config hooks:status --coverage).";

/** `refuse` blocks the prompt; `warn` is all a host that cannot refuse allows, and its channel stays `uncovered`. */
export type PromptGate = { readonly outcome: "refuse" | "warn"; readonly message: string };

/**
 * The gate for a `user_prompt_submit` event (5.1, D3), or `null` when there is
 * nothing to refuse. The credential class is refused in `protect` and `strict`;
 * the identifier class only in `strict`. The message carries the redacted copy
 * to resend and never the original text. A scan that overran its deadline, or
 * a value whose extent could not be proven, refuses with no copy: past the
 * deadline the host's own timeout is close, and that timeout sends the prompt.
 */
export function planPromptGate(
  envelope: JsonObject,
  stage: EgressStageResult,
  deps: RewriteDeps,
): PromptGate | null {
  if (envelope["event"] !== "user_prompt_submit") return null;
  if (stage.mode !== "protect" && stage.mode !== "strict") return null;
  const counts = stage.counts.filter(
    (c) => c.field === "prompt" && (c.class === "credential" || stage.mode === "strict"),
  );
  const refused = stage.refused.some((r) => r.field === "prompt");
  const overran = (deps.elapsed ?? (() => performance.now()))() > PROMPT_DEADLINE_MS;
  if (counts.length === 0 && !refused) return null;
  const count = counts.reduce((n, c) => n + c.count, 0);
  const types = [...new Set(counts.map((c) => c.type))].sort();
  let outcome: PromptGate["outcome"] = "warn";
  try {
    const platform = String(envelope["platform"] ?? "");
    const cap = (deps.capability ?? resolveRewriteCapability)(platform, deps.row, "prompt", {
      today: deps.today ?? new Date().toISOString().slice(0, 10),
      root: deps.packageRoot,
    });
    if (cap.ok && cap.capability.mode === "gate") outcome = "refuse";
  } catch {
    outcome = "warn";
  }
  const placeholder = isObject(stage.placeholder?.["payload"]) ? (stage.placeholder?.["payload"] as JsonObject) : null;
  const copy = placeholder !== null && typeof placeholder["prompt"] === "string" ? placeholder["prompt"] : null;
  const head =
    outcome === "refuse"
      ? "agent-config egress: this prompt was not sent, because it carries a listed value."
      : "agent-config egress: this prompt carries a listed value and this host cannot refuse it, so it was sent.";
  const body =
    refused || overran || copy === null
      ? "The value could not be bounded in time, so no redacted copy is offered; retype the prompt without it."
      : `Resend this redacted copy instead:\n\n${copy}`;
  return { outcome, message: `${head}\n${body}\n\n${COVERAGE_POINTER}\n${promptResidueLine(types, count)}` };
}

export type EgressEmission = ToolOutputRewrite | PromptGate | RestorePlan;

/** The one decision the dispatcher hands to `emitFor` for this event. */
export function planEgressEmission(
  envelope: JsonObject,
  stage: EgressStageResult,
  deps: RewriteDeps,
): EgressEmission | null {
  if (envelope["event"] === "user_prompt_submit") return planPromptGate(envelope, stage, deps);
  if (envelope["event"] === "pre_tool_use") return planInputRestore(envelope, deps);
  return planToolOutputRewrite(envelope, stage, deps);
}

/**
 * The restore for a `pre_tool_use` input (Phase 4). Where the host's row grants
 * no `input` capability, a restore cannot be delivered, so a call that needed
 * one is denied instead: an unrestored token must not reach a tool (4.4).
 */
export function planInputRestore(envelope: JsonObject, deps: RewriteDeps, restore: RestoreDeps = {}): RestorePlan | null {
  const plan = planRestore(envelope, {
    ...restore,
    ...(deps.sessionDir !== undefined ? { sessionDir: deps.sessionDir } : {}),
    ...(deps.replay !== undefined ? { replay: deps.replay } : {}),
  });
  if (plan === null || plan.input === null) return plan;
  const platform = String(envelope["platform"] ?? "");
  const cap = (deps.capability ?? resolveRewriteCapability)(platform, deps.row, "input", {
    today: deps.today ?? new Date().toISOString().slice(0, 10),
    root: deps.packageRoot,
  });
  if (cap.ok && cap.capability.mode === "replace") return plan;
  return { outcome: "restore", input: null, decision: "deny", reason: "agent-config egress: this host cannot restore a placeholder into a tool input, so the call was not run." };
}

/**
 * The byte length of each body the emission replaces, keyed `<payload key>#`, for
 * the payload stub to carry beside the received length. Empty unless a result
 * rewrite is emitted.
 */
export function deliveredBodyBytes(envelope: JsonObject, e: EgressEmission | null): ReadonlyMap<string, number> {
  const out = new Map<string, number>();
  if (e?.outcome !== "emitted" || !isObject(envelope["payload"])) return out;
  const key = resultKey(envelope["payload"]);
  if (key !== null) out.set(`${key}#`, Buffer.byteLength(typeof e.value === "string" ? e.value : JSON.stringify(e.value), "utf8"));
  return out;
}

/** What the host receives for an event the stage decided; the dispatcher writes it instead of `emitFor`'s. */
export interface EgressHostEmission {
  readonly exit: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface EmitContext {
  readonly event: string;
  /** `allow`, `warn` or `block`: the concerns' reduced verdict, which a block lets outrank a rewrite. */
  readonly severity: string;
  /** The concerns' deciding reasons, joined. */
  readonly reason: string;
  /** The host's refusal code on this slot, `null` where it cannot refuse. */
  readonly blockExit: number | null;
  /** The host's own name for the event, e.g. `PostToolUse`. */
  readonly hookEventName: string;
}

/**
 * The emission for a decided event, or `null` to leave `emitFor` in charge.
 * A block outranks a rewrite (ADR-285): it emits no replaced value, and the
 * result counts as unreplaced. A refused prompt's message replaces every
 * concern reason, because a concern's text may quote the prompt it refuses.
 */
export function emitEgress(e: EgressEmission | null, ctx: EmitContext): EgressHostEmission | null {
  if (e === null) return null;
  if (ctx.event === "post_tool_use" && (e.outcome === "emitted" || e.outcome === "withheld")) {
    const hso: Record<string, unknown> = { hookEventName: ctx.hookEventName };
    const out: Record<string, unknown> = { hookSpecificOutput: hso };
    const emitted = e.outcome === "emitted" && ctx.severity !== "block";
    if (emitted) hso[e.field] = e.value;
    else out["systemMessage"] = rewriteWithheldNotice(e.outcome === "emitted" ? { outcome: "withheld", reason: "stage-error", replaced: e.replaced } : e);
    const label = ctx.severity === "block" ? ctx.reason || "agent-config hook reported a blocking finding" : ctx.reason;
    const context = [emitted && e.outcome === "emitted" ? e.explain : undefined, label].filter(Boolean).join("\n\n");
    if (context) hso["additionalContext"] = context;
    return { exit: 0, stdout: `${JSON.stringify(out)}\n`, stderr: "" };
  }
  if (ctx.event === "pre_tool_use" && e.outcome === "restore") {
    // A concern's block outranks a restore and keeps the host's own refusal path.
    if (ctx.severity === "block") return null;
    const hso: Record<string, unknown> = { hookEventName: ctx.hookEventName };
    if (e.input !== null) hso["updatedInput"] = e.input;
    // Never an `allow` beside a restored input (K2): no decision leaves the host's own permission flow in charge.
    if (e.decision !== null) {
      hso["permissionDecision"] = e.decision;
      hso["permissionDecisionReason"] = [e.reason, ctx.reason].filter(Boolean).join("\n\n");
    } else if (ctx.reason) hso["additionalContext"] = ctx.reason;
    return { exit: 0, stdout: `${JSON.stringify({ hookSpecificOutput: hso })}\n`, stderr: "" };
  }
  if (ctx.event !== "user_prompt_submit") return null;
  if (e.outcome === "refuse" && ctx.blockExit !== null) return { exit: ctx.blockExit, stdout: "", stderr: `${e.message}\n` };
  if ((e.outcome === "warn" || e.outcome === "refuse") && ctx.severity !== "block") {
    const text = [ctx.reason, e.message].filter(Boolean).join("\n\n");
    return { exit: 0, stdout: `${JSON.stringify({ hookSpecificOutput: { hookEventName: ctx.hookEventName, additionalContext: text } })}\n`, stderr: "" };
  }
  return null;
}

/** The stage's decision for one event, as the dispatcher consumes it. */
export interface StagePlan {
  readonly decision: EgressEmission | null;
  /** The rewritten body's byte length per payload key, for the payload stub; empty with no rewrite. */
  readonly delivered: ReadonlyMap<string, number>;
  /** The host emission once the concerns have reduced to a severity, or `null` to leave `emitFor` in charge. */
  emit(severity: string, reasons: readonly string[]): EgressHostEmission | null;
}

/**
 * Decides the event and binds everything the emission needs from the host's
 * lowering row: whether the row emits natively (verified, with a native
 * envelope), its refusal code and its own event name for the slot.
 */
export function planStage(
  envelope: JsonObject,
  stage: EgressStageResult,
  deps: RewriteDeps,
): { plan?: StagePlan; placeholder?: JsonObject; execution?: JsonObject } {
  // `observe` builds no placeholder view and asks the host for nothing.
  if (stage.placeholder === undefined) return {};
  const minted = mintIntoSession(envelope, stage, deps);
  const decided = minted === null ? stage : { ...stage, placeholder: minted };
  const decision = planEgressEmission(envelope, decided, deps);
  const event = String(envelope["event"] ?? "");
  const row = deps.row ?? null;
  const today = deps.today ?? new Date().toISOString().slice(0, 10);
  const native = row !== null && row.json_shape !== "none" && row.verified !== null && row.verified.expires >= today;
  const slot = row?.slots.get(event);
  const plan: StagePlan = {
    decision,
    delivered: deliveredBodyBytes(envelope, decision),
    emit(severity, reasons) {
      if (!native || slot === undefined) return null;
      const reason = reasons.map((r) => r.trim()).filter((r) => r.length > 0).join(" · ");
      const hookEventName = slot.native.find((n) => n !== "" && n !== "null") ?? event;
      return emitEgress(decision, { event, severity, reason, blockExit: slot.block_exit, hookEventName });
    },
  };
  const out: { plan: StagePlan; placeholder?: JsonObject; execution?: JsonObject } = { plan };
  if (minted !== null) out.placeholder = minted;
  // The guards decide on what will run: the restored input, never the token.
  if (decision?.outcome === "restore" && decision.input !== null && isObject(envelope["payload"])) {
    out.execution = { ...envelope, payload: { ...envelope["payload"], tool_input: decision.input } };
  }
  return out;
}

let pruned = false;

/** Tables idle past the retention age go before this process mints into one. */
function pruneOncePerProcess(dir: string): void {
  if (pruned) return;
  pruned = true;
  pruneSessionTables(dir);
}

/** Tools whose result is a file this package can re-read: a token minted from it can be restored. */
const FILE_RESULT_TOOLS: ReadonlySet<string> = new Set(["Read", "Write", "Edit", "MultiEdit"]);

function replaceDeepIn(v: JsonValue, scope: TokenScope): JsonValue {
  if (typeof v === "string") return replaceValues(v, scope);
  if (Array.isArray(v)) return v.map((x) => replaceDeepIn(x, scope));
  if (isObject(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, replaceDeepIn(x as JsonValue, scope)]));
  return v;
}

/**
 * The placeholder view of a file tool's result with its tokens minted into the
 * session table under the file's origin, so a later input can restore them.
 * `null` — keep the stage's own per-dispatch view — for any other event, tool,
 * a missing session id or file, or a failure to write the table.
 */
export function mintIntoSession(envelope: JsonObject, stage: EgressStageResult, deps: RewriteDeps): JsonObject | null {
  if (envelope["event"] !== "post_tool_use" || stage.placeholder === undefined) return null;
  const payload = isObject(envelope["payload"]) ? envelope["payload"] : null;
  const input = payload !== null && isObject(payload["tool_input"]) ? payload["tool_input"] : null;
  const tool = payload?.["tool_name"];
  const file = input?.["file_path"];
  const sessionId = payload?.["session_id"];
  if (payload === null || typeof tool !== "string" || !FILE_RESULT_TOOLS.has(tool)) return null;
  if (typeof file !== "string" || typeof sessionId !== "string" || sessionId === "") return null;
  const key = resultKey(payload);
  if (key === null || !stage.counts.some((c) => c.field === "result")) return null;
  try {
    const workspaceRoot = String(envelope["workspace_root"] || process.cwd());
    pruneOncePerProcess(deps.sessionDir ?? sessionTableDir());
    const origin = fileOrigin(path.resolve(workspaceRoot, file), { tool, field: key, operation: "read" });
    const target = { dir: deps.sessionDir ?? sessionTableDir(), sessionId, workspaceRoot, origin };
    const value = withSessionScope(target, (scope) => {
      try {
        return replaceDeepIn(payload[key] as JsonValue, scope);
      } catch (exc) {
        if (exc instanceof EgressRefusedError) return { [STAGE_WITHHELD_MARKER]: true, rule: exc.rule };
        throw exc;
      }
    });
    const base = stage.placeholder["payload"];
    return { ...stage.placeholder, payload: { ...(isObject(base) ? base : payload), [key]: value } };
  } catch {
    return null;
  }
}
