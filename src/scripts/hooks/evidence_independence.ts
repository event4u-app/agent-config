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
// MUST equal dispatch_hook.EXIT_BLOCK. The dispatcher's internal ladder is
// 0 allow / 1 block / 2 warn — NOT the 2-means-block shape a PreToolUse guard
// reads naturally from Claude's own native contract. This constant was 2 when
// this gate first shipped, so the dispatcher reduced every refusal to a WARN
// and the gate emitted advisory context while the operation went through.
// Pinned against the dispatcher's export by
// tests/hooks/concern_block_exit_parity.test.ts.
const EXIT_BLOCK = 1;

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
  /\b(review|reviewer|audit|auditor|judge|verdict|blind[- ]pass|blind review|adversarial|critique|assess(ment)?|verify (my|the) (work|change|diff|implementation)|find (any )?(bugs|issues|defects|problems) in (my|the)|pr(ü|ue)f(e|ung)?|begutachte|gutachten|bewerte|(gegen)?check(e)?|durchsicht|review(e|iere))\b/i;

/**
 * Verdict pre-loading. Each pattern is a phrase that tells the evaluator what
 * answer is acceptable BEFORE it has looked — the construct that produced the
 * fabricated honest-null.
 */
const PRELOADED_VERDICT_RE = [
  // German — the operator writes German, and an English-only list meant no
  // German dispatch was ever screened at all.
  /\bich erwarte (hier )?(keine|nichts)\b/i,
  /\b(du )?(wirst|solltest) (hier )?nichts finden\b/i,
  /\bbest(ä|ae)tige (nur|kurz)\b/i,
  /\b(ist|sollte) (wahrscheinlich|vermutlich|sicher) (sauber|korrekt|in ordnung|fine)\b/i,
  /\bkeine findings? (erwartet|zu erwarten)\b/i,
  // English paraphrases of the audited construct.
  /\bi am confident there is nothing\b/i,
  /\ba clean pass is the likely\b/i,
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
 *
 * That fix was still too wide, and the cross-project session audit (2026-08-12)
 * measured the cost: `road-to-release-truth/fc1ff181` turn 3 fanned out 16
 * IMPLEMENTATION workers, and 15 were classified self-scoped on one phrase —
 * `this branch`. In context it read "two conversions already landed on this
 * branch in exactly the style you should match", i.e. it named WHERE the work
 * happens. A worktree dispatch prompt carries that phrase by construction
 * ("Work in <worktree> (branch …)"), so on a hook-bound host the guard ate 15
 * of 16 workers — the exact behaviour `evaluator-independence` § "When it does
 * NOT fire" promises is out of scope ("…or IMPLEMENT is not evaluation and is
 * not gated").
 *
 * So the self-reference must name a SUBJECT a verdict can be shopped for — a
 * diff, a change, a patch — never the LOCATION the work happens in. `this
 * branch` is dropped for that reason; `my branch` stays, because the possessive
 * makes it a claim about the agent's own work rather than an address. `this pr`
 * stays for the same reason `this diff` does: a PR is a thing reviewers render
 * verdicts on, whereas a branch is where you stand while working.
 */
const SELF_SCOPE_RE =
  /\b(my (work|change|diff|implementation|code|fix|patch|branch|pr)|this (diff|change|pr|delta|implementation|patch)|the delta|the change i|what i (wrote|built|changed|implemented)|i just (wrote|built|changed|implemented))\b/i;

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

/** The current user turn's stamp, or "" when no ledger exists yet. */
function _ledgerStamp(consumer_root: string): string {
  try {
    const raw = fs.readFileSync(
      path.join(consumer_root, "agents", "state", "git-authorization.json"),
      "utf8",
    );
    const d = JSON.parse(raw) as Record<string, unknown>;
    return typeof d["detected_at"] === "string" ? d["detected_at"] : "";
  } catch {
    return "";
  }
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

  // WARN, not block — a deliberate severity decision, not an oversight.
  //
  // This branch decides from PROSE ALONE: `isEvaluationPrompt` and `isSelfScoped`
  // both infer intent from a natural-language prompt, and no structured fact
  // corroborates them. Under the tier rule in `docs/contracts/hook-architecture-v1.md`
  // (§ What a concern may block on) that is Tier 3, and Tier 3 may only warn.
  //
  // It is written from measurement, not taste. A 16-way fan-out of IMPLEMENTATION
  // subagents lost 15 workers to this branch, because `isEvaluationPrompt` fired
  // on the unavoidable words review/audit/check and `isSelfScoped` on the phrase
  // `this branch` — an address every worktree dispatch prompt carries. Narrowing
  // the phrase list fixed that instance; the council convened on the design
  // (anthropic + openai, 2026-08-12, quorum 2/2) held that no finite pattern can
  // bound the false-positive set, and that a prompt — unlike a shell command —
  // has no grammar to anchor an "invoked vs named" discriminator to.
  //
  // What is NOT downgraded: the pre-loaded-verdict block above. That one matches
  // a literal steering formulation ("NO-FINDINGS is expected and welcome"), which
  // IS the violation rather than evidence of one, so it keeps blocking.
  //
  // The route back to blocking is structural, not another regex: a `role` /
  // `evidence_scope` field the dispatcher sets at the call site, where the caller
  // knows by construction whether it is commissioning an evaluation. Then this
  // branch reads a field instead of guessing, and becomes Tier 1.
  // exit 0 + `decision: "warn"` on stdout is how this dispatcher carries an
  // advisory — NOT exit 2. The internal ladder's `2 = warn` is read as BLOCK by
  // Claude Code's native PreToolUse contract, which is the defect that made an
  // advisory guard a hard deny once already; the same shape here would have kept
  // the fan-out blocked while claiming to warn.
  if (priorEvaluations >= 1) {
    return {
      exit: EXIT_ALLOW,
      stdout: `${JSON.stringify({
        decision: "warn",
        reason:
          `Second evaluation dispatch of your own work in this turn. If both passes ` +
          `judge the SAME subject, that is verdict shopping — commissioning another ` +
          `with a different prompt or scope selects the answer instead of measuring ` +
          `it. Report what the first pass returned, then re-plan. If this is an ` +
          `implementation fan-out rather than a second review, carry on: this check ` +
          `reads prose and cannot tell the two apart with certainty.`,
      })}\n`,
      stderr: "",
      evaluations: priorEvaluations + 1,
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

  // Turn boundary. `turn_id` does NOT exist in the production envelope — the
  // dispatcher never sets it, so the original marker fell through to
  // `session_id` and the counter was session-scoped: one self-review anywhere
  // in a session blocked every later one. The only per-user-turn stamp that
  // actually exists is `detected_at` in the authorization ledger, which
  // `git_authorization_hook` rewrites on every `user_prompt_submit`.
  const turnMarker = `${session_id}:${_ledgerStamp(options.consumer_root)}`;
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
    } catch (err) {
      /* Unlike its two siblings in `git_authorization_hook`, this one fails
         OPEN, which is why it gets a diagnostic rather than a shrug. The turn's
         evaluation count lives only in this file: a failed write leaves
         `evaluations` one short, so the NEXT self-commissioned evaluation in the
         same turn reads `priorEvaluations === 0` and the verdict-shopping warn
         does not fire. The item-1 pre-loaded-verdict BLOCK is unaffected — it
         reads the prompt, not this state — so the degradation is bounded to the
         advisory half. Silent was the wrong call for a guard that loses a check
         when it fails. */
      process.stderr.write(
        `evidence-independence: evaluation-count write failed (${_errText(err)}) — ` +
          "this turn's count did NOT advance, so a second self-scoped evaluation " +
          "will not be warned about. The pre-loaded-verdict block is unaffected.\n",
      );
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

/** One-line, bounded rendering of a caught value for a stderr diagnostic. */
function _errText(err: unknown): string {
  const t = err instanceof Error ? err.message : String(err);
  return t.replace(/\s+/g, " ").trim().slice(0, 200);
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
