// Coverage for the destructive operations added 2026-09-03.
//
// PROVENANCE OF THIS FIXTURE SET. It is not a brainstorm. Twenty-five borderline
// operations — the class where "is this destructive?" is genuinely arguable, of
// which `gh pr merge` was the worked example — were probed against `commandOp`
// on 2026-09-02. Seventeen classified as NOTHING. Three of those seventeen are
// worse than anything the guard already caught:
//
//   gh api -X DELETE …/branches/main/protection   removes the guard itself
//   gh pr review --approve                        releases an armed auto-merge
//   npm unpublish                                 breaks every resolved lockfile
//
// BOTH POLARITIES ARE PINNED HERE, and the second half is the one that matters
// for review: a coverage table is easy to satisfy by matching too much, and a
// guard that refuses `git status` would be routed around within a day. Every
// read-only command below MUST stay unclassified.
//
// ── WHAT IS DERIVED, AND WHAT IS FROZEN (road-to-defect-population-sweeps 2.1)
//
// This file has TWO subjects and they have different truth conditions, which is
// why it used to read as one snapshot:
//
//   The OPERATION set IS derivable. `BLOCK_OPS ∪ WARN_OPS` is the truth source,
//   it is imported below, and `describe("the operation set is derived …")` at
//   the foot of this file fails when an op joins either tier with no command
//   probe anywhere in the corpus. Adding an op and forgetting to probe it is
//   now a red test, not a silent gap.
//
//   The COMMAND corpus is NOT derivable and is a DATED FREEZE: 25 borderline
//   commands probed on 2026-09-02, plus the rows added since. `commandOp` is a
//   parser, so its input language is infinite and no enumeration of it exists
//   to derive from. This half goes stale the way any dated sample does, and
//   saying so is the honest form — an implied completeness was the defect.
//
// The corpus for the derived half is every test file that exercises
// `commandOp`, not this file alone: nine of the twenty-six ops predate
// 2026-09-03 and are probed in `git_authorization.test.ts` and
// `git_auth_merge_ops.test.ts`. Asserting them here too would duplicate rather
// than cover.
import { describe, expect, it } from "vitest";

import { classifyAuthorization, type GitOp } from "../../src/scripts/git_authorization_hook.js";
import {
  BLOCK_OPS,
  WARN_OPS,
  commandOp,
} from "../../src/scripts/hooks/git_command_classifier.js";
import * as fs from "node:fs";
import * as path from "node:path";

function tierOf(command: string): "BLOCK" | "warn" | "uncaught" {
  const op = commandOp(command);
  if (op === null) return "uncaught";
  if (BLOCK_OPS.has(op)) return "BLOCK";
  if (WARN_OPS.has(op)) return "warn";
  throw new Error(`op ${op} is in neither tier`);
}

/** command → the op it must classify as, and the tier that op must sit in. */
const CAUGHT: ReadonlyArray<[string, GitOp, "BLOCK" | "warn"]> = [
  ["npm unpublish @scope/pkg@1.2.3", "unpublish", "BLOCK"],
  ['npm deprecate @scope/pkg@1.2.3 "use v2"', "deprecate", "BLOCK"],
  ["gh release upload v1.2.3 dist.tgz --clobber", "release-asset", "BLOCK"],
  ["gh release delete v1.2.3", "release-asset", "BLOCK"],
  ["gh api -X DELETE /repos/o/r/branches/main/protection", "protection", "BLOCK"],
  ["gh workflow disable ci.yml", "workflow-toggle", "BLOCK"],
  ["gh repo archive o/r", "repo-lifecycle", "BLOCK"],
  ["gh repo edit o/r --visibility public", "repo-lifecycle", "BLOCK"],
  ["gh pr review 1499 --approve", "review-approve", "BLOCK"],
  ["git push --force origin main", "force-push", "BLOCK"],
  ["git push --force-with-lease origin feature/x", "force-push", "BLOCK"],
  ["git worktree remove --force ../wt", "worktree-remove", "BLOCK"],
  ["git clean -fdx", "clean-ignored", "BLOCK"],
  ["git tag -f v1.2.3", "tag-force", "warn"],
  ["git rebase -i origin/main", "rebase", "warn"],
  ["git reset --hard HEAD~3", "reset-hard", "warn"],
  ["git clean -fd", "clean", "warn"],
  ["git stash drop", "stash-drop", "warn"],
  ["git stash clear", "stash-drop", "warn"],
  ["git branch -D feature/x", "branch-delete", "warn"],
  ["git push origin --delete feature/x", "branch-delete", "warn"],
  ["gh pr close 1499", "close", "warn"],
  ["gh issue close 42", "close", "warn"],
];

/** Read-only or unrelated. Classifying any of these is the over-match failure. */
const MUST_STAY_SILENT: readonly string[] = [
  "git status",
  "git log --oneline -20",
  "git diff --stat",
  "git show HEAD",
  "gh pr view 1499",
  "gh pr list --state open",
  "gh run view 123 --log-failed",
  "gh api /repos/o/r/branches/main/protection",
  "gh release view v1.2.3",
  "gh workflow view ci.yml",
  "git worktree list",
  "git stash list",
  "git branch --list",
  "git tag --list",
  "npm view @scope/pkg versions",
  "npm run build",
  'echo "git clean -fdx" >> notes.md',
];

describe("destructive coverage — the 17 that classified as nothing", () => {
  it.each(CAUGHT)("%s → %s (%s)", (command, op, tier) => {
    expect(commandOp(command)).toBe(op);
    expect(tierOf(command)).toBe(tier);
  });

  it("closes the whole measured gap in one table", () => {
    expect(CAUGHT.filter(([, , t]) => t === "BLOCK")).toHaveLength(13);
    expect(CAUGHT.filter(([, , t]) => t === "warn")).toHaveLength(10);
  });
});

describe("the other polarity — a guard that refuses reads gets routed around", () => {
  it.each(MUST_STAY_SILENT)("%s stays unclassified", (command) => {
    expect(commandOp(command)).toBeNull();
  });
});

describe("every blockable op has a sentence that authorizes it", () => {
  // The non-negotiable invariant. A BLOCK op with no authorizing phrase is a
  // dead end: the guard refuses, the user says "yes, do it", the classifier
  // records nothing, and the refusal repeats forever. The user's override would
  // be a claim rather than a mechanism.
  const AUTHORIZING_SENTENCE: Readonly<Record<string, string>> = {
    publish: "mach den npm publish",
    tag: "tagge die version und push die tags",
    release: "release das jetzt",
    "pr-merge": "merge den PR",
    "pr-merge-auto": "stell den PR auf auto-merge",
    unpublish: "unpublish das paket wieder",
    deprecate: "deprecate die alte version",
    "release-asset": "ersetz das asset im release",
    protection: "nimm die branch-protection weg",
    "workflow-toggle": "deaktivier den workflow",
    "repo-lifecycle": "archivier das repo",
    "review-approve": "approve den PR",
    "force-push": "mach einen force-push",
    "worktree-remove": "entfern die worktree",
    "clean-ignored": "git clean -fdx bitte",
  };

  it.each([...BLOCK_OPS])("%s is reachable by a human sentence", (op) => {
    const sentence = AUTHORIZING_SENTENCE[op];
    expect(sentence, `no authorizing sentence recorded for ${op}`).toBeDefined();
    expect(classifyAuthorization(sentence as string).authorized).toContain(op);
  });

  it("covers every BLOCK op — the table cannot fall behind the tier", () => {
    for (const op of BLOCK_OPS) {
      expect(Object.keys(AUTHORIZING_SENTENCE)).toContain(op);
    }
  });
});

describe("a negated instruction authorizes nothing — measured 15/15 leaking before the fix", () => {
  // Every row here returned the operation its sentence forbade when probed on
  // 2026-09-03. They are kept as a table rather than prose because the fix is
  // one shared check (`negatedBefore`), so a regression would reopen all of them
  // at once and a single-case test would under-report it.
  const NEGATED: ReadonlyArray<[GitOp, string]> = [
    ["pr-merge-auto", "never auto-merge this"],
    ["unpublish", "nicht unpublishen bitte"],
    ["deprecate", "nicht deprecaten"],
    ["release-asset", "das asset nicht ersetzen"],
    ["protection", "die branch-protection nicht anfassen"],
    ["workflow-toggle", "den workflow nicht deaktivieren"],
    ["repo-lifecycle", "das repo nicht archivieren"],
    ["review-approve", "den pr nicht approven"],
    ["force-push", "kein force-push bitte"],
    ["worktree-remove", "die worktree nicht entfernen"],
    ["clean-ignored", "ignorierte dateien nicht loeschen"],
    ["rebase", "nicht rebasen"],
    ["reset-hard", "kein hard reset"],
    ["branch-delete", "den branch nicht loeschen"],
    ["close", "den pr nicht schliessen"],
  ];

  it.each(NEGATED)("%s stays unauthorized in: %s", (op, sentence) => {
    expect(classifyAuthorization(sentence).authorized).not.toContain(op);
  });

  it("the pre-existing leaks fell out with them", () => {
    // Not newly added ops. `push` and `branch` had been authorizing under a
    // negation since before this change, and only `pr-merge` was protected.
    expect(classifyAuthorization("kein force-push bitte").authorized).not.toContain("push");
    expect(classifyAuthorization("den branch nicht loeschen").authorized).not.toContain("branch");
  });

  it("a negation does not reach across a sentence boundary", () => {
    // The over-suppression that would be worse than the defect: nothing
    // happens, and nothing says why.
    const { authorized } = classifyAuthorization("Nicht pushen. Merge PR #12.");
    expect(authorized).toContain("pr-merge");
    expect(authorized).not.toContain("push");
  });
});

describe("a destructive verb inside an argument is not that operation", () => {
  it("a commit message mentioning a force-push is a commit, nothing more", () => {
    const command = 'git commit -m "revert the force-push we did yesterday"';
    expect(commandOp(command)).toBe("commit");
    expect(tierOf(command)).toBe("warn");
  });

  it("a clean command quoted into a file is not a clean", () => {
    expect(commandOp('echo "git clean -fdx" >> notes.md')).toBeNull();
  });
});

describe("authorizing one destructive op does not authorize its neighbours", () => {
  it("a force-push instruction does not unlock a publish or a merge", () => {
    const { authorized } = classifyAuthorization("mach einen force-push auf den branch");
    expect(authorized).toContain("force-push");
    expect(authorized).not.toContain("publish");
    expect(authorized).not.toContain("pr-merge");
  });

  it("an unpublish instruction does not unlock a publish", () => {
    // `\bpublish\b` finds no word boundary inside "unpublish"; this pins that
    // the two never collide, in either direction.
    const { authorized } = classifyAuthorization("unpublish die 1.2.3 wieder");
    expect(authorized).toContain("unpublish");
    expect(authorized).not.toContain("publish");
  });

  it("a question about a destructive op authorizes nothing", () => {
    expect(classifyAuthorization("sollen wir die branch-protection wegnehmen?").authorized).toEqual(
      [],
    );
  });
});


describe("the operation set is derived from BLOCK_OPS ∪ WARN_OPS, not frozen", () => {
  // The op a probe asserts is the SECOND element of a CAUGHT row here, and a
  // quoted op literal in the sibling files. Reading the corpus as text rather
  // than importing it keeps this assertion from depending on how any one
  // sibling happens to shape its own fixtures.
  const CORPUS = [
    "tests/scripts/git_auth_destructive_coverage.test.ts",
    "tests/scripts/git_authorization.test.ts",
    "tests/scripts/git_auth_merge_ops.test.ts",
  ];
  const REPO_ROOT = path.resolve(__dirname, "..", "..");
  const corpusText = CORPUS.map((f) => fs.readFileSync(path.join(REPO_ROOT, f), "utf8")).join("\n");

  it("every op in either tier has a command probe somewhere in the corpus", () => {
    const unprobed = [...BLOCK_OPS, ...WARN_OPS].filter(
      (op) => !corpusText.includes(`"${op}"`) && !corpusText.includes(`'${op}'`),
    );
    expect(
      unprobed,
      "an op joined a tier with no command probe — add a row to CAUGHT, or a probe in a sibling",
    ).toEqual([]);
  });

  it("the corpus files it reads all exist — a renamed sibling must not silently empty the check", () => {
    for (const f of CORPUS) {
      expect(fs.existsSync(path.join(REPO_ROOT, f)), `${f} is missing from the corpus`).toBe(true);
    }
  });

  it("is sensitive — an op with no probe anywhere is reported", () => {
    // Assembled at runtime rather than written as a literal: this file is IN
    // its own corpus, so a spelled-out sentinel would find itself and the
    // sensitivity check would pass for the wrong reason.
    const sentinel = ["op", "that", "nobody", "probes"].join("-");
    const unprobed = [sentinel].filter(
      (op) => !corpusText.includes(`"${op}"`) && !corpusText.includes(`'${op}'`),
    );
    expect(unprobed, "the derived check must report an op no corpus file probes").toEqual([
      sentinel,
    ]);
  });

  it("every CAUGHT row names an op that is actually in a tier", () => {
    // The other direction: a row asserting an op that no longer exists would
    // pass `tierOf` by throwing, and a stale row is how a table drifts.
    for (const [, op] of CAUGHT) {
      expect(
        BLOCK_OPS.has(op) || WARN_OPS.has(op),
        `CAUGHT probes \`${op}\`, which is in neither tier`,
      ).toBe(true);
    }
  });
});
