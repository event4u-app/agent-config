#!/usr/bin/env node
/**
 * PostToolUse PR-URL reminder — reply-shape backstop for `direct-answers`.
 *
 * The `direct-answers` rule (reply-close) requires: a PR created THIS turn puts
 * its raw URL as the **literal last line** of the reply. That is a behavioural
 * rule with no deterministic backstop, so it can be silently missed — the URL
 * ends up inline mid-reply instead of last. This hook fires right after a
 * PR-creating tool call, extracts the created PR URL from the tool output, and
 * WARNS in context (exit 2) so the reminder lands exactly when the PR is born,
 * before the reply closes.
 *
 * Fires ONLY on an actual PR *create*:
 *   - a shell command matching `gh pr create`, OR
 *   - a GitHub tool whose name means "create a pull request"
 *     (e.g. create_pull_request / createPullRequest / pulls.create),
 * AND only when the tool output actually contains a `…/pull/<n>` URL — so a
 * failed / dry-run create (no URL) does not nag, and `gh pr view/checks/list/
 * comment` (which also print PR URLs) never fire it.
 *
 * Warn only — never blocks (fail_closed: false). Unconditional: it reinforces
 * an always-on rule and only fires on the rare PR-create event, so it carries
 * no settings gate (mirrors verify-before-complete / roadmap-progress).
 *
 * Exit codes (dispatcher contract): 0 allow · 2 warn (+ `{decision,reason}`
 * JSON on stdout).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readHookStdin } from "./hooks/hook_stdin.js";

const EXIT_ALLOW = 0;
const EXIT_WARN = 2;

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

// Tool names across platforms whose command field carries a shell command
// (kept in lock-step with before_complete_hook.COMMAND_TOOLS).
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

// A shell command that CREATES a pull request. Anchored on a shell separator so
// it matches inside a chained command (`git push && gh pr create …`) but not a
// substring of another word. `gh pr view/checks/list/comment` do not match.
const _GH_PR_CREATE = /(?:^|[\s;&|`(])gh\s+pr\s+create\b/i;

// A non-shell tool whose NAME means "create a pull request" (github-api / MCP).
const _CREATE_PR_TOOL = /(?:create[_-]?pull_?request|createpullrequest|pulls[._-]create|create_pr\b)/i;

// A GitHub pull-request URL as printed by `gh pr create` / returned as html_url.
const _PR_URL = /https?:\/\/github\.com\/[^\s"'`<>]+\/pull\/\d+/i;

function _isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Return [tool_name, command_text] from a tool-event payload. */
function _extractCommand(payload: JsonObject): [string | null, string | null] {
  const toolRaw = payload["tool_name"] ?? payload["toolName"] ?? payload["tool"];
  const tool = typeof toolRaw === "string" ? toolRaw : null;
  if (!(tool !== null && COMMAND_TOOLS.has(tool))) {
    return [tool, null];
  }
  const ti = payload["tool_input"];
  if (_isObject(ti)) {
    for (const key of ["command", "cmd", "shell_command"]) {
      const v = ti[key];
      if (typeof v === "string" && v) {
        return [tool, v];
      }
    }
  }
  for (const key of ["command", "cmd"]) {
    const v = payload[key];
    if (typeof v === "string" && v) {
      return [tool, v];
    }
  }
  return [tool, null];
}

/** Best-effort extraction of the tool-output text from the envelope. */
function _toolOutput(envelope: JsonObject): string {
  for (const key of ["tool_response", "tool_result", "toolResponse", "output", "result", "stdout"]) {
    const v = envelope[key];
    if (typeof v === "string") {
      return v;
    }
    if (_isObject(v) || Array.isArray(v)) {
      return JSON.stringify(v);
    }
  }
  return JSON.stringify(envelope);
}

/** True when this tool event created a pull request. */
function _isPrCreate(tool: string | null, command: string | null): boolean {
  if (command !== null && _GH_PR_CREATE.test(command)) {
    return true;
  }
  return tool !== null && _CREATE_PR_TOOL.test(tool);
}

export function main(): number {
  let envelope: JsonValue;
  try {
    const raw = _readStdin();
    envelope = raw.trim() ? (JSON.parse(raw) as JsonValue) : {};
  } catch {
    return EXIT_ALLOW; // never block on a malformed envelope
  }
  if (!_isObject(envelope)) {
    return EXIT_ALLOW;
  }

  const [tool, command] = _extractCommand(envelope);
  if (!_isPrCreate(tool, command)) {
    return EXIT_ALLOW;
  }

  const match = _PR_URL.exec(_toolOutput(envelope));
  if (match === null) {
    return EXIT_ALLOW; // create attempted but no URL produced (failed / dry-run) — do not nag
  }
  const url = match[0];

  // `reason` (≤ 200 chars) goes to stderr; `additional_context` is what
  // surfaces back to the model on platforms that support it — so the
  // actionable instruction lives there (a stderr-only reason would not
  // change the reply that this hook exists to shape).
  const reason = `PR created this turn (${url}) — end your reply with this raw URL as the literal last line (direct-answers/reply-close).`;
  const additional_context =
    `You created a pull request this turn: ${url}\n\n` +
    `Per the direct-answers rule (reply-close): a PR created this turn must appear ` +
    `as the raw URL on the LITERAL LAST LINE of your reply — not inline mid-message. ` +
    `Before ending the turn, make your final line exactly:\n${url}\n` +
    `If it already is, no action needed.`;
  process.stdout.write(`${JSON.stringify({ decision: "warn", reason, additional_context })}\n`);
  return EXIT_WARN;
}

function _readStdin(): string {
  return readHookStdin();
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
  // Symlinked invocation (installed projection, or macOS /var → /private/var
  // temp dirs) makes the raw URLs differ; compare realpaths so the guard fires.
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
