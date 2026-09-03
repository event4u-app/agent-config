/**
 * Stage-2 impact analysis for a merge the guard is about to refuse.
 *
 * STAGE 1 asks "is this operation in the blocked set?" — a question about the
 * command's shape, answered by `commandOp`. STAGE 2 asks "what would it
 * actually do?" — a question about the diff, answered here.
 *
 * WHAT THIS DOES NOT DO, stated first because the opposite is the tempting
 * reading: it never downgrades a refusal into an allow. Both council seats
 * (2026-09-03, anthropic + codex-default, deep) rejected exactly that, and the
 * argument is not about diff parsing being imperfect — it is that a purely
 * additive diff can still fire a production deploy, close issues, hit outbound
 * webhooks, and land against a base that moved since the review. Diff content
 * is one axis; the destination is the other, and nothing readable from a patch
 * tells you what merging into that branch triggers.
 *
 * So the verdict enriches the REFUSAL. A block that says "this PR adds two
 * files and touches no migration, no exported symbol and no version — say
 * `merge #1499` to authorize" is a question the user can answer in four words,
 * including out loud. A block that says "refused" makes them go read the diff
 * themselves. Same gate, and the difference is entirely in whether the human
 * can act on it.
 *
 * THREE-VALUED ON PURPOSE. `undecidable` is a real answer and the most common
 * one offline: no ref, no network, an unparsable patch. Collapsing it into
 * `additive` would be the failure this module exists to avoid, so every unknown
 * resolves toward "ask".
 */
import { execFileSync } from "node:child_process";

export type ImpactVerdict = "additive" | "destructive" | "undecidable";

export interface MergeImpact {
  verdict: ImpactVerdict;
  /** Human-readable markers behind a `destructive` verdict, in diff order. */
  markers: string[];
  /** Why the analysis could not run, when the verdict is `undecidable`. */
  reason?: string;
  /** Files the diff touches, for the one-line summary in a refusal. */
  filesChanged?: number;
}

/**
 * Destructive markers, each decidable from the patch text alone.
 *
 * DELIBERATELY A PROXY SET, NOT A BREAKING-CHANGE ORACLE. "Does this break a
 * consumer" is undecidable in general; these are the shapes that are cheap to
 * see and expensive to miss. A marker firing means "a human should look", never
 * "this is certainly breaking" — and the absence of every marker means "nothing
 * cheap to see fired", never "this is certainly safe". That asymmetry is why an
 * `additive` verdict still refuses.
 */
const DESTRUCTIVE_MARKERS: ReadonlyArray<{ label: string; re: RegExp }> = [
  // Schema removal. Matched on ADDED lines only — a migration that *removes* a
  // dropColumn call is the opposite of destructive, and matching the raw patch
  // would score it the same way.
  { label: "migration drops a column or table", re: /^\+.*\b(dropColumn|dropTable|dropIfExists|removeColumn|drop_column|drop_table)\b/im },
  { label: "raw DROP or TRUNCATE in a migration", re: /^\+.*\b(DROP\s+(TABLE|COLUMN|INDEX|CONSTRAINT)|TRUNCATE\s+TABLE)\b/im },
  // The author said so themselves. Conventional Commits marks a breaking change
  // with a `!` before the colon or a body trailer.
  { label: "author marked a BREAKING CHANGE", re: /^\+.*BREAKING[ -]CHANGE/m },
  // A removed export is the shape most likely to break an importer.
  { label: "an exported symbol was removed", re: /^-\s*export\s+(default\s+|const\s+|function\s+|class\s+|interface\s+|type\s+|async\s+)/m },
  { label: "a public PHP or Python symbol was removed", re: /^-\s*(public\s+function|def\s+[a-z_]+\s*\()/m },
  // Route removal breaks callers that never imported anything.
  { label: "a route or endpoint was removed", re: /^-.*\b(Route::(get|post|put|patch|delete)|@(Get|Post|Put|Patch|Delete)Mapping|app\.(get|post|put|patch|delete)\s*\()/m },
  { label: "a whole file was deleted", re: /^deleted file mode /m },
];

/** A major-version bump in a manifest, which is the author declaring a break. */
const MAJOR_BUMP =
  /^-\s*"version"\s*:\s*"(\d+)\.[^"]*"[\s\S]{0,200}?^\+\s*"version"\s*:\s*"(\d+)\./m;

/**
 * Classify a unified diff.
 *
 * Pure — the caller supplies the patch, so this is testable without a network,
 * a repository, or a fixture PR.
 */
export function classifyDiff(patch: string): MergeImpact {
  if (patch.trim() === "") {
    return { verdict: "undecidable", markers: [], reason: "empty diff" };
  }

  const markers: string[] = [];
  for (const { label, re } of DESTRUCTIVE_MARKERS) {
    if (re.test(patch)) {
      markers.push(label);
    }
  }

  const bump = MAJOR_BUMP.exec(patch);
  if (bump && bump[1] !== bump[2]) {
    markers.push(`major version bump ${bump[1]}.x to ${bump[2]}.x`);
  }

  const filesChanged = (patch.match(/^diff --git /gm) ?? []).length;

  if (markers.length > 0) {
    return { verdict: "destructive", markers, filesChanged };
  }
  return { verdict: "additive", markers: [], filesChanged };
}

/** How the patch was obtained, so a refusal can say which source answered. */
export type PatchSource = "local" | "gh" | "none";

export interface PatchResult {
  patch: string;
  source: PatchSource;
  reason?: string;
}

/**
 * Fetch the diff for a pull request, local first.
 *
 * The ordering is not a preference, it is a cost decision. A local
 * `git diff` against the merge base costs milliseconds and works offline; a
 * `gh pr diff` costs a network round trip on a `pre_tool_use` hook, which is in
 * the user's critical path. Local answers whenever the ref happens to be
 * fetched, which in a drain run is almost always, because the run just synced
 * the branch it is about to merge.
 *
 * Every failure returns `none` rather than throwing. The caller turns that into
 * `undecidable`, which asks the user — a hook that crashed would be worse than
 * a hook that admitted it did not know.
 */
export function fetchPatch(
  pr: number,
  opts: { cwd?: string; allowNetwork?: boolean; exec?: typeof execFileSync } = {},
): PatchResult {
  const run = opts.exec ?? execFileSync;
  const cwd = opts.cwd ?? process.cwd();
  const capture = (file: string, args: string[]): string =>
    run(file, args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"], timeout: 15_000 }) as unknown as string;

  // A fetched PR ref is what a synced drain run leaves behind.
  for (const ref of [`refs/pull/${pr}/head`, `pull/${pr}/head`]) {
    try {
      const base = capture("git", ["merge-base", "HEAD", ref]).trim();
      if (base) {
        const patch = capture("git", ["diff", `${base}...${ref}`]);
        if (patch.trim() !== "") {
          return { patch, source: "local" };
        }
      }
    } catch {
      /* try the next spelling, then the network */
    }
  }

  if (opts.allowNetwork === false) {
    return { patch: "", source: "none", reason: "no local ref and network reads disabled" };
  }

  try {
    const patch = capture("gh", ["pr", "diff", String(pr), "--patch"]);
    if (patch.trim() !== "") {
      return { patch, source: "gh" };
    }
    return { patch: "", source: "none", reason: "gh returned an empty diff" };
  } catch {
    return { patch: "", source: "none", reason: "no local ref, and gh pr diff failed" };
  }
}

/** Analyse a pull request end to end. `undecidable` whenever the patch is not readable. */
export function analyseMergeImpact(
  pr: number,
  opts: Parameters<typeof fetchPatch>[1] = {},
): MergeImpact {
  const got = fetchPatch(pr, opts);
  if (got.source === "none") {
    return { verdict: "undecidable", markers: [], ...(got.reason ? { reason: got.reason } : {}) };
  }
  return classifyDiff(got.patch);
}

/**
 * One line for a refusal message.
 *
 * Phrased so the user can answer it out loud, which is the point of the whole
 * stage: the shortest reply that unblocks the operation is quoted back to them.
 */
export function describeImpact(pr: number, impact: MergeImpact): string {
  const say = `Say "merge #${pr}" to authorize it.`;
  switch (impact.verdict) {
    case "additive":
      return (
        `Impact scan: PR #${pr} touches ${impact.filesChanged ?? 0} file(s) and trips no ` +
        `destructive marker — no schema drop, no removed export or route, no major bump, ` +
        `no BREAKING CHANGE. Additive as far as the diff can show, which is not the same ` +
        `as safe to merge: the base has moved since review and merging may trigger a ` +
        `deploy. ${say}`
      );
    case "destructive":
      return (
        `Impact scan: PR #${pr} is NOT additive — ${impact.markers.join("; ")}. ` +
        `Read the diff before authorizing. ${say}`
      );
    default:
      return (
        `Impact scan: could not read the diff for PR #${pr} (${impact.reason ?? "unknown"}), ` +
        `so nothing is known about what it changes. ${say}`
      );
  }
}
