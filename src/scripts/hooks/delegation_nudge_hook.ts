#!/usr/bin/env node
/**
 * Delegation nudge — `user_prompt_submit` concern (F3-lite, road-to-orchestrator-
 * discipline-carriers Phase 4).
 *
 * Deterministic, no-LLM carrier for the `delegation-policy` rule's "decompose
 * and dispatch" obligation. `classifyTask` (`_lib/auto_dispatch.ts`) has zero
 * production callers today — its only importer is the `routing:doctor`
 * diagnostic — so the delegate-by-default rule never actually sees a real
 * prompt. This concern is the missing signal producer: it extracts cheap,
 * regex-only structural signals from the SUBMITTED prompt text (enumerated
 * file lists, "for each"/"alle …" shapes, explicit slice counts, ordered-plan
 * markers, multi-deliverable conjunctions), feeds them to `classifyTask`
 * together with the REAL activation gate (settings + host-capability
 * manifest, resolved via `resolveHostCapabilities(hostId, override)` —
 * the F5 committed registry, with the `subagents.host_capabilities`
 * settings override winning outright when present — the same order
 * `routing_doctor.collect_orchestration` uses), and — only on a positive
 * `do-in-parallel` / `do-in-steps` verdict — injects
 * ONE line naming the mode, the slice count, and a tier recommendation for
 * the slices (`resolveSubagentRouting`'s first production caller, applied
 * with a conservative "lite, downshifted" default).
 *
 * ANTI-CANARY CONDITION (roadmap 4.2). Silence is the default: no enumerated
 * signal → no injection, not even a "nothing to delegate here" line. This is
 * deliberate — a per-turn reminder that fires on every turn is exactly the
 * canary shape that measured a 24/29 miss rate; this concern only ever speaks
 * when it has a concrete, falsifiable verdict to report.
 *
 * DELIVERY PATH — fixed to mirror `language_mirror_hook.ts` (found while
 * building this concern; the original `{decision:"allow", context:…}` shape
 * below is superseded). `context_blocks` forwarding in `dispatch_hook.ts` is
 * restricted to the `session_start` event by the code's own comment
 * ("session_start context forwarding … All other events keep the swallow-
 * stdout contract unchanged"). Empirically verified against the real
 * dispatcher (`dispatch_entry.ts`, platform `claude`): a `user_prompt_submit`
 * concern that returns `{decision:"allow", context: "…"}` at exit 0 produces
 * ZERO stdout from the dispatcher — the `context` field is silently dropped,
 * because `host_semantics.emitFor` returns `{exit:0, stdout:"", stderr:""}`
 * unconditionally for severity `"allow"` (derived from the concern's own exit
 * code, which is 0 here). The ONLY path that survives to
 * `hookSpecificOutput.additionalContext` on `user_prompt_submit` is a concern
 * that reports `reason`/`additional_context` and an exit code that reduces to
 * `"warn"` (2) — `language_mirror_hook.ts`'s shipped pattern. This concern now
 * follows that pattern exactly: `{decision:"warn", reason, additional_context}`
 * at exit `EXIT_WARN` (2).
 *
 * WHY EXIT 2 NEVER BLOCKS. `host_semantics.emitFor`'s `severity === "warn"`
 * branch returns `{exit: 0, stdout: claudeAdditionalContext(event, reason)}`
 * UNCONDITIONALLY — it does not consult `CLAUDE_BLOCK_CAPABLE_EVENTS` at all
 * (that check only gates the `"block"` severity branch). So on the verified
 * `claude` platform the real process exit handed back to the host is always
 * 0 for a warn verdict, on `user_prompt_submit` exactly as on every other
 * event — the internal `EXIT_WARN` is dispatcher-internal bookkeeping, never
 * the byte that reaches Claude Code. This is the same mechanism that makes
 * `language_mirror_hook.ts` (which returns the same exit code on the same
 * slot, on effectively every prompt carrying language markers) run in
 * production today without ever blocking a turn.
 *
 * PLATFORM SCOPE — bound only on `claude` and `cowork` in the manifest (not
 * the full `language-mirror` platform list). `host_semantics.VERIFIED_PLATFORMS`
 * covers only `claude`, so `claude` is the one platform where the "never
 * blocks" claim above is verified against documented, testable behaviour.
 * `cowork` is included because `scripts/hooks/cowork-dispatcher.sh` discards
 * the dispatcher's exit code and stdout unconditionally
 * (`>/dev/null 2>&1 || true; exit 0`), so no exit code choice there can ever
 * reach the host as a block — independent of `host_semantics`. Cursor / Cline /
 * Windsurf / Gemini are deliberately NOT added here: their trampolines were
 * not inspected for the same discard property, and extending the exit-2
 * pattern to an unverified propagation path is exactly the speculative
 * mapping `host_semantics.ts`'s own header calls out as "the same class of
 * bug this module exists to remove". `language-mirror`'s existing broader
 * binding is a pre-existing fact this change does not touch or relitigate.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readHookStdin } from "./hook_stdin.js";
import { load_agent_settings } from "../_lib/agent_settings.js";
import { resolveHostCapabilities } from "../_lib/host_capability.js";
import {
  classifyTask,
  type ActivationInputs,
  type Classification,
  type TaskSignals,
} from "../_lib/auto_dispatch.js";
import { resolveSubagentRouting, type Tier } from "../_lib/subagent_routing.js";
import { isSyntheticPrompt } from "../_lib/prompt_shape.js";

const EXIT_ALLOW = 0;
// Severity is taken from the EXIT CODE, not from the `decision` field in the
// stdout payload — mirrors `language_mirror_hook.ts`'s own note (found the
// same way: by tracing delivery, not by re-reading the unit tests). A warn
// verdict is reported at exit 2 so `host_semantics.emitFor` reduces it to
// severity `"warn"` and forwards `additional_context`; see the file header
// for why this exit code never actually blocks the turn.
const EXIT_WARN = 2;

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function _isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// ── Signal extraction (cheap, regex-only — no LLM call) ──────────────────

/**
 * Enumerated file-like tokens: backtick-quoted or bare `name.ext` shapes.
 * Counts UNIQUE matches — "a.ts a.ts" is one file mentioned twice, not two.
 */
const FILE_TOKEN_RE =
  /`?\b[\w][\w.\-]{0,80}\.(ts|tsx|js|jsx|mjs|cjs|py|php|rb|go|rs|java|kt|swift|md|mdx|json|ya?ml|css|scss|less|html|vue|svelte|sql|sh|bash|c|cpp|h|hpp|cs|toml|xml)\b`?/gi;

export function detectEnumeratedFiles(text: string): number {
  const matches = text.match(FILE_TOKEN_RE) ?? [];
  const unique = new Set(matches.map((m) => m.replace(/`/g, "").toLowerCase()));
  return unique.size;
}

/**
 * Explicit slice counts: "6 files", "3 modules", "5 Dateien" — a number
 * immediately followed by a plural noun the classifier recognises as a
 * countable unit of work.
 */
const EXPLICIT_COUNT_RE =
  /\b(\d+)\s+(files?|modules?|components?|endpoints?|scripts?|skills?|rules?|tickets?|tests?|screens?|pages?|repos?|services?|classes?|functions?|methods?|slices?|tasks?|items?|targets?|routes?|controllers?|Dateien|Module|Tests|Komponenten|Skripte|Regeln|Tickets|Aufgaben|Klassen|Funktionen|Endpunkte)\b/i;

export function detectExplicitSliceCount(text: string): number | null {
  const m = EXPLICIT_COUNT_RE.exec(text);
  if (!m) return null;
  const n = Number.parseInt(m[1] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * "for each" / "for every" / "alle …" / "jede(n|s|r) …" — a same-shape-repeated
 * signal with no explicit count attached. Contributes a minimal slice count
 * (2) when nothing more specific was found, since the shape itself implies
 * "more than one" without saying how many.
 */
const FOR_EACH_RE =
  /\bfor\s+each\b|\bfor\s+every\b|\beach\s+of\s+the\b|\bevery\s+one\s+of\b|\ball(?:e|en)\b|\bjed(?:e|er|es|en)\b|\bjeweils\b/i;

export function detectForEachShape(text: string): boolean {
  return FOR_EACH_RE.test(text);
}

/**
 * Multi-deliverable conjunction: "X, Y, and Z" / "X, Y, und Z" — an
 * Oxford-comma-style list of three or more items closed by "and"/"und"
 * immediately after the LAST comma in a sentence. Deliberately requires the
 * comma before the conjunction (>= 2 commas total): a looser, single-comma
 * match ("A, B and C") would also match a stray "<item>, and <note>" aside
 * that is not an enumeration at all. Known gap (documented, not fixed
 * here): a German list that skips the comma before "und" ("Docs, Changelog
 * und README") has only 1 comma and is NOT detected by this function —
 * `detectForEachShape`'s "alle"/"jede…" patterns are the German-first signal
 * for that shape instead.
 */
export function detectMultiDeliverableConjunction(text: string): number {
  for (const sentence of text.split(/[.!?\n]+/)) {
    const commaCount = (sentence.match(/,/g) ?? []).length;
    if (commaCount < 2) continue;
    const tail = sentence.slice(sentence.lastIndexOf(",") + 1);
    if (/^\s*(and|und)\b/i.test(tail)) {
      return commaCount + 1;
    }
  }
  return 0;
}

/**
 * Ordered-plan markers: "Step 1"/"Schritt 2", or lines opening with `1. `/`2)`.
 * Two or more distinct markers is treated as an explicit ordered plan — one
 * numbered reference alone ("see step 3") is not a plan shape.
 */
const STEP_WORD_RE = /\b(?:step|schritt)\s*\d+\b/gi;
const STEP_LINE_RE = /^\s*\d+[.)]\s+\S/gm;

/**
 * Minimum bare numbered-list lines ("1. … \n2. …") before the LINE shape
 * counts as an ordered plan (F7, review): a 2-line numbered list is common,
 * ordinary prose structure ("1. rename a.ts\n2. rename b.ts" is not itself
 * an enumerated work plan) and was firing as a false positive at the
 * previous threshold of 2. The explicit "Step N"/"Schritt N" WORD marker
 * (`STEP_WORD_RE`) is a much stronger, author-stated signal even at 2 — an
 * author who writes "Step 1 … Step 2 …" is naming a plan on purpose — and
 * keeps its own, lower threshold.
 */
const ORDERED_LINE_FLOOR = 3;
const ORDERED_WORD_FLOOR = 2;

export function detectOrderedPlan(text: string): { ordered: boolean; stepCount: number } {
  const wordMatches = text.match(STEP_WORD_RE) ?? [];
  const lineMatches = text.match(STEP_LINE_RE) ?? [];
  const ordered = wordMatches.length >= ORDERED_WORD_FLOOR || lineMatches.length >= ORDERED_LINE_FLOOR;
  const count = Math.max(wordMatches.length, lineMatches.length);
  return { ordered, stepCount: count };
}

export interface ExtractedSignals {
  signals: TaskSignals;
  /** Slice count to surface in the injected line, matching whichever shape fired. */
  sliceCountForLine: number;
}

/**
 * Turn a raw submitted-prompt string into `TaskSignals` for `classifyTask`.
 * Pure and total — never throws; an unparseable/empty prompt resolves to
 * "no signal" (`size_estimate: 0`), which the size floor alone already
 * routes to `in-session`.
 */
export function extractTaskSignals(text: string): ExtractedSignals {
  const ordered = detectOrderedPlan(text);
  if (ordered.ordered) {
    return {
      signals: {
        parallelizable: null,
        ordered_plan: true,
        independent_slices: 0,
        size_estimate: Math.max(ordered.stepCount, 2),
      },
      sliceCountForLine: ordered.stepCount,
    };
  }

  const fileCount = detectEnumeratedFiles(text);
  const explicit = detectExplicitSliceCount(text) ?? 0;
  const conjunction = detectMultiDeliverableConjunction(text);
  const forEach = detectForEachShape(text);

  // F7 (review): a bare file-token count below 3 is common and NOT itself
  // evidence of independent, parallelizable work — "rename a.ts to b.ts"
  // names 2 files but is one mechanical edit, not two delegable slices. The
  // explicit "N files/Dateien" phrase (`detectExplicitSliceCount`) is a
  // stronger, author-stated signal and keeps its existing floor of N>=2.
  const fileSignal = fileCount >= 3 ? fileCount : 0;

  let slices = Math.max(fileSignal, explicit, conjunction);
  if (slices === 0 && forEach) {
    slices = 2;
  }

  const parallelizable: TaskSignals["parallelizable"] =
    fileSignal >= 3 ? "files" : forEach ? "independent" : null;

  return {
    signals: {
      parallelizable,
      ordered_plan: false,
      independent_slices: slices,
      size_estimate: slices > 0 ? Math.max(slices, 2) : 0,
    },
    sliceCountForLine: slices,
  };
}

// ── Activation resolution (mirrors routing_doctor.collect_orchestration) ──

/**
 * `hostId` is the caller-supplied platform identifier (the envelope's own
 * `platform` field, e.g. `"claude"`) — `resolveHostCapabilities` resolves the
 * committed registry row for it. The settings-level
 * `subagents.host_capabilities` override, when present, still wins outright
 * over the registry (per `host_capability.ts § Resolution` — an explicit
 * consumer override is never second-guessed by a committed default).
 */
export function resolveActivation(
  workspace_root: string,
  hostId: string | null | undefined,
): {
  activation: ActivationInputs;
  downshift: boolean;
  separate_quota_pool: boolean;
} {
  const settings = load_agent_settings({ cwd: workspace_root }) as Record<string, unknown>;
  const sub = (settings["subagents"] ?? {}) as Record<string, unknown>;
  const enabled = sub["enabled"] !== false;
  const rawAuto = sub["auto"];
  const auto: ActivationInputs["auto"] =
    rawAuto === "on" || rawAuto === "off" ? rawAuto : "ask";
  const host_manifest = resolveHostCapabilities(hostId, sub["host_capabilities"]);
  const downshift = sub["downshift"] !== false;
  return {
    activation: { enabled, auto, subagent_spawn: host_manifest.subagent_spawn },
    downshift,
    separate_quota_pool: host_manifest.separate_quota_pool,
  };
}

/**
 * Tier recommendation for the (not-yet-inspected) slices: `resolveSubagentRouting`'s
 * first production caller. Conservative "lite, downshifted" default — the
 * concern has no per-slice type classification available at prompt-submit
 * time, so it recommends the cheapest starting point and lets the downshift
 * setting (shipped default: on) decide whether that survives.
 */
export function recommendSliceTier(downshift: boolean, separate_quota_pool: boolean): Tier {
  const decision = resolveSubagentRouting({
    task_tier: "lite",
    session_tier: "high",
    downshift,
    quota_arbitrage: false,
    model_map: {},
    separate_quota_pool,
  });
  return decision.tier;
}

export function buildNudgeLine(
  classification: Classification,
  sliceCount: number,
  tier: Tier,
): string {
  const unit = sliceCount === 1 ? "slice" : "slices";
  return (
    `<delegation-nudge>classifyTask verdict for this prompt: ${classification.mode} ` +
    `(${sliceCount} ${unit}, ${tier} tier recommended). Consider dispatching via ` +
    `subagent-orchestration instead of doing every slice in-session — ` +
    `${classification.reason}.</delegation-nudge>`
  );
}

export interface NudgeResult {
  classification: Classification;
  sliceCount: number;
  tier: Tier;
}

/**
 * Full pipeline: prompt text + workspace root + host id → a positive nudge
 * verdict, or `null` when nothing should be injected (no signal, activation
 * gate closed, or an internal error — all three degrade to the same silent
 * outcome).
 */
export function classifyPrompt(
  prompt: string,
  workspace_root: string,
  hostId: string | null | undefined,
): NudgeResult | null {
  try {
    const { signals, sliceCountForLine } = extractTaskSignals(prompt);
    const { activation, downshift, separate_quota_pool } = resolveActivation(
      workspace_root,
      hostId,
    );
    const classification = classifyTask(signals, activation);
    if (classification.mode === null) {
      return null; // no enumerated signal, or the activation gate closed first
    }
    const tier = recommendSliceTier(downshift, separate_quota_pool);
    return { classification, sliceCount: sliceCountForLine, tier };
  } catch {
    return null; // classifier/settings error → silence, never a crash-to-block
  }
}

function _extractPrompt(payload: JsonObject): string {
  for (const key of ["prompt", "userPrompt", "user_prompt", "message", "text"]) {
    const v = payload[key];
    if (typeof v === "string" && v.trim()) {
      return v;
    }
  }
  return "";
}

function _workspaceRoot(envelope: JsonObject): string {
  const v = envelope["workspace_root"];
  if (typeof v === "string" && v) {
    return v;
  }
  return process.cwd();
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
  if (slot !== "user_prompt_submit") {
    return EXIT_ALLOW; // this concern only reads the submitted prompt
  }

  const payload = _isObject(env["payload"]) ? (env["payload"] as JsonObject) : env;
  const prompt = _extractPrompt(payload);
  if (!prompt) {
    return EXIT_ALLOW;
  }
  if (isSyntheticPrompt(prompt)) {
    return EXIT_ALLOW; // harness-generated turn, not a human-authored task
  }

  const root = _workspaceRoot(env);
  const platform = env["platform"];
  const hostId = typeof platform === "string" && platform ? platform : null;
  const result = classifyPrompt(prompt, root, hostId);
  if (!result) {
    return EXIT_ALLOW; // anti-canary default: no verdict → no output
  }

  process.stdout.write(
    `${JSON.stringify({
      decision: "warn",
      reason: `delegation-nudge: ${result.classification.mode} verdict (${result.sliceCount} slices, ${result.tier} tier)`,
      additional_context: buildNudgeLine(result.classification, result.sliceCount, result.tier),
    })}\n`,
  );
  return EXIT_WARN;
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url` (see cmd_migrate.ts).
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
