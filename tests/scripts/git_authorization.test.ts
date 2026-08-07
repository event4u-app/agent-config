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
import { EXIT_BLOCK as DISPATCHER_BLOCK } from "../../src/scripts/hooks/dispatch_hook.js";
import {
  BLOCK_OPS,
  WARN_OPS,
  commandOp,
  invokedSegments,
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
    // Round-2 fix: the first fixture built the trace with
    // `"$ git push\n".replace("$ git push", "To github.com…")`, which DELETED the
    // token under test — the string `git push` never appeared. These two carry
    // it verbatim, in both shapes the maintainer actually pastes.
    const fenced =
      "das kommt raus:\n```\n" +
      "$ git push origin main\n" +
      "To github.com:event4u-app/agent-config.git\n" +
      " ! [rejected]        main -> main (fetch first)\n" +
      "error: failed to push some refs\n" +
      "hint: Updates were rejected because the remote contains work\n```";
    expect(classifyAuthorization(fenced).authorized).not.toContain("push");

    const unfenced =
      "hier der fehler:\n" +
      "To github.com:event4u-app/agent-config.git\n" +
      " ! [rejected] main -> main\n" +
      "error: failed to push some refs\n" +
      "hint: git push --force?";
    expect(classifyAuthorization(unfenced).authorized).toEqual([]);
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

  // Round-2 self-scan: the gate fired on two commands of the auditor's own
  // session whose only sin was carrying the operation name inside a `printf`
  // argument as test data. Blocking a command because it MENTIONS an operation
  // is the worst false positive a refusing gate can have.
  it("does not fire on an operation merely mentioned inside an argument", () => {
    for (const cmd of [
      `printf '{"tool_input":{"command":"npm publish"}}'`,
      `echo "npm publish" > /tmp/fixture.txt`,
      `grep -rn "gh pr merge" src/`,
      `cat <<'EOF'\nnpm publish\nEOF`,
    ]) {
      expect(commandOp(cmd), cmd).toBeNull();
    }
  });

  it("still fires when the operation is genuinely invoked, including via sh -c", () => {
    expect(commandOp("npm publish --access public")).toBe("publish");
    expect(commandOp(`sh -c "npm publish"`)).toBe("publish");
    expect(commandOp(`bash -c 'gh pr merge 1 --squash'`)).toBe("pr-merge");
    expect(commandOp("NPM_TOKEN=x npm publish")).toBe("publish");
    expect(commandOp("git status && npm publish")).toBe("publish");
  });

  it("invokedSegments keeps only the invoked head of each segment", () => {
    expect(invokedSegments("git status && npm publish")).toEqual(["git status", "npm publish"]);
    expect(invokedSegments(`printf 'npm publish'`)).toEqual([`printf 'npm publish'`]);
  });

  it("returns null for an unrelated command", () => {
    expect(commandOp("git status --porcelain")).toBeNull();
    expect(commandOp("npm run test")).toBeNull();
  });

  // Round-5 audit (2026-08-07): the separator split was not quote-aware, so a
  // quoted alternation was cut into a segment beginning with the op literal.
  // Measured live three times, once blocking the probe that proved the fix.
  it("does not treat a separator inside quotes as a shell separator", () => {
    expect(commandOp(`grep -n -E "foo|npm publish|bar" docs/`)).toBeNull();
    expect(commandOp(`rg "npm publish" --glob '*.md'`)).toBeNull();
    expect(commandOp(`grep -rn "gh pr merge|gh release create" src/`)).toBeNull();
    expect(invokedSegments(`grep -E "a|npm publish|b" x`)).toEqual([
      `grep -E "a|npm publish|b" x`,
    ]);
  });

  it("still splits on unquoted separators after the quote fix", () => {
    expect(commandOp("ls | npm publish")).toBe("publish");
    expect(commandOp("echo hi & npm publish")).toBe("publish");
    expect(commandOp("false || npm publish")).toBe("publish");
    expect(invokedSegments("ls | npm publish")).toEqual(["ls", "npm publish"]);
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
      expect(d.exit).toBe(DISPATCHER_BLOCK);
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
    expect(preTool("npm publish")).toBe(DISPATCHER_BLOCK);
  });

  it("reproduces the measured failure: a pasted rejection trace does not unlock the release chain", () => {
    submit(
      "```\nTo github.com:event4u-app/agent-config.git\n ! [rejected]  main -> main\n" +
        "error: failed to push some refs\n```",
    );
    expect(ledger().authorized).toEqual([]);
    expect(preTool("gh pr merge 1134 --squash")).toBe(DISPATCHER_BLOCK);
    expect(preTool("git push origin --tags")).toBe(DISPATCHER_BLOCK);
    expect(preTool("npm publish")).toBe(DISPATCHER_BLOCK);
  });

  it("a new turn replaces the ledger — a spent authorization does not carry forward", () => {
    submit("mach den npm publish");
    expect(preTool("npm publish")).toBe(0);
    submit("fixe die ci");
    expect(preTool("npm publish")).toBe(DISPATCHER_BLOCK);
  });

  it("no ledger at all is treated as not-authorized for the block subset", () => {
    expect(fs.existsSync(path.join(tmp, STATE_FILE))).toBe(false);
    expect(preTool("npm publish")).toBe(DISPATCHER_BLOCK);
  });
});
