#!/usr/bin/env node
/**
 * Platform-agnostic hook for the `verify-before-complete` rule.
 *
 * TypeScript twin of `src/scripts/verify_before_complete_hook.py` (ADR-094 —
 * Python→TS migration, Phase 6 / hooks). Public API mirrors the Python
 * module exactly (snake_case kept deliberately — fidelity over TS idiom).
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
import { pathToFileURL } from "node:url";

import { atomic_write_json } from "./hooks/state_io.js";

// NOTE: the Python docstring says `agents/runtime/state/`, but the code
// constant is `agents/state/`. Replicated verbatim — latent docstring/code
// divergence in the Python original (ADR-094 § replicate latent bugs).
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
  return _VERIFICATION_RE.test(command);
}

function _reset_turn(state: StateDict, session_id: string): StateDict {
  state["session_id"] = session_id || state["session_id"] || "";
  state["turn_started_at"] = _now();
  state["verifications_this_turn"] = 0;
  state["verified_this_turn"] = false;
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
      state["last_verification"] = {
        command: cmd.slice(0, 512),
        tool,
        at: _now(),
        platform: (envelope["platform"] || "") as unknown,
      };
      state["verifications_this_turn"] = _asInt(state["verifications_this_turn"]) + 1;
      state["verifications_this_session"] =
        _asInt(state["verifications_this_session"]) + 1;
      state["verified_this_turn"] = true;
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
  try {
    return fs.readFileSync(0, "utf-8");
  } catch {
    return "";
  }
}

export function main(argv?: string[]): number {
  const args = parse_args(argv ?? process.argv.slice(2));
  return run(_readStdin(), { consumer_root: process.cwd(), verbose: args.verbose });
}

const isCliEntry =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCliEntry) {
  process.exit(main(process.argv.slice(2)));
}
