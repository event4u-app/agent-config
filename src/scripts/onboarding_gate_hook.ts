#!/usr/bin/env node
/**
 * Platform-agnostic hook for the `onboarding-gate` rule.
 *
 * TypeScript twin of `src/scripts/onboarding_gate_hook.py` (ADR-089 —
 * Python→TS migration, Phase 6 / hooks). Public API mirrors the Python
 * module exactly (snake_case kept deliberately — fidelity over TS idiom).
 *
 * Reads `.agent-settings.yml` from the consumer repo and writes a
 * deterministic state file the rule body can cite as the source of
 * truth for "do I need to prompt the user about /onboard?".
 *
 * Output is written to `agents/runtime/state/onboarding-gate.json` with:
 *   {
 *     "required": <bool>,         // true → rule fires on first turn
 *     "reason":   "<string>",     // why this state was set
 *     "checked_at": "<iso8601>",  // last hook run
 *     "settings_present": <bool>  // .agent-settings.yml exists
 *   }
 *
 * Exit code is **always 0**. Hooks must never block the agent loop.
 *
 * Output discipline:
 *   - stdout: nothing (Augment surfaces stdout to the user)
 *   - stderr: one short line in --verbose mode, otherwise silent
 *
 * CLI:
 *   onboarding_gate_hook.ts [--platform NAME] [--verbose]
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Re-use the shared atomic-write helper so concerns honour the single
// `agents/runtime/state/.dispatcher.lock` discipline (hook-architecture-v1.md
// § Concurrency, Phase 7.4).
import { atomic_write_json } from "./hooks/state_io.js";

export const SETTINGS_FILE = ".agent-settings.yml";
// NOTE: the Python docstring says `agents/runtime/state/`, but the code
// constant is `agents/state/`. Replicated verbatim — this is a latent
// docstring/code divergence in the Python original (ADR-089 § replicate
// latent bugs), and `STATE_FILE` is what the test suite asserts against.
export const STATE_DIR = path.join("agents", "state");
export const STATE_FILE = path.join(STATE_DIR, "onboarding-gate.json");

/**
 * Return [required, reason] — minimal, dependency-free YAML parsing.
 *
 * We only need a single key under the `onboarding:` block. Full YAML is
 * overkill (and would pull in a runtime dep). We scan line-by-line for
 * `onboarded: <bool>` inside the `onboarding:` section.
 */
function _read_onboarded(settings_path: string): [boolean, string] {
  let isFile = false;
  try {
    isFile = fs.statSync(settings_path).isFile();
  } catch {
    isFile = false;
  }
  if (!isFile) {
    return [false, "settings_file_missing"]; // legacy: do not block
  }

  let text: string;
  try {
    text = fs.readFileSync(settings_path, "utf-8");
  } catch {
    return [false, "settings_file_unreadable"];
  }

  let in_onboarding = false;
  let onboarded_value: string | null = null;
  for (const raw of text.split("\n")) {
    // Python str.rstrip() strips trailing whitespace (incl. \r).
    const line = raw.replace(/\s+$/, "");
    if (!line || line.replace(/^\s+/, "").startsWith("#")) {
      continue;
    }
    if (/^onboarding\s*:\s*$/.test(line)) {
      in_onboarding = true;
      continue;
    }
    if (in_onboarding) {
      // Section ends when a top-level (non-indented) key starts.
      if (line && !(line.startsWith(" ") || line.startsWith("\t"))) {
        break;
      }
      const m = /^\s+onboarded\s*:\s*(\S+)\s*(?:#.*)?$/.exec(line);
      if (m && m[1] !== undefined) {
        onboarded_value = m[1].trim().toLowerCase();
      }
    }
  }

  if (onboarded_value === null) {
    return [false, "key_missing"]; // legacy / pre-rule project
  }
  if (["true", "yes", "on"].includes(onboarded_value)) {
    return [false, "already_onboarded"];
  }
  if (["false", "no", "off"].includes(onboarded_value)) {
    return [true, "explicit_false"];
  }
  return [false, `unknown_value:${onboarded_value}`];
}

/** Python datetime.now(timezone.utc).isoformat(timespec="seconds"). */
function _now_iso(): string {
  // e.g. "2026-06-12T10:30:00+00:00" — UTC offset, seconds precision.
  return new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

/**
 * Write `agents/runtime/state/onboarding-gate.json` atomically.
 *
 * Uses the shared `agents/runtime/state/.dispatcher.lock` so concurrent
 * dispatcher invocations across platforms cannot tear the file
 * (hook-architecture-v1.md § Concurrency, Phase 7.4).
 */
function _write_state(
  consumer_root: string,
  required: boolean,
  reason: string,
  settings_present: boolean,
): void {
  const payload = {
    required,
    reason,
    checked_at: _now_iso(),
    settings_present,
  };
  atomic_write_json(path.join(consumer_root, STATE_FILE), payload);
}

export function run(options: {
  consumer_root: string;
  verbose?: boolean;
}): number {
  const { consumer_root } = options;
  const verbose = options.verbose ?? false;
  const settings_path = path.join(consumer_root, SETTINGS_FILE);
  let settings_present = false;
  try {
    settings_present = fs.statSync(settings_path).isFile();
  } catch {
    settings_present = false;
  }

  let required: boolean;
  let reason: string;
  try {
    [required, reason] = _read_onboarded(settings_path);
  } catch {
    [required, reason] = [false, "hook_error"];
  }

  try {
    _write_state(consumer_root, required, reason, settings_present);
  } catch {
    if (verbose) {
      process.stderr.write("onboarding-gate-hook: state write failed\n");
    }
    return 0; // never block
  }

  if (verbose) {
    process.stderr.write(
      `onboarding-gate-hook: required=${pyBool(required)} reason=${reason}\n`,
    );
  }
  return 0;
}

// Python prints booleans as "True"/"False".
function pyBool(value: boolean): string {
  return value ? "True" : "False";
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

function _readStdin(): void {
  try {
    fs.readFileSync(0, "utf-8");
  } catch {
    /* ignore */
  }
}

export function main(argv?: string[]): number {
  const args = parse_args(argv ?? process.argv.slice(2));
  // Drain stdin so callers piping JSON don't block on a SIGPIPE on
  // platforms that strictly require stdin to be consumed.
  _readStdin();
  return run({ consumer_root: process.cwd(), verbose: args.verbose });
}

const isCliEntry =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isCliEntry) {
  process.exit(main(process.argv.slice(2)));
}
