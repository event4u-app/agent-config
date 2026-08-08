#!/usr/bin/env node
/**
 * Behavioural conformance scan — replays the local transcript store through the
 * checks this suite MECHANISES, and nothing else.
 *
 * The scope constraint is the point, and it is a council ruling
 * (2026-08-06): *"a conformance scan that checks un-mechanised rules is
 * theatre — if you can't gate it, don't pretend measuring it post-hoc is
 * enforcement."* So this scan carries exactly four checks, one per shipped
 * gate, and every classifier is IMPORTED from the gate it measures rather than
 * re-implemented here. A second copy of a classifier is the "second artefact to
 * keep in sync" the repo's own principle forbids, and it would let the scan and
 * the gate disagree silently.
 *
 *   language-pin      ← language_mirror_hook.classify
 *   git-authorization ← git_authorization_hook.classifyAuthorization
 *                       + block_unauthorized_git.commandOp / BLOCK_OPS
 *   vacuous-evidence  ← before_complete_hook.isVacuousOutput / isCiPoll / pendingCount
 *   evidence-steering ← evidence_independence.isEvaluationPrompt / preloadedVerdict
 *
 * Deliberately NOT scanned: ask-shape, session-canary, promissory closings,
 * checkbox batching, symptom-vs-root-cause. Those are left as prose by
 * `road-to-agent-behavior-conformance`, and measuring them here would claim a
 * rigour the tree does not have.
 *
 * This is a REPORT, not a gate: exit 0 on every path except an unreadable
 * store. It answers "did the shipped gates have anything to bite on?" —
 * which is also the only honest way to find out whether they help.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { censusRuleDir } from "./_lib/carrier_divergence.js";

import { classify } from "./language_mirror_hook.js";
import { isSyntheticPrompt } from "./_lib/prompt_shape.js";
import { classifyAuthorization, type GitOp } from "./git_authorization_hook.js";
import { BLOCK_OPS, commandOp } from "./hooks/block_unauthorized_git.js";
import { isVacuousOutput, isCiPoll, pendingCount } from "./before_complete_hook.js";
import { isEvaluationPrompt, isSelfScoped, preloadedVerdict } from "./hooks/evidence_independence.js";

export interface Violation {
  check: "language-pin" | "git-authorization" | "vacuous-evidence" | "evidence-steering";
  session: string;
  at: string;
  detail: string;
  /**
   * Language-pin only. Assistant turns since the last genuine user prompt, and
   * whether a compaction boundary fell in between. Together they separate the
   * two failures the round-5 audit found hiding under one count: a pin that was
   * ABSENT because compaction removed it, and a pin that was PRESENT and
   * ignored. The first is a state defect; the second is non-compliance, and
   * only the second is unfixable by re-injection.
   */
  turns_since_prompt?: number;
  compaction_since_prompt?: boolean;
}

export interface SessionReport {
  session: string;
  user_turns: number;
  assistant_turns: number;
  violations: Violation[];
}

/**
 * Rule text reaching context, per carrier — round-6 Phase 4.3, and the
 * instrument the `essential` default-flip decision has been waiting on. Token
 * basis: chars/4, the same estimate `preamble_byte_census` and
 * `measure_scope_dedup` use, so the three numbers are comparable.
 *
 * MEASURED AT SCAN TIME, NOT PER SESSION — and the step asked for per-session.
 * The delivered payload is a property of the CARRIERS ON DISK, and the
 * transcript records none of it (verified in `preamble_byte_census`: a
 * transcript carries `message.usage` counts and response content, no system or
 * tools field). The carriers also change under the sessions — this round alone
 * added three rules and refreshed the global install. So attaching today's
 * figure to a session from three weeks ago would be a fabrication dressed as a
 * per-session measurement, and the honest shape is one reading per scan run
 * plus the forward series 4.5 records. That correction is why 4.3 and 4.5 are
 * one mechanism rather than two.
 */
export interface DeliveredPayload {
  project: { dir: string; files: number; tokens: number };
  global: { dir: string; files: number; tokens: number };
  /** What a machine carrying BOTH carriers pays — the figure M5 compared across projects. */
  union_tokens: number;
}

/**
 * The band M5 observed across the only three stores with a corpus worth
 * measuring (`private/capisco` 39.2 %, this package 25.4 %,
 * `private/agent-switch` 9.1 %). Both council members independently named the
 * same falsifier for cancelling the volume test: **a fourth project falling
 * outside this band**. It is a constant here, with its source, because a
 * falsifier nobody can evaluate is not one.
 */
export const OBSERVED_BAND = { low: 9.1, high: 39.2 } as const;

/**
 * The smallest corpus the band was derived from — `private/capisco`, 1 978
 * assistant turns. NOT a chosen threshold: a rate computed over materially fewer
 * turns is not comparable to the three that defined the band, and declaring it
 * out-of-band would fire the falsifier on corpus size rather than on behaviour.
 *
 * The first run of this instrument proved the point: the worktree's own store
 * read 4.1 % over 606 turns and would have announced the falsifier on its second
 * day of existence.
 */
export const BAND_MIN_TURNS = 1978;

export type BandVerdict = "inside" | "outside" | "corpus-too-small";

/** Round-6 Phase 4.5 — the forward-capture record for one scan run. */
export interface RateRecord {
  /** Not the store path: a stable digest of it. See `storeKey`. */
  store_key: string;
  sessions: number;
  assistant_turns: number;
  language_pin: number;
  rate_pct: number;
  /** `outside` is the falsifier firing; `corpus-too-small` is not a reading. */
  band: BandVerdict;
  delivered_project_tokens: number;
  delivered_global_tokens: number;
}

export function bandVerdict(rate_pct: number, assistant_turns: number): BandVerdict {
  if (assistant_turns < BAND_MIN_TURNS) {
    return "corpus-too-small";
  }
  return rate_pct >= OBSERVED_BAND.low && rate_pct <= OBSERVED_BAND.high ? "inside" : "outside";
}

export interface ScanReport {
  scanned_at: string;
  store: string;
  sessions: number;
  totals: Record<string, number>;
  per_session: SessionReport[];
  delivered: DeliveredPayload;
  rate: RateRecord;
}

type Entry = Record<string, unknown>;

function _isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Text of a user-role entry, or null when it is not a real chat message. */
export function userText(entry: Entry): string | null {
  if (entry["type"] !== "user" || entry["isSidechain"] === true) {
    return null;
  }
  const msg = entry["message"];
  const content = _isObject(msg) ? msg["content"] : undefined;
  let text = "";
  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    text = content
      .filter((b) => _isObject(b) && b["type"] === "text")
      .map((b) => String((b as Record<string, unknown>)["text"] ?? ""))
      .join("\n");
  }
  if (!text.trim()) {
    return null;
  }
  if (text.includes("<system-reminder>") || text.startsWith("<local-command-stdout>")) {
    return null;
  }
  return text;
}

/** Assistant prose, or null. */
export function assistantText(entry: Entry): string | null {
  if (entry["type"] !== "assistant" || entry["isSidechain"] === true) {
    return null;
  }
  const msg = entry["message"];
  const content = _isObject(msg) ? msg["content"] : undefined;
  if (!Array.isArray(content)) {
    return null;
  }
  const text = content
    .filter((b) => _isObject(b) && b["type"] === "text")
    .map((b) => String((b as Record<string, unknown>)["text"] ?? ""))
    .join("\n")
    .trim();
  return text || null;
}

/** Tool-use blocks from an assistant entry. */
function toolUses(entry: Entry): Array<{ name: string; input: Record<string, unknown> }> {
  const msg = entry["message"];
  const content = _isObject(msg) ? msg["content"] : undefined;
  if (!Array.isArray(content)) {
    return [];
  }
  return content
    .filter((b) => _isObject(b) && b["type"] === "tool_use")
    .map((b) => {
      const o = b as Record<string, unknown>;
      return {
        name: String(o["name"] ?? ""),
        input: _isObject(o["input"]) ? (o["input"] as Record<string, unknown>) : {},
      };
    });
}

/**
 * A skill / slash-command body arriving in the user role. This is the
 * transcript shape that made the language defect invisible: it occupies the
 * user role but is not a chat message, so it must never become the language
 * trigger — the same reason `language_mirror_hook` pins at prompt-submit time.
 */
export function isInjectedBody(text: string): boolean {
  if (/^(Base directory for this skill|<command-message>|<command-name>|<local-command)/.test(text)) {
    return true;
  }
  return text.length > 2500 && classify(text).language === "en";
}

/**
 * Harness-generated text that occupies an assistant turn but is not the
 * assistant writing. Round-2 self-scan: 8 of 9 "violations" in one session were
 * `API Error: 529 Overloaded` retry banners. Counting the harness as the model
 * inflates the very number this scan exists to report honestly.
 */
const HARNESS_TEXT =
  /^(API Error:|Request (timed out|was aborted)|\[Request interrupted|Error: |Credit balance is too low|You've hit your|Prompt is too long)/i;

/** Rough English-opener test for the language check (first prose line only). */
const EN_OPENER =
  /^(let me|i'?ll |i'?m |found it|ok[,. ]|okay|alright|here'?s|now[,. ]|looking|checking|reading|running|the |this |that |there |we |you |good |right[,. ]|perfect|done[.,]|all |confirmed|correct)/i;

export function scanSession(sessionId: string, lines: string[]): SessionReport {
  const report: SessionReport = {
    session: sessionId,
    user_turns: 0,
    assistant_turns: 0,
    violations: [],
  };

  let pinned: "de" | "en" | null = null;
  let pendingPoll: { at: string; cmd: string } | null = null;
  let authorized = new Set<GitOp>();
  let sawPending = false;
  let evaluationsThisTurn = 0;
  // Round-5 provenance for language violations. The round-5 audit could only
  // separate "the pin was absent" from "the pin was ignored" by reconstructing
  // both facts from the raw store afterwards; recording them here is what makes
  // that split reproducible against a future corpus instead of re-argued.
  let turnsSincePrompt = 0;
  let compactionSincePrompt = false;

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    let entry: Entry;
    try {
      entry = JSON.parse(line) as Entry;
    } catch {
      continue;
    }

    // Tool results arrive as `user` entries carrying `toolUseResult`.
    if (entry["type"] === "user" && entry["toolUseResult"] !== undefined && pendingPoll !== null) {
      const raw = entry["toolUseResult"];
      const out = typeof raw === "string" ? raw : JSON.stringify(raw);
      const pending = pendingCount(out);
      if (pending !== null && pending > 0) {
        sawPending = true;
      } else if (isVacuousOutput(out) || (pending === 0 && !sawPending)) {
        report.violations.push({
          check: "vacuous-evidence",
          session: sessionId,
          at: pendingPoll.at,
          detail: `CI poll read as settled without an in-flight observation: ${out.slice(0, 90)}`,
        });
      }
      pendingPoll = null;
      continue;
    }

    // A compaction boundary removes context the pin lived in. It is not a turn
    // and it is not a prompt, but it changes what the model can still see — so
    // it is recorded, not skipped silently.
    if (entry["type"] === "system" && entry["subtype"] === "compact_boundary") {
      compactionSincePrompt = true;
      continue;
    }

    const ut = userText(entry);
    if (ut !== null) {
      // A compaction SUMMARY arrives as a `user` entry. Treating it as a chat
      // message would let its language reset the pin — the exact defect class
      // that made the first detector report 303 instead of 626.
      if (entry["isCompactSummary"] === true) {
        continue;
      }
      // A harness-generated turn is not a chat message. The HOOK has skipped
      // these since round 5 and this scanner did not, so the two were measuring
      // different populations while reporting one number. Same predicate, one
      // module, so they cannot drift again.
      if (isSyntheticPrompt(ut)) {
        continue;
      }
      if (isInjectedBody(ut)) {
        // Not a chat message — it changes neither the pin nor the ledger.
        continue;
      }
      report.user_turns += 1;
      turnsSincePrompt = 0;
      compactionSincePrompt = false;
      const c = classify(ut);
      if (c.language !== "und") {
        pinned = c.language;
      }
      authorized = new Set(classifyAuthorization(ut).authorized);
      sawPending = false;
      evaluationsThisTurn = 0;
      pendingPoll = null;
      continue;
    }

    if (entry["type"] !== "assistant" || entry["isSidechain"] === true) {
      continue;
    }
    const at = String(entry["timestamp"] ?? "");

    const prose = assistantText(entry);
    if (prose !== null) {
      report.assistant_turns += 1;
      turnsSincePrompt += 1;
      if (pinned === "de") {
        const first = prose.split("\n").find((l) => l.trim()) ?? "";
        if (HARNESS_TEXT.test(first.trim())) {
          continue; // harness banner, not the assistant's prose
        }
        const c = classify(first);
        if (first.length > 12 && (c.language === "en" || EN_OPENER.test(first.trim()))) {
          report.violations.push({
            check: "language-pin",
            session: sessionId,
            at,
            detail: `German pin, English reply opener: "${first.slice(0, 110)}"`,
            turns_since_prompt: turnsSincePrompt,
            compaction_since_prompt: compactionSincePrompt,
          });
        }
      }
    }

    for (const tu of toolUses(entry)) {
      const cmd =
        typeof tu.input["command"] === "string" ? (tu.input["command"] as string) : null;
      if (cmd !== null) {
        const op = commandOp(cmd);
        if (op !== null && !authorized.has(op) && BLOCK_OPS.has(op)) {
          report.violations.push({
            check: "git-authorization",
            session: sessionId,
            at,
            detail: `irreversible \`${op}\` with no authorization in the turn's prompt: ${cmd.slice(0, 110)}`,
          });
        }
        if (isCiPoll(cmd)) {
          // The RESULT of this call arrives on the NEXT entry, and that entry is
          // role `user` — not assistant. The first version read
          // `entry["toolUseResult"]` off the assistant entry, where it never
          // exists: measured on a 20 MB transcript, 1913 entries carry the key
          // and all 1913 are `user`. So this check could not fire at all and the
          // scan printed a permanent `✅ vacuous-evidence 0` — a false green in
          // the one report whose job is to say whether the gates bite.
          pendingPoll = { at, cmd };
        }
      }

      const prompt =
        typeof tu.input["prompt"] === "string" ? (tu.input["prompt"] as string) : null;
      if (prompt !== null && isEvaluationPrompt(prompt)) {
        const preloaded = preloadedVerdict(prompt);
        if (preloaded !== null) {
          report.violations.push({
            check: "evidence-steering",
            session: sessionId,
            at,
            detail: `evaluation prompt pre-loads its verdict: "${preloaded}"`,
          });
        } else if (isSelfScoped(prompt)) {
          if (evaluationsThisTurn >= 1) {
            report.violations.push({
              check: "evidence-steering",
              session: sessionId,
              at,
              detail: "second self-review dispatch in one turn (verdict shopping)",
            });
          }
          evaluationsThisTurn += 1;
        }
      }
    }
  }

  return report;
}

/**
 * Where `--record` appends by default. Under the gitignored `agents/runtime/`
 * because the series is per-machine observation, and committing it would publish
 * the project set `storeKey` exists to hide.
 */
export const DEFAULT_RATE_SERIES = path.join("agents", "runtime", "state", "conformance-rates.jsonl");

/** Default Claude Code transcript store for a project directory. */
export function defaultStore(projectDir: string): string {
  // Claude Code slugs BOTH separators and dots: /Users/x/.claude → -Users-x--claude.
  const slug = projectDir.replace(/[/.]/g, "-");
  return path.join(process.env["HOME"] ?? "", ".claude", "projects", slug);
}

/** chars/4, the estimate every other payload measurement in this repo uses. */
function _tokens(chars: number): number {
  return Math.round(chars / 4);
}

/**
 * Measure what each carrier delivers. Defaults are the two real carriers; both
 * are injectable so a test never reads the developer's home.
 */
export function measureDelivered(projectRulesDir: string, globalRulesDir: string): DeliveredPayload {
  const p = censusRuleDir(projectRulesDir);
  const g = censusRuleDir(globalRulesDir);
  return {
    project: { dir: projectRulesDir, files: p.files, tokens: _tokens(p.chars) },
    global: { dir: globalRulesDir, files: g.files, tokens: _tokens(g.chars) },
    union_tokens: _tokens(p.chars + g.chars),
  };
}

/**
 * A stable, non-reversible key for a store — NEVER the path.
 *
 * The store path is `-Users-<realname>-projects-<client>-…`: a real name, a
 * directory layout, and often a customer identifier. `domain-safety-pii` §
 * Surface 3 forbids exporting a direct identifier and
 * `low-impact-corpus-privacy-floor` names project-rooted paths outright, so the
 * forward series is keyed on a digest. It still answers the only question 4.5
 * asks of it — "is this the same project as last time, and is a FOURTH one
 * outside the band" — because equality and novelty survive hashing while the
 * identity does not.
 */
export function storeKey(store: string): string {
  return createHash("sha256").update(path.resolve(store)).digest("hex").slice(0, 12);
}

export function scanStore(store: string, limit: number): ScanReport {
  const files = fs
    .readdirSync(store)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => ({ f, m: fs.statSync(path.join(store, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m)
    .slice(0, limit)
    .map((x) => x.f);

  const per_session: SessionReport[] = [];
  for (const f of files) {
    const lines = fs.readFileSync(path.join(store, f), "utf8").split("\n");
    const r = scanSession(f.replace(/\.jsonl$/, "").slice(0, 8), lines);
    if (r.assistant_turns > 0) {
      per_session.push(r);
    }
  }

  const totals: Record<string, number> = {
    "language-pin": 0,
    "git-authorization": 0,
    "vacuous-evidence": 0,
    "evidence-steering": 0,
  };
  for (const s of per_session) {
    for (const v of s.violations) {
      totals[v.check] = (totals[v.check] ?? 0) + 1;
    }
  }

  const assistant_turns = per_session.reduce((n, s) => n + s.assistant_turns, 0);
  const language_pin = totals["language-pin"] ?? 0;
  const rate_pct = assistant_turns === 0 ? 0 : (100 * language_pin) / assistant_turns;
  const delivered = measureDelivered(
    path.join(process.cwd(), ".claude", "rules"),
    path.join(process.env["HOME"] ?? os.homedir(), ".claude", "rules"),
  );

  return {
    scanned_at: new Date().toISOString(),
    store,
    sessions: per_session.length,
    totals,
    per_session,
    delivered,
    rate: {
      store_key: storeKey(store),
      sessions: per_session.length,
      assistant_turns,
      language_pin,
      rate_pct: Number(rate_pct.toFixed(1)),
      band: bandVerdict(rate_pct, assistant_turns),
      delivered_project_tokens: delivered.project.tokens,
      delivered_global_tokens: delivered.global.tokens,
    },
  };
}

/**
 * Append one scan's rate record — round-6 Phase 4.5's forward capture.
 *
 * PII-exclusion-by-construction, the shape `artifact-engagement-recording`
 * applies to telemetry: `RateRecord` has NO field able to hold a path, a prompt,
 * a session id, or any free text, so there is no scrubber here that could fail.
 * Keep it that way — never widen it with a `note` or `extra`.
 *
 * Default destination is under the gitignored `agents/runtime/`, because the
 * series is per-machine observation and committing it would publish the very
 * project set the key exists to hide.
 */
export function recordRate(file: string, scanned_at: string, rate: RateRecord): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify({ measured_at: scanned_at, ...rate })}\n`, "utf8");
}

export function render(report: ScanReport): string {
  const lines: string[] = [];
  lines.push(`conformance:behavior · ${report.sessions} session(s) · ${report.store}`);
  for (const [k, v] of Object.entries(report.totals)) {
    lines.push(`  ${v === 0 ? "✅" : "⚠️ "} ${k.padEnd(18)} ${v}`);
  }
  const worst = [...report.per_session]
    .filter((s) => s.violations.length > 0)
    .sort((a, b) => b.violations.length - a.violations.length)
    .slice(0, 5);
  if (worst.length > 0) {
    lines.push("");
    lines.push("  Highest-violation sessions:");
    for (const s of worst) {
      lines.push(`    ${s.session}  ${s.violations.length} across ${s.assistant_turns} turns`);
    }
  }
  const d = report.delivered;
  lines.push("");
  lines.push("  Delivered rule text (chars/4, carriers as they stand NOW — not per-session):");
  lines.push(`    project  ${String(d.project.files).padStart(4)} rules  ${String(d.project.tokens).padStart(7)} tok`);
  lines.push(`    global   ${String(d.global.files).padStart(4)} rules  ${String(d.global.tokens).padStart(7)} tok`);
  lines.push(`    union                  ${String(d.union_tokens).padStart(7)} tok`);
  lines.push("    A session's own payload is NOT recoverable: the transcript records no system");
  lines.push("    or tools field, and the carriers change under the sessions. This is one");
  lines.push("    reading; the series below is what makes it interpretable over time.");
  lines.push("");
  lines.push(
    `  language-pin rate  ${report.rate.rate_pct.toFixed(1)}%  ` +
      `(${report.rate.language_pin} of ${report.rate.assistant_turns} assistant turns)`,
  );
  if (report.rate.band === "corpus-too-small") {
    lines.push(
      `    Not compared: ${report.rate.assistant_turns} turns is below the ${BAND_MIN_TURNS} of the`,
    );
    lines.push("    smallest corpus the band was derived from, so a verdict here would be about");
    lines.push("    corpus size, not behaviour.");
  } else if (report.rate.band === "inside") {
    lines.push(
      `    Inside the observed ${OBSERVED_BAND.low}-${OBSERVED_BAND.high}% band (M5, n=3).`,
    );
  } else {
    lines.push(
      `    ⚠️  OUTSIDE the observed ${OBSERVED_BAND.low}-${OBSERVED_BAND.high}% band (M5, n=3).`,
    );
    lines.push("    This is the falsifier both council members named when the volume test was");
    lines.push("    cancelled: a project outside the band is the signal that the cancellation");
    lines.push("    was wrong. It is a reason to look, not a defect in this run.");
    lines.push("    CHECK FIRST that this is a different PROJECT: a git worktree gets its own");
    lines.push("    transcript store under the same project, so a store-keyed series counts it");
    lines.push("    as new. Store novelty is not project novelty.");
  }
  lines.push("");
  lines.push("  Scanned checks are exactly the mechanised ones. Ask-shape, session-canary,");
  lines.push("  promissory closings and checkbox batching are left as prose and NOT measured.");
  return lines.join("\n");
}

export function main(argv?: string[]): number {
  const args = argv ?? process.argv.slice(2);
  let store: string | null = null;
  let limit = 30;
  let json = false;
  let out: string | null = null;
  let record: string | null = null;
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--store" && args[i + 1] !== undefined) {
      store = args[++i] as string;
    } else if (a === "--limit" && args[i + 1] !== undefined) {
      limit = Number(args[++i]);
    } else if (a === "--json") {
      json = true;
    } else if (a === "--output" && args[i + 1] !== undefined) {
      out = args[++i] as string;
    } else if (a === "--record") {
      // Opt-in, and a bare `--record` takes the default path rather than
      // swallowing the next flag as a filename.
      record =
        args[i + 1] !== undefined && !(args[i + 1] as string).startsWith("-")
          ? (args[++i] as string)
          : DEFAULT_RATE_SERIES;
    }
  }
  const resolved = store ?? defaultStore(process.cwd());
  if (!fs.existsSync(resolved)) {
    process.stderr.write(`conformance:behavior: no transcript store at ${resolved}\n`);
    return 1;
  }
  const report = scanStore(resolved, Number.isFinite(limit) && limit > 0 ? limit : 30);
  if (out) {
    fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  if (record) {
    recordRate(record, report.scanned_at, report.rate);
  }
  // fs.writeSync, not process.stdout.write: `process.exit()` below does not
  // flush an async pipe write, so `--json | jq` reproducibly received a
  // truncated 64 KB document with no error (measured: 85,169 vs 65,536 bytes).
  fs.writeSync(1, json ? `${JSON.stringify(report, null, 2)}\n` : `${render(report)}\n`);
  return 0;
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
