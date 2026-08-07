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
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { classify } from "./language_mirror_hook.js";
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

export interface ScanReport {
  scanned_at: string;
  store: string;
  sessions: number;
  totals: Record<string, number>;
  per_session: SessionReport[];
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

/** Default Claude Code transcript store for a project directory. */
export function defaultStore(projectDir: string): string {
  // Claude Code slugs BOTH separators and dots: /Users/x/.claude → -Users-x--claude.
  const slug = projectDir.replace(/[/.]/g, "-");
  return path.join(process.env["HOME"] ?? "", ".claude", "projects", slug);
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

  return {
    scanned_at: new Date().toISOString(),
    store,
    sessions: per_session.length,
    totals,
    per_session,
  };
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
