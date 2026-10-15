<!-- evidence-type: analysis -->

<!-- The round-2 prompt given to the council on 2026-10-15 for branch
     drain/placeholders-phase-1, committed verbatim so the verdict recorded beside
     it can be checked against what was actually asked. Not edited after the run. -->

# Review branch drain/placeholders-phase-1 — delta since council round 1

Head `0cec5745cdfe6d90cf4a52248f43c5ba11ac020b`. Round 1 reviewed the egress stage at `ca0103809` and both seats asked for changes. This round covers only commit `0cec5745c`, shown below, plus the full current `src/scripts/hooks/egress_stage.ts` for context.

Round-1 findings and what the commit does with each:

1. Execution-view grant bound to the concern name only — the grant list now maps each name to its script; `egressViewFor` takes the concern definition and requires both to match; the lint refuses a listed name bound to another script.
2. Settings failures resolved to `off` — a present but invalid mode is `protect`; a project layer that contains `egress` but does not parse is `protect`; a mode reader that throws is `protect`. A bare YAML `off` (parsed as `false` under YAML 1.1) is `off`.
3. Fast-path key detector missed flow-style and quoted keys — the fast path now looks for the word `egress` anywhere in a project layer.
4. Mode resolution outside the failure boundary — moved inside a try.
5. Fallback dispatches not recorded — the fallback now records a `stage-error` refusal per scanned field.
6. Per-key catch swallowed every error — only `EgressRefusedError` withholds one key; any other error reaches the all-body fallback.
7. Rewrite rule enforced only by source text — not changed in code. The dispatcher builds the host emission only from the reply keys `decision`, `reason`, `additional_context` and `context`; a new test drives a concern returning `updatedInput` through the dispatcher and asserts the emission carries none. The contract now says the lint is the authoring-time half and reads source text only.
8. Tests for multiple values, token scope, the spoofed name and the unexpected-failure path — added.
9. The reporting fixture `tests/hooks/fixtures/concern_report_egress_view.ts` (redacted in round 1) computes `text.includes(planted)` and `parseTokens(text).length > 0` and writes only those two booleans.
10. Default-off cost — not changed beyond item 3: with no project layer containing the word, the cost is reading the project layers that exist and one regex test each, measured 0.25 ms cold and 0.09 ms warm in-process.

For each finding, state whether the delta resolves it. Report any defect in the delta or in the current stage file with file:line, the failure scenario and a severity — in particular a value reaching a concern or file it should not, a fail-open path, or a test that would pass without the code it covers. State your stance (APPROVE or REQUEST_CHANGES) and the single highest-leverage change.

Omitted: everything outside commit `0cec5745c` that round 1 already covered (dispatcher wiring, payload planner, replay, admission gate, ADR-285, settings surfaces).

## Current src/scripts/hooks/egress_stage.ts

```ts
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
  const script = EXECUTION_VIEW_GRANTS.get(String(concern["name"]));
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
 * anywhere, even in a comment, pays the full parse. `broken` means a naming
 * layer does not parse; the cascade would read it as empty and fall to `off`.
 */
function egressLayers(workspaceRoot: string): "none" | "named" | "broken" {
  let named = false;
  for (const p of _resolve_cascade_paths(workspaceRoot, null)) {
    let text: string;
    try {
      text = fs.readFileSync(p, "utf8");
    } catch {
      continue; // absent layer
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
export function readEgressMode(workspaceRoot: string): EgressMode {
  if (isEnvKillSwitchActive(EGRESS_STAGE_KILL_SWITCH)) return "off";
  let layers: "none" | "named" | "broken";
  try {
    layers = egressLayers(workspaceRoot);
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
        // Anything but a refusal is a defect, and withholds every body upstream.
        if (!(exc instanceof EgressRefusedError)) throw exc;
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
    const counted = countEnvelope(envelope);
    const placeholder = mode === "observe" ? undefined : buildPlaceholderEnvelope(envelope);
    result = { mode, placeholder, ...counted };
  } catch {
    const scanned = FIELDS.filter((f) => presentKeys(payload, f).length > 0);
    const refused = scanned.map((field) => ({ field, rule: "stage-error" }));
    if (mode === "observe") {
      result = { ...none, mode, scanned, refused };
    } else {
      const withheld: JsonObject = { ...payload };
      for (const f of scanned) {
        for (const k of presentKeys(payload, f)) withheld[k] = { [WITHHELD_MARKER]: true, rule: "stage-error" };
      }
      result = { ...none, mode, scanned, refused, placeholder: { ...envelope, payload: withheld } };
    }
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
```

## The delta

```diff
diff --git a/docs/contracts/egress-placeholders-v1.md b/docs/contracts/egress-placeholders-v1.md
index 3bc7d63b8..a83ab8486 100644
--- a/docs/contracts/egress-placeholders-v1.md
+++ b/docs/contracts/egress-placeholders-v1.md
@@ -201,8 +201,10 @@ of one envelope through the payload-shape planner:
 - the **execution view** — the envelope as the host sent it. It goes only to
   the concerns on `EXECUTION_VIEW_GRANTS`, a closed list the dispatcher owns:
-  every concern that decides whether a call may run. A concern cannot request
-  it; `lint_hook_manifest` refuses a `payload_view: execution` declaration off
-  the list, a blocking concern missing from it, and a listed concern that is not
-  blocking. Until a session table exists there are no tokens to resolve, so the
+  every concern that decides whether a call may run, each bound to the one
+  script it runs. A manifest entry that borrows a listed name for another script
+  gets the placeholder view. A concern cannot request the grant;
+  `lint_hook_manifest` refuses a `payload_view: execution` declaration off the
+  list, a blocking concern missing from it, a listed concern that is not
+  blocking, and a listed name bound to another script. Until a session table exists there are no tokens to resolve, so the
   execution view is the received envelope unchanged.
 - the **placeholder view** — every detected value replaced by its token. It goes
@@ -211,5 +213,13 @@ of one envelope through the payload-shape planner:
   own. A key whose secret has no provable extent is withheld whole (an object
   carrying `_agent_config_egress_withheld` and the rule id), never partly
-  replaced; an unexpected failure of the stage withholds every body.
+  replaced; any other failure of the stage withholds every body and is
+  recorded as a `stage-error` refusal.
+
+**A concern reply cannot rewrite.** The dispatcher reads a fixed set of keys
+from a concern reply (`decision`, `reason`, `additional_context`, `context` and
+the permission verdict) and builds the host emission from those alone, so a
+rewrite field in a reply reaches no host; a test drives a concern that returns
+one through the dispatcher and asserts the emission carries none. The lint rule
+`rewrite-concern-refused` is the authoring-time half and reads source text only.
 
 The token scope is one dispatch: a token in a local store cannot be resolved
@@ -229,5 +239,9 @@ Replacement paths are switched by `egress.placeholders.mode`. The shipped
 default is `off`; whether any class is replaced by default for consumers is an
 owner decision (`default-mode-for-consumers`). The key is read from the project
-layers of the settings cascade only.
+layers of the settings cascade only; a layer that does not contain the word
+`egress` skips the full cascade read. Resolution fails toward protection: an
+absent mode (or a bare YAML `off`) is `off`, a present value that is not one of
+the four is `protect`, and a layer that names `egress` but does not parse, or a
+read that fails, is `protect` — never a silent `off`.
 
 | Mode | Detects and counts | Placeholder view to concerns | Rewrite sent to the host |
diff --git a/src/config/hook-latency-budget.json b/src/config/hook-latency-budget.json
index f76ce42d3..02894e812 100644
--- a/src/config/hook-latency-budget.json
+++ b/src/config/hook-latency-budget.json
@@ -60,5 +60,5 @@
         "revisit_if": "The p50 — not the p95 — of a green run rises above 160 ms. Read the MEDIAN because that is the runner-speed indicator: the observed p50 range is 111-148 ms, so a p50 past 160 is outside every machine this window saw and is the cost itself growing. It then belongs to the owning roadmap (road-to-per-turn-hook-economy, D-2: the dispatcher's own payload read+parse, once per event) rather than to a third cap raise. Raising this number again without a measured distribution beside it is the config-bending this block exists to make visible.",
         "_revisit_if_FIRED_2026_09_30": "THE TRIGGER ABOVE HAS FIRED, and this row records it rather than spending it. Measured on PR #2104 (road-to-a-stop-that-holds), three consecutive CI runs of the gated `via cli` leg: pre_tool_use p50 172, 175 and 176 ms against a revisit-if threshold of 160 and an observed historical p50 range of 111-148. The p95 readings were 179, 176 and 176 against the 175 cap. THE CAP IS NOT RAISED — this block says raising it again without a measured distribution beside it is the config-bending the block exists to make visible, and that verdict is unchanged. WHAT THIS BRANCH CONTRIBUTED, measured rather than guessed: `npm run build:hooks` at this branch produces 1,443,442 bytes against 1,424,332 at its merge base, i.e. +19,110 bytes / +1.34%. Every concern shares one bundle, so that cost is paid by EVERY slot including pre_tool_use, which this branch's diff otherwise does not touch (none of its six changed files is bound on that slot). At ~149 ms of non-spawn work the proportional share is ~2 ms — real, and far short of the 24-64 ms by which the p50 exceeds its historical range, so the dominant term is the runner and the branch is a contributor rather than the cause. `--legal-comments=none` was measured as a mitigation and recovers 635 bytes: the growth is code, not prose, so it cannot be given back without removing the feature. ROUTING, per this block's own revisit-if: this belongs to road-to-per-turn-hook-economy D-2 (the dispatcher's own payload read+parse, once per event) and to the maintainer, not to a third cap raise. Recorded here because a budget pre-registered so it could not be spent silently must not be spent silently.",
-        "_egress_stage_bundle_delta_2026_10_15": "road-to-placeholders-on-the-wire Phase 1 states its delta here, as the fired trigger above requires of every phase that touches the dispatcher. BUNDLE: check_hook_bundle_composition measured 1,529,222 B at the merge base and 1,542,322 B with the egress stage, i.e. +13,100 B / +0.86 %, almost all of it the egress rule table and token grammar the stage imports; 292 modules. RUNTIME, measured in-process on darwin (not on a CI runner): with the shipped default `off` the stage costs one regex over the project settings layers that exist, 0.25 ms cold and 0.09 ms warm, because the full settings cascade (about 25 ms cold, dominated by the template parse) is skipped unless a project layer opens a top-level `egress:` key; with `observe` or `protect`, one detection pass of about 2.3 ms on a 52 KB tool result and 25-35 ms on 2 MB. No cap is changed. Proportional share of the bundle growth at ~149 ms of non-spawn work is about 1 ms on every slot.",
+        "_egress_stage_bundle_delta_2026_10_15": "road-to-placeholders-on-the-wire Phase 1 states its delta here, as the fired trigger above requires of every phase that touches the dispatcher. BUNDLE: check_hook_bundle_composition measured 1,529,222 B at the merge base and 1,543,851 B with the egress stage, i.e. +14,629 B / +0.96 %, almost all of it the egress rule table and token grammar the stage imports; 292 modules. RUNTIME, measured in-process on darwin (not on a CI runner): with the shipped default `off` the stage costs one regex over the project settings layers that exist, 0.25 ms cold and 0.09 ms warm, because the full settings cascade (about 25 ms cold, dominated by the template parse) is skipped unless a project layer opens a top-level `egress:` key; with `observe` or `protect`, one detection pass of about 2.3 ms on a 52 KB tool result and 25-35 ms on 2 MB. No cap is changed. Proportional share of the bundle growth at ~149 ms of non-spawn work is about 1 ms on every slot.",
         "_revisit_if_correction":"First written as 'a green run measures p95 above 160 ms', which round 2 finding 9 refuted from inside this same block: 160 sits 15 ms BELOW the new cap and 3 ms above the observed max, so the very first green 161 ms run would pass the gate and simultaneously trip a trigger declaring the variance to be over. A trigger has to live outside the spread its own cap absorbs, and on a p95 with 42 ms of runner spread no such point exists below 175. The p50 has a spread of 37 ms and a ceiling of 148, so it does."
     },
diff --git a/src/scripts/hooks/dispatch_hook.ts b/src/scripts/hooks/dispatch_hook.ts
index ca33f6ff4..5faf7f0e9 100644
--- a/src/scripts/hooks/dispatch_hook.ts
+++ b/src/scripts/hooks/dispatch_hook.ts
@@ -1298,5 +1298,5 @@ export function main(argv?: string[]): number {
       continue;
     }
-    const concern_envelope = shapes.shapeFor(keep_classes, egressViewFor(String(concern["name"])));
+    const concern_envelope = shapes.shapeFor(keep_classes, egressViewFor(concern));
     const stubs_served = shapes.stubsFor(keep_classes);
     // What was actually SERVED, not what was declared. Recording the
diff --git a/src/scripts/hooks/egress_stage.ts b/src/scripts/hooks/egress_stage.ts
index 9a4b40063..dca631dde 100644
--- a/src/scripts/hooks/egress_stage.ts
+++ b/src/scripts/hooks/egress_stage.ts
@@ -15,4 +15,6 @@ import * as fs from "node:fs";
 import * as path from "node:path";
 
+import { parse as parseYaml } from "yaml";
+
 import { _resolve_cascade_paths, load_agent_settings } from "../_lib/agent_settings.js";
 import { detect, EGRESS_RULES, type EgressClass } from "../_lib/egress_rules.js";
@@ -29,25 +31,29 @@ export const EGRESS_STAGE_KILL_SWITCH = "AGENT_CONFIG_NO_EGRESS_STAGE";
 
 /**
- * The concerns that receive the execution view: every concern that decides
- * whether a call may run. A guard served the placeholder view would match a
- * token instead of the value it exists to stop, so `lint_hook_manifest` fails
- * when a blocking concern is missing here and when a name here is not a
- * blocking concern. Owned by the dispatcher; a concern cannot add itself.
+ * The concerns that receive the execution view — every concern that decides
+ * whether a call may run — each bound to the one script it may run. A guard
+ * served the placeholder view would match a token instead of the value it
+ * exists to stop, so `lint_hook_manifest` fails when a blocking concern is
+ * missing here, when a name here is not a blocking concern, and when the
+ * manifest binds a listed name to another script. The binding to the script is
+ * what stops a manifest entry from borrowing a guard's name to read raw values.
  */
-export const EXECUTION_VIEW_GRANTS: ReadonlySet<string> = new Set([
-  "block-config-weakening",
-  "block-kernel-rule-writes",
-  "block-no-verify",
-  "block-plumbing-writes",
-  "block-speaking-inbox-dir",
-  "evidence-independence",
-  "one-question-per-ask",
-  "turn-end-gate",
+export const EXECUTION_VIEW_GRANTS: ReadonlyMap<string, string> = new Map([
+  ["block-config-weakening", "src/scripts/hooks/block_config_weakening.ts"],
+  ["block-kernel-rule-writes", "src/scripts/hooks/block_kernel_rule_writes.ts"],
+  ["block-no-verify", "src/scripts/hooks/block_no_verify.ts"],
+  ["block-plumbing-writes", "src/scripts/hooks/block_plumbing_writes.ts"],
+  ["block-speaking-inbox-dir", "src/scripts/hooks/block_speaking_inbox_dir.ts"],
+  ["evidence-independence", "src/scripts/hooks/evidence_independence.ts"],
+  ["one-question-per-ask", "src/scripts/hooks/one_question_per_ask_hook.ts"],
+  ["turn-end-gate", "src/scripts/hooks/turn_end_gate_hook.ts"],
 ]);
 
 export type EnvelopeView = "execution" | "placeholder";
 
-export function egressViewFor(concern: string): EnvelopeView {
-  return EXECUTION_VIEW_GRANTS.has(concern) ? "execution" : "placeholder";
+/** Execution only for a listed name running its listed script; everything else gets the placeholder view. */
+export function egressViewFor(concern: JsonObject): EnvelopeView {
+  const script = EXECUTION_VIEW_GRANTS.get(String(concern["name"]));
+  return script !== undefined && concern["script"] === script ? "execution" : "placeholder";
 }
 
@@ -90,5 +96,9 @@ function isObject(v: unknown): v is JsonObject {
 }
 
-/** Unknown, missing or misspelled resolves to `off`: the shipped behaviour. */
+/**
+ * An absent mode is `off`, the shipped default. A mode that is present but not
+ * one of the four is `protect`: someone asked for the stage, and guessing the
+ * least protective reading of a typo would serve raw values in their name.
+ */
 export function resolveEgressMode(settings: unknown): EgressMode {
   if (isEnvKillSwitchActive(EGRESS_STAGE_KILL_SWITCH)) return "off";
@@ -96,33 +106,59 @@ export function resolveEgressMode(settings: unknown): EgressMode {
   const placeholders = isObject(egress) ? egress["placeholders"] : undefined;
   const mode = isObject(placeholders) ? placeholders["mode"] : undefined;
-  return (EGRESS_MODES as readonly unknown[]).includes(mode) ? (mode as EgressMode) : "off";
+  // YAML 1.1 reads a bare `off` as false, which is the user writing `off`.
+  if (mode === undefined || mode === null || mode === false) return "off";
+  return (EGRESS_MODES as readonly unknown[]).includes(mode) ? (mode as EgressMode) : "protect";
 }
 
-const EGRESS_KEY_LINE = /^["']?egress["']?\s*:/m;
+/** Any spelling of the key — block, flow or quoted — contains the word. */
+const EGRESS_WORD = /\begress\b/;
 
 /**
  * Every project settings layer the cascade would read; the user-global layer
- * cannot carry `egress` (it is not on MERGEABLE_KEYS). When no layer opens a
- * top-level `egress:` key the shipped default holds, and the full cascade —
- * whose template parse measured about 25 ms cold — is skipped on every call.
+ * cannot carry `egress` (it is not on MERGEABLE_KEYS). When no layer contains
+ * the word at all the shipped default holds, and the full cascade — whose
+ * template parse measured about 25 ms cold — is skipped. A layer that names it
+ * anywhere, even in a comment, pays the full parse. `broken` means a naming
+ * layer does not parse; the cascade would read it as empty and fall to `off`.
  */
-function anyLayerNamesEgress(workspaceRoot: string): boolean {
+function egressLayers(workspaceRoot: string): "none" | "named" | "broken" {
+  let named = false;
   for (const p of _resolve_cascade_paths(workspaceRoot, null)) {
+    let text: string;
+    try {
+      text = fs.readFileSync(p, "utf8");
+    } catch {
+      continue; // absent layer
+    }
+    if (!EGRESS_WORD.test(text)) continue;
+    named = true;
     try {
-      if (EGRESS_KEY_LINE.test(fs.readFileSync(p, "utf8"))) return true;
+      parseYaml(text, { version: "1.1" });
     } catch {
-      // absent layer
+      return "broken";
     }
   }
-  return false;
+  return named ? "named" : "none";
 }
 
+/**
+ * A layer that names `egress` but cannot be read or parsed resolves to
+ * `protect`, never `off`: a broken file must not switch configured protection
+ * off in silence. The count record carries the mode, so the fallback is visible.
+ */
 export function readEgressMode(workspaceRoot: string): EgressMode {
   if (isEnvKillSwitchActive(EGRESS_STAGE_KILL_SWITCH)) return "off";
+  let layers: "none" | "named" | "broken";
+  try {
+    layers = egressLayers(workspaceRoot);
+  } catch {
+    return "protect";
+  }
+  if (layers === "none") return "off";
+  if (layers === "broken") return "protect";
   try {
-    if (!anyLayerNamesEgress(workspaceRoot)) return "off";
     return resolveEgressMode(load_agent_settings({ cwd: workspaceRoot }));
   } catch {
-    return "off";
+    return "protect";
   }
 }
@@ -203,6 +239,7 @@ export function buildPlaceholderEnvelope(envelope: JsonObject, scope: TokenScope
         next[k] = replaceDeep(payload[k] as JsonValue, scope);
       } catch (exc) {
-        const rule = exc instanceof EgressRefusedError ? exc.rule : "unknown";
-        next[k] = { [WITHHELD_MARKER]: true, rule };
+        // Anything but a refusal is a defect, and withholds every body upstream.
+        if (!(exc instanceof EgressRefusedError)) throw exc;
+        next[k] = { [WITHHELD_MARKER]: true, rule: exc.rule };
       }
     }
@@ -277,5 +314,10 @@ export function runEgressStage(
   if (payload === null || !FIELDS.some((f) => presentKeys(payload, f).length > 0)) return none;
   const workspaceRoot = String(envelope["workspace_root"] || process.cwd());
-  const mode = readMode(workspaceRoot);
+  let mode: EgressMode;
+  try {
+    mode = readMode(workspaceRoot);
+  } catch {
+    mode = "protect";
+  }
   if (mode === "off") return none;
   let result: EgressStageResult;
@@ -285,10 +327,15 @@ export function runEgressStage(
     result = { mode, placeholder, ...counted };
   } catch {
-    if (mode === "observe") return { ...none, mode };
-    const withheld: JsonObject = { ...payload };
-    for (const f of FIELDS) {
-      for (const k of presentKeys(payload, f)) withheld[k] = { [WITHHELD_MARKER]: true, rule: "unknown" };
+    const scanned = FIELDS.filter((f) => presentKeys(payload, f).length > 0);
+    const refused = scanned.map((field) => ({ field, rule: "stage-error" }));
+    if (mode === "observe") {
+      result = { ...none, mode, scanned, refused };
+    } else {
+      const withheld: JsonObject = { ...payload };
+      for (const f of scanned) {
+        for (const k of presentKeys(payload, f)) withheld[k] = { [WITHHELD_MARKER]: true, rule: "stage-error" };
+      }
+      result = { ...none, mode, scanned, refused, placeholder: { ...envelope, payload: withheld } };
     }
-    return { ...none, mode, placeholder: { ...envelope, payload: withheld } };
   }
   recordObservation(workspaceRoot, observationLine(envelope, result));
diff --git a/src/scripts/lint_hook_manifest.ts b/src/scripts/lint_hook_manifest.ts
index 740c11004..c66c46cff 100644
--- a/src/scripts/lint_hook_manifest.ts
+++ b/src/scripts/lint_hook_manifest.ts
@@ -909,4 +909,11 @@ function _check_execution_view_grants(manifest: YamlObject, errors: string[]): v
       );
     }
+    if (granted && spec["script"] !== EXECUTION_VIEW_GRANTS.get(name)) {
+      errors.push(
+        `concerns.${name}: execution-view-not-granted — the grant is bound to ` +
+          `${String(EXECUTION_VIEW_GRANTS.get(name))}, but the manifest runs ${JSON.stringify(spec["script"])}; ` +
+          `the dispatcher will serve it the placeholder view`,
+      );
+    }
   }
 }
diff --git a/tests/scripts/hooks/egress_stage.test.ts b/tests/scripts/hooks/egress_stage.test.ts
index 0c9ce9680..334d3b1b2 100644
--- a/tests/scripts/hooks/egress_stage.test.ts
+++ b/tests/scripts/hooks/egress_stage.test.ts
@@ -76,9 +76,23 @@ describe("mode resolution", () => {
       expect(resolveEgressMode({ egress: { placeholders: { mode: m } } })).toBe(m);
     }
-    for (const bad of [undefined, {}, { egress: { placeholders: { mode: "PROTECT" } } }, { egress: "on" }]) {
-      expect(resolveEgressMode(bad)).toBe("off");
+    for (const absent of [undefined, {}, { egress: "on" }, { egress: { placeholders: { mode: false } } }]) {
+      expect(resolveEgressMode(absent)).toBe("off");
+    }
+    // Present but not a mode: someone asked for the stage, so the safer reading.
+    for (const typo of ["PROTECT", "protec", true, 1]) {
+      expect(resolveEgressMode({ egress: { placeholders: { mode: typo } } })).toBe("protect");
     }
   });
 
+  it("reads every spelling of the key, and a broken naming layer is protect, not off", () => {
+    const file = path.join(tmp, ".agent-settings.yml");
+    fs.writeFileSync(file, "{egress: {placeholders: {mode: observe}}}\n");
+    expect(readEgressMode(tmp)).toBe("observe");
+    fs.writeFileSync(file, "egress:\n  placeholders:\n    mode: off\n");
+    expect(readEgressMode(tmp)).toBe("off");
+    fs.writeFileSync(file, "egress:\n  placeholders:\n    mode: [observe\n");
+    expect(readEgressMode(tmp)).toBe("protect");
+  });
+
   it("reads the project layer, and a comment naming egress is not a key", () => {
     const file = path.join(tmp, ".agent-settings.yml");
@@ -136,6 +150,54 @@ describe("protect builds the placeholder view; the received envelope is untouche
     const keep = new Set(["input"] as const);
     const plan = planPayloadShapes(env, [keep], r.placeholder);
-    expect(holds(plan.shapeFor(keep, egressViewFor("chat-history")))).toBe(false);
-    expect(holds(plan.shapeFor(keep, egressViewFor("block-no-verify")))).toBe(true);
+    const recorder = { name: "chat-history", script: "src/scripts/chat_history.ts" };
+    const guard = { name: "block-no-verify", script: "src/scripts/hooks/block_no_verify.ts" };
+    expect(holds(plan.shapeFor(keep, egressViewFor(recorder)))).toBe(false);
+    expect(holds(plan.shapeFor(keep, egressViewFor(guard)))).toBe(true);
+  });
+
+  it("counts and replaces every value, in every field, not only the first", () => {
+    const second = ["ghp", ALNUM.slice(1, 36) + ALNUM.slice(0, 1)].join("_");
+    const env = envelope({
+      tool_name: "Bash",
+      tool_input: { command: `a ${PLANTED} b ${second}` },
+      tool_response: `out ${PLANTED}`,
+    });
+    const r = runEgressStage(env, fixed("protect"));
+    expect(r.counts).toStrictEqual([
+      { field: "input", class: "credential", type: "TOKEN", count: 2 },
+      { field: "result", class: "credential", type: "TOKEN", count: 1 },
+    ]);
+    const text = JSON.stringify(r.placeholder);
+    expect(holds(r.placeholder) || text.includes(second)).toBe(false);
+    expect(parseTokens(text).length).toBe(3);
+  });
+
+  it("a token minted in one dispatch is not the token of the next", () => {
+    const first = JSON.stringify(buildPlaceholderEnvelope(toolCall()));
+    const second = JSON.stringify(buildPlaceholderEnvelope(toolCall()));
+    expect(parseTokens(first)[0]?.fingerprint).not.toBe(parseTokens(second)[0]?.fingerprint);
+  });
+
+  it("an unexpected failure withholds every body and is recorded, never served raw", () => {
+    const hostile = new Proxy({} as JsonObject, {
+      ownKeys: () => {
+        throw new Error("boom");
+      },
+    });
+    const env = envelope({ tool_name: "Bash", tool_input: hostile, tool_response: `out ${PLANTED}` });
+    const r = runEgressStage(env, fixed("protect"));
+    const payload = r.placeholder?.["payload"] as JsonObject;
+    expect((payload["tool_response"] as JsonObject)[WITHHELD_MARKER]).toBe(true);
+    expect((payload["tool_input"] as JsonObject)[WITHHELD_MARKER]).toBe(true);
+    expect(r.refused.map((x) => x.rule)).toStrictEqual(["stage-error", "stage-error"]);
+    expect(fs.readFileSync(path.join(tmp, OBSERVATION_FILE), "utf8").includes("stage-error")).toBe(true);
+  });
+
+  it("a mode reader that throws resolves to protect, not off", () => {
+    const r = runEgressStage(toolCall(), () => {
+      throw new Error("unreadable");
+    });
+    expect(r.mode).toBe("protect");
+    expect(holds(r.placeholder)).toBe(false);
   });
 
@@ -151,8 +213,12 @@ describe("protect builds the placeholder view; the received envelope is untouche
 
 describe("the execution view is granted, never requested", () => {
-  it("only names on the closed list get the execution view", () => {
-    for (const name of EXECUTION_VIEW_GRANTS) expect(egressViewFor(name)).toBe("execution");
+  it("only a listed name running its listed script gets the execution view", () => {
+    for (const [name, script] of EXECUTION_VIEW_GRANTS) {
+      expect(egressViewFor({ name, script })).toBe("execution");
+      // The same name bound to another script — a manifest borrowing a guard's name.
+      expect(egressViewFor({ name, script: REPORT_VIEW })).toBe("placeholder");
+    }
     for (const name of ["chat-history", "journal-record", "tool-result-bytes", "rtk-wrap"]) {
-      expect(egressViewFor(name)).toBe("placeholder");
+      expect(egressViewFor({ name, script: "src/scripts/chat_history.ts" })).toBe("placeholder");
     }
   });
@@ -205,4 +271,5 @@ describe("end to end through the dispatcher", () => {
       ...concern("block-no-verify", REPORT_VIEW, true),
       ...concern("recorder", REPORT_VIEW, false),
+      ...concern("rewriter", "tests/hooks/fixtures/concern_names_rewrite_field.ts", false),
       "  chat-history:",
       "    script: src/scripts/chat_history.ts",
@@ -213,5 +280,5 @@ describe("end to end through the dispatcher", () => {
       "platforms:",
       "  claude:",
-      "    pre_tool_use: [block-no-verify, recorder]",
+      "    pre_tool_use: [block-no-verify, recorder, rewriter]",
       "    user_prompt_submit: [chat-history, block-no-verify, recorder]",
       "",
@@ -220,5 +287,5 @@ describe("end to end through the dispatcher", () => {
   }
 
-  function dispatch(ws: string, mode: EgressMode, event: string, native: string, payload: JsonObject): void {
+  function dispatch(ws: string, mode: EgressMode, event: string, native: string, payload: JsonObject): string {
     fs.writeFileSync(
       path.join(ws, ".agent-settings.yml"),
@@ -236,4 +303,5 @@ describe("end to end through the dispatcher", () => {
     );
     expect(r.status).toBe(0);
+    return r.stdout;
   }
 
@@ -244,5 +312,5 @@ describe("end to end through the dispatcher", () => {
   }
 
-  it("protect: the guard sees the value, the recorder and chat history see only a token", () => {
+  it("protect: the recorder, chat history and a script borrowing a guard's name see only a token", () => {
     const ws = path.join(tmp, "ws");
     fs.mkdirSync(ws, { recursive: true });
@@ -251,5 +319,8 @@ describe("end to end through the dispatcher", () => {
       prompt: `deploy with ${PLANTED} please`,
     });
-    expect(saw(ws, "egress-e2e", "block-no-verify")).toStrictEqual({ sawPlanted: true, sawToken: false });
+    // The manifest binds `block-no-verify` to the reporting fixture, not to the
+    // guard's own script, so the grant does not apply. The real pair is covered
+    // by the planner test above; no shipped guard reports what it was served.
+    expect(saw(ws, "egress-e2e", "block-no-verify")).toStrictEqual({ sawPlanted: false, sawToken: true });
     expect(saw(ws, "egress-e2e", "recorder")).toStrictEqual({ sawPlanted: false, sawToken: true });
     const history = fs.readFileSync(path.join(ws, "agents", "runtime", ".agent-chat-history"), "utf8");
@@ -271,3 +342,14 @@ describe("end to end through the dispatcher", () => {
     expect(record.includes('"type":"TOKEN"')).toBe(true);
   });
+
+  it("a rewrite field in a concern reply never reaches the host (ADR-285)", () => {
+    const ws = path.join(tmp, "ws-rewrite");
+    fs.mkdirSync(ws, { recursive: true });
+    const stdout = dispatch(ws, "protect", "pre_tool_use", "PreToolUse", {
+      session_id: "egress-rewrite",
+      tool_name: "Bash",
+      tool_input: { command: "ls" },
+    });
+    expect(stdout.includes("updatedInput")).toBe(false);
+  });
 });
diff --git a/tests/scripts/lint_hook_manifest.test.ts b/tests/scripts/lint_hook_manifest.test.ts
index 78fc8f418..259d1d00e 100644
--- a/tests/scripts/lint_hook_manifest.test.ts
+++ b/tests/scripts/lint_hook_manifest.test.ts
@@ -260,5 +260,5 @@ describe("effect: — the census's field (Phase 2.2)", () => {
 
   /** Run the linter and return its exit code with everything it wrote. */
-  function run(body: string, name = "session-canary"): { code: number; text: string } {
+  function run(body: string, name = "session-canary", script?: string): { code: number; text: string } {
     const chunks: string[] = [];
     const realErr = process.stderr.write.bind(process.stderr);
@@ -271,5 +271,6 @@ describe("effect: — the census's field (Phase 2.2)", () => {
     process.stdout.write = sink as typeof process.stdout.write;
     try {
-      const manifest = withConcern(body).replaceAll("session-canary", name);
+      let manifest = withConcern(body).replaceAll("session-canary", name);
+      if (script !== undefined) manifest = manifest.replace("src/scripts/session_canary_hook.ts", script);
       return { code: lint(fixtureManifest(manifest), false), text: chunks.join("") };
     } finally {
@@ -311,7 +312,7 @@ describe("effect: — the census's field (Phase 2.2)", () => {
 
   it("accepts a blocking concern declared as permission", () => {
-    // A blocking concern must also hold an execution-view grant, so the fixture
-    // takes a granted name; the script is irrelevant to the effect check.
-    const r = run("    severity: blocking\n    effect: permission\n", "block-no-verify");
+    // A blocking concern must also hold an execution-view grant, which binds a
+    // name to its script, so the fixture takes a granted pair.
+    const r = run("    severity: blocking\n    effect: permission\n", "block-no-verify", "src/scripts/hooks/block_no_verify.ts");
     expect(r.code).toBe(0);
   });
@@ -393,4 +394,14 @@ describe("rewrite-concern-refused — no concern may produce a rewrite (ADR-285)
   });
 
+  it("execution-view-not-granted: a granted name bound to another script is refused", () => {
+    const borrowed = VALID.replace(
+      "    fail_closed: false\n    effect: context\n",
+      "    fail_closed: false\n    severity: blocking\n    effect: permission\n",
+    ).replaceAll("session-canary", "block-no-verify");
+    const r = run(borrowed);
+    expect(r.code).toBe(1);
+    expect(r.text).toMatch(/concerns\.block-no-verify: execution-view-not-granted — the grant is bound to/);
+  });
+
   it("execution-view-not-granted: a blocking concern missing from the closed list is refused", () => {
     const r = run(VALID.replace("    fail_closed: false\n    effect: context\n", "    fail_closed: false\n    severity: blocking\n    effect: permission\n"));
```
