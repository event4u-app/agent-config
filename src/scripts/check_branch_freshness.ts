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
 * branch AS THE SERVER REPORTS IT (`ls-remote --symref`), then the local
 * `origin/HEAD`, then `main`. Every message names the base AND where it came
 * from, because "I checked main because that is the PR's base" and "I checked
 * main because I could not ask" must never print the same.
 *
 * The server symref matters for the same reason `remoteHead` exists: the local
 * `refs/remotes/origin/HEAD` is written at clone time and never refreshed, so
 * taking the base NAME from it would reintroduce the stale-local-state failure
 * this module argues against everywhere else. It is kept only as the labelled
 * fallback for when the server cannot be reached.
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
/**
 * One network round trip on the push path — long enough for a cold `gh`, short
 * enough that the worst case stays under budget.
 *
 * It bounds `git` as well as `gh`, and that is the point rather than tidiness:
 * with a timeout on `gh` only, the two `ls-remote` calls could hang unbounded
 * against an unresponsive SSH remote, so the stated worst case was not one. The
 * slowest path makes three calls (forge, symref, base head), so the arithmetic
 * that keeps this under the 25s `pre_push_budget_seconds` ceiling is 3 x 8s.
 */
const NETWORK_TIMEOUT_MS = 8_000;

function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: NETWORK_TIMEOUT_MS,
    }).trim();
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
  | { kind: "pr"; base: string; number?: number }
  | { kind: "none" }
  | { kind: "unavailable"; reason: string };

/** Where the base name came from — printed with every verdict. */
export type BaseSource =
  | "flag"
  | "pull-request"
  | "origin-symref"
  | "origin-head"
  | "fallback";

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
      timeout: NETWORK_TIMEOUT_MS,
    });
    return { ok: true, stdout: out.toString() };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { ok: false, reason: "the gh CLI is not installed" };
    }
    if (code === "ETIMEDOUT") {
      return { ok: false, reason: `gh did not answer within ${NETWORK_TIMEOUT_MS / 1000}s` };
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
  // The number is cosmetic — it names the PR in the verdict line — while the
  // base is the answer the gate exists to get. An unusable number therefore
  // does NOT discard the base: doing that made the gate check the repo default
  // instead and warn "could not ask the forge" when it had asked and been
  // answered, trading a correct verdict for a tidier message. `describeBase`
  // omits the number rather than rendering the impossible `#0`.
  const usable =
    typeof row.number === "number" && Number.isInteger(row.number) && row.number > 0;
  return usable ? { kind: "pr", base, number: row.number as number } : { kind: "pr", base };
}

/**
 * The default branch as the LOCAL clone believes it — no network.
 *
 * `refs/remotes/origin/HEAD` is written at clone time and never refreshed
 * without `git remote set-head`, so this is exactly the class of stale local
 * state this module argues against everywhere else. It has exactly one caller,
 * `serverDefaultBase`, and is reached only when the server could not be asked —
 * where `describeBase` labels it as possibly stale. It decides no verdict on
 * its own; a short-circuit that let it do so is the regression documented in
 * `resolveBase`.
 */
export function localDefaultBase(): { base: string; source: "origin-head" | "fallback" } {
  const ref = git(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
  if (ref !== null && ref.startsWith("origin/")) {
    const name = ref.slice("origin/".length).trim();
    if (name !== "") {
      return { base: name, source: "origin-head" };
    }
  }
  return { base: DEFAULT_BASE, source: "fallback" };
}

/**
 * The default branch as the SERVER reports it right now.
 *
 * Same discipline as `remoteHead`: a gate whose thesis is "ask the remote"
 * must not take the branch NAME from a tracking ref either. Costs one
 * `ls-remote`, the round trip this gate already pays, and degrades to the
 * local ref (labelled as such) when the server cannot be reached.
 */
export function serverDefaultBase(): {
  base: string;
  source: "origin-symref" | "origin-head" | "fallback";
} {
  const out = git(["ls-remote", "--symref", "origin", "HEAD"]);
  if (out !== null) {
    for (const line of out.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("ref:")) {
        const name = trimmed.slice("ref:".length).trim().split(/\s+/)[0] ?? "";
        if (name.startsWith("refs/heads/")) {
          const short = name.slice("refs/heads/".length).trim();
          if (short !== "") {
            return { base: short, source: "origin-symref" };
          }
        }
      }
    }
  }
  return localDefaultBase();
}

/**
 * The base requested on the command line, or null when none was.
 *
 * Both spellings are accepted. `--base=develop` used to be dropped silently by
 * an `indexOf("--base")` lookup, and a dropped request is worse than a rejected
 * one here: the gate then auto-resolves some OTHER base and reports a green
 * about a base the caller never asked about.
 */
export function explicitBase(argv: readonly string[]): string | null {
  const joined = argv.find((a) => a.startsWith("--base="));
  if (joined !== undefined) {
    const value = joined.slice("--base=".length);
    return value === "" ? null : value;
  }
  const flag = argv.indexOf("--base");
  if (flag < 0) {
    return null;
  }
  const explicit = argv[flag + 1];
  // A bare trailing `--base`, or one followed by another flag, is a typo rather
  // than a base name. Accepting it produced `remoteHead("--quiet")`, which fails
  // and lands on the exit-0 NOT-VERIFIED path — a typo reading as a pass.
  if (explicit === undefined || explicit === "" || explicit.startsWith("-")) {
    return null;
  }
  return explicit;
}

/** `--base` wins, then the open PR's base, then the repo default. */
export function resolveBase(
  argv: readonly string[],
  branch: string,
  forge: (b: string) => ForgeAnswer = (b) => askForgeForBase(b),
): BaseResolution {
  const explicit = explicitBase(argv);
  if (explicit !== null) {
    return { base: explicit, source: "flag" };
  }
  // There is deliberately no cheap short-circuit for "the branch looks like the
  // default". It was tried and reverted: it decided a VERDICT from
  // `localDefaultBase`, the stale clone-time ref this module argues against, so
  // a branch whose name collided with a stale or fallback local default was
  // skipped without any check at all. The premise it rested on — that
  // `gh pr list --head main` can never usefully answer — is false: a PR from the
  // default branch into a release line or a parent PR is exactly that answer,
  // and it is the case this gate exists for. Standing on the real base is
  // short-circuited one layer up, in `main`, AFTER the base is known.
  const answer = forge(branch);
  if (answer.kind === "pr") {
    return answer.number === undefined
      ? { base: answer.base, source: "pull-request" }
      : { base: answer.base, source: "pull-request", pr: answer.number };
  }
  const fallback = serverDefaultBase();
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
      return r.pr === undefined
        ? "base of the open PR for this branch"
        : `base of open PR #${r.pr}`;
    case "origin-symref":
      return "repo default branch, as the server reports it";
    case "origin-head":
      return "repo default branch from the LOCAL origin/HEAD ref, which may be stale";
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
interface Scaffold {
  origin: string;
  work: string;
  g: (args: string[], at: string) => void;
  write: (at: string, name: string, body: string) => void;
}

/** The bare origin + working clone every fixture below starts from. */
function scaffold(root: string): Scaffold {
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
  return { origin, work, g, write };
}

function buildFixture(root: string, opts: { advanceRemote: boolean }): string {
  const { origin, work, g, write } = scaffold(root);
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
 * A repo where the branch's real base is NOT `main`: `feat/x` is cut from
 * `develop`, `develop` then advances on the remote, and `main` never moves.
 * The SERVER's `HEAD` is pointed at `serverDefault`.
 *
 * The base is left for the gate to resolve — no `--base`. That is the whole
 * point of the fixture, and the first version got it wrong: it passed
 * `--base` on both cases, which exercises the flag branch that existed before
 * this change. Deleting the entire forge/symref resolution would have left both
 * cases green, so the pair proved nothing about the new behaviour and the raised
 * self-test floors rested on coverage that did not exist. (R2 finding 2.)
 *
 * With `serverDefault = "develop"` the gate must refuse: that is the base this
 * branch is actually behind. With `serverDefault = "main"` the same tree passes.
 * A regression that reinstates a hardcoded `main` flips the first case, because
 * nothing but the resolution decides which base is asked about.
 */
function buildTwoBaseFixture(root: string, serverDefault: string): string {
  const { origin, work, g, write } = scaffold(root);
  g(["checkout", "-b", "develop"], work);
  g(["push", "-u", "origin", "develop"], work);
  g(["checkout", "-b", "feat/x"], work);
  write(work, "b.txt", "two");
  // The bare repo's own HEAD is what `ls-remote --symref origin HEAD` reports,
  // so this is the server-side default branch, not a local tracking ref.
  g(["symbolic-ref", "HEAD", `refs/heads/${serverDefault}`], origin);
  // A second clone advances `develop` only — `main` stays exactly where it was.
  const other = path.join(root, "other");
  g(["clone", origin, other], root);
  g(["checkout", "develop"], other);
  write(other, "c.txt", "three");
  g(["push"], other);
  return work;
}

/**
 * Strip everything that could point the child's `gh` at a real forge.
 *
 * `runGateCli` spawns with the full inherited environment, and since the
 * two-base cases dropped `--base` the resolution itself is what they assert on.
 * An ambient `GH_REPO` can make `gh pr list --head feat/x` answer about a real
 * PR in someone else's repository and silently move the base under test — the
 * same ambient-credential hazard the `forge` seam closed for the unit tests,
 * which would otherwise have stayed live in the only coverage of the new
 * symref resolution. `CI` would no-op every case green.
 */
function isolateChildEnv(): void {
  for (const key of ["CI", "GITHUB_ACTIONS", "GH_REPO", "GH_TOKEN", "GITHUB_TOKEN", "GH_HOST", "GH_CONFIG_DIR"]) {
    delete process.env[key];
  }
}

export function selfTest(repoRoot: string): number {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cbf-selftest-"));
  const run = (advanceRemote: boolean, onBase: boolean): number => {
    const dir = fs.mkdtempSync(path.join(root, "case-"));
    const work = buildFixture(dir, { advanceRemote });
    if (onBase) {
      execFileSync("git", ["checkout", DEFAULT_BASE], { cwd: work, stdio: "ignore" });
    }
    isolateChildEnv();
    return runGateCli(repoRoot, SCRIPT_REL, ["--quiet"], work);
  };
  const runTwoBase = (serverDefault: string): number => {
    const dir = fs.mkdtempSync(path.join(root, "twobase-"));
    const work = buildTwoBaseFixture(dir, serverDefault);
    isolateChildEnv();
    // No `--base`: the gate resolves it, which is the behaviour under test.
    return runGateCli(repoRoot, SCRIPT_REL, ["--quiet"], work);
  };
  const cases: SelfTestCase[] = [
    {
      name: "a branch whose tracking ref is stale while the remote has moved is REFUSED",
      expect: "reject",
      run: () => run(true, false),
    },
    {
      name: "the RESOLVED base decides: server default develop, branch behind it, REFUSED",
      expect: "reject",
      run: () => runTwoBase("develop"),
    },
    {
      name: "same tree, server default main — passes, so the resolution is what moved the verdict",
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

/**
 * @param forge Seam for the forge lookup. Production passes nothing and gets the
 * real `gh`. Tests MUST pass a stub: without this parameter the only way to
 * reach the forge-unavailable branch was to not have `gh` installed, so the test
 * for it could only assert conditionally — i.e. it passed whether or not the
 * warning was emitted. It also stopped every fixture test from spawning `gh`
 * against ambient credentials, where a `GH_REPO` override could return a real
 * PR base for a same-named branch and silently change the base under test.
 */
export function main(
  argv: string[] = process.argv.slice(2),
  forge?: (b: string) => ForgeAnswer,
): number {
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
  // `resolveBase`'s third parameter has a default, so passing `undefined`
  // positionally already selects the real `gh` — no branch needed here.
  const resolved = resolveBase(argv, branch, forge);
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
