#!/usr/bin/env node
/**
 * Skill route — `user_prompt_submit` concern
 * (road-to-inbox-harvest-2026-08-d-runtime-skill-routing Phase 2).
 *
 * THE DEFECT THIS CLOSES. A deterministic task→skill ranker has shipped in
 * this tree for months and is bound to nothing: `score_skill_relevance.rank`
 * and its `suggest_skill_for_task` wrapper have no production caller, and
 * `hook_manifest.yaml` had no concern that reached either. A capability that
 * ships and never runs is indistinguishable from one that was never built —
 * the same shape `delegation-nudge` was created to end for `classifyTask`, and
 * this concern is deliberately its twin rather than a new mechanism.
 *
 * POINTERS, NEVER BODIES. The injected line names at most three skill IDs and
 * their scores. It does not carry descriptions, excerpts, or file contents, and
 * it never instructs the agent to load anything. The reason is the risk this
 * roadmap's own register ranks first: a pointer line the agent trusts is worse
 * than no line when the ranking is poor, so what is injected is the cheapest
 * thing that can still be acted on — and the cheapest thing to ignore.
 *
 * SILENCE IS THE DEFAULT, AND BOTH FLOORS ARE MEASURED, NOT GUESSED. `rank`
 * already drops every zero-scoring skill, but on real prompts it almost always
 * returns SOMETHING, so "non-empty" is not a usable trigger. Measured over the
 * routing-matrix corpus (496 prompt lines, `tests/eval/routing-matrix/*.yaml`,
 * 2026-08-16): top-score median 18, p75 28, p90 30, max 70, and only 4 prompts
 * score nothing at all.
 *
 * TWO floors are needed, because the score alone cannot express the failure at
 * the short end. `MIN_TOP_SCORE` gates confidence; `MIN_TASK_TERMS` gates the
 * denominator that confidence is computed over — the scorer divides by the task
 * term count, so a one-term prompt scores 70/100 against whatever shares that
 * term. Together they fire on 9.1 % of the corpus. A score floor at the median
 * with no term floor would fire on half of all turns AND still hand 70/100 to
 * `"fix it"` — the per-turn-reminder shape this estate has already measured
 * failing at a 24/29 miss rate. Each constant carries its own derivation below.
 *
 * COST, MEASURED RATHER THAN ASSUMED. Ranking re-reads the skill catalogue per
 * prompt, uncached. Measured 2026-08-16 on this tree: **12.3 ms warm** for a
 * prompt that reaches the ranker, against the slot's 250 ms p95 budget — about
 * 5 % of it. A prompt below `MIN_TASK_TERMS` costs **0 ms**, because the term
 * floor is checked BEFORE the catalogue read; that ordering is deliberate and
 * is what keeps conversational turns free. No cache is added: a cache would
 * need an invalidation story for a tree that changes under the session, and
 * 12.3 ms does not buy one.
 *
 * NO ADOPTION THRESHOLD IS COMMITTED HERE. Whether the line changes behaviour
 * is a question for data, not for this header: `skill_route_pointer_rate` is
 * registered in `hook-token-budget.json` under the same owner/review discipline
 * as its sibling advisories, with the same kill standard — a nudge whose
 * verdicts are measurably ignored gets its trigger tightened or its line
 * removed. The score floor above is a TRIGGER calibration and is measured; the
 * adoption threshold is an OUTCOME claim and is deliberately absent.
 *
 * DELIVERY PATH — the verified one, copied rather than re-derived. A
 * `user_prompt_submit` concern returning `{decision:"allow", context:…}` at
 * exit 0 produces zero stdout: `host_semantics.emitFor` drops the field for
 * severity `"allow"`. The only shape that survives to
 * `hookSpecificOutput.additionalContext` is `{decision:"warn", reason,
 * additional_context}` at exit 2, which `emitFor` reduces to a real process
 * exit of 0 — it never blocks the turn. `delegation_nudge_hook.ts` carries the
 * full proof of that mechanism and this concern follows it exactly.
 *
 * PLATFORM SCOPE — `claude` only, for the same reason its twin gives:
 * `host_semantics.VERIFIED_PLATFORMS` covers only `claude`, `cowork`'s
 * trampoline discards dispatcher stdout unconditionally, and the other
 * trampolines were never inspected for that property. Extending an exit-2
 * delivery to an unverified propagation path is the speculative mapping
 * `host_semantics.ts` exists to prevent.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { readHookStdin } from "./hook_stdin.js";
import { isSyntheticPrompt } from "../_lib/prompt_shape.js";
import { resolveSkillsRoot } from "../_lib/skill_catalogue.js";
import { _tokenize, rank, type RankRow } from "../skill_tools/score_skill_relevance.js";

const EXIT_ALLOW = 0;
/** See the header: reduced to a real exit of 0 by `emitFor`'s warn branch. */
const EXIT_WARN = 2;

/**
 * Minimum top-1 ranker score before this concern speaks.
 *
 * **31, not the measured p90 of 30, and the extra point is load-bearing.** The
 * scorer is `overlap * 70 + personaHit * 30`, so a skill whose PERSONA slug
 * appears in the prompt scores exactly 30 with zero keyword overlap. A floor of
 * 30 with a `>=` test therefore admits a pure persona coincidence as if it were
 * a ranked match. 31 is the smallest floor strictly above that value; it moves
 * the corpus fire rate from 13.9 % to 9.1 %.
 */
export const MIN_TOP_SCORE = 31;

/**
 * Minimum distinct task terms before the score is trusted at all.
 *
 * The scorer divides by `|task_terms|`, so the score is inversely proportional
 * to prompt length and degenerates at the short end: `"fix it"` tokenizes to
 * ONE term and hands 70/100 to whichever skills happen to share it, which on
 * this catalogue means the alphabetically first three. `MIN_TOP_SCORE` cannot
 * fix that — the number is not too low, the denominator is too small.
 *
 * **3 is the routing-matrix corpus's own minimum**, so this floor excludes
 * ZERO of the 496 prompt lines the score calibration rests on while removing
 * every degenerate short prompt measured (`"fix it"` 1, `"mach das"` 2,
 * `"was denkst du dazu"` 2, `"weiter"` 1). A floor of 4 would have cost 10 real
 * corpus prompts for one tenth of a percentage point.
 */
export const MIN_TASK_TERMS = 3;

/** Pointers per line. Three is the ranker's own default `--top`. */
export const TOP_K = 3;

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function _isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Rank a prompt and return the pointers worth injecting, or `[]` for silence.
 *
 * Total by construction: a missing root, an unreadable catalogue, or a ranker
 * error all resolve to `[]`. A routing advisory that can crash a turn is worse
 * than one that says nothing.
 */
export function routePointers(prompt: string, skillsDir: string | null): RankRow[] {
  if (skillsDir === null) return [];
  // Denominator floor BEFORE the catalogue read: a prompt too short to score
  // meaningfully cannot produce a pointer worth 337 file reads either.
  try {
    if (_tokenize(prompt).size < MIN_TASK_TERMS) return [];
  } catch {
    return [];
  }
  let rows: RankRow[];
  try {
    rows = rank(prompt, skillsDir);
  } catch {
    return [];
  }
  const top = rows[0];
  if (top === undefined || top[1] < MIN_TOP_SCORE) return [];
  return rows.slice(0, TOP_K);
}

/**
 * The injected line. Names the floor it cleared, so a reader can tell a
 * confident pointer from a lucky one without opening this file.
 */
export function buildRouteLine(rows: readonly RankRow[]): string {
  const pointers = rows.map(([name, score]) => `${name} (${score})`).join(", ");
  return (
    `<skill-route>ranked skill pointers for this prompt: ${pointers}. ` +
    `Deterministic keyword ranker, top-1 at or above ${MIN_TOP_SCORE}/100 — ` +
    `pointers only, no bodies loaded. Open one if it fits; ignore the line if it does not.</skill-route>`
  );
}

function _extractPrompt(payload: JsonObject): string {
  for (const key of ["prompt", "userPrompt", "user_prompt", "message", "text"]) {
    const v = payload[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

function _workspaceRoot(envelope: JsonObject): string {
  const v = envelope["workspace_root"];
  return typeof v === "string" && v ? v : process.cwd();
}

export function main(): number {
  let envelope: JsonValue = {};
  try {
    const raw = readHookStdin();
    envelope = raw.trim() ? (JSON.parse(raw) as JsonValue) : {};
  } catch {
    return EXIT_ALLOW; // malformed envelope — never block
  }
  const env: JsonObject = _isObject(envelope) ? envelope : {};

  const event = env["event"];
  const slot = typeof event === "string" && event !== "" ? event : "user_prompt_submit";
  if (slot !== "user_prompt_submit") return EXIT_ALLOW;

  const payload = _isObject(env["payload"]) ? (env["payload"] as JsonObject) : env;
  const prompt = _extractPrompt(payload);
  if (!prompt) return EXIT_ALLOW;
  if (isSyntheticPrompt(prompt)) return EXIT_ALLOW; // harness turn, not a task

  const rows = routePointers(prompt, resolveSkillsRoot(_workspaceRoot(env)));
  if (rows.length === 0) return EXIT_ALLOW; // silence is the default

  process.stdout.write(
    `${JSON.stringify({
      decision: "warn",
      reason: `skill-route: ${rows.length} pointer(s), top ${rows[0]![1]}/100`,
      additional_context: buildRouteLine(rows),
    })}\n`,
  );
  return EXIT_WARN;
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url`.
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
  if (typeof __AGENT_CONFIG_BUNDLE__ !== "undefined" && __AGENT_CONFIG_BUNDLE__) return false;
  if (process.argv[1] === undefined) return false;
  const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
  if (import.meta.url === argvUrl) return true;
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
