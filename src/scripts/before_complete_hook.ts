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
 * Output: `agents/state/verify-before-complete.json`
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

import { atomic_write_json } from "./hooks/state_io.js";
import { readHookStdin } from "./hooks/hook_stdin.js";

// NOTE: the Python docstring says `agents/runtime/state/`, but the code
// constant is `agents/state/`. Replicated verbatim — latent docstring/code
// divergence in the retired Python implementation (ADR-200 § replicate latent bugs).
export const STATE_FILE = path.join("agents", "state", "verify-before-complete.json");

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
    checked_at: _now(),
  };
}

function _load_state(target: string): StateDict {
  let isFile = false;
  try {
    isFile = fs.statSync(target).isFile();
  } catch {
    isFile = false;
  }
  if (!isFile) {
    return _empty_state();
  }
  try {
    const decoded = JSON.parse(fs.readFileSync(target, "utf-8")) as unknown;
    if (typeof decoded === "object" && decoded !== null && !Array.isArray(decoded)) {
      return { ..._empty_state(), ...(decoded as StateDict) };
    }
  } catch {
    // fall through
  }
  return _empty_state();
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
    // A verification command that printed nothing at all is not evidence either.
    return true;
  }
  return _VACUOUS_PATTERNS.some((re) => re.test(text));
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
  const rows = output.match(/^\S.*\b(pending|in_progress|queued)\b/gim);
  return rows ? rows.length : null;
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
  const target = path.join(consumer_root, STATE_FILE);
  let state = _load_state(target);
  state = _update(state, event, envelope);

  try {
    atomic_write_json(target, state);
  } catch {
    if (verbose) {
      process.stderr.write("verify-before-complete-hook: state write failed\n");
    }
    return 0;
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
