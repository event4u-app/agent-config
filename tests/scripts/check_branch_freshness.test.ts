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
  explicitBase,
  main,
  resolveBase,
  type ForgeAnswer,
  type GhResult,
} from "../../src/scripts/check_branch_freshness.js";

const GATE = path.resolve("src/scripts/check_branch_freshness.ts");

/**
 * Forge stubs.
 *
 * Every `main()` call below passes one — round-2 finding 7 caught the one that
 * did not, which made this sentence and `main()`'s own JSDoc false. Without a
 * seam these tests spawned the real `gh` against ambient credentials inside a
 * temp fixture, so an environment carrying `GH_REPO` could return a real PR
 * base for a same-named branch and change the base under test (round-1 finding
 * 6) — and the forge-unavailable branch could only be reached by NOT having
 * `gh`, which is why the test for it used to assert conditionally (round-1
 * finding 1).
 */
const noPr = (): ForgeAnswer => ({ kind: "none" });
const forgeDown = (): ForgeAnswer => ({
  kind: "unavailable",
  reason: "stubbed: forge unreachable",
});
const prBase =
  (base: string, num = 42) =>
  (): ForgeAnswer => ({ kind: "pr", base, number: num });

/** Capture stdout for one call — the warning path is stdout, not an exit code. */
function captureStdout(fn: () => void): string {
  const said: string[] = [];
  const write = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string) => {
    said.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  try {
    fn();
  } finally {
    process.stdout.write = write;
  }
  return said.join("");
}

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
    expect(main(["--quiet"], noPr)).toBe(0);
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
    expect(main(["--quiet"], noPr)).toBe(1);
  });

  it("no-ops on the base branch itself and in CI", () => {
    expect(main(["--quiet"], noPr)).toBe(0); // still on main
    git(["checkout", "-b", "feat/y"], process.cwd());
    process.env["CI"] = "true";
    expect(main(["--quiet"], noPr)).toBe(0);
    delete process.env["CI"];
  });

  it("does not fail closed when the remote is unreachable, but says so", () => {
    git(["checkout", "-b", "feat/z"], process.cwd());
    // An unknown base name is indistinguishable from an unreachable remote at
    // this layer, and both must report NOT VERIFIED rather than a false green.
    expect(main(["--base", "no-such-base"], noPr)).toBe(0);
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

    // Unconditional. The earlier version asserted inside `if (out.includes(...))`,
    // so wherever `gh` answered it asserted nothing and passed identically
    // whether the warning was emitted or suppressed (R2 finding 1). The stub
    // forces the branch, so this test can actually fail.
    const out = captureStdout(() => {
      expect(main(["--quiet"], forgeDown)).toBe(0);
    });
    expect(out).toContain("could not ask the forge");
    expect(out).toContain("stubbed: forge unreachable");
    expect(out).toContain("NOT verified");
  });

  it("stays silent about the forge when it answered — the warning is not boilerplate", () => {
    git(["checkout", "-b", "feat/answered"], process.cwd());
    commit(process.cwd(), "b.txt", "two");
    const out = captureStdout(() => {
      expect(main(["--quiet"], noPr)).toBe(0);
    });
    expect(out).not.toContain("could not ask the forge");
  });

  it("main() judges against the PR base end to end, not just resolveBase", () => {
    const work = process.cwd();
    git(["checkout", "-b", "develop"], work);
    git(["push", "-u", "origin", "develop"], work);
    git(["checkout", "-b", "feat/stacked-e2e"], work);
    commit(work, "b.txt", "two");

    // A second clone advances `develop` only; `main` never moves.
    const other = path.join(dir, "other");
    git(["clone", path.join(dir, "origin.git"), other], dir);
    git(["checkout", "develop"], other);
    commit(other, "c.txt", "three");
    git(["push"], other);

    // Against main the branch is current — true and irrelevant.
    expect(main(["--quiet"], prBase("main"))).toBe(0);
    // Against the base the PR actually targets, it is behind.
    expect(main(["--quiet"], prBase("develop", 77))).toBe(1);
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

  it("keeps a usable base when the PR NUMBER is missing, and never claims PR #0", () => {
    // Round-2 finding 4: discarding the base over an unusable number made the
    // gate check the repo default and warn "could not ask the forge" when it
    // HAD asked and been answered — a correct verdict traded for a tidier
    // message. The number is cosmetic; the base is the answer.
    for (const row of [{ baseRefName: "develop" }, { baseRefName: "develop", number: "7" }]) {
      const run = (): GhResult => ({ ok: true, stdout: JSON.stringify([row]) });
      const answer = askForgeForBase("feat/x", run);
      expect(answer).toEqual({ kind: "pr", base: "develop" });
    }
    // Round-2 finding 5: the old assertion passed pr: 7 and so could never
    // render #0 — it asserted nothing. This exercises the branch that can.
    expect(describeBase({ base: "develop", source: "pull-request" })).not.toContain("#0");
    expect(describeBase({ base: "develop", source: "pull-request" })).toContain("open PR");
    expect(describeBase({ base: "develop", source: "pull-request", pr: 7 })).toContain("#7");
  });

  it("rejects a --base that is really the next flag, instead of checking origin/--quiet", () => {
    // R2 finding 11: the guard used to accept anything non-empty, so
    // `--base --quiet` produced remoteHead("--quiet"), which fails and lands on
    // the exit-0 NOT-VERIFIED path — a typo reading as a pass.
    expect(explicitBase(["--base", "--quiet"])).toBeNull();
    expect(explicitBase(["--base"])).toBeNull();
    expect(explicitBase(["--base", ""])).toBeNull();
    // Round-2 finding 6: an indexOf("--base") lookup dropped the joined form
    // silently, so the gate auto-resolved some OTHER base and reported a green
    // about a base the caller never asked about.
    expect(explicitBase(["--base=develop"])).toBe("develop");
    expect(explicitBase(["--quiet", "--base=release/2.x"])).toBe("release/2.x");
    expect(explicitBase(["--base="])).toBeNull();
    expect(explicitBase(["--base", "release/9"])).toBe("release/9");
  });

  it("still asks the forge while standing on the apparent default branch", () => {
    // Round-2 finding 1, and the reversal of a round-1 finding whose premise
    // was false. Skipping the forge for `branch === localDefaultBase()` let the
    // STALE clone-time ref decide a verdict: with origin/HEAD unset the local
    // default falls back to "main", so on a repo whose real base is "develop"
    // the branch was skipped with no check at all. `gh pr list --head main`
    // CAN usefully answer — a PR from the default branch into a release line
    // is exactly that answer, and exactly what this gate exists for.
    let asked = 0;
    const forge = (b: string): ForgeAnswer => {
      asked += 1;
      expect(b).toBe("main");
      return { kind: "pr", base: "develop", number: 5 };
    };
    const r = resolveBase([], "main", forge);
    expect(asked).toBe(1);
    expect(r.base).toBe("develop");
    expect(r.source).toBe("pull-request");
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
