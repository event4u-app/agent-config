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
// MUST equal dispatch_hook.EXIT_BLOCK. The dispatcher's internal ladder is
// 0 allow / 1 block / 2 warn — NOT the 2-means-block shape a PreToolUse guard
// reads naturally from Claude's own native contract. This constant was 2 when
// this gate first shipped, so the dispatcher reduced every refusal to a WARN
// and the gate emitted advisory context while the operation went through.
// Pinned against the dispatcher's export by
// tests/hooks/concern_block_exit_parity.test.ts.
const EXIT_BLOCK = 1;

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
// `git`/`gh` accept global options before the subcommand (`git -C dir push`,
// `git --git-dir=x push`), and each of those was a silent bypass of the whole
// gate. `G` allows any run of them.
const G = "(?:-[A-Za-z-]+(?:=\\S+)?(?:\\s+\\S+)?\\s+)*";

/**
 * Command → operation. Order matters: the most specific pattern wins, so
 * `git push --tags` is a tag push and not a plain push.
 */
const COMMAND_OPS: ReadonlyArray<{ op: GitOp; re: RegExp }> = [
  { op: "publish", re: new RegExp(`\\b(npm|pnpm|yarn)\\s+${G}publish\\b`, "i") },
  { op: "release", re: /\bgh\s+release\s+create\b|\bgh\s+api\b[^\n]*\/releases\b/i },
  {
    op: "tag",
    re: new RegExp(
      `\\bgit\\s+${G}push\\b[^\\n;|&]*(--tags|--follow-tags|refs\\/tags\\/)`,
      "i",
    ),
  },
  { op: "pr-merge", re: /\bgh\s+pr\s+merge\b|\bgh\s+api\b[^\n]*\/pulls\/\d+\/merge\b/i },
  { op: "pr-create", re: /\bgh\s+pr\s+create\b|\bgh\s+api\b[^\n]*-X\s+POST[^\n]*\/pulls\b/i },
  { op: "push", re: new RegExp(`\\bgit\\s+${G}push\\b`, "i") },
  { op: "commit", re: new RegExp(`\\bgit\\s+${G}commit\\b`, "i") },
  { op: "branch", re: new RegExp(`\\bgit\\s+${G}(checkout\\s+-b|switch\\s+-c)\\b`, "i") },
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

/**
 * Split a shell command into the segments that are actually INVOKED.
 *
 * A substring match over the whole command string is wrong, and measurably so:
 * the round-2 self-scan found this gate firing on two commands of the auditor's
 * own session whose only sin was carrying `npm publish` inside a `printf`
 * argument as test data. Blocking a command because it mentions an operation is
 * the worst false-positive shape a refusing gate can have.
 *
 * So: split on shell separators, drop leading env assignments, and keep the
 * segment only from its command word. `printf '{"cmd":"npm publish"}'` yields a
 * segment starting at `printf` and never matches.
 *
 * Quoted payloads are NOT simply discarded — `sh -c "npm publish"` really does
 * publish. Those are unwrapped and re-split, so closing the false positive does
 * not open a bypass.
 */
export function invokedSegments(command: string, depth = 0): string[] {
  if (depth > 3) {
    return [];
  }
  const out: string[] = [];
  // Strip heredoc bodies before splitting: a line inside `<<EOF … EOF` is data
  // being written, not a command being run, but after a newline split it looks
  // exactly like an invocation.
  const withoutHeredocs = command.replace(
    /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1[\s\S]*?^\s*\2\s*$/gm,
    "<<HEREDOC",
  );
  for (const raw of withoutHeredocs.split(/\n|;|&&|\|\||\||&/)) {
    let seg = raw.trim();
    if (!seg) {
      continue;
    }
    // Drop leading env assignments: `FOO=bar BAZ=1 npm publish`.
    seg = seg.replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|\S*)\s+)+/, "");
    // Unwrap `sh -c '<payload>'` / `bash -c "<payload>"` and recurse.
    const wrapped = /^(?:\S*\/)?(?:ba|z|k)?sh\s+-[a-z]*c\s+(?:"([^"]*)"|'([^']*)'|(\S+))/.exec(seg);
    if (wrapped) {
      out.push(...invokedSegments(wrapped[1] ?? wrapped[2] ?? wrapped[3] ?? "", depth + 1));
      continue;
    }
    out.push(seg);
  }
  return out;
}

/**
 * Classify a shell command into the operation it performs, if any.
 *
 * Matches per invoked segment and only when the segment BEGINS with the tool —
 * a mention inside an argument is not an invocation.
 */
export function commandOp(command: string): GitOp | null {
  // Every segment is classified and the MOST SEVERE result wins. Returning the
  // first match let `npm publish && git push --tags` pass its tag push
  // unchecked once `publish` was authorized.
  let found: GitOp | null = null;
  for (const seg of invokedSegments(command)) {
    if (!/^(?:\S*\/)?(git|gh|npm|pnpm|yarn)\b/.test(seg)) {
      continue;
    }
    for (const { op, re } of COMMAND_OPS) {
      if (re.test(seg)) {
        if (BLOCK_OPS.has(op)) {
          return op;
        }
        found ??= op;
        break;
      }
    }
  }
  return found;
}

/** A ledger older than this is not "this turn" under any reading. */
export const LEDGER_MAX_AGE_MS = 30 * 60 * 1000;

/**
 * Load the ledger, and refuse one that does not belong to THIS session and
 * THIS turn.
 *
 * The header claims the gate answers "did the user authorize this THIS turn?".
 * Before this check it answered "did anyone, in any session, ever authorize
 * it?" — the file records `session_id` and `detected_at` and neither was read.
 * Two concurrent worktrees share one state root, so session A typing
 * `mach den release` authorized session B.
 */
function _loadLedger(
  consumer_root: string,
  session_id: string,
  now: number,
): { authorized: Set<GitOp>; present: boolean } {
  try {
    const raw = fs.readFileSync(path.join(consumer_root, STATE_FILE), "utf8");
    const decoded = JSON.parse(raw) as unknown;
    if (_isObject(decoded) && Array.isArray(decoded["authorized"])) {
      const ledgerSession = typeof decoded["session_id"] === "string" ? decoded["session_id"] : "";
      // A ledger from a different session is another conversation's consent.
      if (session_id && ledgerSession && ledgerSession !== session_id) {
        return { authorized: new Set<GitOp>(), present: false };
      }
      const at = Date.parse(String(decoded["detected_at"] ?? ""));
      if (Number.isFinite(at) && now - at > LEDGER_MAX_AGE_MS) {
        return { authorized: new Set<GitOp>(), present: false };
      }
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
  const session_id = typeof envelope["session_id"] === "string" ? envelope["session_id"] : "";
  const decision = decide(
    extractCommand(envelope),
    _loadLedger(options.consumer_root, session_id, Date.now()),
  );
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
