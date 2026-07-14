// Tests for src/scripts/pr_url_reminder_hook.ts — the reply-shape backstop for
// the direct-answers rule (a PR created this turn must end the reply as the
// literal last raw URL). Feeds PostToolUse stdin envelopes to the tsx hook and
// asserts exit code + the warn JSON on stdout. The hook writes no state files.
import { spawnSync } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "..", "..", "..");
const TS_SCRIPT = path.join(REPO_ROOT, "src", "scripts", "pr_url_reminder_hook.ts");
const TSX_BIN = path.join(
  REPO_ROOT,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsx.cmd" : "tsx",
);

const PR_URL = "https://github.com/event4u-app/agent-switch/pull/20";

function run(envelope: unknown): { stdout: string; status: number | null } {
  const r = spawnSync(TSX_BIN, [TS_SCRIPT], {
    encoding: "utf8",
    cwd: REPO_ROOT,
    input: typeof envelope === "string" ? envelope : JSON.stringify(envelope),
  });
  expect(r.status).not.toBeNull();
  return { stdout: r.stdout as string, status: r.status };
}

describe("pr_url_reminder_hook", () => {
  it("warns (exit 2) on `gh pr create` that produced a PR URL, echoing the exact URL", () => {
    const { stdout, status } = run({
      tool_name: "Bash",
      tool_input: { command: `git push && gh pr create --base main --title x` },
      tool_response: `Creating pull request...\n${PR_URL}\n`,
    });
    expect(status).toBe(2);
    const out = JSON.parse(stdout);
    expect(out.decision).toBe("warn");
    expect(out.reason).toContain(PR_URL);
    expect(out.reason.length).toBeLessThanOrEqual(200);
    // the actionable instruction must ride additional_context — that is what
    // surfaces back to the model (reason alone only reaches stderr).
    expect(out.additional_context).toContain(PR_URL);
    expect(out.additional_context).toContain("LITERAL LAST LINE");
  });

  it("fires on a github create-pull-request tool (name-based), URL from the response", () => {
    const { status, stdout } = run({
      tool_name: "create_pull_request",
      tool_response: { html_url: PR_URL, number: 20 },
    });
    expect(status).toBe(2);
    expect(JSON.parse(stdout).reason).toContain(PR_URL);
  });

  it("does NOT fire on `gh pr view` even though the output carries a PR URL", () => {
    const { status, stdout } = run({
      tool_name: "Bash",
      tool_input: { command: "gh pr view 20 --json url" },
      tool_response: `{"url":"${PR_URL}"}`,
    });
    expect(status).toBe(0);
    expect(stdout.trim()).toBe("");
  });

  it("does NOT fire on `gh pr create` that produced no URL (failed / dry-run)", () => {
    const { status } = run({
      tool_name: "Bash",
      tool_input: { command: "gh pr create --fill" },
      tool_response: "error: a pull request for branch already exists\n",
    });
    expect(status).toBe(0);
  });

  it("does NOT fire on an unrelated tool call", () => {
    const { status } = run({
      tool_name: "Bash",
      tool_input: { command: "git status" },
      tool_response: "On branch main\n",
    });
    expect(status).toBe(0);
  });

  it("never blocks on a malformed or empty envelope", () => {
    expect(run("not json {").status).toBe(0);
    expect(run("").status).toBe(0);
    expect(run([1, 2, 3]).status).toBe(0);
  });
});
