#!/usr/bin/env node
/**
 * PostToolUse push-settle reminder — the second half of "a push closes its own
 * loop", and the half no gate could reach before.
 *
 * WHY THIS EXISTS — measured, not hypothetical.
 *
 * The pre-push hook answers "is this push safe to make". Nothing answered "is
 * this push finished", and the difference is what reaches the user. Over the 30
 * sessions and 50 PRs preceding 2026-09-04:
 *
 *   · 22 of 30 sessions ran `gh run view --log-failed` — i.e. a red CI job was
 *     routine, not exceptional.
 *   · 17 of the 36 PRs whose workflow runs were still readable carried at least
 *     one FAILED run (56 failed runs in total).
 *   · 20 of 50 PRs carried a follow-up `fix(ci|gates|budget)…` commit — 41 of
 *     them — every one a repair made after a push that had looked done.
 *
 * The push itself always succeeded. What failed was the ending: the agent
 * pushed, reported the work as delivered, and the red arrived afterwards, where
 * the user found it. `verify-before-complete` already forbids that, and it is
 * model-carried at exactly the moment a turn feels finished — which is the
 * moment a behavioural rule is least likely to fire.
 *
 * So this hook fires where the fact is deterministic: right after a shell
 * command that ACTUALLY ADVANCED A REMOTE REF. It reads git's own push report
 * rather than the exit code or the command text — a wrapper that pushes
 * (`task push-ready`, a deploy script, a `git` alias) advances a ref without
 * the words `git push` appearing anywhere, and those are the pushes furthest
 * from a human's eye. So:
 *
 *   · `Everything up-to-date`  → nothing was pushed, nothing to settle, silent.
 *   · `! [rejected]`           → the push did not happen; the agent already has
 *                                a visible failure and does not need a second.
 *   · `--delete`              → no ref advanced; silent.
 *   · `--dry-run`             → prints the same report as a real push, so this
 *                                one is caught on the COMMAND, not the output.
 *
 * It resolves the PR number for the pushed branch itself (one `gh` call, best
 * effort) so the reminder carries the literal next command rather than a flag —
 * per `active-remediation` § "The ask carries fixes, not a flag". With no `gh`,
 * no auth, or no open PR, it names the branch and the two-step instead, and
 * never claims a PR number it did not read.
 *
 * Warn only, never blocks (fail_closed: false). A push that is genuinely WIP is
 * a legitimate thing to leave unsettled; what is not legitimate is ENDING THE
 * TURN on one silently.
 *
 * Exit codes (dispatcher contract): 0 allow · 2 warn (+ `{decision,reason,
 * additional_context}` JSON on stdout).
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readHookStdin } from "./hook_stdin.js";

const EXIT_ALLOW = 0;
const EXIT_WARN = 2;

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

// Tool names across platforms whose command field carries a shell command
// (kept in lock-step with pr_url_reminder_hook.COMMAND_TOOLS).
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

/**
 * A push git was told NOT to actually make. `git push --dry-run` prints the SAME
 * ref-advance report as a real push, so the command is where the two are told
 * apart — and it is the ONLY thing the command is consulted for.
 *
 * Deliberately not the other way round. The first version required the command
 * to match `git push`, and its own near-miss test exposed the cost: a wrapper
 * that pushes — `task push-ready`, a deploy script, a `git` alias — advances a
 * remote ref without the words `git push` appearing anywhere, and the hook
 * would have been silent on exactly the pushes furthest from a human's eye.
 * A false negative here is the failure this whole change exists to remove, so
 * the authoritative condition is git's OWN report and the command only subtracts.
 */
const DRY_RUN = /(?:^|\s)(?:--dry-run|-n)(?:\s|$)/;

/**
 * Git's own report that a ref MOVED. Both shapes it prints:
 *   `   b75d7f7..a1b2c3d  feat/x -> feat/x`      (fast-forward / forced)
 *   ` * [new branch]      feat/x -> feat/x`      (first push)
 * The `->` is the load-bearing token: `Everything up-to-date` has none, and a
 * `! [rejected]` line carries one but is excluded before this runs.
 */
const REF_ADVANCED = /(?:\[new branch\]|\[new tag\]|[0-9a-f]{7,}\.\.[0-9a-f]{7,})\s+(\S+)\s+->\s+(\S+)/;

/** A push git refused. Its `->` must never be read as an advance. */
const REJECTED = /^\s*!\s*\[(?:rejected|remote rejected)\]/m;

function isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Unwrap the dispatcher envelope `{event, platform, payload: <native>}`.
 * Reading `tool_name` off the top level is the defect that left
 * `pr-url-reminder` silently never firing in production (measured 2026-08-06).
 */
function unwrap(envelope: JsonObject): JsonObject {
  const inner = envelope["payload"];
  return isObject(inner) ? inner : envelope;
}

function extractCommand(payload: JsonObject): string | null {
  const toolRaw = payload["tool_name"] ?? payload["toolName"] ?? payload["tool"];
  const tool = typeof toolRaw === "string" ? toolRaw : null;
  if (tool === null || !COMMAND_TOOLS.has(tool)) return null;
  const ti = payload["tool_input"];
  if (isObject(ti)) {
    for (const key of ["command", "cmd", "shell_command"]) {
      const v = ti[key];
      if (typeof v === "string" && v) return v;
    }
  }
  for (const key of ["command", "cmd"]) {
    const v = payload[key];
    if (typeof v === "string" && v) return v;
  }
  return null;
}

function toolOutput(payload: JsonObject): string {
  for (const key of ["tool_response", "tool_result", "toolResponse", "output", "result", "stdout"]) {
    const v = payload[key];
    if (typeof v === "string") return v;
    if (isObject(v) || Array.isArray(v)) return JSON.stringify(v);
  }
  return JSON.stringify(payload);
}

/**
 * The pushed branch, taken from the REMOTE side of git's `local -> remote`
 * report and stripped of any `refs/heads/` prefix. The remote side is the one
 * that names the branch CI will run against; on a `HEAD:feat/x` push the local
 * side says `HEAD` and would resolve to nothing.
 */
export function pushedBranch(output: string): string | null {
  if (REJECTED.test(output)) return null;
  const m = REF_ADVANCED.exec(output);
  if (m === null) return null;
  const remote = m[2];
  if (remote === undefined) return null;
  return remote.replace(/^refs\/heads\//, "") || null;
}

/** Best-effort PR number for a branch. Never throws, never guesses. */
export function resolvePr(
  branch: string,
  run: (cmd: string, args: string[]) => string = (cmd, args) =>
    execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 15_000 }),
): number | null {
  try {
    const out = run("gh", ["pr", "view", branch, "--json", "number", "-q", ".number"]).trim();
    const n = Number.parseInt(out, 10);
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** The reminder text. Split out so the test can read it without a `gh` on PATH. */
export function buildReminder(branch: string, pr: number | null): { reason: string; additional_context: string } {
  const settle =
    pr === null
      ? `gh pr view ${branch} --json number -q .number   # then:\n` +
        `./scripts-run src/scripts/ci_settle <that number>`
      : `./scripts-run src/scripts/ci_settle ${pr}`;
  const subject = pr === null ? `branch ${branch}` : `PR #${pr} (${branch})`;
  const reason =
    `Pushed ${subject} — the turn is not finished until its CI has settled green ` +
    `(verify-before-complete). Run ci_settle before you report this as done.`;
  const additional_context =
    `You just advanced a remote ref: ${subject}.\n\n` +
    `A push is not a delivery. Per verify-before-complete, a completion claim needs ` +
    `fresh evidence, and the evidence for a push is the CI verdict — not the push's ` +
    `own exit code.\n\n` +
    `Before this turn ends:\n` +
    `  1. Settle it:\n     ${settle}\n` +
    `     Exit 0 = settled green · 1 = settled, something failed · 2 = NOT a verdict ` +
    `(timed out or unreadable — never report 2 as green).\n` +
    `  2. Red? Read only the failing part:\n` +
    `     gh run view --job <id> --log-failed | grep -E '×|FAIL|Error'\n` +
    `     then fix it and push again (fix-what-you-see: the author is irrelevant).\n` +
    `  3. Still red after 3 attempts on the same target, or blocked on something ` +
    `only the user can decide — stop and say so, with the three attempts named ` +
    `(autonomous-execution N=3).\n\n` +
    `Handing the user a red PR with its cause named and unfixed is not a delivery ` +
    `either. If you are deliberately leaving this WIP, say that in the reply — ` +
    `silence is what this hook exists to stop.`;
  return { reason, additional_context };
}

export function main(): number {
  let envelope: JsonValue;
  try {
    const raw = readHookStdin();
    envelope = raw.trim() ? (JSON.parse(raw) as JsonValue) : {};
  } catch {
    return EXIT_ALLOW; // never block on a malformed envelope
  }
  if (!isObject(envelope)) return EXIT_ALLOW;

  const inner = unwrap(envelope);
  // A shell tool is still required: the report below is git's own text, and a
  // structured forge tool does not produce it.
  const command = extractCommand(inner);
  if (command === null) return EXIT_ALLOW;
  if (DRY_RUN.test(command)) return EXIT_ALLOW;

  const branch = pushedBranch(toolOutput(inner));
  if (branch === null) return EXIT_ALLOW; // up-to-date, rejected, delete — nothing advanced

  const { reason, additional_context } = buildReminder(branch, resolvePr(branch));
  process.stdout.write(`${JSON.stringify({ decision: "warn", reason, additional_context })}\n`);
  return EXIT_WARN;
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url` (see cmd_migrate.ts).
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function isCliEntry(): boolean {
  if (typeof __AGENT_CONFIG_BUNDLE__ !== "undefined" && __AGENT_CONFIG_BUNDLE__) return false;
  if (process.argv[1] === undefined) return false;
  const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
  if (import.meta.url === argvUrl) return true;
  try {
    return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
  } catch {
    return false;
  }
}

if (isCliEntry()) {
  process.exit(main());
}
