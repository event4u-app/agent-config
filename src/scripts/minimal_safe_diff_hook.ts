#!/usr/bin/env node
/**
 * Platform-agnostic hook for the `minimal-safe-diff` rule.
 *
 * TypeScript twin of `src/scripts/minimal_safe_diff_hook.py` (ADR-090 —
 * Python→TS migration, Phase 6 / hooks). Public API mirrors the Python
 * module exactly (snake_case kept deliberately — fidelity over TS idiom).
 *
 * Pre-edit gate: counts unique files touched in the current turn (or
 * session, when the platform lacks a turn-boundary signal) and warns
 * when the count exceeds the configured threshold. The hook never
 * blocks — it is observability infra. The rule body cites the resulting
 * state file when the agent prepares a diff for review.
 *
 * Wired to multiple events via the manifest:
 *   - session_start / user_prompt_submit → reset turn-scoped counters
 *   - pre_tool_use → record the planned edit's path before execution
 *
 * Output: `agents/state/minimal-safe-diff.json`
 *   {
 *     "schema_version": 1,
 *     "session_id": "<str>",
 *     "turn_started_at": "<iso8601|null>",
 *     "files_touched_this_turn": ["a", "b", ...],
 *     "count": <int>,
 *     "threshold": <int>,
 *     "warning": <bool>,
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
// divergence in the Python original (ADR-090 § replicate latent bugs).
export const STATE_FILE = path.join("agents", "state", "minimal-safe-diff.json");
export const SETTINGS_FILE = ".agent-settings.yml";
export const DEFAULT_THRESHOLD = 5;
export const MAX_TRACKED_PATHS = 200; // hard cap to keep the state file bounded

// Edit-tool names across platforms whose successful invocation results
// in a file being modified, created, or deleted. Keep explicit so an
// unknown tool doesn't trigger a false positive.
export const EDIT_TOOLS: ReadonlySet<string> = new Set([
  "str-replace-editor",
  "str_replace_editor", // Augment
  "save-file",
  "save_file", // Augment
  "remove-files",
  "remove_files", // Augment
  "Edit",
  "Write",
  "MultiEdit", // Claude Code
  "edit_file",
  "edit-file", // Cursor
  "create_file",
  "create-file",
  "delete_file", // variants
]);

type StateDict = Record<string, unknown>;

/** Python datetime.now(timezone.utc).isoformat(timespec="seconds"). */
function _now(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

function _empty_state(threshold: number): StateDict {
  return {
    schema_version: 1,
    session_id: "",
    turn_started_at: null,
    files_touched_this_turn: [],
    count: 0,
    threshold,
    warning: false,
    checked_at: _now(),
  };
}

/**
 * Parse `hooks.minimal_safe_diff.threshold` from .agent-settings.yml.
 *
 * Dependency-free YAML scan — we only need a single integer under a
 * nested block; pulling a YAML parser in for this would be overkill.
 */
function _read_threshold(consumer_root: string): number {
  const settings = path.join(consumer_root, SETTINGS_FILE);
  let isFile = false;
  try {
    isFile = fs.statSync(settings).isFile();
  } catch {
    isFile = false;
  }
  if (!isFile) {
    return DEFAULT_THRESHOLD;
  }
  let text: string;
  try {
    text = fs.readFileSync(settings, "utf-8");
  } catch {
    return DEFAULT_THRESHOLD;
  }

  let in_hooks = false;
  let in_msd = false;
  for (const raw of text.split("\n")) {
    // Python str.rstrip() — strip trailing whitespace (incl. \r).
    const line = raw.replace(/\s+$/, "");
    if (!line || line.replace(/^\s+/, "").startsWith("#")) {
      continue;
    }
    // top-level key resets nested context
    if (line && !(line.startsWith(" ") || line.startsWith("\t"))) {
      in_hooks = /^hooks\s*:\s*$/.test(line);
      in_msd = false;
      continue;
    }
    if (in_hooks) {
      if (/^\s+minimal_safe_diff\s*:\s*$/.test(line)) {
        in_msd = true;
        continue;
      }
      // leaving the minimal_safe_diff block when indent decreases
      if (in_msd && /^\s{0,3}\S/.test(line)) {
        in_msd = false;
      }
    }
    if (in_msd) {
      const m = /^\s+threshold\s*:\s*(\d+)\s*(?:#.*)?$/.exec(line);
      if (m && m[1] !== undefined) {
        const val = parseInt(m[1], 10);
        // Python int() on a \d+ match never raises; the ValueError branch
        // is dead, but the `val > 0 else DEFAULT` guard is replicated.
        return val > 0 ? val : DEFAULT_THRESHOLD;
      }
    }
  }
  return DEFAULT_THRESHOLD;
}

function _load_state(target: string, threshold: number): StateDict {
  let isFile = false;
  try {
    isFile = fs.statSync(target).isFile();
  } catch {
    isFile = false;
  }
  if (!isFile) {
    return _empty_state(threshold);
  }
  try {
    const decoded = JSON.parse(fs.readFileSync(target, "utf-8")) as unknown;
    if (typeof decoded === "object" && decoded !== null && !Array.isArray(decoded)) {
      const base = _empty_state(threshold);
      Object.assign(base, decoded as StateDict);
      base["threshold"] = threshold; // always reflect current setting
      return base;
    }
  } catch {
    // fall through
  }
  return _empty_state(threshold);
}

function _candidate_paths(payload: StateDict): string[] {
  const out: string[] = [];
  const fc = payload["file_changes"];
  if (Array.isArray(fc)) {
    for (const entry of fc) {
      if (typeof entry === "object" && entry !== null && !Array.isArray(entry)) {
        const p = (entry as StateDict)["path"];
        if (typeof p === "string" && p) {
          out.push(p);
        }
      }
    }
  }
  const ti = payload["tool_input"];
  if (typeof ti === "object" && ti !== null && !Array.isArray(ti)) {
    for (const key of ["path", "file_path", "target_file", "filename"]) {
      const v = (ti as StateDict)[key];
      if (typeof v === "string" && v) {
        out.push(v);
      }
    }
  }
  return out;
}

function _normalize(p: string): string {
  // Python str.lstrip("./") strips any leading run of chars in the set
  // {'.', '/'} (NOT a "./" prefix) — replicate that character-set strip.
  return p.replace(/^[./]+/, "").replace(/\\/g, "/");
}

function _reset_turn(state: StateDict, session_id: string): StateDict {
  state["session_id"] = session_id || state["session_id"] || "";
  state["turn_started_at"] = _now();
  state["files_touched_this_turn"] = [];
  state["count"] = 0;
  state["warning"] = false;
  return state;
}

function _update(
  state: StateDict,
  event: string,
  envelope: StateDict,
  threshold: number,
): StateDict {
  const session_id = (envelope["session_id"] || state["session_id"] || "") as string;
  if (session_id && session_id !== state["session_id"]) {
    state = _reset_turn(state, session_id);
  }

  let payload = envelope["payload"];
  if (!(typeof payload === "object" && payload !== null && !Array.isArray(payload))) {
    payload = {};
  }
  const pl = payload as StateDict;

  if (event === "session_start" || event === "user_prompt_submit") {
    state = _reset_turn(state, session_id);
  } else if (event === "pre_tool_use" || event === "post_tool_use") {
    const tool = pl["tool_name"] || pl["toolName"] || pl["tool"];
    if (typeof tool === "string" && EDIT_TOOLS.has(tool)) {
      const existing = state["files_touched_this_turn"];
      let touched: string[] = Array.isArray(existing)
        ? (existing as string[]).slice()
        : [];
      const seen = new Set<string>(touched);
      for (const raw of _candidate_paths(pl)) {
        const norm = _normalize(raw);
        if (norm && !seen.has(norm)) {
          seen.add(norm);
          touched.push(norm);
        }
      }
      if (touched.length > MAX_TRACKED_PATHS) {
        touched = touched.slice(-MAX_TRACKED_PATHS);
      }
      state["files_touched_this_turn"] = touched;
      state["count"] = touched.length;
      state["warning"] = touched.length > threshold;
    }
  }

  state["threshold"] = threshold;
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
  const threshold = _read_threshold(consumer_root);
  const target = path.join(consumer_root, STATE_FILE);
  let state = _load_state(target, threshold);
  state = _update(state, event, envelope, threshold);

  try {
    atomic_write_json(target, state);
  } catch {
    if (verbose) {
      process.stderr.write("minimal-safe-diff-hook: state write failed\n");
    }
    return 0;
  }

  if (verbose) {
    process.stderr.write(
      `minimal-safe-diff-hook: event=${event} ` +
        `count=${pyRepr(state["count"])} threshold=${threshold} ` +
        `warning=${pyRepr(state["warning"])}\n`,
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
