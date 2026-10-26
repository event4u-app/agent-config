/**
 * Introduced vs incumbent findings (road-to-tells-a-near-miss-can-refute 3.1).
 *
 * The baseline is the committed blob of the same path, empty for an untracked
 * file. A finding whose rule and normalised snippet occur in the baseline is
 * incumbent; the hook reports those as a count, never as the edit's own tell.
 * Matching is a multiset: two new copies of one incumbent side-stripe leave one
 * introduced. Digits are masked, so a density snippet ("6 em-dashes in ~386
 * words") stays the same finding when the count moves.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";

export interface Attributable {
  rule: string;
  snippet: string;
}

const key = (f: Attributable): string => `${f.rule}\u0000${f.snippet.replace(/\s+/g, " ").replace(/\d+/g, "#").trim()}`;

export function attribute<T extends Attributable>(found: T[], baseline: Attributable[]): { introduced: T[]; incumbent: number } {
  const left = new Map<string, number>();
  for (const b of baseline) left.set(key(b), (left.get(key(b)) ?? 0) + 1);
  const introduced: T[] = [];
  let incumbent = 0;
  for (const f of found) {
    const n = left.get(key(f)) ?? 0;
    if (n > 0) {
      left.set(key(f), n - 1);
      incumbent += 1;
    } else introduced.push(f);
  }
  return { introduced, incumbent };
}

/** `HEAD:<path>` relative to the repository, or "" when untracked or not a repository. */
export function committedBlob(root: string, file: string): string {
  try {
    const abs = path.resolve(root, file);
    const rel = path.relative(root, abs).split(path.sep).join("/");
    return execFileSync("git", ["-C", root, "show", `HEAD:./${rel}`], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
}
