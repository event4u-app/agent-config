#!/usr/bin/env tsx
/**
 * PreToolUse RTK-wrap nudge — deterministic, warn-in-context
 * (token-saving Phase 3).
 *
 * Converts RTK from advisory to DETERMINISTIC: instead of trusting a
 * self-reported flag, this hook keys off a live `which rtk` probe. When rtk is
 * actually installed AND the agent is about to run a single verbose CLI command
 * that is NOT completeness-critical, it surfaces (warn) "re-run wrapped with
 * rtk" so the 60–90% output-token saving is captured. It NEVER blocks (the v1
 * dispatcher contract is allow/block/warn — there is no transparent
 * `updatedInput` rewrite — and, like `injection_scan_hook`, warn preserves
 * agency). It NEVER fires when rtk is absent (silent plain-command fallback,
 * no nag).
 *
 * Default-OFF. Fires only when `hooks.rtk_wrap.enabled: true` in
 * `.agent-settings.yml`. Disabled / missing / rtk-absent → no-op exit 0.
 * fail_closed: false — any parse/probe error returns allow (never break a
 * command for a token optimization).
 *
 * Denylist (never nudged — completeness-critical or already-handled):
 *   - `git diff` / `rtk read` (silent truncation risk — see the rtk skill)
 *   - already `rtk …` wrapped, or piped / compound (`|`, `&&`, `||`, `;`)
 *   - any program not in the verbose-CLI allowlist
 *
 * Exit codes (dispatcher contract): 0 allow · 2 warn (+ JSON reason on stdout).
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  shlexSplit,
  ShlexError,
  _split_subcommands,
  _is_env_assignment,
} from "./block_no_verify.js";

const SETTINGS_FILE = ".agent-settings.yml";
const EXIT_ALLOW = 0;
const EXIT_WARN = 2;

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

// Verbose-CLI programs worth wrapping — mirrors the cli-output-handling rule
// triggers + the rtk skill's "✅ Always" table. Kept in sync with
// src/rules/cli-output-handling.md.
const _RTK_PROGRAMS: ReadonlySet<string> = new Set([
  "git", "phpstan", "rector", "phpunit", "composer",
  "npm", "pnpm", "yarn", "eslint", "tsc", "vitest", "jest",
  "pytest", "ruff", "mypy", "pyright", "cargo", "go",
  "golangci-lint", "docker", "kubectl", "terraform",
]);

function _isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** `hooks.rtk_wrap.enabled: true` mini-parser (mirrors injection_scan_hook). */
function _enabled(root: string): boolean {
  const f = path.join(root, SETTINGS_FILE);
  try {
    if (!fs.statSync(f).isFile()) return false;
  } catch {
    return false;
  }
  let text: string;
  try {
    text = fs.readFileSync(f, "utf-8");
  } catch {
    return false;
  }
  let in_hooks = false;
  let in_rw = false;
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (!line || line.replace(/^\s+/, "").startsWith("#")) continue;
    if (!(line.startsWith(" ") || line.startsWith("\t"))) {
      in_hooks = /^hooks\s*:\s*$/.test(line);
      in_rw = false;
      continue;
    }
    if (in_hooks) {
      if (/^\s+rtk_wrap\s*:\s*$/.test(line)) {
        in_rw = true;
        continue;
      }
      if (in_rw && /^\s{0,3}\S/.test(line)) in_rw = false;
    }
    if (in_rw && /^\s+enabled\s*:\s*true\b/.test(line)) return true;
  }
  return false;
}

/** Live `which rtk` — scan PATH for an executable `rtk` (cross-platform). */
export function rtk_available(env: NodeJS.ProcessEnv = process.env): boolean {
  const pathVar = env.PATH ?? env.Path ?? "";
  if (!pathVar) return false;
  const dirs = pathVar.split(path.delimiter).filter(Boolean);
  // On Windows the launcher is rtk.exe / rtk.cmd / rtk.bat.
  const exts = process.platform === "win32" ? ["", ".exe", ".cmd", ".bat"] : [""];
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, `rtk${ext}`);
      try {
        const st = fs.statSync(candidate);
        if (st.isFile()) {
          // POSIX: require an executable bit; Windows: extension is enough.
          if (process.platform === "win32" || (st.mode & 0o111) !== 0) return true;
        }
      } catch {
        /* not here — keep scanning */
      }
    }
  }
  return false;
}

function _extract_command(envelope: JsonObject): string | null {
  const payload = (_isObject(envelope["payload"]) ? envelope["payload"] : {}) as JsonObject;
  const tool_input = (_isObject(payload["tool_input"]) ? payload["tool_input"] : {}) as JsonObject;
  for (const src of [tool_input["command"], payload["command"], envelope["command"]]) {
    if (typeof src === "string") return src;
  }
  return null;
}

export interface Eligibility {
  eligible: boolean;
  program?: string;
  reason_skip?: string;
}

/**
 * A command is eligible for an rtk-wrap nudge iff it is a SINGLE simple command
 * (no pipe / compound separators), whose program is a known verbose CLI, and is
 * not a completeness-critical / already-wrapped case.
 */
export function classify(command: string): Eligibility {
  const cmd = command.trim();
  if (!cmd) return { eligible: false, reason_skip: "empty" };

  let tokens: string[];
  try {
    tokens = shlexSplit(cmd);
  } catch (e) {
    if (e instanceof ShlexError) return { eligible: false, reason_skip: "parse-error" };
    throw e;
  }

  // Compound / piped → don't wrap (rtk wraps a single command). `_split_subcommands`
  // splits on && || ; | — more than one group means a pipeline/chain.
  const groups = _split_subcommands(tokens);
  if (groups.length !== 1) return { eligible: false, reason_skip: "compound-or-piped" };

  const sub = groups[0] as string[];
  let i = 0;
  while (i < sub.length && _is_env_assignment(sub[i] as string)) i += 1;
  const program = sub[i];
  if (!program) return { eligible: false, reason_skip: "no-program" };
  if (program === "rtk") return { eligible: false, reason_skip: "already-rtk" };
  if (!_RTK_PROGRAMS.has(program)) return { eligible: false, program, reason_skip: "not-verbose-cli" };
  // `git diff` is completeness-critical (silent truncation) — never wrap.
  if (program === "git" && sub[i + 1] === "diff") {
    return { eligible: false, program, reason_skip: "git-diff-denylisted" };
  }
  return { eligible: true, program };
}

function _readStdin(): string {
  try {
    if (process.stdin.isTTY) return "";
    return fs.readFileSync(0, "utf-8");
  } catch {
    return "";
  }
}

function _jsonReason(reason: string): string {
  return JSON.stringify({ decision: "warn", reason });
}

export function main(): number {
  let envelope: JsonValue;
  try {
    const raw = _readStdin();
    envelope = raw.trim() ? (JSON.parse(raw) as JsonValue) : {};
  } catch {
    return EXIT_ALLOW; // never break a command on a malformed envelope
  }
  if (!_isObject(envelope)) return EXIT_ALLOW;

  const cwd = envelope["cwd"];
  const projectRoot = envelope["workspace_root"] ?? envelope["project_root"];
  const root =
    typeof cwd === "string" && cwd
      ? cwd
      : typeof projectRoot === "string" && projectRoot
        ? projectRoot
        : ".";
  if (!_enabled(root)) return EXIT_ALLOW;

  // Deterministic gate: the live probe, NOT a self-reported flag.
  if (!rtk_available()) return EXIT_ALLOW;

  const command = _extract_command(envelope);
  if (!command) return EXIT_ALLOW;

  const verdict = classify(command);
  if (!verdict.eligible) return EXIT_ALLOW;

  const reason =
    `rtk is installed and wraps verbose CLI output (60–90% fewer output tokens). ` +
    `Re-run wrapped: \`rtk ${command.trim()}\`. ` +
    `(Skip for completeness-critical output like \`git diff\`.)`;
  process.stdout.write(`${_jsonReason(reason)}\n`);
  return EXIT_WARN;
}

const _isCliEntry =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry) {
  process.exit(main());
}
