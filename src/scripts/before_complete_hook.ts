#!/usr/bin/env node
/**
 * Platform-agnostic hook for the `verify-before-complete` rule.
 *
 * Named `before_complete_hook`, not `verify_before_complete_hook`: `verify_` is
 * one of the gate-shaped prefixes in `_lib/gate_population.ts`, so the old name
 * put an observability hook into the gate population, where the scan-scope
 * ratchet counted it as a gate that cannot assert a scan scope (it scans no
 * corpus — its only inputs are its stdin envelope and the state file it writes).
 * AI council 2026-08-05 rejected the alternative of excluding `_hook.ts` in the
 * population filter as population-shrinking: `.d.ts` / `.test.ts` are excluded
 * because the language and the test runner make them structurally
 * non-executable, whereas "a hook never blocks" is an operational property you
 * can only learn by reading `hook_manifest.yaml` — and manifest-driven
 * classification was already rejected once. Renaming keeps classification
 * structural and needs no exclusion rule.
 *
 * Ported from the retired Python `src/scripts/verify_before_complete_hook.py`
 * (ADR-200 — Python→TS migration, Phase 6 / hooks). Public API mirrors the
 * Python module exactly (snake_case kept deliberately — fidelity over TS idiom).
 *
 * Records observable evidence that a verification command (tests, quality
 * tools, build) ran. The rule body cites the resulting state file as the
 * source of truth for the "have I verified this turn?" question. The hook
 * itself never blocks — it is observability infra, not control flow.
 *
 * Wired to multiple events via the manifest:
 *   - session_start / user_prompt_submit → reset turn-scoped counters
 *   - post_tool_use → inspect tool + command, record verifications
 *   - stop                                → record stop fired (claim-done window)
 *
 * Output: `agents/state/verify-before-complete/<sha256(session_id)>.json`
 *   — ONE FILE PER SESSION. It was one file per project root until 2026-08-20,
 *   which under this repo's worktree workflow (`CLAUDE_PROJECT_DIR` resolves to
 *   the PARENT checkout) meant one file across every concurrent run: a
 *   neighbour's CI witness and verification counters became this run's, and the
 *   in-file session-boundary reset in `_update` turned into the damage rather
 *   than the defense, because two live runs then clear each other in a loop.
 *   Consumers address it via `statePathFor`, never a path literal.
 *   {
 *     "schema_version": 1,
 *     "session_id": "<str>",
 *     "turn_started_at": "<iso8601|null>",
 *     "last_verification": {"command": ..., "tool": ..., "at": ...} | null,
 *     "verifications_this_turn": <int>,
 *     "verifications_this_session": <int>,
 *     "last_stop_at": "<iso8601|null>",
 *     "verified_this_turn": <bool>,
 *     "checked_at": "<iso8601>"
 *   }
 *
 * Exit code is always 0.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  has_stable_session_id,
  prune_legacy_state_file,
  prune_stale_session_states,
  session_state_file,
  update_json_under_lock,
  owns_session_state,
} from "./hooks/state_io.js";
import { readHookStdin } from "./hooks/hook_stdin.js";
import { isVerificationCommand, mightBeVerification } from "./_lib/verification_command.js";
import { runnerOf } from "./_lib/verification_evidence.js";

// NOTE: the Python docstring says `agents/runtime/state/`, but the code
// constant is `agents/state/`. Replicated verbatim — latent docstring/code
// divergence in the retired Python implementation (ADR-200 § replicate latent bugs).
//
// PRE-SPLIT PATH. Nothing reads it after the per-session split below;
// `prune_legacy_state_file` removes it once this version owns the tree. Kept
// exported because `prune_legacy_state_file` needs to name the path it deletes,
// and because a reader that still resolves it should get a compile-visible
// symbol rather than a silently stale path literal. It is NOT kept for an
// "older bundle still writing during an upgrade" — that phrasing was copied
// here unchecked and is corrected at `state_io.prune_legacy_state_file`, which
// carries the measured deployment shape and the one narrow window that remains.
export const STATE_FILE = path.join("agents", "state", "verify-before-complete.json");

/**
 * Per-SESSION state, one file each.
 *
 * WHY, in one sentence: the single file above is shared by every concurrent
 * session under one project root — which in this repo's worktree workflow is
 * the PARENT checkout — so a neighbouring run's CI witness and verification
 * counters became this run's.
 *
 * The in-file session-boundary reset in `_update` is NOT the fix and is the
 * reason this was easy to miss. It is written for SEQUENTIAL sessions: notice a
 * foreign `session_id`, clear the session-scoped counters, carry on. Under
 * CONCURRENT sessions that same code is the damage — each run reads the other's
 * id, resets, and writes, so two sessions erase each other's verification
 * evidence in a loop. The direction of the loss is toward FORGETTING a
 * verification that did happen, which then reads as "not verified this turn".
 *
 * The reset stays, but NOT for the reasons this comment first gave. It said the
 * reset "still covers the id-less bucket and a legacy file", and a cross-model
 * review (2026-08-20, both seats) showed neither is reachable: an id-less
 * envelope returns from `run()` before `_update` is ever called, and the legacy
 * file is never LOADED any more — only deleted. Writing an unreachable
 * justification next to retained code is how dead logic survives review, so the
 * real one is stated instead.
 *
 * Its one reachable case is a file at THIS session's digest path carrying
 * somebody else's `session_id` — a copy, a restore, a hand-edit, or a buggy
 * writer. That is integrity recovery on the producer side, and it pairs with the
 * consumer side refusing the same file outright (`owns_session_state`). Both
 * halves are needed: the producer cannot refuse to run, and the consumer cannot
 * repair. `before_complete_session_isolation.test.ts` reaches it directly.
 *
 * Rationale, the digest-not-sanitiser property, and the claim-then-revalidate
 * prune all live once in `hooks/state_io.ts` § Per-session concern state — this
 * is the second concern to need them, which is what made sharing them right.
 */
export const STATE_DIR = path.join("agents", "state", "verify-before-complete");

/**
 * Days after which an untouched session's state is pruned.
 *
 * Matches the language hook and the council session-artefact window — a
 * convention match, not a measurement, and stated as such.
 */
export const STATE_RETENTION_DAYS = 7;

/** Path of one session's state file. */
export function statePathFor(session_id: string): string {
  return session_state_file(STATE_DIR, session_id);
}

// Tool names across platforms whose `command` / `tool_input.command` field
// carries a shell command we can inspect. Edit tools are deliberately
// excluded — they cannot run verification.
export const COMMAND_TOOLS: ReadonlySet<string> = new Set([
  "launch-process",
  "launch_process", // Augment
  "Bash",
  "BashTool", // Claude Code
  "run-process",
  "runProcess", // variants
  "shell",
  "execute_shell", // generic / Cline
  "RunShellCommand", // Cursor
]);

type StateDict = Record<string, unknown>;

/** Python datetime.now(timezone.utc).isoformat(timespec="seconds"). */
function _now(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

function _empty_state(): StateDict {
  return {
    schema_version: 1,
    session_id: "",
    turn_started_at: null,
    last_verification: null,
    verifications_this_turn: 0,
    verifications_this_session: 0,
    last_stop_at: null,
    verified_this_turn: false,
    ci_saw_pending: false,
    nonevidence_this_turn: 0,
    // Round 7 § Phase 1 — the last CI read, SESSION-scoped on purpose. Every
    // other counter here is turn-scoped because a stale POSITIVE would wrongly
    // vouch ("I verified"). This one is a NEGATIVE ("CI was not settled"), and a
    // stale negative only ever refuses more often — so surviving the turn
    // boundary preserves the freshness invariant rather than bypassing it. It
    // has to survive it: the measured failure is a completion claim in a LATER
    // turn than the poll it rests on.
    ci_last: null,
    // Round 8 — see `_reset_turn`. Present in the empty state so a freshly
    // created file has the same shape as one that has seen a turn boundary;
    // a reader must never have to distinguish "no runs yet" from "key absent".
    verification_runs: [],
    edits_this_turn: 0,
    checked_at: _now(),
  };
}


/** Return [tool_name, command_text] from a tool-event payload. */
function _extract_command(payload: StateDict): [string | null, string | null] {
  const toolRaw = payload["tool_name"] || payload["toolName"] || payload["tool"];
  if (!(typeof toolRaw === "string" && COMMAND_TOOLS.has(toolRaw))) {
    return [typeof toolRaw === "string" ? toolRaw : null, null];
  }
  const tool = toolRaw;
  const ti = payload["tool_input"];
  if (typeof ti === "object" && ti !== null && !Array.isArray(ti)) {
    for (const key of ["command", "cmd", "shell_command"]) {
      const v = (ti as StateDict)[key];
      if (typeof v === "string" && v) {
        return [tool, v];
      }
    }
  }
  // Some platforms surface the command at the top level.
  for (const key of ["command", "cmd"]) {
    const v = payload[key];
    if (typeof v === "string" && v) {
      return [tool, v];
    }
  }
  return [tool, null];
}

function _is_verification(command: string): boolean {
  // CI polls join the verification set here (they did not match the local
  // runner pattern). A settled green CI run IS evidence — but only once the
  // settle is genuine, which is what the FC-3b guard below decides. Before this
  // change a CI poll counted for nothing at all, so nothing observed the
  // difference between "settled" and "never started".
  return isVerificationCommand(command) || isCiPoll(command);
}

/**
 * Non-vacuity guard (conformance audit 2026-08-06, failure class FC-3b).
 *
 * The measured failure: a CI poll landing in the gap between `git push` and
 * GitHub registering the checks returned `0 pass / 0 fail`, so the agent's exit
 * condition `pending == 0` was TRIVIALLY satisfied and "CI settled" was reported
 * twice — on a run that had not started. The verification *command* ran, so the
 * evidence gate felt satisfied. Nothing checked that its output said anything.
 *
 * A result set of size zero is not evidence. `∀x ∈ ∅` is vacuously true, and
 * that is a logic error rather than a judgement call, which is why it is gated
 * here rather than described in a rule.
 */
const _VACUOUS_PATTERNS: readonly RegExp[] = [
  // gh pr checks / gh run — no checks registered at all.
  /\b0\s+(?:checks?|runs?)\b/i,
  // Test runners reporting an empty run.
  /\bno tests? (?:ran|found|to run|were run)\b/i,
  /\bNo test files found\b/i,
  /\b0\s+pass(?:ed|ing)?\b[\s,|·]*\b0\s+fail(?:ed|ing|ures)?\b/i,
  /\bTests?\s+0\s+passed\b/i,
  /\bRan 0 tests?\b/i,
  // Linters / scanners with an empty target set.
  /\bno files? (?:matched|to (?:lint|check|scan)|found)\b/i,
  /\b0\s+files?\s+(?:checked|scanned|linted)\b/i,
  /\bnothing to check\b/i,
];

/** True when a verification command's output proves nothing because it covered nothing. */
export function isVacuousOutput(output: string): boolean {
  const text = output.trim();
  if (!text) {
    // Silence is the Unix convention for success: a clean `tsc --noEmit`,
    // `eslint`, or `phpstan` prints nothing. Round 2 caught this reading empty
    // output as vacuity, which quietly stopped counting the most common green
    // signal in this repo. Genuinely unreadable CI polls are handled separately
    // (`pendingCount` returns null and the poll counts for nothing).
    return false;
  }
  // Per RESULT LINE, not per blob: a composite run whose 812 tests passed and
  // whose one empty sub-package printed "No test files found" is evidence.
  const lines = text.split("\n").filter((l) => l.trim());
  return lines.every((l) => _VACUOUS_PATTERNS.some((re) => re.test(l)));
}

/** Commands that poll CI state rather than produce a local result. */
const _CI_POLL_RE = /\bgh\s+(?:pr\s+checks|run\s+(?:watch|list|view))\b/i;

export function isCiPoll(command: string): boolean {
  return _CI_POLL_RE.test(command);
}

/**
 * Read a pending-check count out of a CI poll's output. Returns null when the
 * shape is unrecognised — an unknown shape must not be read as "settled".
 */
export function pendingCount(output: string): number | null {
  const m = /(\d+)\s+(?:checks? )?pending\b/i.exec(output) ?? /\bpending[:=]\s*(\d+)/i.exec(output);
  if (m?.[1] !== undefined) {
    return Number(m[1]);
  }
  // `gh pr checks` prints one row per check; count the in-progress markers.
  // `gh pr checks` prints one row per check (`name\tpass\t1m2s\t…`). Count the
  // in-flight rows; a table with rows but none pending IS a settle, which the
  // first version could not see because it returned null and never counted.
  const rows = output.match(/^\S.*\b(pending|in_progress|queued)\b/gim);
  if (rows) {
    return rows.length;
  }
  if (/\bno checks reported\b/i.test(output)) {
    return null; // the push→registration gap — not a settle
  }
  if (/^\S+\s+(pass|fail|skipping|successful|failing)\b/im.test(output)) {
    return 0; // a real result table with no in-flight rows
  }
  return null;
}

/**
 * Extract a tool's textual output from a post-tool payload.
 *
 * Returns `null` when the payload carries NO output field at all — which is not
 * the same fact as "the command produced no output". Several platforms do not
 * surface tool output on this event, and treating their silence as a vacuous
 * result would turn the guard into a blanket regression that stops counting
 * every verification everywhere. The guard only fires where it can actually
 * read a result.
 */
function _extract_output(payload: StateDict): string | null {
  for (const key of ["tool_response", "toolResponse", "output", "stdout", "result"]) {
    const v = payload[key];
    if (typeof v === "string") {
      return v;
    }
    if (v !== null && typeof v === "object") {
      return JSON.stringify(v);
    }
  }
  return null;
}

/**
 * Tool names that CHANGE the tree, across the platforms this concern sees.
 *
 * The first four mirror `_EDIT_TOOLS` in the turn-end gate exactly; the rest are
 * the same three tools under the names Augment, Cline and Cursor give them. The
 * gate reads a Claude transcript and can afford four names; this recorder runs
 * on every platform the manifest binds `post_tool_use` on, so it needs all of
 * them — a missed edit name means `edits_this_turn` undercounts and a
 * verification run looks LATER in the sequence than it was, which is the one
 * direction that could clear an unverified edit.
 */
const EDIT_TOOLS: ReadonlySet<string> = new Set([
  "Edit",
  "Write",
  "MultiEdit",
  "NotebookEdit",
  "str-replace-editor",
  "save-file",
  "str_replace_editor",
  "create_file",
  "write_to_file",
  "replace_in_file",
  "apply_diff",
  "edit_file",
]);

/**
 * How many run records one turn may keep.
 *
 * The state file is read by a stop-slot hook on every turn, so it is on the
 * latency path and cannot grow without a ceiling. The NEWEST are kept because
 * the only question asked of them is whether a passing run follows the LAST
 * edit, which is always answered by the tail.
 */
export const MAX_VERIFICATION_RUNS_PER_TURN = 24;

/**
 * Characters of tool output retained per stream per record.
 *
 * CHARACTERS, not bytes, and the name is kept for its existing importers: the
 * slice is applied to a JS string. Multibyte output can therefore exceed this
 * many bytes, which is a bound on the state file rather than a promise about
 * it, and 4,096 characters is far more than any runner's summary needs.
 */
export const RUN_OUTPUT_TAIL_BYTES = 4096;

/**
 * Apply the per-turn cap, keeping the newest AND the earliest failing record.
 *
 * Two detectors read this array and they ask opposite-ended questions. Detector
 * C asks whether a pass follows the last edit — always answered by the tail.
 * Detector F asks whether a red preceded the green — answered by the head. A
 * plain `slice(-N)` serves the first and can silently drop the evidence the
 * second needs, turning a turn that did honest red-green work into a
 * `no_red_evidence` refusal once the run count passes the cap.
 */
function _cap_runs(runs: unknown[]): unknown[] {
  if (runs.length <= MAX_VERIFICATION_RUNS_PER_TURN) return runs;
  const tail = runs.slice(-(MAX_VERIFICATION_RUNS_PER_TURN - 1));
  const head = runs.find((r) => {
    if (r === null || typeof r !== "object" || Array.isArray(r)) return false;
    const rec = r as StateDict;
    const code = rec["exit_code"];
    return typeof code === "number" && code !== 0;
  });
  if (head === undefined || tail.includes(head)) {
    return runs.slice(-MAX_VERIFICATION_RUNS_PER_TURN);
  }
  return [head, ...tail];
}

/**
 * The prefix a host puts on a FAILED shell result when it carries no exit field.
 *
 * Claude Code's Bash tool does exactly this: a failing call's whole tool
 * response is the string `Error: Exit code 1\n<output>`. Measured over 1,077
 * object-shaped and 11 string-shaped tool results in this machine's own
 * transcripts (2026-09-29): every string-shaped result carried this prefix, and
 * no shape of either kind carried any of the numeric field names below.
 */
const _ERROR_EXIT_PREFIX = /^Error:\s*Exit code\s*(\d+)/i;

/**
 * The same statement without the `Error:` word, which is how the host words it
 * on its FAILURE event.
 *
 * Measured 2026-10-01 on Claude Code 2.1.286: a failing `Bash` call fires
 * `PostToolUseFailure`, whose envelope carries NO `tool_response` at all. The
 * exit status is a top-level `error` string whose first line reads
 * `Exit code N`, with the command's own diagnostics on the lines after it. The
 * prefix above never matches that, so for as long as only the success event was
 * bound this recorder could not have written a non-zero exit even once — which
 * is exactly what 24 consecutive all-zero records on this host turned out to
 * mean.
 */
const _BARE_EXIT_PREFIX = /^\s*Exit code\s*(\d+)/i;

/** The status a post-tool payload actually reports, and HOW it reported it. */
interface ExitReading {
  readonly code: number | null;
  /** Provenance, recorded so a reader can tell an observed code from a derived one. */
  readonly source: "field" | "error_prefix" | "response_shape" | null;
  /** The host said the call was interrupted — a kill, not a verdict on the work. */
  readonly interrupted: boolean;
}

const _NO_EXIT: ExitReading = { code: null, source: null, interrupted: false };

function _numeric_exit_field(obj: StateDict): number | null {
  for (const key of ["exit_code", "exitCode", "returncode", "returnCode", "status_code"]) {
    const v = obj[key];
    if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
      return Math.trunc(Number(v));
    }
  }
  return null;
}

/**
 * What the host said about how the command ended.
 *
 * `null` is a REAL value and is never normalised to 0: several hosts surface no
 * exit status at all, and writing 0 for "the host said nothing" would
 * manufacture the strongest possible evidence out of silence. The classifier's
 * `exit_code_unavailable` verdict exists so that gap stays visible.
 *
 * THREE SOURCES, in descending directness, and the third is the one that took a
 * measurement rather than a guess.
 *
 *   · `field` — a numeric exit field, wherever a host provides one.
 *   · `error_prefix` — the `Error: Exit code N` string form above. This is a
 *     real non-zero code, stated by the host in the only place it states it.
 *   · `response_shape` — an OBJECT response carrying `interrupted: false`
 *     alongside a `stdout` or `stderr` key. On Claude Code that is the success
 *     form, and the discriminator is deliberately the PRESENCE of
 *     `interrupted: false` rather than the ABSENCE of an error prefix: a
 *     positive signal from the host, not an inference from silence. A shape
 *     that carries neither reads as `null` and stays an instrument gap.
 *
 * Without the second and third readings this recorder wrote `exit_code: null`
 * for every command on the one host that binds the turn-end gate, so the whole
 * record path was inert — found by an independent review of the branch that
 * introduced it, against 1,077 real tool results.
 */
/**
 * Did the HOST say this call failed, independently of anything in its text?
 *
 * Read from the native event name, which the host writes in two places and the
 * agent in neither: `hook_event_name` inside the payload, and `native_event` on
 * the dispatcher envelope. Either is authoritative; both are checked because a
 * raw-payload invocation carries only the first and a synthesised envelope only
 * the second.
 *
 * Matched on a `Failure` suffix rather than one literal name. The one observed
 * spelling is `PostToolUseFailure`; a host naming its own failure event
 * differently is caught by the suffix, and the cost of a false positive is
 * bounded to refusing to record a zero — never to recording one.
 */
function _is_failure_event(payload: StateDict, envelope: StateDict): boolean {
  for (const v of [payload["hook_event_name"], envelope["native_event"]]) {
    if (typeof v === "string" && /failure$/i.test(v)) return true;
  }
  return false;
}

function _extract_exit_reading(payload: StateDict, failure_event = false): ExitReading {
  // On an event the host itself named a FAILURE, a zero is never recorded —
  // from any of the three readings. The host has already stated the call did not
  // succeed, so a `0` arrived at by parsing its text would contradict the only
  // authoritative thing in the envelope, and it would do so in the single most
  // dangerous direction: manufacturing the strongest possible pass evidence out
  // of a red run. `null` instead, which the classifier already treats as an
  // instrument gap and never as a pass.
  //
  // Raised by an independent reviewer who asked what happens when a command's
  // own error text begins `Exit code 0`. Nothing observed produces that, which
  // is exactly why it is worth closing before something does.
  const seal = (r: ExitReading): ExitReading =>
    failure_event && r.code === 0 ? { code: null, source: null, interrupted: r.interrupted } : r;

  const direct = _numeric_exit_field(payload);
  if (direct !== null) return seal({ code: direct, source: "field", interrupted: false });

  // The FAILURE envelope, read before the success keys because it carries none
  // of them: no `tool_response`, the status in a top-level `error` string, and
  // the interrupt flag spelled `is_interrupt` rather than the nested
  // `interrupted` below. Interruption is checked FIRST — a killed call is a
  // statement about the kill and not a verdict on the work, so a host that
  // sends both must not have its kill read as a failing exit.
  const interrupted_top = payload["is_interrupt"] === true;
  const err = payload["error"];
  if (typeof err === "string") {
    if (interrupted_top) return { code: null, source: null, interrupted: true };
    const bare = _BARE_EXIT_PREFIX.exec(err) ?? _ERROR_EXIT_PREFIX.exec(err);
    if (bare?.[1] !== undefined) {
      return seal({ code: Number(bare[1]), source: "error_prefix", interrupted: false });
    }
  }
  if (interrupted_top) return { code: null, source: null, interrupted: true };

  for (const key of ["tool_response", "toolResponse", "result", "output"]) {
    const v = payload[key];
    if (typeof v === "string") {
      const m = _ERROR_EXIT_PREFIX.exec(v);
      if (m?.[1] !== undefined) {
        return seal({ code: Number(m[1]), source: "error_prefix", interrupted: false });
      }
      continue;
    }
    if (v === null || typeof v !== "object" || Array.isArray(v)) continue;
    const obj = v as StateDict;
    const nested = _numeric_exit_field(obj);
    if (nested !== null) return seal({ code: nested, source: "field", interrupted: false });
    if (obj["interrupted"] === true) return { code: null, source: null, interrupted: true };
    const hasStream = typeof obj["stdout"] === "string" || typeof obj["stderr"] === "string";
    if (obj["interrupted"] === false && hasStream) {
      return seal({ code: 0, source: "response_shape", interrupted: false });
    }
  }
  return _NO_EXIT;
}

/**
 * The command's stdout and stderr as REAL strings, never as a stringified blob.
 *
 * Separate from `_extract_output` above, which feeds the pre-existing `vacuous`
 * counters and whose behavior must not move: that one returns
 * `JSON.stringify(v)` for an object response, and every parser in
 * `verification_evidence.ts` is line-anchored (`/^[ \t]*Tests:?.../m` and
 * friends). JSON escapes a newline as the two characters `\` and `n`, so a
 * stringified response can never match any of them — the classifier was blind
 * to every summary on the host's success shape. Found by the same review.
 */
function _extract_run_streams(payload: StateDict): { stdout: string; stderr: string } {
  for (const key of ["tool_response", "toolResponse", "result", "output"]) {
    const v = payload[key];
    if (typeof v === "string") return { stdout: v, stderr: "" };
    if (v === null || typeof v !== "object" || Array.isArray(v)) continue;
    const obj = v as StateDict;
    const out = obj["stdout"] ?? obj["output"];
    const err = obj["stderr"];
    if (typeof out === "string" || typeof err === "string") {
      return {
        stdout: typeof out === "string" ? out : "",
        stderr: typeof err === "string" ? err : "",
      };
    }
  }
  const topOut = payload["stdout"] ?? payload["output"];
  const topErr = payload["stderr"];
  if (typeof topOut === "string" || typeof topErr === "string") {
    return {
      stdout: typeof topOut === "string" ? topOut : "",
      stderr: typeof topErr === "string" ? topErr : "",
    };
  }
  // The failure envelope's one text field. Recorded as `stdout` because the
  // host collapses both streams into it and says nothing about which was
  // which — a recorder that split them would be inventing a fact — and because
  // every parser in `verification_evidence` is line-anchored over stdout. The
  // alternative, dropping it, would leave a red run recorded with its exit code
  // and no reason, which is the half the reader actually needs.
  const errText = payload["error"];
  if (typeof errText === "string") return { stdout: errText, stderr: "" };
  return { stdout: "", stderr: "" };
}

function _reset_turn(state: StateDict, session_id: string): StateDict {
  state["session_id"] = session_id || state["session_id"] || "";
  state["turn_started_at"] = _now();
  state["verifications_this_turn"] = 0;
  state["verified_this_turn"] = false;
  // Round 8 — the run records the stop gate reads instead of the command text,
  // and the edit counter that places them in the turn's sequence. Both are
  // TURN-scoped: a run from the previous turn demonstrably did not exercise this
  // turn's edits, which is the freshness argument `verify-before-complete` makes.
  state["verification_runs"] = [];
  state["edits_this_turn"] = 0;
  // FC-3b turn-scoped counters: a CI settle must be witnessed within the same
  // turn that claims it, so the in-flight observation does not survive a turn.
  state["ci_saw_pending"] = false;
  state["nonevidence_this_turn"] = 0;
  return state;
}

function _asInt(v: unknown): number {
  if (!v) {
    return 0;
  }
  if (typeof v === "number") {
    return Math.trunc(v);
  }
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function _update(state: StateDict, event: string, envelope: StateDict): StateDict {
  const session_id = (envelope["session_id"] || state["session_id"] || "") as string;
  if (session_id && session_id !== state["session_id"]) {
    // Session boundary — reset session-scoped counters.
    state["session_id"] = session_id;
    state["verifications_this_session"] = 0;
    // R2 finding 1 (high). `ci_last` is SESSION-scoped, and until this line
    // nothing cleared it: `_reset_turn` clears the turn-scoped witness,
    // `_empty_state` sets it null only for a state file that does not exist yet,
    // and `_load_state` merges the persisted value over that default. So session
    // A polled CI, saw pending, and ended; session B — a doc-only session that
    // never touched CI — said "Fertig" and was REFUSED, contradicting both the
    // consumer's own comment ("a session that never polled CI must never be
    // refused for it") and the negative case the roadmap pinned. Session-scoped
    // has to mean cleared at the boundary, or it means never cleared.
    state["ci_last"] = null;
    state = _reset_turn(state, session_id);
  }

  // The host that wrote this file. Recorded because the instrument-gap reading
  // is a PER-HOST question and the witness carried no answer to it: every
  // coverage number had to be attributed by hand, and a file from an unknown
  // host is indistinguishable from a host with nothing to report. Written on
  // every update rather than once, so a file predating this field acquires it
  // the first time the host touches it; until then a reader sees it absent,
  // which is the honest reading and not a default.
  const platform = envelope["platform"];
  if (typeof platform === "string" && platform) state["platform"] = platform;

  let payload = envelope["payload"];
  if (!(typeof payload === "object" && payload !== null && !Array.isArray(payload))) {
    payload = {};
  }
  const pl = payload as StateDict;

  if (event === "session_start" || event === "user_prompt_submit") {
    state = _reset_turn(state, session_id);
  } else if (event === "post_tool_use") {
    const [tool, cmd] = _extract_command(pl);
    // Counted BEFORE the verification branch, so a run recorded in this same
    // event is placed after the edits that preceded it and never after itself.
    if (tool !== null && EDIT_TOOLS.has(tool)) {
      state["edits_this_turn"] = _asInt(state["edits_this_turn"]) + 1;
    }
    if (cmd && _is_verification(cmd)) {
      const output = _extract_output(pl);
      // No readable output → the guard has nothing to judge, so behaviour is
      // exactly what it was before FC-3b landed.
      const vacuous = output !== null && isVacuousOutput(output);

      // A CI poll is evidence of a SETTLE only when this turn has already seen
      // the run in flight. Polling once and reading `pending == 0` off a run
      // that never registered is the measured FC-3b failure. With no readable
      // output a poll counts for nothing — which is also its pre-FC-3b
      // behaviour, since CI polls were not in the verification set at all.
      let counts = !vacuous;
      if (isCiPoll(cmd)) {
        const pending = output === null ? null : pendingCount(output);
        if (pending !== null && pending > 0) {
          state["ci_saw_pending"] = true;
          counts = false; // running, not settled
        } else if (pending === 0) {
          counts = !vacuous && state["ci_saw_pending"] === true;
        } else {
          counts = false; // unrecognised or unreadable — never read as settled
        }
        // Round 7 § 1.1 — the session-scoped negative the turn-end consumer reads.
        //
        // R2 finding 3 (medium), and it was the sharpest one: this said `settled:
        // pending === 0` and CLAIMED "the same discrimination `counts` makes
        // above". It was not. `counts` requires `!vacuous && ci_saw_pending`;
        // `pending === 0` alone drops both. A post-push poll that reads a stale
        // all-pass table returns pending 0 — verbatim the FC-3b failure documented
        // twenty lines up — and recorded `settled: true`, so the completion
        // detector went SILENT in exactly the premature-claim case it exists for.
        // A detector defeated by the false settle it was built to catch is worse
        // than no detector, because it reports coverage.
        //
        // Now it reuses `counts` itself, which is that discrimination rather than
        // a paraphrase of it. `pending === null` (unreadable, and "no checks
        // reported") stays not-a-settle by construction.
        state["ci_last"] = {
          at: _now(),
          command: cmd.slice(0, 512),
          pending,
          settled: pending === 0 && counts === true,
        };
      }

      state["last_verification"] = {
        command: cmd.slice(0, 512),
        tool,
        at: _now(),
        platform: (envelope["platform"] || "") as unknown,
        vacuous,
        counted: counts,
      };

      if (counts) {
        state["verifications_this_turn"] = _asInt(state["verifications_this_turn"]) + 1;
        state["verifications_this_session"] =
          _asInt(state["verifications_this_session"]) + 1;
        state["verified_this_turn"] = true;
      } else {
        state["nonevidence_this_turn"] = _asInt(state["nonevidence_this_turn"]) + 1;
      }
    }

    // The RUN record, written beside `last_verification` and gated on a
    // DIFFERENT, wider selector — the one the turn-end gate's detector C uses.
    //
    // Two selectors is a smell, so here is why it is not one — and the reason
    // was rewritten 2026-09-30, because the version standing here was half
    // wrong. It claimed the narrow selector protected `verifications_this_turn`
    // AND the FC-3b `ci_last` discrimination. `ci_last` is written inside the
    // nested `isCiPoll` branch above, reached through the second disjunct of
    // `_is_verification` whatever the first one says, so no widening of the
    // first could ever have moved it; and nothing branches on the counter.
    // Both are now pinned by tests rather than asserted in a comment.
    //
    // What survives is a real distinction, and it is about ERROR COST, not
    // about two spellings of one idea. `isVerificationCommand` answers *did
    // this verify* — a false positive there clears an unverified edit, so it is
    // head-anchored. `mightBeVerification` answers *is this worth writing down*
    // — and the run record decides nothing by itself, since `classifyRun` is
    // what judges it. So the record path wants every command the gate might
    // read, including the ones the classifier will then reject —
    // `not_a_verification_command` is a verdict the gate needs to SEE, and a
    // recorder that filtered those out would leave the gate unable to tell "the
    // turn ran `echo test`" from "the turn ran nothing at all".
    //
    // `after_edits` is the edit counter as it stood when the command ran. The
    // reader compares it against the number of edits the turn made in total:
    // equal or greater means nothing was edited afterwards. That is an ORDINAL
    // comparison needing no clock, so it survives a host whose timestamps are
    // coarse or absent, and it degrades toward under-refusing when the reader's
    // own count is short.
    if (cmd && mightBeVerification(cmd)) {
      const streams = _extract_run_streams(pl);
      const exit = _extract_exit_reading(pl, _is_failure_event(pl, envelope));
      const runs = Array.isArray(state["verification_runs"])
        ? [...(state["verification_runs"] as unknown[])]
        : [];
      runs.push({
        command: cmd.slice(0, 512),
        tool,
        exit_code: exit.code,
        // Provenance, not decoration: `response_shape` is a code this recorder
        // DERIVED from the host's success form, and a reader disputing a verdict
        // needs to know which of the three readings produced it.
        exit_source: exit.source,
        interrupted: exit.interrupted,
        stdout_tail: streams.stdout.slice(-RUN_OUTPUT_TAIL_BYTES),
        // Written, and previously not: `RunRecord.stderr_tail` was declared and
        // read by the classifier's `output()` while nothing populated it, so
        // stderr reached a parser only by accident inside a stringified blob.
        stderr_tail: streams.stderr.slice(-RUN_OUTPUT_TAIL_BYTES),
        runner: runnerOf(cmd),
        after_edits: _asInt(state["edits_this_turn"]),
        at: _now(),
      });
      // The NEWEST are kept for detector C, which asks whether a pass follows
      // the last edit. Detector F asks a question the head answers — was there a
      // red before the green — so the cap keeps the FIRST failing record too,
      // ahead of the tail, rather than letting a chatty turn drop the red half
      // of its own red-then-green pair.
      state["verification_runs"] = _cap_runs(runs);
    }
  } else if (event === "stop") {
    state["last_stop_at"] = _now();
  }

  state["checked_at"] = _now();
  return state;
}

export function run(
  stdin_text: string,
  options: { consumer_root: string; verbose?: boolean },
): number {
  const { consumer_root } = options;
  const verbose = options.verbose ?? false;

  let envelope: StateDict = {};
  if (stdin_text.trim()) {
    try {
      const decoded = JSON.parse(stdin_text) as unknown;
      if (typeof decoded === "object" && decoded !== null && !Array.isArray(decoded)) {
        envelope = decoded as StateDict;
      }
    } catch {
      envelope = {};
    }
  }

  const event = (envelope["event"] || "") as string;
  const session_id = typeof envelope["session_id"] === "string" ? envelope["session_id"] : "";

  // No stable identity → persist NOTHING. Sanitising an empty id into a shared
  // literal is the original cross-session defect restored in the one case with
  // no guard left (see `state_io` § has_stable_session_id).
  //
  // What that costs, and it is worse than the word this comment first used: on a
  // host that sends no `session_id` this concern records no evidence at all, so
  // `readCiSettled` returns "nothing observed" and the turn-end gate's completion
  // detector never fires. The first version called that "the SAFE direction —
  // under-refusing". A cross-model review (2026-08-20, both seats) rejected the
  // word: for a BLOCKING gate, not refusing is fail-OPEN. A premature completion
  // claim over unsettled CI passes unchallenged. This is DEGRADED ENFORCEMENT, and
  // naming it "safe" hides the loss behind a reassuring adjective.
  //
  // It is still the right call among the options available, which is a different
  // claim and the only one the evidence supports: the alternative is one shared
  // file whose contents belong to whichever concurrent run wrote last, i.e. a
  // gate that refuses or clears on somebody else's evidence. A gate that goes
  // quiet is recoverable; a gate that acts on a foreign witness is not.
  // Every host this suite binds `post_tool_use` on sends a `session_id`
  // (`hook_manifest.yaml` platforms × `native_event_aliases`), so the degraded
  // path is a fallback rather than a supported mode — but it is not verified per
  // host, and this comment does not claim it is.
  if (!has_stable_session_id(session_id)) {
    if (verbose) {
      process.stderr.write(
        "verify-before-complete-hook: no session_id — running stateless, nothing recorded\n",
      );
    }
    return 0;
  }

  const target = path.join(consumer_root, statePathFor(session_id));

  // LOAD → UPDATE → PUBLISH under ONE lock, not three separate steps.
  //
  // This was `_load_state` / `_update` / `atomic_write_json`, which makes the
  // publish atomic and leaves the transaction racy. A cross-model review
  // (2026-08-20, both seats) named the interleaving, and this host runs tool
  // calls in parallel, so it is reachable rather than theoretical: two
  // `post_tool_use` invocations for the SAME session both load the counter at
  // N, both compute N+1, both publish N+1, and one verification is lost. The
  // per-session split does nothing about it — the two failures are independent,
  // and closing the cross-session one made this one easier to mistake for
  // solved.
  //
  // `state` is captured for the verbose line below; the value that lands is the
  // one computed inside the lock, from state read inside the lock.
  let state: StateDict = {};
  // Three-state result (state_io § Three states, not two). This mutator NEVER
  // returns null, so `skipped` is unreachable here — but it is handled with
  // `written` rather than lumped with `failed`, because the two have opposite
  // meanings for this caller: a decline means the state needed no change, a
  // failure means the state on disk is not what this run computed. Writing
  // `!== "written"` would have made a future mutator that learns to decline
  // silently stop recording, which is the failure this API change exists to
  // make impossible to write by accident.
  const outcome = update_json_under_lock<StateDict>(target, (loaded) => {
    // `_empty_state()` UNDER the loaded value, which is what the `_load_state`
    // this replaced did (`{ ..._empty_state(), ...decoded }`). Dropping it would
    // have been a silent regression that the suite could not see: `_asInt`
    // treats a missing counter as 0 and the `=== true` guards treat a missing
    // flag as false, so every assertion would still pass while `schema_version`
    // and an explicit `ci_last: null` vanished from a freshly created file.
    state = _update({ ..._empty_state(), ...loaded } as StateDict, event, envelope);
    return state;
  });
  if (outcome === "failed") {
    if (verbose) {
      process.stderr.write("verify-before-complete-hook: state write failed\n");
    }
    return 0;
  }

  // Housekeeping on the once-per-turn events only — never on `post_tool_use`,
  // which fires many times per turn, and never before the write above.
  if (event === "session_start" || event === "user_prompt_submit") {
    prune_legacy_state_file(path.join(consumer_root, STATE_FILE));
    prune_stale_session_states(
      path.join(consumer_root, STATE_DIR),
      Date.now(),
      STATE_RETENTION_DAYS,
    );
  }

  if (verbose) {
    process.stderr.write(
      `verify-before-complete-hook: event=${event} ` +
        `verified_this_turn=${pyRepr(state["verified_this_turn"])} ` +
        `verifications_this_turn=${pyRepr(state["verifications_this_turn"])}\n`,
    );
  }
  return 0;
}

function pyRepr(value: unknown): string {
  if (value === null || value === undefined) {
    return "None";
  }
  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }
  return String(value);
}

interface ParsedArgs {
  platform: string;
  verbose: boolean;
}

function parse_args(argv: string[]): ParsedArgs {
  let platform = "generic";
  let verbose = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--platform") {
      platform = argv[i + 1] ?? "generic";
      i += 1;
    } else if (arg !== undefined && arg.startsWith("--platform=")) {
      platform = arg.slice("--platform=".length);
    } else if (arg === "--verbose") {
      verbose = true;
    }
  }
  return { platform, verbose };
}

function _readStdin(): string {
  return readHookStdin();
}

export function main(argv?: string[]): number {
  const args = parse_args(argv ?? process.argv.slice(2));
  return run(_readStdin(), { consumer_root: process.cwd(), verbose: args.verbose });
}

// ---------------------------------------------------------------------------
// The consumer side of `verification_runs`, living with its producer
// ---------------------------------------------------------------------------

/**
 * Why the turn-end gate's reader sits HERE and not in the gate.
 *
 * The shape of `verification_runs` and `edits_this_turn` is this file's; the
 * reader is the only consumer of that shape, and the gate already imported this
 * module's path BUILDER rather than a path constant for exactly the reason that
 * applies here too — "the consumer cannot read a path the producer does not
 * write" is only true while the two agree, and separating them made the
 * agreement invisible when the layout moved. Keeping the reader beside the
 * writer makes a shape change a type error in one file instead of a silent
 * disagreement across two.
 *
 * It also keeps the gate under its source-size ceiling without deleting
 * anything, which is the move the ratchet asks for rather than a trim.
 */
export interface TurnRunState {
  readonly runs: readonly unknown[];
  readonly edits_this_turn: number;
}

/**
 * The turn's recorded verification runs, or `null` when the recorder is not live.
 *
 * WHY THE LIVENESS TEST IS `edits_this_turn >= 1` AND NOT "the file exists".
 * The obvious predicate — a state file with a `verification_runs` key — is
 * wrong in a way that would refuse honest work on entire platforms. That key is
 * present in the recorder's EMPTY state, so a host whose `post_tool_use` slot
 * the manifest does not bind still has a file carrying `[]`, written by the
 * prompt and stop events alone. Reading that as "this turn ran nothing" would
 * refuse every editing turn on such a host, whatever the operator actually ran.
 *
 * `edits_this_turn` is the one field only a `post_tool_use` event can raise. The
 * detector reaches here having already found an edit in the transcript, so a
 * recorder that saw none of this turn's tool events is exactly the case this
 * returns `null` for — and `null` means the transcript path answers, which is
 * the behavior that predates the record path.
 *
 * The ownership check is the same one detector D applies to `ci_last`, for the
 * same reason: a FOREIGN file's passing record would vouch for a run this
 * session never made.
 */
export function readTurnRunState(
    workspaceRoot: string,
    session_id: string,
): TurnRunState | null {
    if (!has_stable_session_id(session_id)) return null;
    try {
        const raw = fs.readFileSync(path.join(workspaceRoot, statePathFor(session_id)), 'utf-8');
        const decoded: unknown = JSON.parse(raw);
        if (!owns_session_state(decoded, session_id)) return null;
        if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) return null;
        const state = decoded as Record<string, unknown>;
        const runs = state['verification_runs'];
        const edits = state['edits_this_turn'];
        if (!Array.isArray(runs)) return null;
        if (typeof edits !== 'number' || !Number.isFinite(edits) || edits < 1) return null;
        return { runs: runs as readonly unknown[], edits_this_turn: edits };
    } catch {
        // Absent, unreadable or malformed — the recorder said nothing, so the
        // transcript answers. Never a refusal of its own.
        return null;
    }
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url` (see cmd_migrate.ts).
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) {
        return false;
    }
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

const isCliEntry =
  _isCliEntry();
if (isCliEntry) {
  process.exit(main(process.argv.slice(2)));
}
