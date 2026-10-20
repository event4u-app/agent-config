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

import { resolveRewriteCapability } from "./rewrite_capability.js";
import { surfaceRow } from "./host_lowering.js";
import { type EgressEngine } from "./egress_engine_loader.js";
import { WITHHELD_MARKER, type EgressStageResult, requireEngine } from "./egress_stage.js";
import { BODY_KEYS, type JsonObject, type JsonValue } from "./payload_stub.js";
import { is_replay_mode } from "./state_io.js";

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
  if (isObject(v)) return WITHHELD_MARKER in v || Object.values(v).some((x) => hasWithheld(x as JsonValue));
  return false;
}

function residual(v: JsonValue, engine: EgressEngine): boolean {
  if (typeof v === "string") return engine.detect(v).length > 0;
  if (Array.isArray(v)) return v.some((x) => residual(x, engine));
  if (isObject(v)) return Object.values(v).some((x) => residual(x as JsonValue, engine));
  return false;
}

function resultKey(payload: JsonObject): string | null {
  return BODY_KEYS.result.find((k) => payload[k] !== undefined && payload[k] !== null) ?? null;
}

/** One fixed-field line per decided result; the dropped-replacement count is the `withheld` lines. */
export const REWRITE_FILE = path.join("agents", "runtime", "state", "egress-rewrites.jsonl");
const TOOL_NAME = /^[A-Za-z0-9_.:-]{1,128}$/;

export function recordRewrite(workspaceRoot: string, envelope: JsonObject, r: ToolOutputRewrite): void {
  if (is_replay_mode()) return;
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
export function firstTokenUse(workspaceRoot: string, sessionId: unknown): boolean {
  if (typeof sessionId !== "string" || !SESSION_ID.test(sessionId)) return true;
  if (is_replay_mode()) return true;
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
  readonly packageRoot: string;
  readonly today?: string;
  readonly now?: () => number;
  readonly engine?: () => EgressEngine;
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
  if (r !== null) recordRewrite(String(envelope["workspace_root"] || process.cwd()), envelope, r);
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
    const cap = (deps.capability ?? resolveRewriteCapability)(platform, surfaceRow(platform), "output", {
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
    if (residual(after, (deps.engine ?? requireEngine)())) return { outcome: "withheld", reason: "residual-hit", replaced };
    if (now() - started > REWRITE_DEADLINE_MS) return { outcome: "withheld", reason: "deadline", replaced };
    const tool = original["tool_name"];
    const field: RewriteField = typeof tool === "string" && tool.startsWith("mcp__") ? "updatedMCPToolOutput" : "updatedToolOutput";
    const told = !firstTokenUse(String(envelope["workspace_root"] || process.cwd()), original["session_id"]);
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

/** Scanning the prompt must finish well before the host's timeout, because a host timeout sends the prompt. */
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
  const overran = (stage.elapsedMs ?? 0) > PROMPT_DEADLINE_MS;
  if (counts.length === 0 && !refused) return null;
  const count = counts.reduce((n, c) => n + c.count, 0);
  const types = [...new Set(counts.map((c) => c.type))].sort();
  let outcome: PromptGate["outcome"] = "warn";
  try {
    const platform = String(envelope["platform"] ?? "");
    const cap = (deps.capability ?? resolveRewriteCapability)(platform, surfaceRow(platform), "prompt", {
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
  return { outcome, message: `${head}\n${body}\n\n${promptResidueLine(types, count)}` };
}

export type EgressEmission = ToolOutputRewrite | PromptGate;

/** The one decision the dispatcher hands to `emitFor` for this event. */
export function planEgressEmission(
  envelope: JsonObject,
  stage: EgressStageResult,
  deps: RewriteDeps,
): EgressEmission | null {
  return envelope["event"] === "user_prompt_submit"
    ? planPromptGate(envelope, stage, deps)
    : planToolOutputRewrite(envelope, stage, deps);
}

/**
 * The byte length of each body the emission replaces, keyed by payload key, for
 * the payload stub to carry beside the received length. Empty unless a result
 * rewrite is emitted.
 */
export function deliveredBodyBytes(envelope: JsonObject, e: EgressEmission | null): ReadonlyMap<string, number> {
  const out = new Map<string, number>();
  if (e?.outcome !== "emitted" || !isObject(envelope["payload"])) return out;
  const key = resultKey(envelope["payload"]);
  if (key !== null) out.set(key, Buffer.byteLength(typeof e.value === "string" ? e.value : JSON.stringify(e.value), "utf8"));
  return out;
}
