#!/usr/bin/env tsx
/**
 * Keep a chain of branches current, top-down: main → dev-123 → subdev-123.
 *
 *   status [--branch B] [--offline] [--json]   each level against its parent
 *   sync   [--branch B] [--offline]            bring owned levels current, root first
 *   parent --set <parent> [--branch B]         record a branch's parent (local git config)
 *   parent --from-reflog                       record the current branch's parent and its SHA
 *                                              from the reflog (the post-checkout hook)
 *   reparent                                   hand the children of a merged parent to the
 *                                              grandparent, offline, with a report
 *
 * WHY TOP-DOWN. A child is brought current with its parent only after the
 * parent is current with its own parent. Merging main straight into subdev-123
 * while dev-123 lags integrates the same commits twice, on two diverging lines,
 * with exactly the conflicts the chain exists to avoid (K23) — so a lagging
 * parent that is not ours stops the cascade below it, with a report.
 *
 * WHAT IT MAY DO (D12). It merges a parent into a branch only when every commit
 * on that branch since its parent is authored by the current git user, the
 * branch's tree is clean, and the update strategy is merge. A branch not checked
 * out here is integrated in a temporary worktree, never in the checkout being
 * edited. A conflict is aborted and its paths are named; nothing is resolved
 * automatically. Nothing is ever pushed: a push stays behind the owner's
 * this-turn confirmation. With `--offline` nothing reaches the network; without
 * it, only `git fetch` (remote-tracking refs) and the forge's PR base are asked.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  chainOf,
  currentBranch,
  type ForgeBase,
  recordParent,
  recordParentFromReflog,
  reparentMerged,
} from "./_lib/branch_parents.js";
import {
  chainStatus,
  type Git,
  levelStatus,
  makeGit,
  renderStatus,
  tryGit,
} from "./_lib/branch_chain_status.js";
import { askForgeForBase } from "./check_branch_freshness.js";

export {
  chainStatus,
  type LevelStatus,
  renderStatus,
  writeChainStatus,
} from "./_lib/branch_chain_status.js";

export interface SyncStep {
  branch: string;
  action: "current" | "merged" | "reported" | "conflict" | "skipped";
  detail: string;
}

function updateStrategy(root: string): "merge" | "rebase" {
  for (const f of [".git-convention.yml", ".git-convention.yaml"]) {
    try {
      if (
        /^\s*update_strategy\s*:\s*["']?rebase/m.test(
          fs.readFileSync(path.join(root, f), "utf-8"),
        )
      )
        return "rebase";
    } catch {
      /* absent */
    }
  }
  return "merge";
}

/** The worktree that has `branch` checked out, if any. */
function checkedOutAt(git: Git, branch: string): string | null {
  const list = tryGit(git, ["worktree", "list", "--porcelain"]) ?? "";
  let wt: string | null = null;
  for (const line of list.split("\n")) {
    if (line.startsWith("worktree ")) wt = line.slice(9);
    if (line === `branch refs/heads/${branch}`) return wt;
  }
  return null;
}

function mergeIn(
  dir: string,
  parentRef: string,
): { ok: true } | { ok: false; conflicts: string[]; reason: string } {
  const g = makeGit(dir);
  if (tryGit(g, ["status", "--porcelain", "--untracked-files=no"]) !== "")
    return {
      ok: false,
      conflicts: [],
      reason: "the tree has uncommitted changes",
    };
  try {
    g(["merge", "--no-edit", "--no-ff", parentRef]);
    return { ok: true };
  } catch {
    const conflicts = (
      tryGit(g, ["diff", "--name-only", "--diff-filter=U"]) ?? ""
    )
      .split("\n")
      .filter(Boolean);
    tryGit(g, ["merge", "--abort"]);
    return {
      ok: false,
      conflicts,
      reason: conflicts.length
        ? "the merge conflicts"
        : "git refused the merge",
    };
  }
}

/** Bring the chain current, root first; never past a lagging parent that is not ours; never a push. */
export function chainSync(
  root: string,
  branch: string,
  opts: { forge?: ForgeBase; offline?: boolean } = {},
): SyncStep[] {
  const git = makeGit(root);
  if (!opts.offline) tryGit(git, ["fetch", "--quiet", "origin"]);
  const steps: SyncStep[] = [];
  let blockedBy: string | null = null;
  const strategy = updateStrategy(root);
  const here = currentBranch(root);
  for (const link of chainOf(
    root,
    branch,
    opts.forge ? { forge: opts.forge } : {},
  )) {
    const lvl = levelStatus(git, link);
    if (!lvl.parent || !lvl.parentRef || lvl.behind === null) {
      steps.push({
        branch: lvl.branch,
        action: "skipped",
        detail:
          lvl.note ?? (lvl.parent ? "not comparable" : "the root of the chain"),
      });
      continue;
    }
    if (blockedBy) {
      steps.push({
        branch: lvl.branch,
        action: "reported",
        detail: `waits for ${blockedBy}: integrating the default branch straight into ${lvl.branch} would integrate the same commits twice`,
      });
      continue;
    }
    if (lvl.behind === 0) {
      steps.push({
        branch: lvl.branch,
        action: "current",
        detail: `contains ${lvl.parent}`,
      });
      continue;
    }
    const why = !lvl.owned
      ? `frozen — not ours: ${lvl.branch} has no commit of ours since ${lvl.parent}, or one authored by someone else`
      : strategy === "rebase"
        ? "the update strategy is rebase: a history rewrite is the owner's call"
        : null;
    if (why) {
      steps.push({
        branch: lvl.branch,
        action: "reported",
        detail: `${lvl.behind} behind ${lvl.parent} — ${why}${lvl.overlap.length ? `; both changed ${lvl.overlap.slice(0, 5).join(", ")}` : ""}`,
      });
      blockedBy = lvl.branch;
      continue;
    }
    // Someone pushed to this branch since it was fetched here: a local merge would diverge from it.
    if (
      tryGit(git, [
        "rev-parse",
        "--verify",
        "--quiet",
        `refs/remotes/origin/${lvl.branch}`,
      ]) &&
      (tryGit(git, [
        "rev-list",
        "--count",
        `refs/heads/${lvl.branch}..refs/remotes/origin/${lvl.branch}`,
      ]) ?? "0") !== "0"
    ) {
      steps.push({
        branch: lvl.branch,
        action: "reported",
        detail: `origin/${lvl.branch} is ahead of the local branch — pull it first, then sync`,
      });
      blockedBy = lvl.branch;
      continue;
    }
    const at = checkedOutAt(git, lvl.branch);
    let dir: string;
    let temp: string | null = null;
    if (at && at !== root && lvl.branch !== here) {
      steps.push({
        branch: lvl.branch,
        action: "reported",
        detail: `${lvl.behind} behind ${lvl.parent}; checked out in ${at} — run sync there`,
      });
      blockedBy = lvl.branch;
      continue;
    }
    if (lvl.branch === here) dir = root;
    else {
      temp = fs.mkdtempSync(path.join(os.tmpdir(), "branch-chain-"));
      fs.rmSync(temp, { recursive: true, force: true });
      if (
        tryGit(git, ["worktree", "add", "--quiet", temp, lvl.branch]) === null
      ) {
        steps.push({
          branch: lvl.branch,
          action: "reported",
          detail: "a temporary worktree could not be made",
        });
        blockedBy = lvl.branch;
        continue;
      }
      dir = temp;
    }
    const r = mergeIn(dir, lvl.parentRef);
    if (temp) tryGit(git, ["worktree", "remove", "--force", temp]);
    if (r.ok)
      steps.push({
        branch: lvl.branch,
        action: "merged",
        detail: `merged ${lvl.behind} commit(s) of ${lvl.parent} locally — not pushed`,
      });
    else {
      steps.push({
        branch: lvl.branch,
        action: "conflict",
        detail: `${r.reason}${r.conflicts.length ? `: ${r.conflicts.join(", ")}` : ""} — aborted, nothing changed`,
      });
      blockedBy = lvl.branch;
    }
  }
  return steps;
}

function flag(argv: readonly string[], name: string): string | null {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? (argv[i + 1] as string) : null;
}

export function main(
  argv: readonly string[] = process.argv.slice(2),
  root: string = process.cwd(),
): number {
  const valued = new Set(["--branch", "--set"]);
  const action =
    argv.find(
      (a, i) => !a.startsWith("--") && !valued.has(argv[i - 1] ?? ""),
    ) ?? "status";
  const branch = flag(argv, "--branch") ?? currentBranch(root);
  if (!branch) {
    process.stderr.write(
      "branch_chain: HEAD is detached — name the branch with --branch\n",
    );
    return 2;
  }
  const offline = argv.includes("--offline");
  const forge: ForgeBase | undefined = offline
    ? undefined
    : (b) => askForgeForBase(b);
  if (action === "parent" && argv.includes("--from-reflog")) {
    const r = recordParentFromReflog(root);
    if (r) process.stdout.write(`recorded: ${r.branch} ← ${r.parent} at ${r.sha.slice(0, 12)} (from the reflog)\n`);
    return 0;
  }
  if (action === "reparent") {
    const lines = reparentMerged(root);
    for (const l of lines) process.stdout.write(`${l}\n`);
    if (!lines.length) process.stdout.write("no recorded parent is merged — nothing re-parented\n");
    return 0;
  }
  if (action === "parent") {
    const parent = flag(argv, "--set");
    if (!parent) {
      process.stderr.write(
        "usage: branch_chain parent --set <parent> [--branch B]\n",
      );
      return 2;
    }
    if (!recordParent(root, branch, parent)) return 1;
    process.stdout.write(
      `recorded: ${branch} ← ${parent} (local git config, not committed)\n`,
    );
    return 0;
  }
  if (action === "sync") {
    const steps = chainSync(root, branch, {
      ...(forge ? { forge } : {}),
      offline,
    });
    for (const s of steps)
      process.stdout.write(
        `${s.branch.padEnd(32)} ${s.action.padEnd(9)} ${s.detail}\n`,
      );
    if (steps.some((s) => s.action === "merged"))
      process.stdout.write(
        "nothing was pushed — push each merged branch when you choose to\n",
      );
    return steps.some((s) => s.action === "conflict") ? 1 : 0;
  }
  if (action !== "status") {
    process.stderr.write(
      "usage: branch_chain <status|sync|reparent|parent --set P|parent --from-reflog> [--branch B] [--offline] [--json]\n",
    );
    return 2;
  }
  const levels = chainStatus(root, branch, forge ? { forge } : {});
  if (argv.includes("--json"))
    process.stdout.write(`${JSON.stringify(levels, null, 2)}\n`);
  else process.stdout.write(`${renderStatus(levels).join("\n")}\n`);
  return 0;
}

const invokedDirectly = ((): boolean => {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return (
      fs.realpathSync(path.resolve(entry)) ===
      fs.realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
})();

if (invokedDirectly) process.exit(main());
