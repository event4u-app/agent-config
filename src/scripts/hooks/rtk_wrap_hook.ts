#!/usr/bin/env tsx
/**
 * PreToolUse RTK-wrap nudge — deterministic, warn-in-context
 * (token-saving Phase 3).
 *
 * Converts RTK from advisory to DETERMINISTIC: instead of trusting a
 * self-reported flag, this hook keys off a live probe — PATH presence PLUS an
 * `rtk gain` identity check (the binary name collides with the unrelated Rust
 * Type Kit; see src/install/rtkDetection.ts). When a VERIFIED Rust Token
 * Killer is installed AND the agent is about to run a single verbose CLI
 * command that is NOT completeness-critical, it surfaces (warn) "re-run
 * wrapped with rtk" so the upstream-reported 60–90% output-token saving is
 * captured. It NEVER blocks, and like `injection_scan_hook`, warn preserves
 * agency. It NEVER fires when rtk is absent (silent plain-command fallback,
 * no nag).
 *
 * CORRECTED 2026-08-23 (re-probed, Claude Code 2.1.241). This header used to say
 * "the v1 dispatcher contract is allow/block/warn — there is no transparent
 * `updatedInput` rewrite". **That was false for this host build**, and it was also
 * undated, which is the worse half: an unpinned capability claim cannot be checked
 * against the build it was true for. The host documents
 * `` `updatedInput` - Modified tool input (PreToolUse only) ``, validates its
 * schema, and logs a fallback when it is absent
 * (`agents/evidence/analysis/host-input-rewrite-probe-2026-08-23.md`).
 *
 * What IS true, and is why this hook still only warns: **this dispatcher does not
 * emit it, and no accepted composition policy exists for it.** The dispatcher
 * aggregates many concerns per event and reduces them to one exit code; what
 * happens when two concerns both want to rewrite the same tool input is an
 * unanswered design question, not a plumbing detail. A default-OFF hook that
 * silently changes what the agent runs is also a materially different safety
 * posture from one that warns. AI council 2026-08-23, 2/2 convergent, chose the
 * warn and recorded the rewrite as REJECTED-FOR-NOW on those two grounds rather
 * than on the refuted host claim — with a reopening condition, so a temporary
 * design gap does not become permanent inertia.
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
 * Second branch (token-economy-cache Phase 4.2, advisory-degraded): for
 * commands rtk cannot wrap — an unbounded tree-wide search per the committed
 * OUTPUT_CAP_TABLE below — emit a warn naming the bounded alternative. No
 * rewrite, no truncation; see the table's comment for the degradation record.
 *
 * Exit codes (dispatcher contract): 0 allow · 2 warn (+ JSON reason on stdout).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  shlexSplit,
  ShlexError,
  _split_subcommands,
  _is_env_assignment,
} from "./block_no_verify.js";
import { readHookStdin } from "./hook_stdin.js";
import { detectRtkCached } from "../../install/rtkDetection.js";

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
    tokens = shlexSplit(cmd, true);
  } catch (e) {
    if (e instanceof ShlexError) return { eligible: false, reason_skip: "parse-error" };
    throw e;
  }

  // Compound / piped → don't wrap (rtk wraps a single command). `_split_subcommands`
  // splits on && || ; | & — more than one group means a pipeline/chain.
  // `splitOperators` is REQUIRED here: POSIX shlex leaves a separator attached
  // to the preceding word, so `foo; bar` tokenised to one group and read as a
  // single command. Same construct as the block_no_verify defect measured
  // 2026-08-20; found by the sibling search for that fix, 2 call sites, both
  // in this file.
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

// ── Unbounded-output cap ADVISORY (token-economy-cache Phase 4.2) ──────────
// The roadmap step asked for a deterministic PreToolUse cap REWRITE. It degrades
// to an ADVISORY per that roadmap's pre-registered consequence — but NOT for the
// reason recorded here until 2026-08-23, which was "the v1 dispatcher contract
// carries no `updatedInput`". Re-probed against Claude Code 2.1.241: the host
// carries it (see the header, and
// agents/evidence/analysis/host-input-rewrite-probe-2026-08-23.md). The real
// reason is that THIS dispatcher emits no such field and has no accepted
// composition policy for one across concerns. Same outcome, correct cause: a committed
// per-command cap table (this constant — rows individually removable,
// per-row opt-out via `enabled`) and a warn naming the bounded alternative.
// Nothing is ever truncated; ignoring the advisory IS the uncapped re-run,
// and repeated fires in the dispatcher's warn counters are the demand
// signal that calibrates the table. Table scope is evidence-bound: only the
// class the 2026-08-10 corpus run measured (tree-wide search — 302 KB raw
// vs 21 KB bounded on this repo; internal/bench/rtk-savings/RESULTS.md).
export interface CapRow {
  enabled: boolean;
  /** long flags whose presence means the output is already bounded */
  bounded_long_flags: readonly string[];
  /** short-option letters (combined forms like `-rln` count) that bound output */
  bounded_short_letters: string;
  /** fire only when a recursive/tree-wide flag is present ("" = always tree-wide) */
  recursive_short_letters: string;
  recursive_long_flags: readonly string[];
  hint: string;
}

export const OUTPUT_CAP_TABLE: Readonly<Record<string, CapRow>> = {
  grep: {
    enabled: true,
    bounded_long_flags: ["--files-with-matches", "--count", "--max-count"],
    bounded_short_letters: "lcm",
    recursive_short_letters: "rR",
    recursive_long_flags: ["--recursive", "--dereference-recursive"],
    hint: "add `-l` (files only) or `-m 5` (per-file cap), or pipe through `| head -n 100`",
  },
  rg: {
    enabled: true,
    bounded_long_flags: ["--files-with-matches", "--count", "--max-count", "--count-matches"],
    bounded_short_letters: "lcm",
    recursive_short_letters: "",
    recursive_long_flags: [],
    hint: "add `-l` (files only) or `--max-count 5`, or pipe through `| head -n 100`",
  },
};

/** Pipeline members that already bound or consume the stream. */
const _BOUNDING_PROGRAMS: ReadonlySet<string> = new Set(["head", "tail", "wc", "rtk"]);

function _shortLetters(token: string): string | null {
  return /^-[A-Za-z]+$/.test(token) ? token.slice(1) : null;
}

function _hasAnyFlag(group: readonly string[], longFlags: readonly string[], shortLetters: string): boolean {
  for (const t of group) {
    if (longFlags.some((f) => t === f || t.startsWith(`${f}=`))) return true;
    const letters = _shortLetters(t);
    if (letters && shortLetters && [...shortLetters].some((c) => letters.includes(c))) return true;
  }
  return false;
}

export interface CapVerdict {
  program: string;
  hint: string;
}

/**
 * An unbounded tree-wide search in the command (any pipeline segment) with no
 * bounding flag and no bounding pipeline member → advisory verdict. Fail-open:
 * parse errors and anything ambiguous return null.
 */
export function classifyCap(
  command: string,
  table: Readonly<Record<string, CapRow>> = OUTPUT_CAP_TABLE,
): CapVerdict | null {
  const cmd = command.trim();
  if (!cmd) return null;
  let tokens: string[];
  try {
    tokens = shlexSplit(cmd, true);
  } catch (e) {
    if (e instanceof ShlexError) return null;
    throw e;
  }
  const groups = _split_subcommands(tokens);
  let hit: CapVerdict | null = null;
  for (const group of groups) {
    let i = 0;
    while (i < group.length && _is_env_assignment(group[i] as string)) i += 1;
    const program = group[i];
    if (!program) continue;
    // A bounding consumer anywhere in the chain (head/tail/wc/rtk) → bounded.
    if (_BOUNDING_PROGRAMS.has(program)) return null;
    const row = table[program];
    if (!row || !row.enabled) continue;
    const needsRecursive = row.recursive_short_letters !== "" || row.recursive_long_flags.length > 0;
    if (needsRecursive && !_hasAnyFlag(group, row.recursive_long_flags, row.recursive_short_letters)) {
      continue; // single-file / non-tree invocation — not the measured class
    }
    if (_hasAnyFlag(group, row.bounded_long_flags, row.bounded_short_letters)) continue;
    if (hit === null) hit = { program, hint: row.hint };
  }
  return hit;
}

function _readStdin(): string {
  return readHookStdin();
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

  const command = _extract_command(envelope);
  if (!command) return EXIT_ALLOW;

  // Deterministic gate: the live probe, NOT a self-reported flag — and an
  // IDENTITY probe, not bare presence: the `rtk` binary name collides with
  // the unrelated Rust Type Kit, and nudging the agent to wrap commands with
  // the wrong tool would be a second wrong answer. Only a verified Rust
  // Token Killer activates the nudge; `unverified` (broken/slow probe) does
  // NOT — fail closed for behavior, fail open for the command itself.
  // Identity is cached user-globally keyed on the binary's path+mtime+size,
  // so the `rtk gain` probe runs once per installed binary, not per command.
  if (rtk_available() && detectRtkCached().identity === "token-killer") {
    const verdict = classify(command);
    if (verdict.eligible) {
      const reason =
        `rtk is installed and wraps verbose CLI output (upstream reports 60–90% fewer output tokens). ` +
        `Re-run wrapped: \`rtk ${command.trim()}\`. ` +
        `(Skip for completeness-critical output like \`git diff\`.)`;
      process.stdout.write(`${_jsonReason(reason)}\n`);
      return EXIT_WARN;
    }
  }

  // Cap advisory needs no rtk — it covers exactly the commands rtk cannot
  // wrap (compound/piped, or outside its allowlist).
  const cap = classifyCap(command);
  if (cap) {
    const reason =
      `Unbounded \`${cap.program}\` output: a tree-wide search can return hundreds of KB into context ` +
      `(measured here: 302 KB raw vs 21 KB bounded — internal/bench/rtk-savings/RESULTS.md). ` +
      `Prefer a bounded form — ${cap.hint}. Re-running unbounded is fine when completeness is required.`;
    process.stdout.write(`${_jsonReason(reason)}\n`);
    return EXIT_WARN;
  }
  return EXIT_ALLOW;
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

if (_isCliEntry()) {
  process.exit(main());
}
