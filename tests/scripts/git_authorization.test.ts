// Tests for the git-authorization ledger (src/scripts/git_authorization_hook.ts)
// and its blocking half (src/scripts/hooks/block_unauthorized_git.ts).
//
// Every fixture below is drawn from a real turn in the 30-session conformance
// audit (2026-08-06). The two that matter most:
//
//   - "fixe die ci" must NOT unlock a push. That exact instruction was read as
//     covering commit + push three times in one session.
//   - A pasted `git push … rejected` stack trace must NOT authorize a push. That
//     paste was read as implicit continuation immediately before an unauthorized
//     prod-trunk merge, tag push, GitHub release and npm publish.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import {
  classifyAuthorization,
  splitFences,
  run as ledgerRun,
  STATE_FILE,
  type GitOp,
} from "../../src/scripts/git_authorization_hook.js";
import {
  BLOCK_OPS,
  WARN_OPS,
  commandOp,
  decide,
  extractCommand,
  run as gateRun,
} from "../../src/scripts/hooks/block_unauthorized_git.js";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "git-auth-"));
});

function submit(prompt: string): void {
  ledgerRun(
    JSON.stringify({ event: "user_prompt_submit", session_id: "s1", payload: { prompt } }),
    { consumer_root: tmp },
  );
}

function ledger(): { authorized: GitOp[] } {
  return JSON.parse(fs.readFileSync(path.join(tmp, STATE_FILE), "utf8")) as { authorized: GitOp[] };
}

function preTool(command: string): number {
  return gateRun(
    JSON.stringify({ event: "pre_tool_use", payload: { tool_name: "Bash", tool_input: { command } } }),
    { consumer_root: tmp },
  );
}

describe("classifyAuthorization — prose", () => {
  it("unlocks the ops the user actually named, in German", () => {
    const { authorized } = classifyAuthorization(
      "Commite das und erstelle einen PR, ready for review.",
    );
    expect(authorized).toContain("commit");
    expect(authorized).toContain("pr-create");
  });

  it("does NOT unlock push on a bare code-fix instruction", () => {
    // The measured violation: "consistency faily. fixe das" → commit + push.
    for (const prompt of ["consistency faily. fixe das", "fixe die ci", "es gibt einen linter fehler"]) {
      const { authorized } = classifyAuthorization(prompt);
      expect(authorized).not.toContain("push");
      expect(authorized).not.toContain("commit");
    }
  });

  it("does NOT unlock publish or merge on a broad release-ish instruction alone", () => {
    const { authorized } = classifyAuthorization("Ich kann immer noch nicht releasen. Fixe das endlich.");
    // "releasen" authorizes `release`; it must not silently carry publish/merge.
    expect(authorized).toContain("release");
    expect(authorized).not.toContain("publish");
    expect(authorized).not.toContain("pr-merge");
  });
});

describe("classifyAuthorization — pasted fences", () => {
  it("treats a pasted executable command as authorization for that command", () => {
    const { authorized, evidence } = classifyAuthorization(
      "das hier:\n```\ngit push origin main\n```",
    );
    expect(authorized).toContain("push");
    expect(evidence["push"]).toMatch(/pasted command/);
  });

  it("does NOT treat a pasted error trace containing `git push` as authorization", () => {
    const trace =
      "```\n" +
      "$ git push\n".replace("$ git push", "To github.com:event4u-app/agent-config.git") +
      " ! [rejected]        main -> main (fetch first)\n" +
      "error: failed to push some refs to 'github.com:event4u-app/agent-config.git'\n" +
      "hint: Updates were rejected because the remote contains work that you do not\n" +
      "```";
    const { authorized } = classifyAuthorization(`das kommt raus:\n${trace}`);
    expect(authorized).not.toContain("push");
  });

  it("splitFences separates prose from fenced bodies", () => {
    const { prose, fences } = splitFences("vorher\n```\ngit push\n```\nnachher");
    expect(prose).toContain("vorher");
    expect(prose).toContain("nachher");
    expect(prose).not.toContain("git push");
    expect(fences).toHaveLength(1);
  });
});

describe("commandOp", () => {
  it("prefers the most specific match — a tag push is a tag, not a push", () => {
    expect(commandOp("git push origin --tags")).toBe("tag");
    expect(commandOp("git push origin main")).toBe("push");
  });

  it("classifies the irreversible set", () => {
    expect(commandOp("npm publish --access public")).toBe("publish");
    expect(commandOp("gh release create 9.20.0 --notes x")).toBe("release");
    expect(commandOp("gh pr merge 1188 --squash")).toBe("pr-merge");
  });

  it("returns null for an unrelated command", () => {
    expect(commandOp("git status --porcelain")).toBeNull();
    expect(commandOp("npm run test")).toBeNull();
  });
});

describe("extractCommand", () => {
  it("reads the command out of a Claude-shaped envelope", () => {
    expect(
      extractCommand({ payload: { tool_name: "Bash", tool_input: { command: "git push" } } }),
    ).toBe("git push");
  });

  it("ignores non-command tools", () => {
    expect(extractCommand({ payload: { tool_name: "Read", tool_input: { file_path: "x" } } })).toBeNull();
  });
});

describe("decide", () => {
  it("blocks every irreversible op when the ledger is empty", () => {
    for (const [cmd, op] of [
      ["npm publish", "publish"],
      ["git push origin --tags", "tag"],
      ["gh release create 9.20.0", "release"],
      ["gh pr merge 1188 --squash", "pr-merge"],
    ] as const) {
      const d = decide(cmd, { authorized: new Set(), present: false });
      expect(BLOCK_OPS.has(op)).toBe(true);
      expect(d.exit).toBe(2);
      expect(d.stderr).toMatch(/Blocked/);
      expect(d.stderr).toContain(op);
    }
  });

  it("warns but allows the recoverable ops when the ledger is empty", () => {
    for (const [cmd, op] of [
      ["git commit -m x", "commit"],
      ["git push origin feat/x", "push"],
      ["gh pr create --base main", "pr-create"],
    ] as const) {
      const d = decide(cmd, { authorized: new Set(), present: false });
      expect(WARN_OPS.has(op)).toBe(true);
      expect(d.exit).toBe(0);
      expect(JSON.parse(d.stdout).decision).toBe("warn");
    }
  });

  it("allows an op the ledger authorizes", () => {
    const d = decide("npm publish", { authorized: new Set<GitOp>(["publish"]), present: true });
    expect(d.exit).toBe(0);
    expect(d.stdout).toBe("");
  });

  it("allows an unrelated command outright", () => {
    expect(decide("git status", { authorized: new Set(), present: false }).exit).toBe(0);
    expect(decide(null, { authorized: new Set(), present: false }).exit).toBe(0);
  });
});

describe("end to end", () => {
  it("a German release authorization unlocks the release, not the publish", () => {
    submit("Release 9.20.0 sauber, dann den eigenen PR.");
    expect(ledger().authorized).toContain("release");
    expect(preTool("gh release create 9.20.0")).toBe(0);
    expect(preTool("npm publish")).toBe(2);
  });

  it("reproduces the measured failure: a pasted rejection trace does not unlock the release chain", () => {
    submit(
      "```\nTo github.com:event4u-app/agent-config.git\n ! [rejected]  main -> main\n" +
        "error: failed to push some refs\n```",
    );
    expect(ledger().authorized).toEqual([]);
    expect(preTool("gh pr merge 1134 --squash")).toBe(2);
    expect(preTool("git push origin --tags")).toBe(2);
    expect(preTool("npm publish")).toBe(2);
  });

  it("a new turn replaces the ledger — a spent authorization does not carry forward", () => {
    submit("mach den npm publish");
    expect(preTool("npm publish")).toBe(0);
    submit("fixe die ci");
    expect(preTool("npm publish")).toBe(2);
  });

  it("no ledger at all is treated as not-authorized for the block subset", () => {
    expect(fs.existsSync(path.join(tmp, STATE_FILE))).toBe(false);
    expect(preTool("npm publish")).toBe(2);
  });
});
