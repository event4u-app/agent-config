/**
 * The egress stage — the one dispatcher stage that may produce a rewrite
 * (ADR-285) and the only code that builds the views concerns receive.
 * Contract, including the per-mode table: docs/contracts/egress-placeholders-v1.md.
 *
 * `observe` detects and counts and never changes a view; the placeholder view
 * exists only from `protect` onward. The execution view is the envelope as the
 * host sent it, granted by the closed list below and never requested: a
 * concern's own manifest declaration grants nothing.
 *
 * The rule table holds credential rules only, so every count is a credential
 * count until identifier rules exist.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { _resolve_cascade_paths, load_agent_settings } from "../_lib/agent_settings.js";
import { detect, EGRESS_RULES, type EgressClass } from "../_lib/egress_rules.js";
import { EgressRefusedError, replaceValues, TokenScope } from "../_lib/egress_token.js";
import { isEnvKillSwitchActive } from "../_lib/env_kill_switch.js";
import { BODY_KEYS, type JsonObject, type JsonValue } from "./payload_stub.js";
import { is_replay_mode } from "./state_io.js";

export const EGRESS_MODES = ["off", "observe", "protect", "strict"] as const;
export type EgressMode = (typeof EGRESS_MODES)[number];

/** Set to anything outside the off-set and the stage does nothing, whatever the settings say. */
export const EGRESS_STAGE_KILL_SWITCH = "AGENT_CONFIG_NO_EGRESS_STAGE";

/**
 * The concerns that receive the execution view: every concern that decides
 * whether a call may run. A guard served the placeholder view would match a
 * token instead of the value it exists to stop, so `lint_hook_manifest` fails
 * when a blocking concern is missing here and when a name here is not a
 * blocking concern. Owned by the dispatcher; a concern cannot add itself.
 */
export const EXECUTION_VIEW_GRANTS: ReadonlySet<string> = new Set([
  "block-config-weakening",
  "block-kernel-rule-writes",
  "block-no-verify",
  "block-plumbing-writes",
  "block-speaking-inbox-dir",
  "evidence-independence",
  "one-question-per-ask",
  "turn-end-gate",
]);

export type EnvelopeView = "execution" | "placeholder";

export function egressViewFor(concern: string): EnvelopeView {
  return EXECUTION_VIEW_GRANTS.has(concern) ? "execution" : "placeholder";
}

export type EgressField = "prompt" | "input" | "result";

const FIELD_KEYS: Readonly<Record<EgressField, readonly string[]>> = {
  prompt: ["prompt", "userPrompt"],
  input: BODY_KEYS.input,
  result: BODY_KEYS.result,
};
const FIELDS = Object.keys(FIELD_KEYS) as EgressField[];

/** Marks a field the placeholder view could not replace safely; carries the rule id and nothing else. */
export const WITHHELD_MARKER = "_agent_config_egress_withheld" as const;

export interface EgressCount {
  readonly field: EgressField;
  readonly class: EgressClass;
  readonly type: string;
  readonly count: number;
}

export interface EgressRefusal {
  readonly field: EgressField;
  readonly rule: string;
}

export interface EgressStageResult {
  readonly mode: EgressMode;
  /** The envelope every concern off the grant list receives; `undefined` means the received envelope. */
  readonly placeholder: JsonObject | undefined;
  readonly scanned: readonly EgressField[];
  readonly counts: readonly EgressCount[];
  /** Fields whose secret had no provable extent; withheld from the placeholder view. */
  readonly refused: readonly EgressRefusal[];
}

function isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Unknown, missing or misspelled resolves to `off`: the shipped behaviour. */
export function resolveEgressMode(settings: unknown): EgressMode {
  if (isEnvKillSwitchActive(EGRESS_STAGE_KILL_SWITCH)) return "off";
  const egress = isObject(settings) ? settings["egress"] : undefined;
  const placeholders = isObject(egress) ? egress["placeholders"] : undefined;
  const mode = isObject(placeholders) ? placeholders["mode"] : undefined;
  return (EGRESS_MODES as readonly unknown[]).includes(mode) ? (mode as EgressMode) : "off";
}

const EGRESS_KEY_LINE = /^["']?egress["']?\s*:/m;

/**
 * Every project settings layer the cascade would read; the user-global layer
 * cannot carry `egress` (it is not on MERGEABLE_KEYS). When no layer opens a
 * top-level `egress:` key the shipped default holds, and the full cascade —
 * whose template parse measured about 25 ms cold — is skipped on every call.
 */
function anyLayerNamesEgress(workspaceRoot: string): boolean {
  for (const p of _resolve_cascade_paths(workspaceRoot, null)) {
    try {
      if (EGRESS_KEY_LINE.test(fs.readFileSync(p, "utf8"))) return true;
    } catch {
      // absent layer
    }
  }
  return false;
}

export function readEgressMode(workspaceRoot: string): EgressMode {
  if (isEnvKillSwitchActive(EGRESS_STAGE_KILL_SWITCH)) return "off";
  try {
    if (!anyLayerNamesEgress(workspaceRoot)) return "off";
    return resolveEgressMode(load_agent_settings({ cwd: workspaceRoot }));
  } catch {
    return "off";
  }
}

function payloadOf(envelope: JsonObject): JsonObject | null {
  const p = envelope["payload"];
  return isObject(p) ? p : null;
}

function presentKeys(payload: JsonObject, field: EgressField): string[] {
  return FIELD_KEYS[field].filter((k) => payload[k] !== undefined && payload[k] !== null);
}

function collectStrings(v: JsonValue, out: string[]): void {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) for (const x of v) collectStrings(x, out);
  else if (isObject(v)) for (const x of Object.values(v)) collectStrings(x, out);
}

const RULE_BY_ID = new Map(EGRESS_RULES.map((r) => [r.rule, r]));

/** Detection and the extent proof only — nothing is replaced and nothing is kept. */
export function countEnvelope(envelope: JsonObject): Pick<EgressStageResult, "scanned" | "counts" | "refused"> {
  const payload = payloadOf(envelope);
  const scanned: EgressField[] = [];
  const counts = new Map<string, EgressCount>();
  const refused: EgressRefusal[] = [];
  if (payload === null) return { scanned, counts: [], refused };
  for (const field of FIELDS) {
    const keys = presentKeys(payload, field);
    if (keys.length === 0) continue;
    scanned.push(field);
    const texts: string[] = [];
    for (const k of keys) collectStrings(payload[k] as JsonValue, texts);
    for (const text of texts) {
      for (const span of detect(text)) {
        const policy = RULE_BY_ID.get(span.rule)?.replacement;
        if (policy !== undefined && policy !== "detection") {
          const end = policy.through(text, span);
          if (end === null || end < span.end) {
            refused.push({ field, rule: span.rule });
            continue;
          }
        }
        const key = `${field}\u0000${span.class}\u0000${span.type}`;
        const prev = counts.get(key);
        counts.set(key, { field, class: span.class, type: span.type, count: (prev?.count ?? 0) + 1 });
      }
    }
  }
  return { scanned, counts: [...counts.values()], refused };
}

function replaceDeep(v: JsonValue, scope: TokenScope): JsonValue {
  if (typeof v === "string") return replaceValues(v, scope);
  if (Array.isArray(v)) return v.map((x) => replaceDeep(x, scope));
  if (isObject(v)) {
    const out: JsonObject = {};
    for (const [k, x] of Object.entries(v)) out[k] = replaceDeep(x, scope);
    return out;
  }
  return v;
}

/**
 * The placeholder view: every listed value in the prompt, the tool input and
 * the tool result replaced by its token, under one scope that lives as long as
 * this dispatch. A key whose value cannot be replaced safely is withheld whole,
 * never partly replaced. The received envelope is not modified.
 */
export function buildPlaceholderEnvelope(envelope: JsonObject, scope: TokenScope = new TokenScope()): JsonObject {
  const payload = payloadOf(envelope);
  if (payload === null) return envelope;
  const next: JsonObject = { ...payload };
  for (const field of FIELDS) {
    for (const k of presentKeys(payload, field)) {
      try {
        next[k] = replaceDeep(payload[k] as JsonValue, scope);
      } catch (exc) {
        const rule = exc instanceof EgressRefusedError ? exc.rule : "unknown";
        next[k] = { [WITHHELD_MARKER]: true, rule };
      }
    }
  }
  return { ...envelope, payload: next };
}

/** Bounds the append-only record; past it the file rotates once to `.1`. */
export const OBSERVATION_FILE_MAX_BYTES = 4 * 1024 * 1024;
export const OBSERVATION_FILE = path.join("agents", "runtime", "state", "egress-observations.jsonl");

const TOOL_NAME = /^[A-Za-z0-9_.:-]{1,128}$/;

/**
 * One fixed-field line per scanned dispatch: type and count per field, the rule
 * id of a refusal, and nothing derived from a value — no value, fragment,
 * length or digest. The tool name is kept only when it is id-shaped.
 */
export interface EgressObservationLine {
  ts: string;
  platform: string;
  event: string;
  tool: string | null;
  mode: EgressMode;
  scanned: EgressField[];
  counts: EgressCount[];
  refused: EgressRefusal[];
}

export function observationLine(envelope: JsonObject, result: EgressStageResult): EgressObservationLine {
  const tool = payloadOf(envelope)?.["tool_name"];
  return {
    ts: new Date().toISOString(),
    platform: String(envelope["platform"] ?? ""),
    event: String(envelope["event"] ?? ""),
    tool: typeof tool === "string" && TOOL_NAME.test(tool) ? tool : null,
    mode: result.mode,
    scanned: [...result.scanned],
    counts: result.counts.map((c) => ({ field: c.field, class: c.class, type: c.type, count: c.count })),
    refused: result.refused.map((r) => ({ field: r.field, rule: r.rule })),
  };
}

export function recordObservation(workspaceRoot: string, line: EgressObservationLine): void {
  if (is_replay_mode()) return;
  try {
    const file = path.join(workspaceRoot, OBSERVATION_FILE);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    try {
      if (fs.statSync(file).size > OBSERVATION_FILE_MAX_BYTES) fs.renameSync(file, `${file}.1`);
    } catch {
      // no file yet
    }
    fs.appendFileSync(file, `${JSON.stringify(line)}\n`, "utf8");
  } catch {
    // observability never breaks the hook
  }
}

/**
 * Runs before the concern loop. Reads the mode only when the event carries a
 * prompt or a tool body, so a body-less event pays one property read. Never
 * throws: an unexpected failure in `protect` or `strict` withholds every body
 * from the placeholder view rather than serving it raw.
 */
export function runEgressStage(
  envelope: JsonObject,
  readMode: (workspaceRoot: string) => EgressMode = readEgressMode,
): EgressStageResult {
  const none: EgressStageResult = { mode: "off", placeholder: undefined, scanned: [], counts: [], refused: [] };
  const payload = payloadOf(envelope);
  if (payload === null || !FIELDS.some((f) => presentKeys(payload, f).length > 0)) return none;
  const workspaceRoot = String(envelope["workspace_root"] || process.cwd());
  const mode = readMode(workspaceRoot);
  if (mode === "off") return none;
  let result: EgressStageResult;
  try {
    const counted = countEnvelope(envelope);
    const placeholder = mode === "observe" ? undefined : buildPlaceholderEnvelope(envelope);
    result = { mode, placeholder, ...counted };
  } catch {
    if (mode === "observe") return { ...none, mode };
    const withheld: JsonObject = { ...payload };
    for (const f of FIELDS) {
      for (const k of presentKeys(payload, f)) withheld[k] = { [WITHHELD_MARKER]: true, rule: "unknown" };
    }
    return { ...none, mode, placeholder: { ...envelope, payload: withheld } };
  }
  recordObservation(workspaceRoot, observationLine(envelope, result));
  return result;
}

export type PublishedState = "asserted" | "replaced" | "gated" | "uncovered";

/**
 * The state a channel may be published in. A thrown kill switch, or a mode that
 * replaces nothing, makes every channel `uncovered` whatever evidence was
 * committed for it, so a stale `replaced` can never outlive the stage.
 */
export function publishedEgressState(claimed: PublishedState, mode: EgressMode): PublishedState {
  if (isEnvKillSwitchActive(EGRESS_STAGE_KILL_SWITCH)) return "uncovered";
  if (mode !== "protect" && mode !== "strict") return "uncovered";
  return claimed;
}
