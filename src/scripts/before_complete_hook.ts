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
} from "./hooks/state_io.js";
import { readHookStdin } from "./hooks/hook_stdin.js";

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

// Permissive verification-command pattern. Observability — false positives
// are cheaper than false negatives. Word-boundary anchored on common
// shell separators so chained commands (`task sync && task ci`) match.
//
// Python re flags: IGNORECASE. The pattern uses no Python-specific syntax;
// it ports verbatim. The leading `(?:^|[\s;&|`(])` class includes backtick.
const _VERIFICATION_RE = new RegExp(
  "(?:^|[\\s;&|`(])(" +
    "task\\s+(?:ci|test|tests|lint|check|qa|phpstan|rector|ecs|pest|pytest)" +
    "|(?:\\./|\\.venv/bin/|vendor/bin/)?(?:pest|phpunit|phpstan|psalm|rector|ecs)\\b" +
    "|(?:python3?|\\.venv/bin/python3?)\\s+-m\\s+pytest" +
    "|pytest\\b" +
    "|(?:npm|pnpm|yarn|bun)\\s+(?:run\\s+)?(?:test|check|lint|typecheck|tsc)" +
    "|cargo\\s+(?:test|check|clippy)" +
    "|go\\s+test" +
    "|make\\s+(?:test|check|lint)" +
    "|composer\\s+(?:test|check|lint|phpstan)" +
    "|(?:php\\s+)?artisan\\s+test" +
    ")",
  "i",
);

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
  return _VERIFICATION_RE.test(command) || isCiPoll(command);
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

function _reset_turn(state: StateDict, session_id: string): StateDict {
  state["session_id"] = session_id || state["session_id"] || "";
  state["turn_started_at"] = _now();
  state["verifications_this_turn"] = 0;
  state["verified_this_turn"] = false;
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

  let payload = envelope["payload"];
  if (!(typeof payload === "object" && payload !== null && !Array.isArray(payload))) {
    payload = {};
  }
  const pl = payload as StateDict;

  if (event === "session_start" || event === "user_prompt_submit") {
    state = _reset_turn(state, session_id);
  } else if (event === "post_tool_use") {
    const [tool, cmd] = _extract_command(pl);
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
