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
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_BASE = "main";

function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
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

export function main(argv: string[] = process.argv.slice(2)): number {
  const quiet = argv.includes("--quiet");
  const baseArg = argv.indexOf("--base");
  const base = baseArg >= 0 ? (argv[baseArg + 1] ?? DEFAULT_BASE) : DEFAULT_BASE;

  // CI merges or refuses on the server; a second opinion here would be noise.
  if (process.env["CI"] === "true" || process.env["GITHUB_ACTIONS"] === "true") {
    if (!quiet) {
      process.stdout.write("check_branch_freshness: no-op in CI — the forge owns mergeability." + "\n");
    }
    return 0;
  }

  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch === null || branch === "HEAD") {
    process.stdout.write("check_branch_freshness: detached HEAD — nothing to compare. NO-OP." + "\n");
    return 0;
  }
  if (branch === base) {
    if (!quiet) {
      process.stdout.write(`check_branch_freshness: on ${base} itself — nothing to compare.` + "\n");
    }
    return 0;
  }

  const sha = remoteHead(base);
  if (sha === null) {
    // Loud, not silent. An offline run has not verified the invariant, and a
    // gate that passes on an invariant it never evaluated is the false green
    // this repo keeps finding.
    process.stdout.write(
      `check_branch_freshness: could not reach origin/${base} — NOT VERIFIED (offline?). ` +
        "Re-run before pushing.\n",
    );
    return 0;
  }

  if (containsCommit(sha) === true) {
    if (!quiet) {
      process.stdout.write(`✅  branch is current with origin/${base} (${sha.slice(0, 9)})` + "\n");
    }
    return 0;
  }

  console.error(`❌  branch is BEHIND origin/${base} — the remote is at ${sha.slice(0, 9)}.`);
  console.error("");
  console.error("    Pushing now opens a PR that may conflict, and worse: another branch");
  console.error("    may already have shipped what this one is implementing.");
  console.error("");
  console.error(`    git fetch origin && git merge origin/${base}`);
  console.error("    then re-run the gates before pushing.");
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
