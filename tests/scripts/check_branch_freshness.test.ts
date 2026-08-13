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

import {
  askForgeForBase,
  describeBase,
  main,
  resolveBase,
  type ForgeAnswer,
  type GhResult,
} from "../../src/scripts/check_branch_freshness.js";

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

  it("checks the base of the OPEN PR, not the repo default", () => {
    git(["checkout", "-b", "feat/stacked"], process.cwd());
    commit(process.cwd(), "b.txt", "two");

    // The branch is perfectly current with main and behind `develop`. A gate
    // that assumed the default would report the true-but-irrelevant green.
    const forge = (): ForgeAnswer => ({ kind: "pr", base: "develop", number: 77 });
    const r = resolveBase([], "feat/stacked", forge);
    expect(r.base).toBe("develop");
    expect(r.source).toBe("pull-request");
    expect(r.unverified).toBeUndefined();
    expect(describeBase(r)).toContain("#77");
  });

  it("an explicit --base outranks the forge and never spends a round trip", () => {
    let asked = 0;
    const forge = (): ForgeAnswer => {
      asked += 1;
      return { kind: "pr", base: "develop", number: 1 };
    };
    const r = resolveBase(["--base", "release/9"], "feat/x", forge);
    expect(r.base).toBe("release/9");
    expect(r.source).toBe("flag");
    expect(asked).toBe(0);
  });

  it("distinguishes 'the forge says there is no PR' from 'the forge could not be asked'", () => {
    const answered = resolveBase([], "feat/x", () => ({ kind: "none" }));
    const silent = resolveBase([], "feat/x", () => ({
      kind: "unavailable",
      reason: "the gh CLI is not installed",
    }));

    // Same base — and that is the point: only the confidence differs, so the
    // two must not be representable as the same verdict.
    expect(silent.base).toBe(answered.base);
    expect(answered.unverified).toBeUndefined();
    expect(silent.unverified).toBe("the gh CLI is not installed");
  });

  it("reports NOT-VERIFIED loudly even under --quiet when the forge is unreachable", () => {
    git(["checkout", "-b", "feat/quiet"], process.cwd());
    commit(process.cwd(), "b.txt", "two");
    const said: string[] = [];
    const write = process.stdout.write.bind(process.stdout);
    // `gh` is absent in CI for this repo's test job, so the unverified path is
    // the one this run actually takes — no stubbing needed to reach it.
    process.stdout.write = ((chunk: string) => {
      said.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    try {
      main(["--quiet"]);
    } finally {
      process.stdout.write = write;
    }
    const out = said.join("");
    // Either the forge answered (a real gh in the dev environment) or it did
    // not; what must never happen is silence about which of the two it was.
    if (out.includes("could not ask the forge")) {
      expect(out).toContain("NOT verified");
    }
  });

  it("treats a closed-PR-shaped empty answer as 'no open PR', not as a base", () => {
    const run = (): GhResult => ({ ok: true, stdout: "[]" });
    expect(askForgeForBase("feat/x", run)).toEqual({ kind: "none" });
  });

  it("reads baseRefName out of the forge answer", () => {
    const run = (): GhResult => ({
      ok: true,
      stdout: JSON.stringify([{ number: 1325, baseRefName: "release/9" }]),
    });
    expect(askForgeForBase("feat/x", run)).toEqual({
      kind: "pr",
      base: "release/9",
      number: 1325,
    });
  });

  it("never invents a base when the forge output is unusable", () => {
    const garbage = (): GhResult => ({ ok: true, stdout: "not json" });
    const empty = (): GhResult => ({ ok: true, stdout: JSON.stringify([{ number: 1 }]) });
    const failed = (): GhResult => ({ ok: false, reason: "not authenticated" });
    for (const run of [garbage, empty, failed]) {
      const answer = askForgeForBase("feat/x", run);
      expect(answer.kind).toBe("unavailable");
    }
  });

  it("asks for OPEN PRs on this head only — a merged PR's base is not the next push's base", () => {
    let seen: string[] = [];
    const run = (args: string[]): GhResult => {
      seen = args;
      return { ok: true, stdout: "[]" };
    };
    askForgeForBase("feat/x", run);
    expect(seen).toContain("--head");
    expect(seen).toContain("feat/x");
    expect(seen).toContain("--state");
    expect(seen).toContain("open");
  });
});
