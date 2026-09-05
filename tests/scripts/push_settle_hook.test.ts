// Tests for src/scripts/hooks/push_settle_hook.ts — the deterministic half of
// "a push closes its own loop". The hook fires only when git's OWN report shows
// a remote ref advanced, so the tests that matter are the near-misses: a push
// that changed nothing, a push git refused, a command that only mentions push.
//
// The forge lookup is neutralised by a stub `gh` on PATH that exits non-zero,
// so no test reaches the network or ambient credentials. That matters here for
// the same reason it did in check_branch_freshness: a real `gh` could resolve a
// same-named branch in another repo and silently change the subject under test.
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

import { buildReminder, pushedBranch, resolvePr } from "../../src/scripts/hooks/push_settle_hook";

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "..", "..", "..");
const TS_SCRIPT = path.join(REPO_ROOT, "src", "scripts", "hooks", "push_settle_hook.ts");
const TSX_BIN = path.join(
  REPO_ROOT,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsx.cmd" : "tsx",
);

// A `gh` that always fails, first on PATH — the forge is unavailable by
// construction for every spawned run below.
const STUB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "push-settle-nogh-"));
fs.writeFileSync(path.join(STUB_DIR, "gh"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
afterAll(() => fs.rmSync(STUB_DIR, { recursive: true, force: true }));

const ADVANCED =
  "To github.com:event4u-app/agent-config.git\n   b75d7f7cb..a1b2c3d4e  feat/x -> feat/x\n";

function run(envelope: unknown): { stdout: string; status: number | null } {
  const r = spawnSync(TSX_BIN, [TS_SCRIPT], {
    encoding: "utf8",
    cwd: REPO_ROOT,
    env: { ...process.env, PATH: `${STUB_DIR}${path.delimiter}${process.env["PATH"] ?? ""}` },
    input: typeof envelope === "string" ? envelope : JSON.stringify(envelope),
  });
  expect(r.status).not.toBeNull();
  return { stdout: r.stdout as string, status: r.status };
}

describe("push_settle_hook — the fire path", () => {
  it("warns (exit 2) after a push that advanced a ref, and names the branch", () => {
    const { stdout, status } = run({
      tool_name: "Bash",
      tool_input: { command: "git push -u origin feat/x" },
      tool_response: ADVANCED,
    });
    expect(status).toBe(2);
    const out = JSON.parse(stdout);
    expect(out.decision).toBe("warn");
    expect(out.reason).toContain("feat/x");
    // `reason` reaches stderr only and is capped; the instruction must ride
    // additional_context, which is what surfaces back to the model.
    expect(out.reason.length).toBeLessThanOrEqual(200);
    expect(out.additional_context).toContain("ci_settle");
    expect(out.additional_context).toContain("verify-before-complete");
  });

  it("fires through the dispatcher envelope, not only on a raw payload", () => {
    // `pr-url-reminder` read tool_name off the TOP level and therefore never
    // fired in production for months. Pin the wrapped shape explicitly.
    const { status } = run({
      event: "post_tool_use",
      platform: "claude",
      payload: {
        tool_name: "Bash",
        tool_input: { command: "git commit -m x && git push" },
        tool_response: ADVANCED,
      },
    });
    expect(status).toBe(2);
  });

  it("fires on a WRAPPER that pushed — the false negative the command filter caused", () => {
    // `task push-ready`, a deploy script, or a `git` alias advances a remote ref
    // with the words "git push" nowhere in the command. Requiring them made the
    // hook silent on exactly the pushes furthest from a human's eye.
    const { status } = run({
      tool_name: "Bash",
      tool_input: { command: "task push-ready && ./scripts/ship.sh" },
      tool_response: ADVANCED,
    });
    expect(status).toBe(2);
  });

  it("fires on a first push, whose report says [new branch]", () => {
    const { status } = run({
      tool_name: "Bash",
      tool_input: { command: "git push --set-upstream origin feat/y" },
      tool_response: " * [new branch]      feat/y -> feat/y\n",
    });
    expect(status).toBe(2);
  });
});

describe("push_settle_hook — the near-misses that must stay silent", () => {
  const silent: ReadonlyArray<readonly [string, string, string]> = [
    ["nothing was pushed", "git push", "Everything up-to-date\n"],
    [
      "git refused the push",
      "git push",
      "To github.com:o/r.git\n ! [rejected]        feat/x -> feat/x (fetch first)\n",
    ],
    // The one case the OUTPUT cannot settle: --dry-run prints a real push's
    // report verbatim. It is caught on the command, and this row is the only
    // reason the command is read at all.
    ["a dry run printed a push report it did not make", "git push --dry-run origin feat/x", ADVANCED],
    ["a branch deletion", "git push origin --delete feat/x", "To github.com:o/r.git\n - [deleted]  feat/x\n"],
    ["a non-shell tool", "", ADVANCED],
  ];
  for (const [why, command, output] of silent) {
    it(`stays silent when ${why}`, () => {
      const { status, stdout } = run(
        command === ""
          ? { tool_name: "Read", tool_input: { file_path: "x" }, tool_response: output }
          : { tool_name: "Bash", tool_input: { command }, tool_response: output },
      );
      expect(status).toBe(0);
      expect(stdout.trim()).toBe("");
    });
  }

  it("never blocks on a malformed envelope", () => {
    expect(run("not json").status).toBe(0);
  });
});

describe("push_settle_hook — units", () => {
  it("takes the branch from the REMOTE side of `local -> remote`", () => {
    // A `HEAD:feat/z` push reports `HEAD` on the local side; the remote side is
    // the branch CI will actually run against.
    expect(pushedBranch(" * [new branch]      HEAD -> feat/z\n")).toBe("feat/z");
    expect(pushedBranch("   aaaaaaa..bbbbbbb  feat/x -> refs/heads/feat/x\n")).toBe("feat/x");
  });

  it("reads no branch out of a rejection, even though the line carries a `->`", () => {
    expect(
      pushedBranch(" ! [rejected]        feat/x -> feat/x (non-fast-forward)\n   aaaaaaa..bbbbbbb  a -> a\n"),
    ).toBeNull();
  });

  it("names the literal ci_settle command once the PR is known, and the two-step when it is not", () => {
    expect(buildReminder("feat/x", 1234).additional_context).toContain("ci_settle 1234");
    const unknown = buildReminder("feat/x", null).additional_context;
    expect(unknown).toContain("gh pr view feat/x");
    expect(unknown).not.toMatch(/ci_settle \d/); // never invents a number it did not read
  });

  it("returns null rather than a guess when the forge cannot be asked", () => {
    expect(
      resolvePr("feat/x", () => {
        throw new Error("gh: not authenticated");
      }),
    ).toBeNull();
    expect(resolvePr("feat/x", () => "not-a-number\n")).toBeNull();
    expect(resolvePr("feat/x", () => "1234\n")).toBe(1234);
  });
});
