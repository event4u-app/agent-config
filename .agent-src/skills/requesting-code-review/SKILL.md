---
name: requesting-code-review
description: "Use when asking for a review or creating a PR — self-review first, frame the right context, test plan included — even when the user just says 'open a PR' or 'ready to merge'."
personas:
  - critical-challenger
source: package
---

# requesting-code-review

## When to use

* About to run `/create-pr` or `/prepare-for-review`
* A feature or bug fix is code-complete and the next step is "get
  eyes on it"
* A stacked PR is ready and you need the parent branch reviewer to
  context-switch smoothly
* Asking a human for a quick sanity check on a specific commit or
  diff

Do NOT use when:

* You are *processing* review feedback — use [`receiving-code-review`](../receiving-code-review/SKILL.md)
* The branch is not yet code-complete — the review-request gate
  requires green tests and a clean diff
* The change is documentation-only and has no behavior impact

## Goal

Give the reviewer exactly the context they need — what changed, why,
how to verify — without forcing them to reconstruct your thought
process. A well-framed review request **halves** review time and
**reduces** back-and-forth on missing context.

## The Iron Law

```
NEVER REQUEST REVIEW FROM A BRANCH YOU HAVE NOT REVIEWED YOURSELF.
```

Self-review is the single cheapest filter. It catches the issues a
human reviewer would flag in round one, so the human reviewer can
spend time on the issues only they can see.

## Procedure

### 1. Self-review first

Before asking anyone else:

* Read the full diff (`git diff <base>...<head>`), not just the files
  you remember touching
* Check for accidental debug output, dead code, leftover `dd()`,
  `console.log`, commented-out blocks
* Check for secrets in diff — API keys, connection strings, tokens
* Check file-system side effects — generated files, lockfile churn,
  IDE configs, `.env` changes
* Run the linter + tests (see [`verify-before-complete`](../verify-before-complete/SKILL.md))
* If you find issues → fix them, do **not** ship them and hope the
  reviewer flags them

Use the [`review-changes`](../../commands/review-changes.md) command
as the structured walk-through.

### 2. Establish the diff baseline

Determine the correct base commit:

```bash
# Simple branch from main
BASE=$(git merge-base HEAD main)

# Stacked PR — parent branch is base, not main
BASE=$(git merge-base HEAD <parent-branch>)

HEAD=$(git rev-parse HEAD)
```

The base matters for the reviewer's diff view — wrong base = they
review 80 unrelated commits.

### 3. Write the review request context

Any review request must answer four questions. If any is missing, the
reviewer will ask — and that round trip is preventable.

| Question | Where it lives |
|---|---|
| **What changed?** | PR title (imperative, Conventional Commits) + summary bullets |
| **Why?** | Link to ticket / issue / Sentry event / user message |
| **How do I verify it?** | Test plan: commands to run, URLs to hit, expected behavior |
| **What should I look at first?** | Highlights: "pay attention to X because Y" or "skip Z, it is generated" |

See [`create-pr-description`](../../commands/create-pr-description.md)
for the full structured template, and
[`conventional-commits-writing`](../conventional-commits-writing/SKILL.md)
for the title format.

### 4. Keep the PR reviewable in size

* Target < 400 lines of real diff (excluding generated / lockfiles)
* If bigger — consider splitting into a stack (refactor PR → feature
  PR) so reviewers can handle each in one sitting
* Flag generated files explicitly in the description so reviewers
  skip them
* Never mix a refactor + behavior change in the same PR — reviewers
  cannot isolate the risk

### 5. Pick the right reviewer set

* **Architectural impact** → the code owner for the affected area
* **Security-sensitive** → a security-reviewer role if the project has
  one
* **Bots** → let Copilot / Greptile / Augment run automatically; do not
  gate human review on bot completion
* **Cross-team change** → each affected team's owner

If the project has a `CODEOWNERS` file, GitHub handles this
automatically — do not override without a reason.

### 6. Send and wait — do not nudge early

After the PR is open:

* Respond to questions, not to the implicit "where is my review?"
  schedule
* If the review is blocking and overdue → a single short nudge is
  appropriate; do not re-open or force-push to bump the PR list

When review comments arrive → switch to
[`receiving-code-review`](../receiving-code-review/SKILL.md).

## Output format

When handing the review request to the reviewer (PR body, Slack, email):

1. **Title** — Conventional Commit imperative
2. **Summary** — 2–5 bullets of what changed
3. **Motivation** — why, with ticket / Sentry / user-message link
4. **Test plan** — exact commands or URLs + expected result
5. **Risk / scope notes** — what the reviewer should pay attention to
6. **Non-goals** — what this PR deliberately does **not** do
7. **Screenshots / logs** — when UI or runtime behavior changed

## Gotchas

* "Ready for review" on a red CI run signals carelessness — wait for
  green or explain the specific failure
* A 1000-line PR with "no behavior change" still needs review — the
  reviewer has no way to confirm "no behavior change" without reading
  every line
* Auto-merge on approval bypasses re-review after later force-pushes
  — use deliberately, not by habit
* A PR description that says "see the code" is not a description —
  reviewers need the why
* Requesting review from someone without context (new hire, other
  team) without a longer pairing — they cannot do a deep review cold
* Rebasing during review invalidates line-comments; let reviewers
  finish a round before rebasing when possible

## Do NOT

* Do NOT request review before self-review
* Do NOT request review on a branch with failing CI (except when
  explicitly documenting "CI broken, please eyeball X only")
* Do NOT mix unrelated changes in one PR
* Do NOT force-push during active review without a good reason and a
  note to the reviewer
* Do NOT leave the PR description empty
* Do NOT request review from reviewers who lack context just to get
  approvals

## Anti-patterns

* "Small cleanup" titles on 800-line diffs
* Test plan that says "should work"
* Hiding a risky change inside a 40-file refactor PR
* Pinging reviewers before CI goes green
* Requesting review as a substitute for thinking the problem through

## When to hand over to another skill / command

* Self-review walkthrough → [`review-changes`](../../commands/review-changes.md)
* Bringing a stacked branch up to date first →
  [`prepare-for-review`](../../commands/prepare-for-review.md)
* Writing the PR description → [`create-pr-description`](../../commands/create-pr-description.md)
* Actually opening the PR → [`create-pr`](../../commands/create-pr.md)
* Writing the commits themselves → [`commit`](../../commands/commit.md),
  [`conventional-commits-writing`](../conventional-commits-writing/SKILL.md)
* Verifying readiness → [`verify-before-complete`](../verify-before-complete/SKILL.md)
* Processing the feedback when it arrives → [`receiving-code-review`](../receiving-code-review/SKILL.md)

## Validation checklist

Before asking for review:

* [ ] Self-review walkthrough done on the full diff
* [ ] Linter + targeted tests + full test suite green
* [ ] PR title follows Conventional Commits
* [ ] PR description has summary, motivation, test plan, risk notes
* [ ] Diff is reviewable in size (split if > 400 lines of real code)
* [ ] CODEOWNERS / reviewer set is correct
* [ ] No debug code, secrets, or stray files in the diff
* [ ] No unrelated changes bundled in
