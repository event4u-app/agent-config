#!/usr/bin/env node
/**
 * Behavioural conformance scan — replays the local transcript store through the
 * checks this suite MECHANISES, and nothing else.
 *
 * The scope constraint is the point, and it is a council ruling
 * (2026-08-06): *"a conformance scan that checks un-mechanised rules is
 * theatre — if you can't gate it, don't pretend measuring it post-hoc is
 * enforcement."* So every classifier is IMPORTED from the gate it measures
 * rather than re-implemented here. A second copy of a classifier is the "second
 * artefact to keep in sync" the repo's own principle forbids, and it would let
 * the scan and the gate disagree silently.
 *
 *   language-pin      ← language_mirror_hook.classify
 *   git-authorization ← git_authorization_hook.classifyAuthorization
 *                       + git_command_classifier.commandOp / BLOCK_OPS
 *   vacuous-evidence  ← before_complete_hook.isVacuousOutput / isCiPoll / pendingCount
 *   evidence-steering ← evidence_independence.isEvaluationPrompt / preloadedVerdict
 *   completion-claim  ← turn_end_gate_hook.detectCompletionClaim          (round 7)
 *   task-completeness ← delegation_nudge_hook.enumeratedFileTokens /
 *                       FILE_SIGNAL_FLOOR                                (below)
 *
 * The count was "exactly four checks, one per shipped gate" and both halves have
 * since moved, so both are stated plainly rather than left to rot: there are
 * SIX, and `task-completeness` is the one with NO gate behind it. That is not a
 * quiet exception to the council ruling — it is the ruling's own logic run
 * forwards. The ruling forbids presenting a post-hoc measurement AS enforcement;
 * this check exists to decide whether a refusal is warranted at all, before one
 * is built, because the alternative is a gate resting on an unmeasured premise.
 * The pre-registered bar it will be read against is committed BEFORE the number
 * (`road-to-completion-loop` Phase 2), and a published null — no gate — is an
 * accepted outcome. Nothing here claims the check enforces anything: this file
 * is a REPORT, as its exit contract below says.
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
import { projectStoreSlug } from "./_lib/cc_transcript.js";
import { entryText, isSidechain } from "./_lib/transcript_entry.js";

import { classify } from "./language_mirror_hook.js";
import { isSyntheticPrompt } from "./_lib/prompt_shape.js";
import { classifyAuthorization, type GitOp } from "./git_authorization_hook.js";
import { BLOCK_OPS, commandOp } from "./hooks/git_command_classifier.js";
import { isVacuousOutput, isCiPoll, pendingCount } from "./before_complete_hook.js";
// Round 7 § 1.5 — the SAME predicate `turn-end-gate` refuses on, imported rather
// than reimplemented, so the measured rate and the gate cannot disagree.
import { detectCompletionClaim } from "./hooks/turn_end_gate_hook.js";
import { isEvaluationPrompt, isSelfScoped, preloadedVerdict } from "./hooks/evidence_independence.js";
// Phase 1 of `road-to-completion-loop` — the SAME prompt-signal extraction the
// delegation nudge classifies on, so the measurement cannot see a different
// deliverable set than the classifier does.
import { enumeratedFileTokens, FILE_SIGNAL_FLOOR } from "./hooks/delegation_nudge_hook.js";

/**
 * This module's own repo root, NOT `process.cwd()`.
 *
 * Both the project carrier and the rate series are anchored here. Resolving them
 * against the cwd made a run from any subdirectory record
 * `delivered_project_tokens: 0` and append the series to a fresh
 * `agents/runtime/state/` tree at that location — outside the ignore rule whose
 * coverage the docstring claims, and silently splitting a series whose whole
 * point is comparability. Under the bundled CLI `import.meta.url` still resolves
 * inside the package, which is the tree whose rules are being measured.
 */
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export interface Violation {
  check:
    | "language-pin"
    | "git-authorization"
    | "vacuous-evidence"
    | "evidence-steering"
    | "completion-claim"
    | "task-completeness";
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
  /**
   * `task-completeness` only. The deliverable set's size, how many of it the
   * reply window touched, and the tokens it never touched.
   *
   * Structured rather than prose-only because 1.3 requires HAND-VALIDATING every
   * hit: a validator needs the exact missed tokens to open the window and decide
   * whether the omission was real or one of the legitimate shapes (a blocking
   * question, a hand-back, a user-fenced scope, an explicitly deferred item).
   * A count alone cannot be checked, which is the failure this field prevents.
   */
  enumerated?: number;
  addressed?: number;
  missed?: string[];
}

export interface SessionReport {
  session: string;
  user_turns: number;
  assistant_turns: number;
  violations: Violation[];
  /**
   * Round 7 § 6.2 — assistant turns that stood under a GERMAN pin, i.e. the only
   * turns on which `language-pin` can fire at all. The rate was published over
   * ALL assistant turns, which understates it by whatever fraction of a corpus is
   * English-pinned: measured on round 7's own corpus, 1 655 of 2 354 (70 %), and
   * the same 152 violations read 6.5 % on the old denominator and 9.2 % on this
   * one — enough to move the band verdict from OUTSIDE to INSIDE.
   */
  de_pin_turns: number;
  /** First entry timestamp, so a reader can era-split without a second pass. */
  first_at: string;
  /**
   * `task-completeness`'s DENOMINATOR: reply windows that met the file floor and
   * contained real assistant work, i.e. the windows on which the check could fire
   * at all.
   *
   * Counted here beside the numerator for the same reason `de_pin_turns` is — a
   * rate whose two halves are derived from different populations is the defect
   * round 7 § 6.2 found in the language figure, where the same 152 violations read
   * 6.5 % over all turns and 9.2 % over the eligible ones. Without this a hit
   * COUNT is all there is, and a count is not a rate.
   */
  completeness_windows: number;
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
  /**
   * `present` distinguishes a measured zero from a carrier that is not there.
   * Without it a run from the wrong directory records `tokens: 0`, halves
   * `union_tokens`, and persists a record indistinguishable from a real reading
   * into a series whose entire purpose is comparability over time. The sibling
   * `report_carrier_divergence` carries the same flag and refuses to substitute a
   * different tree; this is the same refusal.
   */
  project: { dir: string; present: boolean; files: number; tokens: number };
  global: { dir: string; present: boolean; files: number; tokens: number };
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

export type BandVerdict = "inside" | "outside" | "corpus-too-small" | "era-spanning";

/** Round-6 Phase 4.5 — the forward-capture record for one scan run. */
export interface RateRecord {
  /** Not the store path: a stable digest of it. See `storeKey`. */
  store_key: string;
  sessions: number;
  assistant_turns: number;
  language_pin: number;
  rate_pct: number;
  /**
   * Round 7 § 6.2 / 6.1 — OPTIONAL, and not for convenience.
   *
   * `--record` appends one line per run to a series whose whole purpose is
   * comparability over time, and every line written before round 7 carries none
   * of these four. Declaring them required would make the type say something
   * false about the records on disk, and the renderer already reads them
   * defensively for exactly that reason. `analyse()` always populates them, so a
   * fresh run is never partial — the optionality describes the archive, not the
   * producer.
   */
  de_pin_turns?: number;
  /** The same numerator over `de_pin_turns`. Reported beside `rate_pct`, never instead. */
  rate_pct_de_pin?: number;
  /**
   * `task-completeness`'s two halves, optional for the same archive reason as the
   * four above: no line written before this check existed carries them.
   *
   * The rate is over WINDOWS, not turns or sessions — the only denominator on
   * which the check can fire — and it is persisted beside the count so a later
   * reader cannot mistake a hit count for a rate.
   */
  completeness_windows?: number;
  task_completeness?: number;
  task_completeness_rate_pct?: number;
  /** The corpus straddles a carrier landing, so no band verdict. */
  era_spanning?: boolean;
  /** Which carrier, when `era_spanning` — empty otherwise. */
  era_reason?: string;
  /**
   * `outside` is the falsifier firing; `corpus-too-small` and `era-spanning` are
   * not readings — the first is about corpus size, the second about the corpus
   * containing two different systems.
   */
  band: BandVerdict;
  /**
   * `null` when the scanned store is NOT this repo's own — `measureDelivered` is
   * always anchored on this checkout, so pairing another project's rate with
   * these tokens would persist a figure that belongs to neither. Cross-project
   * `--record` is exactly the use 4.5 exists for, so the mismatch would have been
   * the common case rather than an edge one.
   */
  delivered_project_tokens: number | null;
  delivered_global_tokens: number | null;
}

/**
 * Round 7 § 6.1 — dates on which a carrier for a mechanised check LANDED.
 *
 * A rate pooled across one of these is not a reading about behaviour; it is a
 * weighted average of two different systems. The band's falsifier is "a fourth
 * PROJECT outside the band", and on round 7's first run it fired on the project
 * that helped DEFINE the band — because the corpus straddled the language-pin
 * carrier. 23.1 % before it, 0.0 % after, 6.5 % pooled, and the pooled figure was
 * announced as the falsifier.
 *
 * Declared as data with provenance rather than inferred: nothing in a transcript
 * records which carriers were bound while it was written.
 */
export const CARRIER_CHANGES: readonly { at: string; what: string }[] = [
  { at: "2026-08-07T00:00:00Z", what: "language-pin bound on user_prompt_submit (round 5)" },
];

/** True when the corpus spans a carrier change, i.e. two systems in one average. */
export function spansCarrierChange(firstAts: readonly string[]): { spans: boolean; what: string } {
  const stamps = firstAts.filter((s) => s !== "").sort();
  if (stamps.length === 0) {
    return { spans: false, what: "" };
  }
  const lo = stamps[0] as string;
  const hi = stamps[stamps.length - 1] as string;
  for (const c of CARRIER_CHANGES) {
    if (lo < c.at && hi >= c.at) {
      return { spans: true, what: c.what };
    }
  }
  return { spans: false, what: "" };
}

export function bandVerdict(
  rate_pct: number,
  assistant_turns: number,
  opts: { spansCarrier?: boolean } = {},
): BandVerdict {
  // The era guard is checked FIRST and for the same reason the turn floor is: a
  // verdict about corpus shape must not be reported as a verdict about behaviour.
  if (opts.spansCarrier === true) {
    return "era-spanning";
  }
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

export type CheckId = Violation["check"];

export const CHECK_IDS: readonly CheckId[] = [
  "language-pin",
  "git-authorization",
  "vacuous-evidence",
  "evidence-steering",
  "completion-claim",
  "task-completeness",
];

/**
 * What each mechanised check actually detects, in the words a reader needs in
 * order to decide whether a hit is a defect or a false read. `--why` prints
 * this ALONGSIDE the hits rather than instead of them: a count with no
 * definition is the shape that let a figure like "109 divergent pairs" travel
 * through five reviews unchallenged.
 */
export const CHECK_MEANINGS: Record<CheckId, string> = {
  "language-pin":
    "An assistant turn whose user-visible prose is not in the language that " +
    "turn's own pin named. Carries provenance (turns_since_prompt, " +
    "compaction_since_prompt) so a pin that was ABSENT because compaction " +
    "removed it stays distinguishable from one that was present and ignored.",
  "git-authorization":
    "A gated git operation performed in a session where no authorization for " +
    "that operation was observed. Authorization is per-operation and never " +
    "carries from one to the next.",
  "vacuous-evidence":
    "A CI poll read as settled without ever observing an in-flight run — the " +
    "poll gap that reports a green settle over a window in which nothing was " +
    "pending yet.",
  "evidence-steering":
    "A self-commissioned evaluation whose prompt pre-loaded its own verdict, " +
    "or a second self-scoped evaluation of the same subject within one turn.",
  "completion-claim":
    "An assistant turn claiming the work is complete while the last CI read in " +
    "that session was NOT settled. Round 7 measured 14 instances by reading, " +
    "each followed by the user handing the work back; this is the same " +
    "predicate `turn-end-gate`'s completion detector refuses on, so the rate " +
    "and the gate cannot disagree. A session that never polled CI can never hit.",
  "task-completeness":
    "A reply window that left at least one file the prompt ENUMERATED " +
    "untouched — the token appears in neither any tool-call input nor any " +
    "assistant prose before the next user prompt. Scope is deliberately narrow: " +
    `only prompts naming >= ${FILE_SIGNAL_FLOOR} distinct file tokens are ` +
    "measured, the same floor `delegation_nudge_hook` uses for its FILE shape, " +
    "and the token list comes from that module rather than a second regex.\n" +
    "    What distinguishes a hit from a false read: a hit is EVIDENCE OF AN " +
    "OMISSION, not proof of one. Four legitimate shapes produce the same " +
    "signature and are NOT excluded here — a blocking question, a hand-back, a " +
    "user-fenced scope, and an explicitly deferred item all address fewer files " +
    "than the prompt named, correctly. That is why every hit is hand-validated " +
    "and a precision is published beside the rate; an unvalidated count from " +
    "this check means nothing.\n" +
    "    What it cannot see, stated so a zero is not misread as health: the " +
    "ordered-plan, explicit-count, for-each and conjunction shapes name a " +
    "COUNT of deliverables but not their identities, so this check is blind to " +
    "them by construction — it does not score them complete, it does not score " +
    "them at all. A prose deliverable that is not a filename is invisible to it.\n" +
    "    MEASURED PRECISION: 0 of 3 hits, over 4 eligible windows in 28 sessions " +
    "(2026-08-12). All three were false positives from ONE extraction defect: the " +
    "token list is taken from the whole prompt, so files quoted inside material " +
    "the user PASTED — a review, a log, an example — read as deliverables. In all " +
    "three, the user's own ask contributed zero tokens. `isInjectedBody` did not " +
    "filter them because it only excludes long ENGLISH text, and this corpus is " +
    "mostly German (12 295 and 7 656 chars, both classified `de`, both passed); " +
    "the one English case missed the 2 500-char cut by 12. So a hit here is not " +
    "evidence of anything until the ask is separated from the pasted material. " +
    "Detector D was NOT built on this result — see " +
    "`agents/evidence/analysis/task-completeness-measurement.md`.",
};

/**
 * `--why <id>` — trace one conformance id: what it detects, whether it fired in
 * this window, and every hit with its session and detail.
 *
 * A check that did not fire prints as *did not fire*, never as silence. Zero is
 * a real answer, and the difference between "clean" and "not measured" is the
 * whole reason to print it.
 */
export function renderWhy(report: ScanReport, id: CheckId): string {
  const hits = report.per_session.flatMap((s) => s.violations.filter((v) => v.check === id));
  const lines: string[] = [
    `conformance:why · ${id} · ${report.sessions} session(s) · ${report.store}`,
    "",
    "  What it detects:",
    `    ${CHECK_MEANINGS[id]}`,
    "",
  ];
  if (hits.length === 0) {
    lines.push(`  Did NOT fire in this window (0 hits over ${report.sessions} session(s)).`);
    lines.push("  A measured zero, not an unmeasured one — the check ran.");
    return lines.join("\n");
  }
  lines.push(`  Fired ${hits.length} time(s):`);
  for (const v of hits) {
    lines.push(`    · ${v.session} @ ${v.at}`);
    lines.push(`      ${v.detail}`);
    const since = (v as { turns_since_prompt?: number }).turns_since_prompt;
    const compacted = (v as { compaction_since_prompt?: boolean }).compaction_since_prompt;
    if (since !== undefined || compacted !== undefined) {
      lines.push(
        `      provenance: turns_since_prompt=${since ?? "—"} · ` +
          `compaction_since_prompt=${compacted ?? "—"}`,
      );
    }
    // `task-completeness` provenance. Printed as its own line because 1.3
    // requires hand-validating every hit, and a validator needs the missed
    // tokens verbatim — not a truncated detail string.
    const missed = (v as { missed?: string[] }).missed;
    if (missed !== undefined) {
      const enumerated = (v as { enumerated?: number }).enumerated;
      const addressed = (v as { addressed?: number }).addressed;
      lines.push(
        `      provenance: enumerated=${enumerated ?? "—"} · ` +
          `addressed=${addressed ?? "—"} · missed=[${missed.join(", ")}]`,
      );
    }
  }
  return lines.join("\n");
}

type Entry = Record<string, unknown>;

function _isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Text of a user-role entry, or null when it is not a real chat message. */
export function userText(entry: Entry): string | null {
  if (entry["type"] !== "user" || isSidechain(entry)) {
    return null;
  }
  // Shape handling moved to `_lib/transcript_entry.ts` so a second reader of the
  // same field cannot get it wrong. It already did once, in this branch: a
  // string-only reader saw 0 of the 41 injected skill bodies in this store,
  // because they all arrive as content blocks.
  const text = entryText(entry);
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
  if (entry["type"] !== "assistant" || isSidechain(entry)) {
    return null;
  }
  return entryText(entry).trim() || null;
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
// Exported since round 7 § 6.3: `probe_session_canary` needs the SAME predicate,
// and its first version had its own copy that omitted `You've hit your` — which
// turned a spend-limit banner into a missed greeting and reported 24/28 for a
// corpus that is 25/28.
export const HARNESS_TEXT =
  /^(API Error:|Request (timed out|was aborted)|\[Request interrupted|Error: |Credit balance is too low|You've hit your|Prompt is too long)/i;

/** Rough English-opener test for the language check (first prose line only). */
const EN_OPENER =
  /^(let me|i'?ll |i'?m |found it|ok[,. ]|okay|alright|here'?s|now[,. ]|looking|checking|reading|running|the |this |that |there |we |you |good |right[,. ]|perfect|done[.,]|all |confirmed|correct)/i;

/**
 * One prompt's reply window, for the `task-completeness` check.
 *
 * A "turn" in this store is one ENTRY, and a single reply spans several of them
 * (one prose entry plus one per tool call). Scoring per entry would report every
 * tool-call entry as incomplete, so the unit is the window from a counted user
 * prompt to the next one — which is what step 1.1's "the turn's own user prompt"
 * means in the transcript's actual shape. The departure is recorded rather than
 * silently taken.
 */
export interface CompletenessWindow {
  /** The PROMPT's timestamp, not an assistant entry's: it is where a validator opens the window. */
  at: string;
  tokens: string[];
  addressed: Set<string>;
  /**
   * The window contained at least one assistant prose entry or tool call.
   *
   * An empty window is a truncated or abandoned session, not an omission — and
   * counting it would make the rate a measure of how often a store ends
   * mid-reply. That is the "detector reproduces the defect it measures" trap
   * this check's own risk register names.
   */
  worked: boolean;
}

/** Mark every deliverable token this text mentions as addressed. */
export function markAddressed(text: string, w: CompletenessWindow): void {
  if (w.tokens.length === 0) {
    return;
  }
  const hay = text.toLowerCase();
  for (const t of w.tokens) {
    if (!w.addressed.has(t) && hay.includes(t)) {
      w.addressed.add(t);
    }
  }
}

/** The window's verdict: the untouched tokens, or `null` for no finding. */
export function evaluateWindow(w: CompletenessWindow): { missed: string[] } | null {
  if (!w.worked || w.tokens.length === 0) {
    return null;
  }
  const missed = w.tokens.filter((t) => !w.addressed.has(t));
  return missed.length > 0 ? { missed } : null;
}

export function scanSession(sessionId: string, lines: string[]): SessionReport {
  const report: SessionReport = {
    session: sessionId,
    user_turns: 0,
    assistant_turns: 0,
    violations: [],
    de_pin_turns: 0,
    first_at: "",
    completeness_windows: 0,
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
  // Round 7 § 1.5 — session-scoped, deliberately NOT reset per prompt: the
  // measured failure is a completion claim in a LATER turn than the poll.
  let ciSeen = false;
  let ciSettled = false;
  // Phase 1 of `road-to-completion-loop` — the open reply window, or null when
  // the last prompt named no deliverable set worth scoring.
  let openWindow: CompletenessWindow | null = null;

  /**
   * Close the open window and record a finding if anything went untouched.
   * Called on the NEXT counted prompt and once after the loop — a window left
   * open at end-of-file is the most common shape in a live store and dropping it
   * would silently bias the rate toward long sessions.
   */
  const closeWindow = (): void => {
    if (openWindow === null) {
      return;
    }
    // The denominator counts windows the check COULD fire on. A window with no
    // assistant work is excluded from both halves — `evaluateWindow` already
    // refuses to score it, and counting it below while never counting it above
    // would deflate the rate by however often a store ends mid-reply.
    if (openWindow.worked) {
      report.completeness_windows += 1;
    }
    const verdict = evaluateWindow(openWindow);
    if (verdict !== null) {
      const addressed = openWindow.tokens.length - verdict.missed.length;
      report.violations.push({
        check: "task-completeness",
        session: sessionId,
        at: openWindow.at,
        detail:
          `prompt enumerated ${openWindow.tokens.length} file(s), reply window touched ` +
          `${addressed}; untouched: ${verdict.missed.join(", ").slice(0, 160)}`,
        enumerated: openWindow.tokens.length,
        addressed,
        missed: verdict.missed,
      });
    }
    openWindow = null;
  };

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
    // Round 7 § 6.1 — captured for the era guard. The FIRST timestamp in the
    // file, not the file mtime: mtime moves when a session is resumed, which
    // would put a July session in the August era.
    if (report.first_at === "" && typeof entry["timestamp"] === "string") {
      report.first_at = entry["timestamp"];
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
      // Round 7 § 1.5 — the session-scoped CI-settle state the completion-claim
      // check reads. R2 finding 3: this copied `pending === 0` AND the wrong
      // comment claiming it matched the producer's discrimination. It did not —
      // a stale all-pass table read as a settle and silenced the check. The
      // in-flight witness is required here too, so the measurement and the gate
      // agree on what a settle is.
      ciSeen = true;
      ciSettled = pending === 0 && sawPending && !isVacuousOutput(out);
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
      // Phase 1 — the previous window ends HERE, at the next real chat message.
      // Ordered deliberately before the new window opens: the filters above
      // (`isCompactSummary`, `isSyntheticPrompt`, `isInjectedBody`) all `continue`
      // without closing, which is correct — an injected skill body does not end
      // the user's reply window.
      closeWindow();
      const deliverables = enumeratedFileTokens(ut);
      if (deliverables.length >= FILE_SIGNAL_FLOOR) {
        openWindow = {
          at: String(entry["timestamp"] ?? ""),
          tokens: deliverables,
          addressed: new Set<string>(),
          worked: false,
        };
      }
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
      const firstLine = (prose.split("\n").find((l) => l.trim()) ?? "").trim();
      // Phase 1 — prose is half the window's evidence (tool inputs are the other
      // half, marked below). Placed before the language block for the same reason
      // the completion-claim check is: that block `continue`s on a harness banner,
      // and evidence collected after it would be skipped without saying so.
      // A harness retry banner is not the assistant writing, so it marks nothing
      // AND does not make the window count as worked — otherwise a session that
      // died on a 529 would read as an omission.
      if (openWindow !== null && !HARNESS_TEXT.test(firstLine)) {
        openWindow.worked = true;
        markAddressed(prose, openWindow);
      }
      // Round 7 § 6.2 — the denominator the language check can actually fire on.
      // Counted here, beside the numerator, so the two cannot be derived from
      // different populations later.
      if (pinned === "de") {
        report.de_pin_turns += 1;
      }
      // Round 7 § 1.5 — placed BEFORE the language block on purpose: that block
      // `continue`s on a harness banner, and a check placed after it would be
      // skipped for every such turn without saying so.
      if (!HARNESS_TEXT.test((prose.split("\n").find((l) => l.trim()) ?? "").trim())) {
        const cc = detectCompletionClaim(prose, { seen: ciSeen, settled: ciSettled });
        if (cc !== null) {
          report.violations.push({
            check: "completion-claim",
            session: sessionId,
            at,
            detail: `completion claimed over an unsettled CI read: "${cc.evidence.slice(0, 110)}"`,
          });
        }
      }
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
      // Phase 1 — the other half of the window's evidence. Serialised whole
      // rather than field-picked: a deliverable can be named in `file_path`,
      // `command`, `pattern`, `old_string` or a prompt, and enumerating the
      // fields that count is how a reader of `file_path` alone would score a
      // `grep`-then-`sed` edit as untouched.
      if (openWindow !== null) {
        openWindow.worked = true;
        markAddressed(`${tu.name} ${JSON.stringify(tu.input)}`, openWindow);
      }
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

  // The last prompt's window never sees a following prompt, so it is closed
  // here. Dropping it would bias the rate toward sessions that happen to end on
  // a user turn.
  closeWindow();

  return report;
}

/**
 * Where `--record` appends by default. Under the gitignored `agents/runtime/`
 * because the series is per-machine observation, and committing it would publish
 * the project set `storeKey` exists to hide.
 */
export const DEFAULT_RATE_SERIES = path.join(
  REPO_ROOT,
  "agents",
  "runtime",
  "state",
  "conformance-rates.jsonl",
);

/**
 * Default Claude Code transcript store for a project directory.
 *
 * Claude Code slugs every character outside `[A-Za-z0-9-]`, not just the
 * separator and the dot: `/Users/x/.claude` → `-Users-x--claude`, and a
 * worktree named `feat+turn-end-gate-always-on` → `feat-turn-end-gate-always-on`.
 *
 * The narrower `[/.]` this replaced is why the 2026-08-12 session audit could
 * not scan the worktree it was running in: the `+` survived into the computed
 * slug, no such directory exists, and the scan printed "no transcript store"
 * and measured NOTHING. A measurement tool that silently reports an empty
 * corpus for a whole class of paths is worse than one that errors, because the
 * zero is indistinguishable from a clean result.
 *
 * The character class is generalised rather than extended by one `+` because
 * every one of the 56 store names on this machine matches `^[A-Za-z0-9-]+$` —
 * there is no observed counter-example of a preserved special character, and
 * guessing which OTHER character is next would repeat this defect.
 */
export function defaultStore(projectDir: string): string {
  const slug = projectStoreSlug(projectDir);
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
    project: {
      dir: projectRulesDir,
      present: fs.existsSync(projectRulesDir),
      files: p.files,
      tokens: _tokens(p.chars),
    },
    global: {
      dir: globalRulesDir,
      present: fs.existsSync(globalRulesDir),
      files: g.files,
      tokens: _tokens(g.chars),
    },
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
    "completion-claim": 0,
  };
  for (const s of per_session) {
    for (const v of s.violations) {
      totals[v.check] = (totals[v.check] ?? 0) + 1;
    }
  }

  const assistant_turns = per_session.reduce((n, s) => n + s.assistant_turns, 0);
  const language_pin = totals["language-pin"] ?? 0;
  // Round ONCE, then use the rounded value for both the record and the verdict.
  // Rounding after the comparison lets a raw 9.06 persist `rate_pct: 9.1` beside
  // `band: "outside"`, and print "9.1%" directly above "OUTSIDE the 9.1-39.2%
  // band" — a rounding artefact announcing the declared falsifier.
  const rate_pct =
    assistant_turns === 0 ? 0 : Number(((100 * language_pin) / assistant_turns).toFixed(1));
  // Round 7 § 6.2 — the second denominator, reported beside the first rather than
  // instead of it: replacing the figure silently would break comparability with
  // every recorded run, and the band's own three reference values were computed
  // on the all-turns denominator.
  const de_pin_turns = per_session.reduce((n, s) => n + s.de_pin_turns, 0);
  const rate_pct_de_pin =
    de_pin_turns === 0 ? 0 : Number(((100 * language_pin) / de_pin_turns).toFixed(1));
  // `task-completeness` over its own denominator. Kept separate from the language
  // rate on purpose: the two checks fire on different populations, and a single
  // `rate_pct` covering both would be the pooled figure round 7 § 6.1 had to
  // retract.
  const completeness_windows = per_session.reduce((n, s) => n + s.completeness_windows, 0);
  const task_completeness = totals["task-completeness"] ?? 0;
  const task_completeness_rate_pct =
    completeness_windows === 0
      ? 0
      : Number(((100 * task_completeness) / completeness_windows).toFixed(1));
  const era = spansCarrierChange(per_session.map((s) => s.first_at));
  const delivered = measureDelivered(
    path.join(REPO_ROOT, ".claude", "rules"),
    path.join(process.env["HOME"] ?? os.homedir(), ".claude", "rules"),
  );
  const ownStore = path.resolve(store) === path.resolve(defaultStore(REPO_ROOT));

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
      rate_pct,
      de_pin_turns,
      rate_pct_de_pin,
      completeness_windows,
      task_completeness,
      task_completeness_rate_pct,
      era_spanning: era.spans,
      era_reason: era.what,
      band: bandVerdict(rate_pct, assistant_turns, { spansCarrier: era.spans }),
      // Only attach the carrier figures when the rate and the carriers describe
      // the same project.
      delivered_project_tokens: ownStore ? delivered.project.tokens : null,
      delivered_global_tokens: ownStore ? delivered.global.tokens : null,
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
  const carrier = (label: string, c: { present: boolean; files: number; tokens: number }): string =>
    c.present
      ? `    ${label}  ${String(c.files).padStart(4)} rules  ${String(c.tokens).padStart(7)} tok`
      : `    ${label}  ABSENT — not a measured zero, this carrier does not exist here`;
  lines.push(carrier("project", d.project));
  lines.push(carrier("global ", d.global));
  lines.push(`    union                  ${String(d.union_tokens).padStart(7)} tok`);
  lines.push("    A session's own payload is NOT recoverable: the transcript records no system");
  lines.push("    or tools field, and the carriers change under the sessions. This is one");
  lines.push("    reading; the series below is what makes it interpretable over time.");
  lines.push("");
  lines.push(
    `  language-pin rate  ${report.rate.rate_pct.toFixed(1)}%  ` +
      `(${report.rate.language_pin} of ${report.rate.assistant_turns} assistant turns)`,
  );
  // Round 7 § 6.2 — both denominators, always. The band's three reference values
  // were computed on the all-turns one, so that stays the headline; the second is
  // the only one the check can actually fire on, and on round 7's own corpus the
  // two differ by enough to move the verdict (6.5 % vs 9.2 %, band low 9.1 %).
  // Optional-read, not `report.rate.x.toFixed(...)`: a `rate` block RECORDED
  // before round 7 carries neither field, and `--record` exists to be read back
  // over time. A renderer that throws on last month's line makes the series
  // unreadable to prove a point about denominators.
  const dePinTurns = report.rate.de_pin_turns;
  const dePinRate = report.rate.rate_pct_de_pin;
  if (typeof dePinTurns === 'number' && typeof dePinRate === 'number') {
    lines.push(
      `                     ${dePinRate.toFixed(1)}%  ` +
        `(${report.rate.language_pin} of ${dePinTurns} turns under a GERMAN pin — the only` +
        ' turns this check can fire on)',
    );
    lines.push(
      '    The band (M5, n=3) was computed on the ALL-turns denominator, so the first figure',
    );
    lines.push('    is the comparable one and the second is the honest one. Both are printed.');
  }
  // `task-completeness`, on its own denominator. Optional-read for the same
  // archive reason as the two above: a `rate` block recorded before this check
  // existed carries neither field, and the series exists to be read back.
  const cWindows = report.rate.completeness_windows;
  const cRate = report.rate.task_completeness_rate_pct;
  if (typeof cWindows === "number" && typeof cRate === "number") {
    lines.push("");
    lines.push(
      `  task-completeness  ${cRate.toFixed(1)}%  ` +
        `(${report.rate.task_completeness ?? 0} of ${cWindows} eligible reply windows)`,
    );
    lines.push("    A hit is EVIDENCE of an omission, never proof: a blocking question, a");
    lines.push("    hand-back, a fenced scope and a deferred item all produce this signature");
    lines.push("    correctly. Read the hand-validated precision beside this figure or not");
    lines.push("    at all — `--why task-completeness` lists every hit with its missed tokens.");
  }
  if (report.rate.band === "era-spanning") {
    lines.push(
      `    Not compared: the corpus SPANS a carrier landing — ${report.rate.era_reason || 'see CARRIER_CHANGES'}.`,
    );
    lines.push('    A rate pooled across it is a weighted average of two different systems, not');
    lines.push('    a reading about behaviour. Round 7 measured 23.1% before and 0.0% after that');
    lines.push('    exact carrier; the pooled 6.5% was announced as the falsifier firing.');
    lines.push('    Split the window at the carrier date and read each era on its own.');
  } else if (report.rate.band === "corpus-too-small") {
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
  // Round 7 § 6.4 — this footer used to lump four classes together as "NOT
  // measured", and two of the four were wrong. Stated per class instead, because
  // "not measured here" and "not measured anywhere" are different facts and only
  // one of them is a gap.
  lines.push("  Scanned checks are exactly the mechanised ones. What is NOT in the counts above:");
  lines.push("    ask-shape (trailing free-text offer)  — measured NOWHERE. ~11 findings in round 7's");
  lines.push("      reading half; the discriminator needs judgement, so it stays advisory on purpose.");
  lines.push("    session-canary (opening greeting)     — not here, but PROBEABLE:");
  lines.push("      `./scripts-run src/scripts/probe_session_canary`. Round 7: 25/28 sessions,");
  lines.push("      24/25 post-carrier. The per-TASK instance is undecidable — no task boundary");
  lines.push("      is recorded in a transcript.");
  lines.push("    promissory closings                   — not here, but ALREADY GATED: `turn-end-gate`");
  lines.push("      ships a blocking `detectPromissory`. Round 7 probe: 1 of 120 hand-back turns");
  lines.push("      (the 163 this line first printed was the retracted denominator — it counted");
  lines.push("      synthetic user turns as hand-back closers).");
  lines.push("      `./scripts-run src/scripts/probe_promissory_closing`.");
  lines.push("    checkbox batching                     — measured NOWHERE. ~5 low-severity findings.");
  return lines.join("\n");
}

export function main(argv?: string[]): number {
  const args = argv ?? process.argv.slice(2);
  let store: string | null = null;
  let limit = 30;
  let json = false;
  let out: string | null = null;
  let record: string | null = null;
  let why: string | null = null;
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
    } else if (a === "--why" && args[i + 1] !== undefined) {
      why = args[++i] as string;
    } else if (a === "--record") {
      // Opt-in, and a bare `--record` takes the default path rather than
      // swallowing the next flag as a filename.
      record =
        args[i + 1] !== undefined && !(args[i + 1] as string).startsWith("-")
          ? (args[++i] as string)
          : DEFAULT_RATE_SERIES;
    }
  }
  if (why !== null && !CHECK_IDS.includes(why as CheckId)) {
    process.stderr.write(
      `conformance:why: unknown check id ${JSON.stringify(why)} — known ids: ` +
        `${CHECK_IDS.join(", ")}\n`,
    );
    return 2;
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
  if (why !== null) {
    const id = why as CheckId;
    fs.writeSync(
      1,
      json
        ? `${JSON.stringify(
            {
              check: id,
              meaning: CHECK_MEANINGS[id],
              store: report.store,
              sessions: report.sessions,
              hits: report.per_session.flatMap((s) =>
                s.violations.filter((v) => v.check === id),
              ),
            },
            null,
            2,
          )}\n`
        : `${renderWhy(report, id)}\n`,
    );
    return 0;
  }
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
