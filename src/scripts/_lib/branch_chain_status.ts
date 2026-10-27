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
  /** tables, columns, packages and routes both sides added since the merge base, whatever the files (H18) */
  semantic?: string[];
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

/**
 * Ours: at least one commit on `branch` since `parent`, and every one authored by
 * the current git user — by e-mail, or by name where the e-mail differs. A branch
 * with no own commit is not ours: it holds nothing of ours to integrate (H17).
 */
export function ownedBy(git: Git, branch: string, parentRef: string): boolean {
  const me = tryGit(git, ["config", "--get", "user.email"])?.toLowerCase();
  const myName = tryGit(git, ["config", "--get", "user.name"])?.toLowerCase();
  if (!me && !myName) return false;
  const authors = tryGit(git, [
    "log",
    "--format=%ae%x09%an",
    `${parentRef}..refs/heads/${branch}`,
  ]);
  if (authors === null) return false;
  const rows = authors.split("\n").filter(Boolean);
  return (
    rows.length > 0 &&
    rows.every((r) => {
      const [email = "", name = ""] = r.toLowerCase().split("\t");
      return email === me || (!!myName && name === myName);
    })
  );
}

/**
 * What a diff adds, by meaning rather than by path: tables and columns of a
 * migration or DDL, a dependency in a manifest, a route. Read from the `+`
 * lines only; a removed one is no new claim on a name.
 */
export function semanticKeys(diff: string): string[] {
  const out = new Set<string>();
  for (const raw of diff.split("\n")) {
    if (!raw.startsWith("+") || raw.startsWith("+++")) continue;
    const l = raw.slice(1);
    for (const m of l.matchAll(/Schema::create\(\s*['"]([\w.]+)['"]/g)) out.add(`table ${m[1]}`);
    for (const m of l.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?[`"]?([\w.]+)/gi)) out.add(`table ${m[1]}`);
    for (const m of l.matchAll(/\$table->(?!index|unique|primary|foreign|timestamps|softDeletes|dropColumn|drop)\w+\(\s*['"](\w+)['"]/g)) out.add(`column ${m[1]}`);
    for (const m of l.matchAll(/ALTER TABLE [`"]?([\w.]+)[`"]? ADD (?:COLUMN )?[`"]?(\w+)/gi)) out.add(`column ${m[1]}.${m[2]}`);
    const dep = /^\s*"(@?[\w.-]+(?:\/[\w.-]+)?)"\s*:\s*"[~^<>=*\d]/.exec(l);
    if (dep && !/^(name|version|description|main|type|license|php)$/.test(dep[1] as string)) out.add(`package ${dep[1]}`);
    for (const m of l.matchAll(/(?:Route::|\b(?:app|router)\.)(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/gi)) out.add(`route ${(m[1] as string).toUpperCase()} ${m[2]}`);
  }
  return [...out].sort();
}

function addedSince(git: Git, base: string, tip: string): Set<string> {
  return new Set(semanticKeys(tryGit(git, ["-c", "core.quotePath=false", "diff", "--unified=0", `${base}...${tip}`]) ?? ""));
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
  const theirs = base && behind > 0 ? addedSince(git, base, parentRef) : new Set<string>();
  const semantic = theirs.size ? [...addedSince(git, base as string, `refs/heads/${link.branch}`)].filter((k) => theirs.has(k)).sort() : [];
  return {
    branch: link.branch,
    parent: link.parent,
    source: link.source,
    parentRef,
    behind,
    ahead,
    owned: ownedBy(git, link.branch, parentRef),
    overlap,
    semantic,
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
    const sem = l.semantic ?? [];
    const warn =
      (sem.length ? ` — both added: ${sem.slice(0, 8).join(", ")}${sem.length > 8 ? ", …" : ""}` : "") +
      (l.overlap.length ? ` — both changed: ${l.overlap.slice(0, 8).join(", ")}${l.overlap.length > 8 ? ", …" : ""}` : "");
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
