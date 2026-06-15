#!/usr/bin/env node
/**
 * Platform-agnostic PostToolUse hook for the `context-hygiene` rule.
 *
 * TypeScript twin of `src/scripts/context_hygiene_hook.py` (ADR-200 —
 * Python→TS migration, Phase 6 / hooks). Public API mirrors the Python
 * module exactly (snake_case kept deliberately — fidelity over TS idiom).
 *
 * Maintains a deterministic state file the rule body cites for the
 * freshness threshold, the 3-failure stop, and tool-loop detection. The
 * agent's job shrinks from "remember three counters" to "read this file
 * before responding".
 *
 * Output: `agents/state/context-hygiene.json`
 *   {
 *     "tool_calls": <int>,                 // running PostToolUse count
 *     "consecutive_same_tool": <int>,      // includes the latest call
 *     "last_tool": "<name>",
 *     "tool_history": [..., last 5 names],
 *     "loop_detected": <bool>,             // ≥ 3 same tool in a row
 *     "freshness_threshold": <int|null>,   // 20/40/60 milestone hit
 *     "checked_at": "<iso8601>"
 *   }
 *
 * Exit code is always 0.
 *
 * CLI:
 *   context_hygiene_hook.ts [--platform NAME] [--verbose]
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Re-use the shared atomic-write helper so concerns honour the single
// `agents/runtime/state/.dispatcher.lock` discipline (hook-architecture-v1.md
// § Concurrency, Phase 7.4).
import { atomic_write_json } from "./hooks/state_io.js";

// NOTE: the Python docstring says `agents/runtime/state/`, but the code
// constant is `agents/state/`. Replicated verbatim — this is a latent
// docstring/code divergence in the Python original (ADR-200 § replicate
// latent bugs), and `STATE_FILE` is what the test suite asserts against.
export const STATE_DIR = path.join("agents", "state");
export const STATE_FILE = path.join(STATE_DIR, "context-hygiene.json");

export const LOOP_THRESHOLD = 3; // 3+ consecutive same-tool calls
export const HISTORY_DEPTH = 5;
export const FRESHNESS_MILESTONES = [20, 40, 60] as const;

// A loose JSON object used for the parsed payload / state. Snake_case keys
// mirror the Python dict shape exactly.
type StateDict = Record<string, unknown>;

function _empty_state(): StateDict {
  return {
    tool_calls: 0,
    consecutive_same_tool: 0,
    last_tool: null,
    tool_history: [],
    loop_detected: false,
    freshness_threshold: null,
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
      return decoded as StateDict;
    }
  } catch {
    // Corrupt — start fresh, never block.
  }
  return _empty_state();
}

function _extract_tool(payload: StateDict): string | null {
  for (const key of ["tool_name", "toolName", "tool"]) {
    const v = payload[key];
    if (typeof v === "string" && v) {
      return v;
    }
  }
  return null;
}

/** Return the milestone crossed by going from `prev` to `curr`, else null. */
function _milestone_hit(prev: number, curr: number): number | null {
  for (const ms of FRESHNESS_MILESTONES) {
    if (prev < ms && ms <= curr) {
      return ms;
    }
  }
  return null;
}

/** Python datetime.now(timezone.utc).isoformat(timespec="seconds"). */
function _now_iso(): string {
  // e.g. "2026-06-12T10:30:00+00:00" — UTC offset, seconds precision.
  return new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

function _asInt(v: unknown): number {
  // Python `int(state.get(...) or 0)` semantics: falsy → 0, else int().
  if (!v) {
    return 0;
  }
  if (typeof v === "number") {
    return Math.trunc(v);
  }
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function _update(state: StateDict, tool: string | null): StateDict {
  if (tool === null) {
    // Non-tool event (e.g. malformed payload) — still mark we ran.
    state["checked_at"] = _now_iso();
    return state;
  }

  const prev_count = _asInt(state["tool_calls"]);
  const curr_count = prev_count + 1;
  state["tool_calls"] = curr_count;

  const last = state["last_tool"];
  if (last === tool) {
    state["consecutive_same_tool"] = _asInt(state["consecutive_same_tool"]) + 1;
  } else {
    state["consecutive_same_tool"] = 1;
  }
  state["last_tool"] = tool;

  let hist = state["tool_history"];
  if (!Array.isArray(hist)) {
    hist = [];
  }
  (hist as unknown[]).push(tool);
  state["tool_history"] = (hist as unknown[]).slice(-HISTORY_DEPTH);

  state["loop_detected"] = _asInt(state["consecutive_same_tool"]) >= LOOP_THRESHOLD;

  const ms = _milestone_hit(prev_count, curr_count);
  if (ms !== null) {
    state["freshness_threshold"] = ms;
  }
  state["checked_at"] = _now_iso();
  return state;
}

/**
 * Write the state file atomically under the shared dispatcher lock
 * (hook-architecture-v1.md § Concurrency, Phase 7.4).
 */
function _write_state(consumer_root: string, state: StateDict): void {
  atomic_write_json(path.join(consumer_root, STATE_FILE), state);
}

export function run(
  stdin_text: string,
  options: { consumer_root: string; verbose?: boolean },
): number {
  const { consumer_root } = options;
  const verbose = options.verbose ?? false;

  let payload: StateDict = {};
  if (stdin_text.trim()) {
    try {
      const decoded = JSON.parse(stdin_text) as unknown;
      if (typeof decoded === "object" && decoded !== null && !Array.isArray(decoded)) {
        payload = decoded as StateDict;
      }
    } catch {
      // silent no-op, never block
    }
  }

  // Unwrap dispatcher envelope (Phase 7.3, hook-architecture-v1.md).
  if (["schema_version", "platform", "event", "payload"].every((k) => k in payload)) {
    const inner = payload["payload"];
    payload =
      typeof inner === "object" && inner !== null && !Array.isArray(inner)
        ? (inner as StateDict)
        : {};
  }

  const target = path.join(consumer_root, STATE_FILE);
  let state = _load_state(target);
  state = _update(state, _extract_tool(payload));

  try {
    _write_state(consumer_root, state);
  } catch {
    if (verbose) {
      process.stderr.write("context-hygiene-hook: state write failed\n");
    }
    return 0;
  }

  if (verbose) {
    process.stderr.write(
      `context-hygiene-hook: tool_calls=${pyRepr(state["tool_calls"])} ` +
        `loop=${pyRepr(state["loop_detected"])} ` +
        `threshold=${pyRepr(state["freshness_threshold"])}\n`,
    );
  }
  return 0;
}

// Python str() of a value as it appears in the verbose line: booleans
// render "True"/"False", None renders "None", ints render bare.
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
