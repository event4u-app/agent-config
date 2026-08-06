#!/usr/bin/env node
/**
 * Unauthorized-git gate — `pre_tool_use` concern.
 *
 * Checks a git / GitHub / npm operation against the authorization ledger that
 * `git_authorization_hook.ts` writes on `user_prompt_submit`, so the question
 * "did the user authorize this THIS turn?" is answered from a recorded fact
 * rather than from the model's recollection.
 *
 * SEVERITY SPLIT — by reversibility, not by confidence.
 *
 * The AI council (2026-08-06) split on block-vs-warn: one member argued block
 * from day one because a published npm release had already happened; the other
 * argued warn-first to gather false-positive data. The repo's locked
 * `ratchet severity, never reach` decision settles it without overriding
 * either:
 *
 *   BLOCK — only operations that `non-destructive-by-default` ALREADY declares
 *   never-autonomous and that cannot be undone: `npm publish`, a tag push,
 *   `gh release create`, `gh pr merge`. Blocking these adds no new prohibition;
 *   it makes an existing one mechanical. That is severity, not reach.
 *
 *   WARN — `git commit`, `git push`, `gh pr create`, branch creation,
 *   force-push. Real violations were measured here too (two PRs opened on turns
 *   with zero authorization), but these are recoverable, and a false positive on
 *   `git commit` would be a workflow cliff.
 *
 * KNOWN CONSERVATIVE OVER-BLOCK: `gh pr merge` does not name its base in the
 * command, so a merge into a non-production base is blocked as if it were a
 * production-trunk merge. Stated rather than silently narrowed — the escape is
 * one authorizing word in the prompt, and in this repo virtually every PR
 * targets `main`.
 *
 * NO LEDGER = NOT AUTHORIZED for the block subset, warn for the rest. A hook
 * that fails open on its own state file would be decorative on exactly the
 * turns where the state write failed.
 *
 * Exit codes (dispatcher contract): 0 allow · 2 block (stderr carries the
 * reason on block-capable events) — the dispatcher's `host_semantics`
 * translation owns the per-platform mapping.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { readHookStdin } from "./hook_stdin.js";
import { STATE_FILE, type GitOp } from "../git_authorization_hook.js";

const EXIT_ALLOW = 0;
const EXIT_BLOCK = 2;

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function _isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Irreversible operations — blocked without a this-turn authorization. */
export const BLOCK_OPS: ReadonlySet<GitOp> = new Set<GitOp>([
  "publish",
  "tag",
  "release",
  "pr-merge",
]);

/** Recoverable operations — warned without a this-turn authorization. */
export const WARN_OPS: ReadonlySet<GitOp> = new Set<GitOp>([
  "commit",
  "push",
  "pr-create",
  "branch",
]);

/**
 * Command → operation. Order matters: the most specific pattern wins, so
 * `git push --tags` is a tag push and not a plain push.
 */
const COMMAND_OPS: ReadonlyArray<{ op: GitOp; re: RegExp }> = [
  { op: "publish", re: /\b(npm|pnpm|yarn)\s+publish\b/i },
  { op: "release", re: /\bgh\s+release\s+create\b/i },
  { op: "tag", re: /\bgit\s+push\b[^\n;|&]*--tags\b|\bgit\s+push\b[^\n;|&]*\brefs\/tags\//i },
  { op: "pr-merge", re: /\bgh\s+pr\s+merge\b/i },
  { op: "pr-create", re: /\bgh\s+pr\s+create\b/i },
  { op: "push", re: /\bgit\s+push\b/i },
  { op: "commit", re: /\bgit\s+commit\b/i },
  { op: "branch", re: /\bgit\s+(checkout\s+-b|switch\s+-c)\b/i },
];

const COMMAND_TOOLS: ReadonlySet<string> = new Set([
  "launch-process",
  "launch_process",
  "Bash",
  "BashTool",
  "run-process",
  "runProcess",
  "shell",
  "execute_shell",
  "RunShellCommand",
]);

/** Extract the shell command from a platform-native pre-tool envelope. */
export function extractCommand(envelope: JsonObject): string | null {
  const payload = _isObject(envelope["payload"]) ? (envelope["payload"] as JsonObject) : envelope;
  const toolRaw = payload["tool_name"] ?? payload["toolName"] ?? payload["tool"];
  const tool = typeof toolRaw === "string" ? toolRaw : null;
  if (tool !== null && !COMMAND_TOOLS.has(tool)) {
    return null;
  }
  const input = _isObject(payload["tool_input"])
    ? (payload["tool_input"] as JsonObject)
    : _isObject(payload["toolInput"])
      ? (payload["toolInput"] as JsonObject)
      : payload;
  for (const key of ["command", "cmd", "script"]) {
    const v = input[key];
    if (typeof v === "string" && v.trim()) {
      return v;
    }
  }
  return null;
}

/** Classify a shell command into the operation it performs, if any. */
export function commandOp(command: string): GitOp | null {
  for (const { op, re } of COMMAND_OPS) {
    if (re.test(command)) {
      return op;
    }
  }
  return null;
}

function _loadLedger(consumer_root: string): { authorized: Set<GitOp>; present: boolean } {
  try {
    const raw = fs.readFileSync(path.join(consumer_root, STATE_FILE), "utf8");
    const decoded = JSON.parse(raw) as unknown;
    if (_isObject(decoded) && Array.isArray(decoded["authorized"])) {
      return {
        authorized: new Set((decoded["authorized"] as string[]).filter(Boolean) as GitOp[]),
        present: true,
      };
    }
  } catch {
    /* fall through */
  }
  return { authorized: new Set<GitOp>(), present: false };
}

export interface Decision {
  exit: number;
  stdout: string;
  stderr: string;
}

export function decide(
  command: string | null,
  ledger: { authorized: Set<GitOp>; present: boolean },
): Decision {
  if (command === null) {
    return { exit: EXIT_ALLOW, stdout: "", stderr: "" };
  }
  const op = commandOp(command);
  if (op === null || ledger.authorized.has(op)) {
    return { exit: EXIT_ALLOW, stdout: "", stderr: "" };
  }

  const shown = command.length > 120 ? `${command.slice(0, 117)}…` : command;

  if (BLOCK_OPS.has(op)) {
    const reason =
      `Blocked: \`${op}\` with no authorization in this turn's prompt. ` +
      `This operation is irreversible and non-destructive-by-default already declares it ` +
      `never-autonomous. Command: ${shown}. ` +
      `Ask the user, in one numbered-options block, and run it only after they answer this turn.`;
    return { exit: EXIT_BLOCK, stdout: "", stderr: `${reason}\n` };
  }

  if (WARN_OPS.has(op)) {
    const reason =
      `No \`${op}\` authorization found in this turn's prompt (commit-policy: a one-shot ` +
      `authorization is spent on the operation it named). If the user did authorize it this ` +
      `turn, proceed; otherwise stop and ask. Command: ${shown}`;
    return {
      exit: EXIT_ALLOW,
      stdout: `${JSON.stringify({ decision: "warn", reason })}\n`,
      stderr: "",
    };
  }

  return { exit: EXIT_ALLOW, stdout: "", stderr: "" };
}

export function run(stdin_text: string, options: { consumer_root: string }): number {
  let envelope: JsonObject = {};
  if (stdin_text.trim()) {
    try {
      const decoded = JSON.parse(stdin_text) as unknown;
      if (_isObject(decoded)) {
        envelope = decoded;
      }
    } catch {
      return EXIT_ALLOW;
    }
  }
  const decision = decide(extractCommand(envelope), _loadLedger(options.consumer_root));
  if (decision.stdout) {
    process.stdout.write(decision.stdout);
  }
  if (decision.stderr) {
    process.stderr.write(decision.stderr);
  }
  return decision.exit;
}

export function main(argv?: string[]): number {
  const args = argv ?? process.argv.slice(2);
  let consumer_root = process.cwd();
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--project-dir" && args[i + 1] !== undefined) {
      consumer_root = args[i + 1] as string;
      i += 1;
    } else if (a !== undefined && a.startsWith("--project-dir=")) {
      consumer_root = a.slice("--project-dir=".length);
    }
  }
  return run(readHookStdin(), { consumer_root });
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
