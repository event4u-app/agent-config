/**
 * The gate that would have caught the 2026-08-08 stale-push: a branch cut from
 * a fetch at the start of a long run, pushed into a base that had moved twice.
 *
 * The tests run against real throwaway repositories rather than mocks, because
 * the one property that matters is which REF the gate consults. A mocked git
 * would let the implementation read the local tracking ref — the exact stale
 * reading that caused the incident — and still pass.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { main } from "../../src/scripts/check_branch_freshness.js";

const GATE = path.resolve("src/scripts/check_branch_freshness.ts");

let dir: string;
let cwd: string;

function git(args: string[], at: string): string {
  return execFileSync("git", args, { cwd: at, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
    .toString()
    .trim();
}

function commit(at: string, file: string, body: string): void {
  fs.writeFileSync(path.join(at, file), body);
  git(["add", "-A"], at);
  git(["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", `add ${file}`], at);
}

beforeEach(() => {
  cwd = process.cwd();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "branch-freshness-"));
  const origin = path.join(dir, "origin.git");
  const work = path.join(dir, "work");
  fs.mkdirSync(origin);
  git(["init", "--bare", "-b", "main"], origin);
  git(["init", "-b", "main", work], dir);
  git(["remote", "add", "origin", origin], work);
  commit(work, "a.txt", "one");
  git(["push", "-u", "origin", "main"], work);
  process.chdir(work);
  // The gate must not read CI as an excuse to no-op in these tests.
  delete process.env["CI"];
  delete process.env["GITHUB_ACTIONS"];
});

afterEach(() => {
  process.chdir(cwd);
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("check_branch_freshness", () => {
  it("passes when the branch contains the remote base", () => {
    git(["checkout", "-b", "feat/x"], process.cwd());
    commit(process.cwd(), "b.txt", "two");
    expect(main(["--quiet"])).toBe(0);
  });

  it("fails when the remote base has moved ahead", () => {
    const work = process.cwd();
    git(["checkout", "-b", "feat/x"], work);
    commit(work, "b.txt", "two");

    // Someone else lands on main. Note this NEVER touches the local tracking
    // ref: a second clone pushes, so `origin/main` here stays stale — which is
    // precisely the condition the incident had.
    const other = path.join(dir, "other");
    git(["clone", path.join(dir, "origin.git"), other], dir);
    commit(other, "c.txt", "three");
    git(["push"], other);

    const staleRef = git(["rev-parse", "origin/main"], work);
    const trueRemote = git(["ls-remote", "--heads", "origin", "main"], work).split(/\s+/)[0];
    expect(staleRef).not.toBe(trueRemote);

    // A gate reading the tracking ref would pass here. This one must not.
    expect(main(["--quiet"])).toBe(1);
  });

  it("no-ops on the base branch itself and in CI", () => {
    expect(main(["--quiet"])).toBe(0); // still on main
    git(["checkout", "-b", "feat/y"], process.cwd());
    process.env["CI"] = "true";
    expect(main(["--quiet"])).toBe(0);
    delete process.env["CI"];
  });

  it("does not fail closed when the remote is unreachable, but says so", () => {
    git(["checkout", "-b", "feat/z"], process.cwd());
    // An unknown base name is indistinguishable from an unreachable remote at
    // this layer, and both must report NOT VERIFIED rather than a false green.
    expect(main(["--base", "no-such-base"])).toBe(0);
  });

  it("is registered in preflight — the gate exists to run before a push", () => {
    const taskfile = fs.readFileSync(path.join(cwd, "taskfiles/ci-fast.yml"), "utf8");
    expect(taskfile).toContain("check_branch_freshness");
    expect(fs.existsSync(GATE)).toBe(true);
  });
});
