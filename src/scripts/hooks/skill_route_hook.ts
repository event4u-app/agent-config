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
 * HOST-HONEST, AND FAIL-OPEN BY CONSTRUCTION (road-to-catalogue-host-fit Phase
 * 3). The ranker reads the on-disk tree; the host does not necessarily deliver
 * it. A skill the host truncated is still rankable and still pointable, and the
 * pointer then names a skill whose description the model never received — worse
 * than silence, because a pointer reads as a delivered capability. That is the
 * roadmap's D-4, and it is MEASURED rather than assumed: 16 of 16 bare entries
 * in the 2026-08-12 claude observation are still in this ranker's catalogue
 * (`capture_skill_catalogue --pointable-bare`), among them `design-review`,
 * `design-intelligence` and `fe-design` — skills this estate's own rules route
 * to. So the pointer set is filtered against the latest per-entry observation
 * for the CURRENT host.
 *
 * The filter only ever narrows on a positive reading, and every uncertain state
 * resolves to no filtering at all: no observation log, no record for this host,
 * a host that publishes no per-entry list, a malformed line, an unknown host, or
 * any throw. `knownBareNames` returns `null` for each of them and
 * `filterKnownBare` treats `null` as a pass-through, so behaviour is
 * byte-identical to the unfiltered line. A filter that quietly hides skills on
 * missing data is worse than the divergence it treats — the roadmap's own words,
 * and the reason fail-open is a construction here rather than a convention.
 *
 * IT COSTS ZERO ON THE PATH THE HEADER ABOVE PROMISES IS FREE, AND 0.015 ms ON
 * THE ONE THAT PAYS. The log read is passed in as a thunk, not a value, and
 * `routePointers` calls it only after the term floor AND the rank both pass. A
 * prompt below `MIN_TASK_TERMS` therefore still reads no files at all, which is
 * the claim the 0 ms paragraph makes and an eagerly-read log would have quietly
 * falsified.
 *
 * The FIRING path was measured rather than assumed, because R2 finding 10 is
 * right that the paragraph above describes a path this branch changed. Measured
 * 2026-08-18 on this tree, same method as the 12.3 ms figure: `knownBareForHost`
 * alone is **0.015 ms median / 0.022 ms p95** (n=2000, warm) against a ranked
 * pass of 8.3 ms median — three orders of magnitude below the ranker it rides
 * on, and under 0.01 % of the slot's 250 ms p95 budget. The log is seven lines;
 * a cache would need an invalidation story and 0.015 ms does not buy one, which
 * is the same reasoning the ranker's own no-cache decision records.
 *
 * Note what the existing bench does NOT cover, so nobody reads it as coverage:
 * `bench_hook_latency`'s synthetic payload carries neither `prompt` nor
 * `platform`, so this concern returns before the ranker on every bench
 * iteration. The figures above come from a direct probe, not from that harness.
 *
 * THE FLOOR APPLIES TO WHAT IS DELIVERED, NOT TO WHAT WAS RANKED. Filtering
 * happens BEFORE `MIN_TOP_SCORE` and before the `TOP_K` slice, so the confidence
 * question is asked of the best pointer the model can actually use. One rule, in
 * one order: rank → drop the undeliverable → apply the floor → take the top
 * three.
 *
 * That ordering makes silence a real outcome, and the number says so rather than
 * the prose guessing: on `"review the authorization policy and tenant scope for
 * this endpoint"` the ranker returns `authz-review` at 47 and the next entry at
 * 23, against a floor of 31. Suppress the top-1 and NOTHING clears the floor —
 * the line goes silent instead of naming a 23/100 pointer because the 47 one was
 * undeliverable. That is the intended reading of a floor calibrated for
 * confidence, and promoting a sub-floor pointer to fill the gap would be the
 * "advisory worse than silence" failure this file's risk paragraph ranks first.
 * `suppressed` is what distinguishes that silence from an unranked prompt, and
 * `tests/hooks/skill_route_hook.test.ts` pins both cases against the real
 * corpus rather than a constructed one.
 *
 * NO ADOPTION THRESHOLD IS COMMITTED HERE. Whether the line changes behaviour
 * is a question for data, not for this header: `skill_route_pointer_rate` is
 * registered in `hook-token-budget.json` under the same owner/review discipline
 * as its sibling advisories, with the same kill standard — a nudge whose
 * verdicts are measurably ignored gets its trigger tightened or its line
 * removed. The score floor above is a TRIGGER calibration and is measured; the
 * adoption threshold is an OUTCOME claim and is deliberately absent.
 *
 * `skill_route_bare_suppression_rate` is registered beside it under the same
 * owner, review date and kill discipline, and inherits the same refusal: how
 * often the filter fires is a number to collect, not one to promise. Its
 * numerator is carried in the warn `reason` below — `N suppressed` — because no
 * dedicated counter exists, and that gap is registered as a gap rather than
 * implied to be automatic.
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
import { OBSERVATION_LOG, readObservationLog, resolveSkillsRoot } from "../_lib/skill_catalogue.js";
import { knownBareNames } from "../_lib/skill_catalogue_series.js";
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
 * Names this host is known to have delivered bare, or `null` for no filtering.
 *
 * Every failure mode collapses to `null` — an unknown host, a missing log, an
 * unreadable one, a host that enumerates nothing, a throw from anywhere in the
 * read. The three-way distinction `knownBareNames` draws is preserved: an empty
 * set means *measured clean*, `null` means *never measured*, and only the second
 * one is produced here by accident.
 */
export function knownBareForHost(workspaceRoot: string, host: string | null): Set<string> | null {
  if (host === null || host === "") return null;
  try {
    return knownBareNames(readObservationLog(path.join(workspaceRoot, OBSERVATION_LOG)), host);
  } catch {
    return null;
  }
}

/**
 * Drop the ranked rows this host is known to have delivered bare.
 *
 * `null` is a pass-through and returns the input order untouched, which is the
 * fail-open half of the header's contract and what makes an absent observation
 * byte-identical to today.
 */
export function filterKnownBare(
  rows: readonly RankRow[],
  bare: Set<string> | null,
): RankRow[] {
  if (bare === null || bare.size === 0) return [...rows];
  return rows.filter(([name]) => !bare.has(name));
}

/** What one routing pass decided, including what it refused to name. */
export interface RouteDecision {
  rows: RankRow[];
  /**
   * Would-be POINTERS dropped as known-bare — the suppression metric's numerator.
   *
   * Scoped to the pointer window (`TOP_K` of the unfiltered ranking), not to the
   * whole ranked list. R2 finding 1: `rank` returns every non-zero-scoring skill
   * and this catalogue has hundreds, so counting drops across all of them would
   * let a bare name at rank 40 — never pointable, never a loss — bump the count
   * on almost every fire. The registered metric defines this as skills the
   * ranker wanted to POINT AT, and its upper falsifier would otherwise fire on a
   * perfectly healthy join.
   */
  suppressed: number;
}

/**
 * Rank a prompt and return the pointers worth injecting, or `[]` for silence.
 *
 * Total by construction: a missing root, an unreadable catalogue, or a ranker
 * error all resolve to `[]`. A routing advisory that can crash a turn is worse
 * than one that says nothing.
 *
 * `bareProvider` is a THUNK, deliberately — see the header's zero-cost
 * paragraph. It is called only once both the term floor and the rank have
 * passed, so the short-prompt path still touches no files. Omitting it disables
 * filtering entirely, which is what keeps every caller that predates the filter
 * behaviourally unchanged.
 */
export function routeDecision(
  prompt: string,
  skillsDir: string | null,
  bareProvider?: () => Set<string> | null,
): RouteDecision {
  const silent: RouteDecision = { rows: [], suppressed: 0 };
  if (skillsDir === null) return silent;
  // Denominator floor BEFORE the catalogue read: a prompt too short to score
  // meaningfully cannot produce a pointer worth 337 file reads either.
  try {
    if (_tokenize(prompt).size < MIN_TASK_TERMS) return silent;
  } catch {
    return silent;
  }
  let rows: RankRow[];
  try {
    rows = rank(prompt, skillsDir);
  } catch {
    return silent;
  }
  let bare: Set<string> | null = null;
  if (bareProvider !== undefined) {
    try {
      bare = bareProvider();
    } catch {
      bare = null; // fail open, never silent-narrow
    }
  }
  const deliverable = filterKnownBare(rows, bare);
  // The pointer WINDOW, not the ranked list — see `RouteDecision.suppressed`.
  const suppressed =
    bare === null ? 0 : rows.slice(0, TOP_K).filter(([name]) => bare.has(name)).length;
  // The floor asks its question of the best DELIVERABLE pointer, not of a
  // pointer the model cannot use. See the header's one-rule-one-order note.
  const top = deliverable[0];
  if (top === undefined || top[1] < MIN_TOP_SCORE) return { rows: [], suppressed };
  return { rows: deliverable.slice(0, TOP_K), suppressed };
}

/** The rows alone. Kept because most callers and fixtures want only these. */
export function routePointers(
  prompt: string,
  skillsDir: string | null,
  bareProvider?: () => Set<string> | null,
): RankRow[] {
  return routeDecision(prompt, skillsDir, bareProvider).rows;
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

  const root = _workspaceRoot(env);
  const platform = env["platform"];
  const host = typeof platform === "string" && platform ? platform : null;
  const { rows, suppressed } = routeDecision(prompt, resolveSkillsRoot(root), () =>
    knownBareForHost(root, host),
  );
  if (rows.length === 0) return EXIT_ALLOW; // silence is the default

  process.stdout.write(
    `${JSON.stringify({
      decision: "warn",
      reason:
        `skill-route: ${rows.length} pointer(s), top ${rows[0]![1]}/100` +
        // The suppression metric's numerator. Named only when non-zero, so the
        // common line keeps its shape and its registered byte budget.
        (suppressed > 0 ? `, ${suppressed} suppressed as host-bare` : ""),
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
