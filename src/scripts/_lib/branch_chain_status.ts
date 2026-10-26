/**
 * The branch chain's status, read from local refs only: each level against its
 * parent, the newer of the local and the remote-tracking ref of that parent,
 * whether the level is the current user's own work, and the paths both sides
 * changed since their merge base. No network, no mutation — the pre-push gate
 * and the detached refresh read it; `branch_chain sync` acts on it.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import {
  chainOf,
  type ChainLink,
  currentBranch,
  type ForgeBase,
} from "./branch_parents.js";
import { gitProbe } from "./spawn_env.js";

export interface LevelStatus {
  branch: string;
  parent: string | null;
  source: ChainLink["source"];
  /** the parent ref compared against: the newer of the local branch and origin's */
  parentRef: string | null;
  behind: number | null;
  ahead: number | null;
  owned: boolean | null;
  /** paths both the parent (since the merge base) and this branch changed */
  overlap: string[];
  note?: string;
}

export type Git = (args: readonly string[]) => string;

export function makeGit(root: string): Git {
  return (args) =>
    gitProbe(root, args, { maxBuffer: 256 * 1024 * 1024 }).trim();
}
export const tryGit = (git: Git, args: readonly string[]): string | null => {
  try {
    return git(args);
  } catch {
    return null;
  }
};

export function refSha(git: Git, ref: string): string | null {
  return tryGit(git, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
}

/** The newer of `refs/heads/<b>` and `refs/remotes/origin/<b>` when one contains the other; the local one otherwise. */
export function parentTip(git: Git, branch: string): string | null {
  const local = refSha(git, `refs/heads/${branch}`)
    ? `refs/heads/${branch}`
    : null;
  const remote = refSha(git, `refs/remotes/origin/${branch}`)
    ? `refs/remotes/origin/${branch}`
    : null;
  if (local && remote)
    return tryGit(git, ["merge-base", "--is-ancestor", local, remote]) !== null
      ? remote
      : local;
  return local ?? remote;
}

/** Every commit on `branch` since `parent` is authored by the current git user. */
export function ownedBy(git: Git, branch: string, parentRef: string): boolean {
  const me = tryGit(git, ["config", "--get", "user.email"]);
  if (!me) return false;
  const authors = tryGit(git, [
    "log",
    "--format=%ae",
    `${parentRef}..refs/heads/${branch}`,
  ]);
  if (authors === null) return false;
  return authors
    .split("\n")
    .filter(Boolean)
    .every((a) => a.toLowerCase() === me.toLowerCase());
}

function changedSince(git: Git, base: string, tip: string): Set<string> {
  const out = tryGit(git, [
    "-c",
    "core.quotePath=false",
    "diff",
    "--name-only",
    `${base}...${tip}`,
  ]);
  return new Set((out ?? "").split("\n").filter(Boolean));
}

export function chainStatus(
  root: string,
  branch: string,
  opts: { forge?: ForgeBase; git?: Git } = {},
): LevelStatus[] {
  const git = opts.git ?? makeGit(root);
  return chainOf(root, branch, opts.forge ? { forge: opts.forge } : {}).map(
    (link) => levelStatus(git, link),
  );
}

/** One level against its parent, read now — a merge into the parent changes what the child lags. */
export function levelStatus(git: Git, link: ChainLink): LevelStatus {
  if (!link.parent) {
    return {
      branch: link.branch,
      parent: null,
      source: link.source,
      parentRef: null,
      behind: null,
      ahead: null,
      owned: null,
      overlap: [],
      ...(link.source === "unknown"
        ? {
            note: `parent unknown — record it: branch_chain parent --set <parent> --branch ${link.branch}`,
          }
        : {}),
    };
  }
  const parentRef = parentTip(git, link.parent);
  if (!parentRef || !refSha(git, `refs/heads/${link.branch}`)) {
    return {
      branch: link.branch,
      parent: link.parent,
      source: link.source,
      parentRef,
      behind: null,
      ahead: null,
      owned: null,
      overlap: [],
      note: "a branch of this level is not here",
    };
  }
  const counts = tryGit(git, [
    "rev-list",
    "--left-right",
    "--count",
    `${parentRef}...refs/heads/${link.branch}`,
  ]);
  const [behind, ahead] = (counts ?? "").split(/\s+/).map(Number) as [
    number,
    number,
  ];
  const base = tryGit(git, [
    "merge-base",
    parentRef,
    `refs/heads/${link.branch}`,
  ]);
  const overlap =
    base && behind > 0
      ? [...changedSince(git, base, parentRef)]
          .filter((f) =>
            changedSince(git, base, `refs/heads/${link.branch}`).has(f),
          )
          .sort()
      : [];
  return {
    branch: link.branch,
    parent: link.parent,
    source: link.source,
    parentRef,
    behind,
    ahead,
    owned: ownedBy(git, link.branch, parentRef),
    overlap,
  };
}

export function renderStatus(levels: readonly LevelStatus[]): string[] {
  return levels.map((l) => {
    if (!l.parent)
      return `${l.branch}${l.source === "root" ? " (root)" : ""}${l.note ? ` — ${l.note}` : ""}`;
    if (l.behind === null)
      return `${l.branch} ← ${l.parent}: ${l.note ?? "unverified"}`;
    const state = l.behind === 0 ? "current" : `${l.behind} behind`;
    const who = l.owned === false ? ", not ours" : "";
    const warn = l.overlap.length
      ? ` — both changed: ${l.overlap.slice(0, 8).join(", ")}${l.overlap.length > 8 ? ", …" : ""}`
      : "";
    return `${l.branch} ← ${l.parent} (${l.source}): ${state}, ${l.ahead} ahead${who}${warn}`;
  });
}

/** Offline chain status as JSON beside the map: what the detached refresh writes. */
export function writeChainStatus(root: string, file: string): void {
  const cur = currentBranch(root);
  if (!cur) return;
  const levels = chainStatus(root, cur);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({ branch: cur, levels })}\n`);
}
