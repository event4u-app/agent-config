/**
 * Values come back in one place: a token in a `pre_tool_use` input (placeholders
 * Phase 4, K4). Lives in the egress engine chunk beside the session table it
 * reads; contract: docs/contracts/egress-placeholders-v1.md § Restoration.
 *
 * A credential token restores only into the file it was read from, re-derived
 * from that file by its keyed digest; toward anything else it is denied. An
 * identifier restores silently into its origin file or a consequence-free call
 * and asks everywhere else, the restored input shown. A token nothing can
 * resolve, a mangled one, and any read of the session table itself are denied.
 * A restore never travels with an `allow` (K2), and an input bound for another
 * model context keeps its tokens.
 */
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import { isCategoryA } from "../hooks/category_a.js";
import type { JsonObject, JsonValue } from "../hooks/payload_stub.js";
import { is_replay_mode } from "../hooks/state_io.js";
import type { EgressRule } from "./egress_rules.js";
import {
  ANY_DESTINATION,
  fileDestination,
  type OriginReading,
  type OriginDescriptor,
  restoreToken,
  sessionTableDir,
} from "./egress_session_table.js";
import { parseTokens } from "./egress_token.js";

/** Tools whose input is a prompt for another model context: their tokens leave untouched. */
export const MODEL_BOUND_TOOLS: ReadonlySet<string> = new Set(["Task", "Agent"]);
/** Tools that write the file named by `file_path`: the restore's destination is that file. */
export const FILE_WRITE_TOOLS: ReadonlySet<string> = new Set(["Edit", "MultiEdit", "Write", "NotebookEdit"]);

/** More restores than this in one session inside the window turns the next into an `ask` (4.5). */
export const RESTORE_BURST = 8;
export const RESTORE_WINDOW_MS = 60_000;
export const RESTORE_AUDIT_FILE = path.join("agents", "runtime", "state", "egress-restores.jsonl");

/** Spaced or broken spellings of the grammar: anything here after restoration is denied, never guessed. */
const LOOSE_TOKEN = /__\s*([A-Z][A-Z0-9]{1,15})\s*_\s*([1-9][0-9]{0,5})\s*_\s*([0-9a-f]{6})\s*(?:_\s*v\s*([2-9]|[1-9][0-9])\s*)?__/g;
const GRAMMAR_REMNANT = /__\s*[A-Z][A-Z0-9]{1,15}\s*_\s*\d+\s*_/;

export type RestoreSink = "origin-file" | "consequence-free" | "other";

/** One audit line per restore attempt: fixed fields, no free text, no value (4.5). */
export interface RestoreAuditLine {
  ts: string;
  session: string;
  class: string;
  type: string;
  number: number;
  tool: string | null;
  sink: RestoreSink;
  decision: "restore" | "ask" | "deny";
}

export interface RestorePlan {
  readonly outcome: "restore";
  /** The input with tokens restored; `null` when the call is denied. */
  readonly input: JsonObject | null;
  readonly decision: "ask" | "deny" | null;
  readonly reason: string;
}

export interface RestoreDeps {
  readonly sessionDir?: string;
  readonly readOrigin?: (o: OriginDescriptor) => OriginReading;
  readonly rules?: readonly EgressRule[];
  readonly now?: number;
  readonly replay?: boolean;
}

function isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function strings(v: JsonValue, out: string[]): void {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) for (const x of v) strings(x, out);
  else if (isObject(v)) for (const x of Object.values(v)) strings(x as JsonValue, out);
}

function mapStrings(v: JsonValue, fn: (s: string) => string): JsonValue {
  if (typeof v === "string") return fn(v);
  if (Array.isArray(v)) return v.map((x) => mapStrings(x, fn));
  if (isObject(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mapStrings(x as JsonValue, fn)]));
  return v;
}

/** The tolerant match of 4.4: one canonical spelling for a spaced token, nothing more. */
export function canonicalizeTokens(text: string): string {
  return text.replace(LOOSE_TOKEN, (_m, t: string, n: string, fp: string, v: string | undefined) =>
    v === undefined ? `__${t}_${n}_${fp}__` : `__${t}_${n}_${fp}_v${v}__`,
  );
}

function sessionHash(id: string): string {
  return createHash("sha256").update(`session\u0000${id}`).digest("hex").slice(0, 16);
}

function recentRestores(file: string, session: string, now: number): number {
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return 0;
  }
  let n = 0;
  for (const line of text.split("\n").slice(-500)) {
    try {
      const l = JSON.parse(line) as RestoreAuditLine;
      if (l.session === session && now - Date.parse(l.ts) <= RESTORE_WINDOW_MS) n += 1;
    } catch {
      // a torn line is not a restore
    }
  }
  return n;
}

function audit(file: string, lines: readonly RestoreAuditLine[]): void {
  if (lines.length === 0) return;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, lines.map((l) => `${JSON.stringify(l)}\n`).join(""), "utf8");
  } catch {
    // observability never breaks the hook
  }
}

const deny = (reason: string): RestorePlan => ({ outcome: "restore", input: null, decision: "deny", reason });

/**
 * The restore decision for a `pre_tool_use` event, or `null` when the input
 * carries no token and touches no session table. Never throws: an internal
 * error denies, because a call whose tokens could not be checked must not run.
 */
export function planRestore(envelope: JsonObject, deps: RestoreDeps = {}): RestorePlan | null {
  if (envelope["event"] !== "pre_tool_use") return null;
  const payload = isObject(envelope["payload"]) ? envelope["payload"] : null;
  const input = payload !== null && isObject(payload["tool_input"]) ? payload["tool_input"] : null;
  if (payload === null || input === null) return null;
  try {
    return decide(envelope, payload, input, deps);
  } catch {
    return deny("agent-config egress: the placeholders in this call could not be checked, so it was not run.");
  }
}

function decide(envelope: JsonObject, payload: JsonObject, input: JsonObject, deps: RestoreDeps): RestorePlan | null {
  const dir = deps.sessionDir ?? sessionTableDir();
  const texts: string[] = [];
  strings(input, texts);
  if (texts.some((t) => t.includes(dir) || t.includes(path.join("runtime", "egress-sessions")))) {
    return deny("agent-config egress: the placeholder session table is not readable by the agent.");
  }
  const tool = typeof payload["tool_name"] === "string" ? payload["tool_name"] : "";
  const canonical = mapStrings(input, canonicalizeTokens) as JsonObject;
  const all: string[] = [];
  strings(canonical, all);
  const tokens = [...new Set(all.flatMap((t) => parseTokens(t).map((p) => t.slice(p.start, p.end))))];
  const remnant = all.some((t) => GRAMMAR_REMNANT.test(t.replace(/__[A-Z][A-Z0-9]{1,15}_[1-9][0-9]{0,5}_[0-9a-f]{6}(?:_v[0-9]{1,2})?__/g, "")));
  if (tokens.length === 0 && !remnant) return null;
  if (MODEL_BOUND_TOOLS.has(tool)) return null;
  if (remnant) return deny("agent-config egress: this call carries a placeholder that does not parse; it was not guessed and not run.");
  const sessionId = typeof payload["session_id"] === "string" ? payload["session_id"] : "";
  const filePath = typeof input["file_path"] === "string" ? input["file_path"] : null;
  const destination = FILE_WRITE_TOOLS.has(tool) && filePath !== null ? fileDestination(filePath) : `tool:${tool}`;
  const workingTree = String(envelope["workspace_root"] || process.cwd());
  const consequenceFree = isCategoryA(tool, input, workingTree);
  const now = deps.now ?? Date.now();
  const session = sessionHash(sessionId);
  const values = new Map<string, string>();
  const lines: RestoreAuditLine[] = [];
  let decision: RestorePlan["decision"] = null;
  const reasons: string[] = [];
  const req = { dir, sessionId, now, ...(deps.rules ? { rules: deps.rules } : {}), ...(deps.readOrigin ? { readOrigin: deps.readOrigin } : {}) };
  for (const token of tokens) {
    const parsed = parseTokens(token)[0];
    const base = { ts: new Date(now).toISOString(), session, type: parsed?.type ?? "", number: parsed?.number ?? 0, tool: tool || null };
    let r = restoreToken(token, { ...req, destination });
    let sink: RestoreSink = r.ok ? "origin-file" : "other";
    if (!r.ok && r.outcome === "DESTINATION_MISMATCH" && r.class === "credential") {
      lines.push({ ...base, class: "credential", sink: "other", decision: "deny" });
      audit(path.join(workingTree, RESTORE_AUDIT_FILE), deps.replay ?? is_replay_mode() ? [] : lines);
      return deny(
        "agent-config egress: a credential placeholder restores only into the file it was read from. " +
          "Reference the variable by name (`$NAME`, `process.env.NAME`) instead of its value.",
      );
    }
    if (!r.ok && r.outcome === "DESTINATION_MISMATCH" && r.class === "identifier") {
      r = restoreToken(token, { ...req, destination: ANY_DESTINATION });
      // D4: a local file write or a consequence-free call is where an identifier may land unasked.
      sink = consequenceFree || FILE_WRITE_TOOLS.has(tool) ? "consequence-free" : "other";
    }
    if (!r.ok) {
      lines.push({ ...base, class: r.outcome === "UNRESOLVED" ? "unknown" : (r.class ?? "unknown"), sink, decision: "deny" });
      audit(path.join(workingTree, RESTORE_AUDIT_FILE), deps.replay ?? is_replay_mode() ? [] : lines);
      return deny(`agent-config egress: ${r.message} The call was not run.`);
    }
    const asks = r.class === "identifier" && sink === "other";
    if (asks) {
      decision = "ask";
      reasons.push(`${r.type} ${r.number}`);
    }
    values.set(token, r.value);
    lines.push({ ...base, class: r.class, sink, decision: asks ? "ask" : "restore" });
  }
  const file = path.join(workingTree, RESTORE_AUDIT_FILE);
  if (decision === null && recentRestores(file, session, now) + lines.length > RESTORE_BURST) {
    decision = "ask";
    reasons.push("a burst of restores");
  }
  if (!(deps.replay ?? is_replay_mode())) audit(file, lines);
  const restored = mapStrings(canonical, (t) => {
    let out = t;
    for (const [token, value] of values) out = out.split(token).join(value);
    return out;
  }) as JsonObject;
  const reason =
    decision === "ask" ? `agent-config egress: this call restores ${reasons.join(", ")} outside its origin; confirm the value shown.` : "";
  return { outcome: "restore", input: restored, decision, reason };
}
