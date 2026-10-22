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

import { parse as parseYaml } from "yaml";

import { _resolve_cascade_paths, load_agent_settings } from "../_lib/agent_settings.js";
import type { EgressClass } from "../_lib/egress_rules.js";
import type { TokenScope } from "../_lib/egress_token.js";
import { isEnvKillSwitchActive } from "../_lib/env_kill_switch.js";
import { type EgressEngine, loadEgressEngine } from "./egress_engine_loader.js";
import { BODY_KEYS, type JsonObject, type JsonValue } from "./payload_stub.js";
import { is_replay_mode } from "./state_io.js";

export const EGRESS_MODES = ["off", "observe", "protect", "strict"] as const;
export type EgressMode = (typeof EGRESS_MODES)[number];

/** Set to anything outside the off-set and the stage does nothing, whatever the settings say. */
export const EGRESS_STAGE_KILL_SWITCH = "AGENT_CONFIG_NO_EGRESS_STAGE";

/**
 * The concerns that receive the execution view — every concern that decides
 * whether a call may run — each bound to the one script it may run. A guard
 * served the placeholder view would match a token instead of the value it
 * exists to stop, so `lint_hook_manifest` fails when a blocking concern is
 * missing here, when a name here is not a blocking concern, and when the
 * manifest binds a listed name to another script. The binding to the script is
 * what stops a manifest entry from borrowing a guard's name to read raw values.
 */
export const EXECUTION_VIEW_GRANTS: ReadonlyMap<string, string> = new Map([
  ["block-config-weakening", "src/scripts/hooks/block_config_weakening.ts"],
  ["block-credential-reads", "src/scripts/hooks/block_credential_reads.ts"],
  ["block-kernel-rule-writes", "src/scripts/hooks/block_kernel_rule_writes.ts"],
  ["block-no-verify", "src/scripts/hooks/block_no_verify.ts"],
  ["block-plumbing-writes", "src/scripts/hooks/block_plumbing_writes.ts"],
  ["block-speaking-inbox-dir", "src/scripts/hooks/block_speaking_inbox_dir.ts"],
  ["evidence-independence", "src/scripts/hooks/evidence_independence.ts"],
  ["one-question-per-ask", "src/scripts/hooks/one_question_per_ask_hook.ts"],
  ["turn-end-gate", "src/scripts/hooks/turn_end_gate_hook.ts"],
]);

export type EnvelopeView = "execution" | "placeholder";

/** Execution only for a listed name running its listed script; everything else gets the placeholder view. */
export function egressViewFor(concern: JsonObject): EnvelopeView {
  const name = concern["name"];
  const script = typeof name === "string" ? EXECUTION_VIEW_GRANTS.get(name) : undefined;
  return script !== undefined && concern["script"] === script ? "execution" : "placeholder";
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

/**
 * An absent mode is `off`, the shipped default. A mode that is present but not
 * one of the four is `protect`: someone asked for the stage, and guessing the
 * least protective reading of a typo would serve raw values in their name.
 */
export function resolveEgressMode(settings: unknown): EgressMode {
  if (isEnvKillSwitchActive(EGRESS_STAGE_KILL_SWITCH)) return "off";
  const egress = isObject(settings) ? settings["egress"] : undefined;
  const placeholders = isObject(egress) ? egress["placeholders"] : undefined;
  const mode = isObject(placeholders) ? placeholders["mode"] : undefined;
  // YAML 1.1 reads a bare `off` as false, which is the user writing `off`.
  if (mode === undefined || mode === null || mode === false) return "off";
  return (EGRESS_MODES as readonly unknown[]).includes(mode) ? (mode as EgressMode) : "protect";
}

/** Any spelling of the key — block, flow or quoted — contains the word. */
const EGRESS_WORD = /\begress\b/;

/**
 * Every project settings layer the cascade would read; the user-global layer
 * cannot carry `egress` (it is not on MERGEABLE_KEYS). When no layer contains
 * the word at all the shipped default holds, and the full cascade — whose
 * template parse measured about 25 ms cold — is skipped. A layer that names it
 * anywhere, even in a comment, pays the full parse. `broken` means a layer
 * exists but cannot be read, or names `egress` and does not parse; the cascade
 * would read either as empty and fall to `off`.
 */
function egressLayers(workspaceRoot: string, readFile: (p: string) => string): "none" | "named" | "broken" {
  let named = false;
  for (const p of _resolve_cascade_paths(workspaceRoot, null)) {
    let text: string;
    try {
      text = readFile(p);
    } catch (exc) {
      // Only a missing layer is skipped; a layer that exists and cannot be read could hold the mode.
      const code = (exc as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "ENOTDIR") continue;
      return "broken";
    }
    if (!EGRESS_WORD.test(text)) continue;
    named = true;
    try {
      parseYaml(text, { version: "1.1" });
    } catch {
      return "broken";
    }
  }
  return named ? "named" : "none";
}

/**
 * A layer that names `egress` but cannot be read or parsed resolves to
 * `protect`, never `off`: a broken file must not switch configured protection
 * off in silence. The count record carries the mode, so the fallback is visible.
 */
export function readEgressMode(
  workspaceRoot: string,
  readFile: (p: string) => string = (p) => fs.readFileSync(p, "utf8"),
): EgressMode {
  if (isEnvKillSwitchActive(EGRESS_STAGE_KILL_SWITCH)) return "off";
  let layers: "none" | "named" | "broken";
  try {
    layers = egressLayers(workspaceRoot, readFile);
  } catch {
    return "protect";
  }
  if (layers === "none") return "off";
  if (layers === "broken") return "protect";
  try {
    return resolveEgressMode(load_agent_settings({ cwd: workspaceRoot }));
  } catch {
    return "protect";
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

/** The rule id a refusal records when the engine cannot load. */
export const ENGINE_UNAVAILABLE = "engine-unavailable";

/** Raised when the engine cannot load; the stage turns it into an `engine-unavailable` refusal. */
export class EngineUnavailableError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(`${ENGINE_UNAVAILABLE}: ${reason}`);
    this.reason = reason;
    this.name = "EngineUnavailableError";
  }
}

/**
 * The engine, or an `EngineUnavailableError` the stage's own failure path turns
 * into a withheld view (`protect`, `strict`) or a recorded miss (`observe`).
 * Never reached when the mode is `off`, so the shipped default loads nothing.
 */
export function requireEngine(load: () => ReturnType<typeof loadEgressEngine> = loadEgressEngine): EgressEngine {
  const r = load();
  if (!r.ok) throw new EngineUnavailableError(r.reason);
  return r.engine;
}

/**
 * Detection and the extent proof only — nothing is replaced and nothing is kept.
 * Throws `EngineUnavailableError` when no engine is passed and none loads; a
 * caller outside the stage handles it (the replay preview reports it).
 */
export function countEnvelope(
  envelope: JsonObject,
  engine: EgressEngine = requireEngine(),
): Pick<EgressStageResult, "scanned" | "counts" | "refused"> {
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
      const tally = engine.tallyText(text);
      for (const rule of tally.refused) refused.push({ field, rule });
      for (const f of tally.found) {
        const key = `${field}\u0000${f.class}\u0000${f.type}`;
        counts.set(key, { field, class: f.class, type: f.type, count: (counts.get(key)?.count ?? 0) + 1 });
      }
    }
  }
  return { scanned, counts: [...counts.values()], refused };
}

/**
 * The placeholder view: every listed value in the prompt, the tool input and
 * the tool result replaced by its token, under one scope that lives as long as
 * this dispatch. A key whose value cannot be replaced safely is withheld whole,
 * never partly replaced. The received envelope is not modified. Throws
 * `EngineUnavailableError` when no engine is passed and none loads.
 */
export function buildPlaceholderEnvelope(
  envelope: JsonObject,
  engine: EgressEngine = requireEngine(),
  scope: TokenScope = new engine.TokenScope(),
): JsonObject {
  const payload = payloadOf(envelope);
  if (payload === null) return envelope;
  const next: JsonObject = { ...payload };
  for (const field of FIELDS) {
    for (const k of presentKeys(payload, field)) {
      try {
        next[k] = engine.replaceJson(payload[k] as JsonValue, scope);
      } catch (exc) {
        // Anything but a refusal is a defect, and withholds every body upstream.
        if (!(exc instanceof engine.EgressRefusedError)) throw exc;
        next[k] = { [WITHHELD_MARKER]: true, rule: exc.rule };
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
  loadEngine: () => ReturnType<typeof loadEgressEngine> = loadEgressEngine,
): EgressStageResult {
  const none: EgressStageResult = { mode: "off", placeholder: undefined, scanned: [], counts: [], refused: [] };
  const payload = payloadOf(envelope);
  if (payload === null || !FIELDS.some((f) => presentKeys(payload, f).length > 0)) return none;
  const workspaceRoot = String(envelope["workspace_root"] || process.cwd());
  let mode: EgressMode;
  try {
    mode = readMode(workspaceRoot);
  } catch {
    mode = "protect";
  }
  if (mode === "off") return none;
  let result: EgressStageResult;
  try {
    const engine = requireEngine(loadEngine);
    const counted = countEnvelope(envelope, engine);
    const placeholder = mode === "observe" ? undefined : buildPlaceholderEnvelope(envelope, engine);
    result = { mode, placeholder, ...counted };
  } catch (exc) {
    const rule = exc instanceof EngineUnavailableError ? ENGINE_UNAVAILABLE : "stage-error";
    const scanned = FIELDS.filter((f) => presentKeys(payload, f).length > 0);
    const refused = scanned.map((field) => ({ field, rule }));
    if (mode === "observe") {
      result = { ...none, mode, scanned, refused };
    } else {
      const withheld: JsonObject = { ...payload };
      for (const f of scanned) {
        for (const k of presentKeys(payload, f)) withheld[k] = { [WITHHELD_MARKER]: true, rule };
      }
      result = { ...none, mode, scanned, refused, placeholder: { ...envelope, payload: withheld } };
    }
  }
  recordObservation(workspaceRoot, observationLine(envelope, result));
  return result;
}

/**
 * Text this package injects into a session — hot context and a handoff at
 * session start, memory recall and every other concern's reply — passes the
 * engine too (road-to-one-detector-and-the-senders-we-own 3.5). In `protect`
 * and `strict` each listed value becomes its token under one scope per
 * dispatch; text whose secret has no provable extent, or that no engine can
 * read, is withheld whole. `off` and `observe` change nothing. Returns a
 * function so the mode is read once per dispatch, and only when there is text.
 */
export function egressInjection(
  workspaceRoot: string,
  readMode: (workspaceRoot: string) => EgressMode = readEgressMode,
  loadEngine: () => ReturnType<typeof loadEgressEngine> = loadEgressEngine,
): (text: string) => string {
  let inject: ((text: string) => string) | undefined;
  return (text) => (inject ??= injector(workspaceRoot, readMode, loadEngine))(text);
}

function injector(
  workspaceRoot: string,
  readMode: (workspaceRoot: string) => EgressMode,
  loadEngine: () => ReturnType<typeof loadEgressEngine>,
): (text: string) => string {
  let mode: EgressMode;
  try {
    mode = readMode(workspaceRoot);
  } catch {
    mode = "protect";
  }
  if (mode !== "protect" && mode !== "strict") return (t) => t;
  const load = loadEngine();
  if (!load.ok) return () => `${WITHHELD_PREFIX}${ENGINE_UNAVAILABLE})]`;
  const scope = new load.engine.TokenScope();
  return (t) => {
    try {
      return load.engine.injectText(t, scope);
    } catch {
      return `${WITHHELD_PREFIX}engine-threw)]`;
    }
  };
}

const WITHHELD_PREFIX = "[egress: injected text withheld (";

/**
 * A refusal's reason may be withheld, never the fact of who refused. Without
 * the concern name a withheld block reads as an unexplained deny, and the user
 * cannot tell which guard to look up.
 */
export function attributeRefusal(concernName: string, refused: boolean, text: string): string {
  return refused && text.startsWith(WITHHELD_PREFIX) ? `${concernName}: BLOCKED — reason ${text}` : text;
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
