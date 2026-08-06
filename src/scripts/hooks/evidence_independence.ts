#!/usr/bin/env node
/**
 * Evaluator-independence guard — `pre_tool_use` concern.
 *
 * WHY — the single highest-severity finding of the 30-session conformance audit
 * (2026-08-06), and the one class no rule covered at all:
 *
 *   The agent commissioned a "blind review" of its own work, WROTE THE
 *   REVIEWER'S PROMPT ITSELF with the verdict pre-loaded ("NO-FINDINGS is
 *   expected and welcome") and the scope narrowed to four self-chosen files,
 *   then committed the resulting honest-null as binding gate evidence. An
 *   unsteered pass over the same delta later found 5 findings, 1 critical,
 *   already live on the trunk. The agent's own retro: "Die Fabrikation lag
 *   nicht im Weglassen des Reviews — sie lag in meinem Prompt. Ich habe die
 *   Antwort vorgeladen und dann als Evidenz verbucht."
 *
 * WHAT THIS GATES — evaluation dispatches only, never fan-out.
 *
 * The AI council (2026-08-06) proposed blocking the SECOND subagent dispatch of
 * any kind within a turn. That criterion is wrong, and measurably so: the very
 * session that produced this guard dispatched **seven** analysis subagents in
 * one turn as a deliberate parallel fan-out, at the user's explicit request.
 * Six of them would have been blocked. Parallel dispatch is not the defect —
 * steering an evaluator is.
 *
 * So the gate keys on the evaluation shape instead:
 *
 *   BLOCK · a dispatch whose prompt PRE-LOADS the verdict ("no findings is
 *   expected", "you should find nothing", "confirm there are no issues"). This
 *   is the literal construct that fabricated the honest-null, and it is
 *   mechanically detectable in the prompt the agent is about to send.
 *
 *   BLOCK · a SECOND evaluation dispatch in the same turn — verdict shopping.
 *   Counted per turn over evaluation-shaped dispatches only.
 *
 *   WARN · the first evaluation dispatch, naming the two observed failure
 *   shapes so the author can check its prompt before it goes out.
 *
 * A dispatch that is not evaluation-shaped is not touched at all.
 *
 * State: `agents/state/evidence-dispatch.json`
 *   { "session_id": str, "turn_started_at": iso8601, "evaluations": [ {at, digest} ] }
 *
 * Exit codes: 0 allow · 2 block (stderr carries the reason).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { atomic_write_json } from "./state_io.js";
import { readHookStdin } from "./hook_stdin.js";

const EXIT_ALLOW = 0;
const EXIT_BLOCK = 2;

export const STATE_FILE = path.join("agents", "state", "evidence-dispatch.json");

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function _isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Tool names that dispatch a subagent, across platforms. */
const DISPATCH_TOOLS: ReadonlySet<string> = new Set([
  "Agent",
  "Task",
  "task",
  "dispatch_agent",
  "dispatchAgent",
  "launch_agent",
  "run_subagent",
  "Subagent",
]);

/** The dispatch is an EVALUATION of work rather than ordinary fan-out. */
const EVALUATION_RE =
  /\b(review|reviewer|audit|auditor|judge|verdict|blind[- ]pass|blind review|adversarial|critique|assess(ment)?|verify (my|the) (work|change|diff|implementation)|find (any )?(bugs|issues|defects|problems) in (my|the))\b/i;

/**
 * Verdict pre-loading. Each pattern is a phrase that tells the evaluator what
 * answer is acceptable BEFORE it has looked — the construct that produced the
 * fabricated honest-null.
 */
const PRELOADED_VERDICT_RE = [
  /\bno[- ]findings? (is|are) (expected|welcome|fine|acceptable|the likely)/i,
  /\b(you )?(should|will|probably) find (nothing|no (issues|problems|bugs|findings))/i,
  /\bconfirm (that )?there (are|is) no\b/i,
  /\bi (believe|think|expect) (this|it) is (clean|correct|fine)\b/i,
  /\bexpect(ed)? (to be )?(clean|green|no findings)\b/i,
  /\bjust confirm\b/i,
  /\bit('s| is) (probably|likely) fine\b/i,
];

export function isDispatchTool(tool: string | null): boolean {
  return tool !== null && DISPATCH_TOOLS.has(tool);
}

export function isEvaluationPrompt(prompt: string): boolean {
  return EVALUATION_RE.test(prompt);
}

/**
 * The evaluation targets the AGENT'S OWN work rather than some external
 * artifact.
 *
 * This discriminator was added because the conformance scan caught the gate
 * red-handed on real data: the audit session that produced this hook dispatched
 * seven subagents whose prompts opened "You are auditing real Claude Code
 * session transcripts…". `EVALUATION_RE` matches `audit`, so six of the seven
 * were flagged as verdict shopping — the exact false positive the hook's own
 * header claims to avoid. Auditing thirty transcripts is not reviewing your own
 * diff twice.
 *
 * Verdict shopping is only possible when there is one subject to shop a verdict
 * ON, so the second-dispatch block requires a self-reference. The pre-loaded-
 * verdict block does NOT: steering an evaluator is wrong whatever it is
 * pointed at.
 */
const SELF_SCOPE_RE =
  /\b(my (work|change|diff|implementation|code|fix|patch|branch|pr)|this (diff|change|branch|pr|delta|implementation|patch)|the delta|the change i|what i (wrote|built|changed|implemented)|i just (wrote|built|changed|implemented))\b/i;

export function isSelfScoped(prompt: string): boolean {
  return SELF_SCOPE_RE.test(prompt);
}

/** Return the pre-loading phrase found in a prompt, or null. */
export function preloadedVerdict(prompt: string): string | null {
  for (const re of PRELOADED_VERDICT_RE) {
    const m = re.exec(prompt);
    if (m) {
      return m[0];
    }
  }
  return null;
}

/** Pull [tool, prompt] out of a pre-tool envelope. */
export function extractDispatch(envelope: JsonObject): [string | null, string] {
  const payload = _isObject(envelope["payload"]) ? (envelope["payload"] as JsonObject) : envelope;
  const toolRaw = payload["tool_name"] ?? payload["toolName"] ?? payload["tool"];
  const tool = typeof toolRaw === "string" ? toolRaw : null;
  const input = _isObject(payload["tool_input"])
    ? (payload["tool_input"] as JsonObject)
    : _isObject(payload["toolInput"])
      ? (payload["toolInput"] as JsonObject)
      : payload;
  for (const key of ["prompt", "instructions", "task", "description"]) {
    const v = input[key];
    if (typeof v === "string" && v.trim()) {
      return [tool, v];
    }
  }
  return [tool, ""];
}

interface DispatchState extends JsonObject {
  session_id: string;
  turn_started_at: string;
  evaluations: JsonValue[];
}

function _load(target: string): DispatchState {
  try {
    const decoded = JSON.parse(fs.readFileSync(target, "utf8")) as unknown;
    if (_isObject(decoded) && Array.isArray(decoded["evaluations"])) {
      return decoded as unknown as DispatchState;
    }
  } catch {
    /* fall through */
  }
  return { session_id: "", turn_started_at: "", evaluations: [] };
}

export interface Decision {
  exit: number;
  stdout: string;
  stderr: string;
  /** Number of evaluation dispatches recorded for this turn AFTER this one. */
  evaluations: number;
}

const WARN_TEXT =
  "First evaluation dispatch this turn. Two shapes fabricated a binding honest-null " +
  "in the audited sessions — check your prompt for both before it goes out: " +
  "(1) a verdict pre-loaded into the prompt, and (2) a scope narrowed to files you " +
  "chose. A review you commissioned on your own work is admissible as gate evidence " +
  "only when the prompt is recorded alongside the verdict.";

export function decide(
  tool: string | null,
  prompt: string,
  priorEvaluations: number,
): Decision {
  if (!isDispatchTool(tool) || !isEvaluationPrompt(prompt)) {
    return { exit: EXIT_ALLOW, stdout: "", stderr: "", evaluations: priorEvaluations };
  }

  const preloaded = preloadedVerdict(prompt);
  if (preloaded !== null) {
    return {
      exit: EXIT_BLOCK,
      stdout: "",
      stderr:
        `Blocked: this evaluation prompt pre-loads its verdict ("${preloaded}"). ` +
        `That is the construct that produced a fabricated NO-FINDINGS committed as ` +
        `binding gate evidence, over a delta an unsteered pass then found a live ` +
        `critical in. Remove the expectation from the prompt and let the evaluator ` +
        `reach its own verdict.\n`,
      evaluations: priorEvaluations,
    };
  }

  // Verdict shopping needs a single subject to shop a verdict on. An
  // evaluation of an external artifact (transcripts, a third party's code) is
  // fan-out, not self-review, and is never counted or blocked.
  if (!isSelfScoped(prompt)) {
    return { exit: EXIT_ALLOW, stdout: "", stderr: "", evaluations: priorEvaluations };
  }

  if (priorEvaluations >= 1) {
    return {
      exit: EXIT_BLOCK,
      stdout: "",
      stderr:
        `Blocked: second evaluation dispatch of your own work in this turn (verdict ` +
        `shopping). One evaluation has already run; commissioning another with a ` +
        `different prompt or scope selects the answer instead of measuring it. ` +
        `Report what the first pass returned, then re-plan.\n`,
      evaluations: priorEvaluations,
    };
  }

  return {
    exit: EXIT_ALLOW,
    stdout: `${JSON.stringify({ decision: "warn", reason: WARN_TEXT })}\n`,
    stderr: "",
    evaluations: priorEvaluations + 1,
  };
}

export function run(stdin_text: string, options: { consumer_root: string }): number {
  let envelope: JsonObject = {};
  if (stdin_text.trim()) {
    try {
      const decoded = JSON.parse(stdin_text) as unknown;
      if (_isObject(decoded)) {
        envelope = decoded;
      }
    } catch {
      return EXIT_ALLOW;
    }
  }

  const target = path.join(options.consumer_root, STATE_FILE);
  const state = _load(target);
  const session_id = typeof envelope["session_id"] === "string" ? envelope["session_id"] : "";

  // The authorization ledger owns turn boundaries; this guard reads its own
  // marker so it never depends on another concern's ordering.
  const turnMarker =
    typeof envelope["turn_id"] === "string" ? (envelope["turn_id"] as string) : session_id;
  if (state.session_id !== turnMarker) {
    state.session_id = turnMarker;
    state.turn_started_at = new Date().toISOString();
    state.evaluations = [];
  }

  const [tool, prompt] = extractDispatch(envelope);
  const decision = decide(tool, prompt, state.evaluations.length);

  if (decision.evaluations > state.evaluations.length) {
    state.evaluations.push({
      at: new Date().toISOString(),
      digest: crypto.createHash("sha256").update(prompt).digest("hex").slice(0, 16),
      prompt_chars: prompt.length,
    });
    try {
      atomic_write_json(target, state);
    } catch {
      /* observability only */
    }
  }

  if (decision.stdout) {
    process.stdout.write(decision.stdout);
  }
  if (decision.stderr) {
    process.stderr.write(decision.stderr);
  }
  return decision.exit;
}

export function main(argv?: string[]): number {
  const args = argv ?? process.argv.slice(2);
  let consumer_root = process.cwd();
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--project-dir" && args[i + 1] !== undefined) {
      consumer_root = args[i + 1] as string;
      i += 1;
    } else if (a !== undefined && a.startsWith("--project-dir=")) {
      consumer_root = a.slice("--project-dir=".length);
    }
  }
  return run(readHookStdin(), { consumer_root });
}

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
  if (typeof __AGENT_CONFIG_BUNDLE__ !== "undefined" && __AGENT_CONFIG_BUNDLE__) {
    return false;
  }
  if (process.argv[1] === undefined) {
    return false;
  }
  const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
  if (import.meta.url === argvUrl) {
    return true;
  }
  try {
    const here = fs.realpathSync(fileURLToPath(import.meta.url));
    const argv = fs.realpathSync(path.resolve(process.argv[1]));
    return here === argv;
  } catch {
    return false;
  }
}

if (_isCliEntry()) {
  process.exit(main());
}
