#!/usr/bin/env tsx
/**
 * Fail when this branch is behind the base it will be merged into — asked of
 * the REMOTE, not of the local tracking ref.
 *
 * WHY THIS EXISTS — measured, not hypothetical.
 *
 * `feedback-update-branch-before-push` says: behind target → merge the base in
 * and re-run the gates, before the push. On 2026-08-08 that obligation was
 * satisfied in form and missed in substance. The run opened with
 * `git fetch origin --prune`, branched from `origin/main` at `c0a3630eb`,
 * worked for roughly ninety minutes, and pushed without fetching again. Two PRs
 * merged inside that window, one of them shipping the same roadmap phase the
 * branch was implementing. The PR opened `CONFLICTING`, and a concurrent branch
 * had already published a different number for the same census.
 *
 * The failure is not a forgotten rule. It is a live-state fact read once and
 * then carried: `direct-answers` Iron Law 2 forbids exactly that for branch and
 * sync state, and a ninety-minute-old reading is memory, not a check. Nothing
 * caught it, because nothing looked — `/roadmap:next` screens the remote before
 * SELECTION, `task preflight` reads the tree, and the session register is
 * advisory. The obligation was model-carried at the one point where its input
 * decays fastest.
 *
 * THIS GATE ASKS THE REMOTE. A version that compared HEAD against the local
 * `origin/main` ref would reproduce the very defect it exists to catch: that
 * ref is exactly the stale reading that caused the incident. So it runs
 * `git ls-remote`, one network round trip, and compares against the SHA the
 * server reports right now.
 *
 * It never fetches, merges, or rebases for you. Choosing how to catch up is a
 * git-history decision (`git-history-discipline`), and a gate that rewrites
 * history to make itself pass is a worse failure than the one it reports.
 *
 * WHICH BASE — asked of the forge, not assumed.
 *
 * The first version hardcoded `main`. That is right for most branches here and
 * wrong for every branch whose PR targets something else: a stacked PR, a
 * release line, a consumer repo on `master`. On those the gate produced a false
 * GREEN — "current with origin/main" while the branch sat behind the base it
 * would actually merge into — which is worse than no gate, because it answers a
 * question nobody asked in the voice of the one they did.
 *
 * So the base is resolved, in order: an explicit `--base`, then the base of the
 * OPEN PR for this branch as the forge reports it, then the repo's default
 * branch from `origin/HEAD`, then `main`. Every message names the base AND
 * where it came from, because "I checked main because that is the PR's base"
 * and "I checked main because I could not ask" must never print the same.
 *
 * When the forge cannot be asked (no `gh`, not authenticated, no GitHub remote)
 * the run says so out loud even under `--quiet`: it has verified the default
 * base and has NOT ruled out an open PR against a different one. That is a
 * partial answer, and partial answers are reported as partial.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runGateCli, runSelfTest, type SelfTestCase } from "./_lib/gate_self_test.js";
import { reportScanned } from "./_lib/scan_scope.js";

// ledger-exempt: single remote-ref probe — the entire scope is ONE ls-remote answer (0 or 1 refs) resolved to one aggregate ancestor verdict, and every empty path already publishes its reason via reportScanned allowEmpty; there is no per-target collection to account.
const DEFAULT_BASE = "main";
const SELF_TEST_MIN_CASES = 5;
const SELF_TEST_MIN_REJECT = 2;
const SCRIPT_REL = "src/scripts/check_branch_freshness.ts";
/** One forge round trip on the push path — long enough for a cold `gh`, short enough not to stall a push. */
const FORGE_TIMEOUT_MS = 10_000;

function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

export type GhResult = { ok: true; stdout: string } | { ok: false; reason: string };
export type GhRunner = (args: string[]) => GhResult;

/**
 * What the forge said about an open PR for this branch.
 *
 * Three-valued on purpose. `none` (the forge answered: no open PR) and
 * `unavailable` (the forge could not be asked) lead to the same base and to
 * DIFFERENT confidence, and collapsing them is exactly how a gate reports a
 * green it did not earn.
 */
export type ForgeAnswer =
  | { kind: "pr"; base: string; number: number }
  | { kind: "none" }
  | { kind: "unavailable"; reason: string };

/** Where the base name came from — printed with every verdict. */
export type BaseSource = "flag" | "pull-request" | "origin-head" | "fallback";

export interface BaseResolution {
  readonly base: string;
  readonly source: BaseSource;
  readonly pr?: number;
  /** Present iff an open PR against a different base could not be ruled out. */
  readonly unverified?: string;
}

function gh(args: string[]): GhResult {
  try {
    const out = execFileSync("gh", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: FORGE_TIMEOUT_MS,
    });
    return { ok: true, stdout: out.toString() };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { ok: false, reason: "the gh CLI is not installed" };
    }
    if (code === "ETIMEDOUT") {
      return { ok: false, reason: `gh did not answer within ${FORGE_TIMEOUT_MS / 1000}s` };
    }
    return { ok: false, reason: "gh could not answer — not authenticated, or no GitHub remote" };
  }
}

/**
 * The base of the open PR whose head is `branch`.
 *
 * `pr list --head` rather than `pr view`: `pr view` will happily resolve a
 * CLOSED PR for the same branch, and a merged PR's base is not the base the
 * next push has to be current with.
 */
export function askForgeForBase(branch: string, run: GhRunner = gh): ForgeAnswer {
  const res = run([
    "pr", "list", "--head", branch, "--state", "open",
    "--json", "number,baseRefName", "--limit", "1",
  ]);
  if (!res.ok) {
    return { kind: "unavailable", reason: res.reason };
  }
  let rows: unknown;
  try {
    rows = JSON.parse(res.stdout);
  } catch {
    return { kind: "unavailable", reason: "gh returned output that is not JSON" };
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return { kind: "none" };
  }
  const row = rows[0] as { baseRefName?: unknown; number?: unknown };
  const base = typeof row.baseRefName === "string" ? row.baseRefName.trim() : "";
  if (base === "") {
    return { kind: "unavailable", reason: "gh answered without a baseRefName" };
  }
  return { kind: "pr", base, number: typeof row.number === "number" ? row.number : 0 };
}

/** The repo's own default branch, so a consumer on `master` is not told about `main`. */
export function repoDefaultBase(): { base: string; source: "origin-head" | "fallback" } {
  const ref = git(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
  if (ref !== null && ref.startsWith("origin/")) {
    const name = ref.slice("origin/".length).trim();
    if (name !== "") {
      return { base: name, source: "origin-head" };
    }
  }
  return { base: DEFAULT_BASE, source: "fallback" };
}

/** `--base` wins, then the open PR's base, then the repo default. */
export function resolveBase(
  argv: readonly string[],
  branch: string,
  forge: (b: string) => ForgeAnswer = (b) => askForgeForBase(b),
): BaseResolution {
  const flag = argv.indexOf("--base");
  if (flag >= 0) {
    const explicit = argv[flag + 1];
    if (explicit !== undefined && explicit !== "") {
      return { base: explicit, source: "flag" };
    }
  }
  const answer = forge(branch);
  if (answer.kind === "pr") {
    return { base: answer.base, source: "pull-request", pr: answer.number };
  }
  const fallback = repoDefaultBase();
  return answer.kind === "unavailable"
    ? { base: fallback.base, source: fallback.source, unverified: answer.reason }
    : { base: fallback.base, source: fallback.source };
}

/** Human-readable provenance — never omitted, so no verdict is ambiguous about what it checked. */
export function describeBase(r: BaseResolution): string {
  switch (r.source) {
    case "flag":
      return "base given on the command line";
    case "pull-request":
      return `base of open PR #${r.pr ?? 0}`;
    case "origin-head":
      return "repo default branch (origin/HEAD)";
    case "fallback":
      return `repo default (assumed ${DEFAULT_BASE} — origin/HEAD is not set)`;
  }
}

/** The SHA the server reports for `<base>` right now — never a tracking ref. */
export function remoteHead(base: string, remote = "origin"): string | null {
  const out = git(["ls-remote", "--heads", remote, base]);
  if (out === null || out === "") {
    return null;
  }
  const sha = out.split(/\s+/)[0];
  return sha !== undefined && /^[0-9a-f]{40}$/.test(sha) ? sha : null;
}

/**
 * Is `sha` already contained in HEAD?
 *
 * `merge-base --is-ancestor` needs the object locally. A SHA the server just
 * reported may not be here yet, which is itself the answer — the branch cannot
 * contain a commit it has never seen.
 */
export function containsCommit(sha: string): boolean | null {
  if (git(["cat-file", "-e", `${sha}^{commit}`]) === null) {
    return false;
  }
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", sha, "HEAD"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Build a throwaway origin + working clone, and optionally let a SECOND clone
 * push so the working clone's tracking ref goes stale without it noticing.
 *
 * The stale-tracking-ref case is the whole point. A fixture that only advances
 * the remote via the same clone would leave `origin/main` correct locally, and a
 * gate reading the tracking ref would pass it — which is exactly the false green
 * this gate exists to remove.
 */
function buildFixture(root: string, opts: { advanceRemote: boolean }): string {
  const origin = path.join(root, "origin.git");
  const work = path.join(root, "work");
  fs.mkdirSync(origin, { recursive: true });
  const g = (args: string[], at: string): void => {
    execFileSync("git", args, { cwd: at, stdio: "ignore" });
  };
  const write = (at: string, name: string, body: string): void => {
    fs.writeFileSync(path.join(at, name), body);
    g(["add", "-A"], at);
    g(["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", name], at);
  };
  g(["init", "--bare", "-b", DEFAULT_BASE], origin);
  g(["init", "-b", DEFAULT_BASE, work], root);
  g(["remote", "add", "origin", origin], work);
  write(work, "a.txt", "one");
  g(["push", "-u", "origin", DEFAULT_BASE], work);
  g(["checkout", "-b", "feat/x"], work);
  write(work, "b.txt", "two");
  if (opts.advanceRemote) {
    const other = path.join(root, "other");
    g(["clone", origin, other], root);
    write(other, "c.txt", "three");
    g(["push"], other);
  }
  return work;
}

/**
 * A repo where the branch's real base is NOT the default branch: `feat/x` is
 * cut from `develop`, `develop` then advances on the remote, and `main` never
 * moves.
 *
 * This is the fixture that demonstrates the defect the base resolution exists
 * to remove. Checked against `main` the branch is perfectly current — a GREEN
 * that is true and irrelevant. Checked against `develop`, the base it will
 * actually merge into, it is behind. Both verdicts come from the same tree, so
 * a regression that reinstates a hardcoded base flips exactly one of them.
 */
function buildTwoBaseFixture(root: string): string {
  const origin = path.join(root, "origin.git");
  const work = path.join(root, "work");
  fs.mkdirSync(origin, { recursive: true });
  const g = (args: string[], at: string): void => {
    execFileSync("git", args, { cwd: at, stdio: "ignore" });
  };
  const write = (at: string, name: string, body: string): void => {
    fs.writeFileSync(path.join(at, name), body);
    g(["add", "-A"], at);
    g(["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", name], at);
  };
  g(["init", "--bare", "-b", DEFAULT_BASE], origin);
  g(["init", "-b", DEFAULT_BASE, work], root);
  g(["remote", "add", "origin", origin], work);
  write(work, "a.txt", "one");
  g(["push", "-u", "origin", DEFAULT_BASE], work);
  g(["checkout", "-b", "develop"], work);
  g(["push", "-u", "origin", "develop"], work);
  g(["checkout", "-b", "feat/x"], work);
  write(work, "b.txt", "two");
  // A second clone advances `develop` only — `main` stays exactly where it was.
  const other = path.join(root, "other");
  g(["clone", origin, other], root);
  g(["checkout", "develop"], other);
  write(other, "c.txt", "three");
  g(["push"], other);
  return work;
}

export function selfTest(repoRoot: string): number {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cbf-selftest-"));
  const run = (advanceRemote: boolean, onBase: boolean): number => {
    const dir = fs.mkdtempSync(path.join(root, "case-"));
    const work = buildFixture(dir, { advanceRemote });
    if (onBase) {
      execFileSync("git", ["checkout", DEFAULT_BASE], { cwd: work, stdio: "ignore" });
    }
    // The child must not inherit a CI flag, or every case would no-op green.
    delete process.env["CI"];
    delete process.env["GITHUB_ACTIONS"];
    return runGateCli(repoRoot, SCRIPT_REL, ["--quiet"], work);
  };
  const runTwoBase = (base: string): number => {
    const dir = fs.mkdtempSync(path.join(root, "twobase-"));
    const work = buildTwoBaseFixture(dir);
    delete process.env["CI"];
    delete process.env["GITHUB_ACTIONS"];
    return runGateCli(repoRoot, SCRIPT_REL, ["--quiet", "--base", base], work);
  };
  const cases: SelfTestCase[] = [
    {
      name: "a branch whose tracking ref is stale while the remote has moved is REFUSED",
      expect: "reject",
      run: () => run(true, false),
    },
    {
      name: "a branch behind its REAL base (develop) is refused when that base is checked",
      expect: "reject",
      run: () => runTwoBase("develop"),
    },
    {
      name: "the same branch passes against main — the false green a hardcoded base produces",
      expect: "accept",
      run: () => runTwoBase(DEFAULT_BASE),
    },
    {
      name: "a branch containing the remote base passes",
      expect: "accept",
      run: () => run(false, false),
    },
    {
      name: "standing on the base branch itself is a no-op, not a refusal",
      expect: "accept",
      run: () => run(false, true),
    },
  ];
  try {
    return runSelfTest({
      gate: "check_branch_freshness",
      cases,
      minCases: SELF_TEST_MIN_CASES,
      minRejectCases: SELF_TEST_MIN_REJECT,
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

/**
 * Publish the scan scope: how many remote base refs this run actually resolved.
 *
 * One when the server answered, zero on every path that legitimately has
 * nothing to ask — each with its reason, because a gate reporting success over
 * an empty scope is the false green this repo keeps finding, and "there was
 * nothing to check" and "I checked and it was fine" must not print the same.
 */
function scanReport(scanned: number, allowEmpty?: string): void {
  reportScanned({
    gate: "check_branch_freshness",
    scanned,
    units: "remote base ref(s)",
    roots: ["origin"],
    ...(allowEmpty === undefined ? {} : { allowEmpty }),
  });
}

export function main(argv: string[] = process.argv.slice(2)): number {
  if (argv.includes("--self-test")) {
    return selfTest(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."));
  }
  const quiet = argv.includes("--quiet");

  // CI merges or refuses on the server; a second opinion here would be noise.
  if (process.env["CI"] === "true" || process.env["GITHUB_ACTIONS"] === "true") {
    scanReport(0, "no-op in CI — the forge owns mergeability, and a second opinion here is noise");
    return 0;
  }

  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch === null || branch === "HEAD") {
    scanReport(0, "detached HEAD — there is no branch whose freshness could be asked");
    return 0;
  }

  // Resolved AFTER the branch is known: the PR's base is a fact about THIS branch.
  const resolved = resolveBase(argv, branch);
  const base = resolved.base;

  if (branch === base) {
    scanReport(0, `standing on ${base} itself — a branch cannot be behind itself`);
    return 0;
  }

  // Loud even under --quiet: this run verified the default base and did NOT
  // rule out an open PR against a different one. A partial answer is reported
  // as partial, never folded into the plain green below.
  if (resolved.unverified !== undefined) {
    process.stdout.write(
      `⚠️  check_branch_freshness: could not ask the forge for this branch's PR base ` +
        `(${resolved.unverified}) — checking origin/${base}, the ${describeBase(resolved)}. ` +
        "If an open PR targets a different base, THAT base is NOT verified here.\n",
    );
  }

  const sha = remoteHead(base);
  if (sha === null) {
    // Loud, not silent. An offline run has not verified the invariant, and a
    // gate that passes on an invariant it never evaluated is the false green
    // this repo keeps finding.
    scanReport(0, `origin/${base} unreachable — reported NOT VERIFIED rather than green`);
    process.stdout.write(
      `check_branch_freshness: could not reach origin/${base} — NOT VERIFIED (offline?). ` +
        "Re-run before pushing.\n",
    );
    return 0;
  }

  scanReport(1);
  if (containsCommit(sha) === true) {
    if (!quiet) {
      process.stdout.write(
        `✅  branch is current with origin/${base} (${sha.slice(0, 9)}) — ${describeBase(resolved)}\n`,
      );
    }
    return 0;
  }

  console.error(
    `❌  branch is BEHIND origin/${base} — the remote is at ${sha.slice(0, 9)}. ` +
      `(${describeBase(resolved)})`,
  );
  console.error("");
  console.error("    Pushing now opens a PR that may conflict, and worse: another branch");
  console.error("    may already have shipped what this one is implementing.");
  console.error("");
  console.error(`    git fetch origin && git merge origin/${base}`);
  console.error("    ./agent-config roadmap:progress   # regenerate AFTER every merge, not only on conflict");
  console.error("    then re-run the gates before pushing.");
  console.error("");
  console.error("    The dashboard line is not optional housekeeping: the roadmap dashboard is a");
  console.error("    GENERATED file, so a merge that lands cleanly still leaves it describing");
  console.error("    neither side's roadmap set. A clean auto-merge of a generated file is still wrong.");
  console.error("");
  console.error(
    "    This gate asks the REMOTE, not your tracking ref — a fetch from earlier in",
  );
  console.error("    the session is a memory, not a check (direct-answers Iron Law 2).");
  return 1;
}

const invokedDirectly = ((): boolean => {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return fs.realpathSync(path.resolve(entry)) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  process.exit(main());
}
