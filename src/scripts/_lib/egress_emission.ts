/**
 * What the egress stage asks the host to do with a tool result (ADR-285): the
 * one writer of a result rewrite. Contract: docs/contracts/egress-placeholders-v1.md
 * § Tool results.
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
import * as os from "node:os";
import * as path from "node:path";

import type { EgressStageResult } from "../hooks/egress_stage.js";
import type { SurfaceRow } from "../hooks/host_lowering.js";
import { BODY_KEYS, type JsonObject, type JsonValue } from "../hooks/payload_stub.js";
import { is_replay_mode } from "../hooks/state_io.js";
import { detect } from "./egress_rules.js";
import { resolveRewriteCapability } from "./rewrite_capability.js";

/**
 * Equal to `WITHHELD_MARKER` in the stage, which this chunk cannot import
 * without carrying the stage's settings reader; a test holds the two equal.
 */
export const STAGE_WITHHELD_MARKER = "_agent_config_egress_withheld";

/** Well inside the host's own hook timeout: a host timeout shows the original. */
export const REWRITE_DEADLINE_MS = 500;

/** Above this many JSON nodes a result is withheld before it is walked, so no check runs unbounded. */
export const MAX_RESULT_NODES = 50_000;

export type RewriteWithheld =
  | "no-capability"
  | "no-workspace"
  | "extent-unproven"
  | "oversize"
  | "shape-mismatch"
  | "residual-hit"
  | "deadline"
  | "stage-error"
  | "audit-unwritable"
  | "block-precedence"
  | "no-emission";

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
  | {
      readonly outcome: "withheld";
      readonly reason: RewriteWithheld;
      readonly replaced: number;
      /** A revoking reason whose revocation could not be written: the channel is NOT disabled. */
      readonly unrevoked?: true;
    };

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

/** False when the line could not be written; an emitted rewrite with no record is withheld instead. */
export function recordRewrite(workspaceRoot: string, envelope: JsonObject, r: ToolOutputRewrite, replay = false): boolean {
  if (replay) return true;
  const tool = isObject(envelope["payload"]) ? envelope["payload"]["tool_name"] : undefined;
  const line = {
    ts: new Date().toISOString(),
    platform: String(envelope["platform"] ?? ""),
    tool: typeof tool === "string" && TOOL_NAME.test(tool) ? tool : null,
    outcome: r.outcome,
    reason: r.outcome === "withheld" ? r.reason : null,
    replaced: r.replaced,
  };
  return appendLine(path.join(workspaceRoot, REWRITE_FILE), line);
}

/** One `O_APPEND` write per line, so concurrent hook processes never lose each other's lines. */
function appendLine(file: string, line: object): boolean {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify(line)}\n`, "utf8");
    return true;
  } catch {
    return false;
  }
}

/** The workspace's real path, or `null` when it does not resolve to a directory: then nothing is written and nothing emitted. */
export function resolveWorkspace(envelope: JsonObject): string | null {
  const raw = envelope["workspace_root"];
  const candidate = typeof raw === "string" && raw !== "" ? raw : process.cwd();
  if (!path.isAbsolute(candidate)) return null;
  try {
    const real = fs.realpathSync(candidate);
    return fs.statSync(real).isDirectory() ? real : null;
  } catch {
    return null;
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

/** A withheld rewrite for one of these reasons revokes the channel on the workspace until a person clears it. */
export const REVOKING_REASONS: ReadonlySet<RewriteWithheld> = new Set(["shape-mismatch", "residual-hit", "deadline", "stage-error"]);
export const REVOCATION_FILE = path.join("agents", "runtime", "state", "egress-revoked.jsonl");

type Revocation = { host: string; channel: string; reason: string; at: string };

/**
 * The revocations recorded on this workspace. An absent file is none; a file
 * that exists and cannot be read, or holds a line that is not a revocation,
 * revokes every channel, because a lost revocation must not read as consent.
 */
export function readRevocations(workspaceRoot: string): Revocation[] {
  let text: string;
  try {
    text = fs.readFileSync(path.join(workspaceRoot, REVOCATION_FILE), "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    return [ALL_REVOKED];
  }
  const out: Revocation[] = [];
  for (const l of text.split("\n")) {
    if (l.trim() === "") continue;
    try {
      const r = JSON.parse(l) as Partial<Revocation>;
      if (typeof r.host !== "string" || typeof r.channel !== "string") return [ALL_REVOKED];
      out.push({ host: r.host, channel: r.channel, reason: String(r.reason ?? ""), at: String(r.at ?? "") });
    } catch {
      return [ALL_REVOKED];
    }
  }
  return out;
}

const ALL_REVOKED: Revocation = { host: "*", channel: "*", reason: "revocation-state-unreadable", at: "" };

const SESSION_FILE = /^[A-Za-z0-9_-]{1,128}$/;
const SEMVER = /^\d+\.\d+\.\d+$/;

function claudeConfigDir(): string {
  return process.env["CLAUDE_CONFIG_DIR"] || path.join(os.homedir(), ".claude");
}

/**
 * The running host's version: the top-level `version` of the last line of
 * this session's own transcript that carries one. The path must resolve, after
 * links, inside the host's `projects` directory and be named for the session,
 * so an envelope cannot point the check at a file it wrote. `null` otherwise,
 * and an unobserved version grants no `replace`.
 */
export function observedHostVersion(transcriptPath: unknown, sessionId: unknown, configDir: string = claudeConfigDir()): string | null {
  if (typeof transcriptPath !== "string" || transcriptPath === "") return null;
  if (typeof sessionId !== "string" || !SESSION_FILE.test(sessionId)) return null;
  let fd: number | null = null;
  try {
    const projects = fs.realpathSync(path.join(configDir, "projects"));
    const real = fs.realpathSync(transcriptPath);
    if (!real.startsWith(projects + path.sep) || path.basename(real) !== `${sessionId}.jsonl`) return null;
    fd = fs.openSync(real, "r");
    const size = fs.fstatSync(fd).size;
    const len = Math.min(size, 65536);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, size - len);
    const lines = buf.toString("utf8").split("\n");
    if (len < size) lines.shift();
    for (const l of lines.reverse()) {
      if (l.trim() === "") continue;
      try {
        const v = (JSON.parse(l) as Record<string, unknown>)["version"];
        if (typeof v === "string" && SEMVER.test(v)) return v;
      } catch {
        // a partial or foreign line carries no version
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== null) fs.closeSync(fd);
  }
}

function nodeCountExceeds(v: JsonValue, limit: number): boolean {
  let n = 0;
  const stack: JsonValue[] = [v];
  while (stack.length > 0) {
    const x = stack.pop() as JsonValue;
    if (++n > limit) return true;
    if (Array.isArray(x)) for (const y of x) stack.push(y);
    else if (isObject(x)) for (const y of Object.values(x)) stack.push(y as JsonValue);
  }
  return false;
}

export interface RewriteDeps {
  readonly packageRoot: string;
  readonly today?: string;
  readonly now?: () => number;
  /** The running host's version; read from the session transcript when absent. */
  readonly observedHostVersion?: string | null;
  /** The host's lowering row; absent means no capability on any channel. */
  readonly row?: SurfaceRow | null;
  /** A replay run writes no record and no per-session flag; read from the environment when absent. */
  readonly replay?: boolean;
  readonly capability?: typeof resolveRewriteCapability;
}

/**
 * The rewrite for a `post_tool_use` event, decided and made final at once —
 * the case where nothing after the concern loop can change it. `null` when
 * there is nothing to decide: another event, a mode that replaces nothing, or a
 * result with no listed value. Never throws.
 */
export function planToolOutputRewrite(
  envelope: JsonObject,
  stage: EgressStageResult,
  deps: RewriteDeps,
): ToolOutputRewrite | null {
  const d = decideToolOutputRewrite(envelope, stage, deps);
  return d === null ? null : finalizeRewrite(envelope, d, deps);
}

/**
 * Makes a decision final and writes its record, its revocation and the
 * per-session explainer flag — once, after the last thing that could change it.
 * An emitted rewrite whose record cannot be written is withheld instead: no
 * replacement goes to the host without the line that counts it.
 */
export function finalizeRewrite(
  envelope: JsonObject,
  decided: ToolOutputRewrite,
  deps: RewriteDeps,
  override?: RewriteWithheld,
): ToolOutputRewrite {
  const replay = deps.replay ?? is_replay_mode();
  const workspace = resolveWorkspace(envelope);
  let r: ToolOutputRewrite = override !== undefined && decided.outcome === "emitted"
    ? { outcome: "withheld", reason: override, replaced: decided.replaced }
    : decided;
  if (workspace === null) {
    return r.outcome === "withheld" ? r : { outcome: "withheld", reason: "no-workspace", replaced: r.replaced };
  }
  if (!recordRewrite(workspace, envelope, r, replay) && r.outcome === "emitted") {
    r = { outcome: "withheld", reason: "audit-unwritable", replaced: r.replaced };
    recordRewrite(workspace, envelope, r, replay);
  }
  if (r.outcome === "emitted") {
    const payload = isObject(envelope["payload"]) ? envelope["payload"] : {};
    if (firstTokenUse(workspace, payload["session_id"], replay)) r = { ...r, explain: TOKEN_EXPLAINER };
  }
  if (r.outcome === "withheld" && REVOKING_REASONS.has(r.reason) && !replay) {
    const host = String(envelope["platform"] ?? "");
    if (!appendLine(path.join(workspace, REVOCATION_FILE), { host, channel: "output", reason: r.reason, at: new Date().toISOString() })) {
      r = { ...r, unrevoked: true };
    }
  }
  return r;
}

/** The decision alone: no record, no revocation, no flag. */
export function decideToolOutputRewrite(envelope: JsonObject, stage: EgressStageResult, deps: RewriteDeps): ToolOutputRewrite | null {
  if (envelope["event"] !== "post_tool_use") return null;
  if (stage.mode !== "protect" && stage.mode !== "strict") return null;
  const replaced = stage.counts.filter((c) => c.field === "result").reduce((n, c) => n + c.count, 0);
  const refusedResult = stage.refused.some((r) => r.field === "result");
  if (replaced === 0 && !refusedResult) return null;
  const now = deps.now ?? Date.now;
  const started = now();
  try {
    if (refusedResult) return { outcome: "withheld", reason: "extent-unproven", replaced };
    const workspace = resolveWorkspace(envelope);
    if (workspace === null) return { outcome: "withheld", reason: "no-workspace", replaced };
    const platform = String(envelope["platform"] ?? "");
    const payload = isObject(envelope["payload"]) ? envelope["payload"] : {};
    const revoked = readRevocations(workspace).map((r) => (r.host === "*" ? { ...r, host: platform, channel: "output" } : r));
    const cap = (deps.capability ?? resolveRewriteCapability)(platform, deps.row, "output", {
      today: deps.today ?? new Date().toISOString().slice(0, 10),
      root: deps.packageRoot,
      observedHostVersion:
        deps.observedHostVersion !== undefined ? deps.observedHostVersion : observedHostVersion(payload["transcript_path"], payload["session_id"]),
      revoked,
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
    if (nodeCountExceeds(before, MAX_RESULT_NODES) || nodeCountExceeds(after, MAX_RESULT_NODES)) {
      return { outcome: "withheld", reason: "oversize", replaced };
    }
    if (hasWithheld(after) || !sameShape(before, after)) return { outcome: "withheld", reason: "shape-mismatch", replaced };
    if (residual(after)) return { outcome: "withheld", reason: "residual-hit", replaced };
    if (now() - started > REWRITE_DEADLINE_MS) return { outcome: "withheld", reason: "deadline", replaced };
    const tool = original["tool_name"];
    const field: RewriteField = typeof tool === "string" && tool.startsWith("mcp__") ? "updatedMCPToolOutput" : "updatedToolOutput";
    return { outcome: "emitted", field, value: after, replaced };
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
    `(${r.reason}). Treat it as disclosed and rotate a credential it carried. ` +
    (r.unrevoked
      ? "The channel could not be disabled on this workspace; set egress.placeholders.mode to off until the cause is found. "
      : "") +
    'What each channel is covered by: docs/contracts/egress-placeholders-v1.md § Coverage (agent-config hooks:status --coverage).'
  );
}

export type EgressEmission = ToolOutputRewrite;

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
  /** `allow`, `warn` or `block`: the concerns' reduced verdict, carried as context; the decision is already final. */
  readonly severity: string;
  /** The concerns' deciding reasons, joined. */
  readonly reason: string;
  /** The host's own name for the event, e.g. `PostToolUse`. */
  readonly hookEventName: string;
}

/**
 * Renders a FINAL decision for the host, or `null` to leave `emitFor` in
 * charge. It changes no outcome: whether a block outranks the rewrite is
 * settled by `finalizeRewrite` before this runs, so what is written to the host
 * is exactly what the record says.
 */
export function emitEgress(e: EgressEmission | null, ctx: EmitContext): EgressHostEmission | null {
  if (e === null || ctx.event !== "post_tool_use") return null;
  const hso: Record<string, unknown> = { hookEventName: ctx.hookEventName };
  const out: Record<string, unknown> = { hookSpecificOutput: hso };
  if (e.outcome === "emitted") hso[e.field] = e.value;
  else out["systemMessage"] = rewriteWithheldNotice(e);
  const label = ctx.severity === "block" ? ctx.reason || "agent-config hook reported a blocking finding" : ctx.reason;
  const context = [e.outcome === "emitted" ? e.explain : undefined, label].filter(Boolean).join("\n\n");
  if (context) hso["additionalContext"] = context;
  return { exit: 0, stdout: `${JSON.stringify(out)}\n`, stderr: "" };
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
 * lowering row. The decision is made final exactly once, at the last point
 * that can change it: here, when the slot honours no block (a block there
 * cannot stop the result from being shown, so it cannot outrank the rewrite —
 * ADR-285's premise is a call that does not run); at emission, when the slot
 * honours one. A row that cannot carry the emission finalizes as withheld.
 */
export function planStage(
  envelope: JsonObject,
  stage: EgressStageResult,
  deps: RewriteDeps,
): { plan?: StagePlan } {
  // `observe` builds no placeholder view and asks the host for nothing.
  if (stage.placeholder === undefined) return {};
  const decided = decideToolOutputRewrite(envelope, stage, deps);
  const event = String(envelope["event"] ?? "");
  const row = deps.row ?? null;
  const today = deps.today ?? new Date().toISOString().slice(0, 10);
  const native = row !== null && row.json_shape !== "none" && row.verified !== null && row.verified.expires >= today;
  const slot = row?.slots.get(event);
  const carries = native && slot !== undefined;
  const blockCapable = slot?.block_exit !== null && slot?.block_exit !== undefined;
  let final: ToolOutputRewrite | null | undefined =
    decided === null ? null : !carries ? finalizeRewrite(envelope, decided, deps, "no-emission") : blockCapable ? undefined : finalizeRewrite(envelope, decided, deps);
  const plan: StagePlan = {
    get decision() {
      return final === undefined ? decided : final;
    },
    delivered: final === undefined ? new Map() : deliveredBodyBytes(envelope, final),
    emit(severity, reasons) {
      if (final === undefined) final = finalizeRewrite(envelope, decided as ToolOutputRewrite, deps, severity === "block" ? "block-precedence" : undefined);
      if (!carries || slot === undefined) return null;
      const reason = reasons.map((r) => r.trim()).filter((r) => r.length > 0).join(" · ");
      const hookEventName = slot.native.find((n) => n !== "" && n !== "null") ?? event;
      return emitEgress(final, { event, severity, reason, hookEventName });
    },
  };
  return { plan };
}
