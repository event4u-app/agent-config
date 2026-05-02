---
name: review-changes
skills: [code-review, subagent-orchestration, judge-bug-hunter, judge-security-auditor, judge-test-coverage, judge-code-quality, git-workflow]
description: Self-review local changes before creating a PR — dispatches to four specialized judges (bug, security, tests, quality) and consolidates verdicts
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "self-review my changes, judge this diff before PR"
  trigger_context: "uncommitted or staged changes pre-PR"
---

# review-changes

## Instructions

Review all uncommitted and committed-but-not-pushed changes against
the default branch (`main`) by dispatching to four specialized judge
sub-skills and consolidating their verdicts.

### 1. Update the current branch

Before gathering the diff, run [`/prepare-for-review`](prepare-for-review.md)
to make sure the current branch is up to date with its base chain:

- Detect the current branch with `git rev-parse --abbrev-ref HEAD`.
- If the branch is `main` → skip this step (nothing to prepare).
- Otherwise, search for an open GitHub PR whose head is the current
  branch.
  - If exactly one open PR is found → invoke `/prepare-for-review`
    with that PR number. It will update `main`, fetch and merge the
    full branch chain into the current branch, and leave the current
    branch checked out.
  - If no open PR is found → fall back to a minimal local update:
    `git fetch origin main` and `git merge origin/main --no-edit` on
    the current branch. Abort on conflict and report.
  - If multiple PRs are found → ask the user which PR to use before
    proceeding.
- If `/prepare-for-review` aborts (merge conflict, network error,
  etc.) → stop the review here and surface the error. Do **not**
  continue with stale data.

### 2. Gather the diff

- `git diff origin/main..HEAD --stat` — overview of changed files
- `git diff origin/main..HEAD` — full committed-but-not-pushed diff
- `git diff --stat` + `git diff` — unstaged changes on top

If both diffs are empty, **stop** — nothing to review.

### 3. Resolve the judge model

Read `.agent-settings.yml`:

- `subagents.judge_model` → empty = one tier above the session model

Unknown alias → stop. Never silently fall back.

### 4. Dispatch to the four judges

Each judge receives **the same diff plus the task context** (ticket,
PR body, commit messages) and runs independently. The judges are:

| Sub-skill | Focus |
|---|---|
| [`judge-bug-hunter`](../skills/judge-bug-hunter/SKILL.md) | Correctness, null-safety, edge cases, races, error handling |
| [`judge-security-auditor`](../skills/judge-security-auditor/SKILL.md) | AuthZ/AuthN, injection, secrets, unsafe deserialization, SSRF, XSS |
| [`judge-test-coverage`](../skills/judge-test-coverage/SKILL.md) | Missing assertions, uncovered branches, over-mocking, regression-test gaps |
| [`judge-code-quality`](../skills/judge-code-quality/SKILL.md) | Naming, SRP, DRY, dead code, consistency with codebase conventions |

Pick dispatch mode based on diff size and environment:

- **Sequential** (default, simplest) — run bug-hunter → security-auditor
  → test-coverage → code-quality, collect each verdict
- **Parallel** — if `subagents.max_parallel` in `.agent-settings.yml` is
  ≥ 4 and subagent dispatch is available, run all four concurrently
  following the `do-in-parallel` pattern in
  [`subagent-orchestration`](../skills/subagent-orchestration/SKILL.md);
  the four judges operate on the same diff but produce independent
  reports, so no shared-state risk

Each judge returns its own `Judge / Model / Target / Verdict /
Issues` block in the format defined by that skill.

### 4b. Optional external council (B3 hook)

If `.agent-settings.yml` has `ai_council.enabled: true` **and** at least
one member is enabled, ask (in the user's language):

> 1. Add an external council review alongside the four internal judges? (billable)
> 2. Skip — internal judges only

Suppress when `personal.autonomy: on` (council is billable).

If picked **1**:

- Run `/council diff:<base>..<head>` in parallel with the four
  internal judges (or sequentially after them — whichever the
  dispatch mode picked in step 4 supports).
- Treat each council member as one extra "judge" in the consolidated
  report (step 5), but **mark them clearly as external** so the user
  can weight them differently. Council verdicts are **advisory** —
  they never block on their own; they augment the internal verdicts.
- The council's neutrality preamble already strips host-agent
  identity; do **not** add the internal judges' verdicts to the
  council prompt (would defeat the Iron Law of Neutrality).

If picked **2** → continue with internal judges only.

### 5. Consolidate

Produce one combined report:

- List each judge's verdict side by side
- Merge issues into a single severity-sorted table (🔴 → 🟡 → 🟢),
  tagged with the judge that raised each one
- Highlight any finding that multiple judges flagged — those are the
  highest-confidence items

### 6. Decide next steps

- If **any** judge returned `reject` → stop; the approach must change
  before proceeding
- If **any** judge returned `revise` → fix 🔴 findings automatically,
  ask before fixing 🟡 findings, report 🟢 as suggestions
- If all four returned `apply` → the diff is ready; report and stop

### 7. Quality tools (optional)

After the consolidated report, ask:

```
> 1. Yes — run quality tools (formatter, static analyzer, linters)
> 2. No — review done
```

If yes, hand off to the project's quality workflow (e.g. `/quality-fix`
or the equivalent configured command).

## Backward compatibility

- Invocation is unchanged: `/review-changes` with no arguments still
  reviews the full uncommitted-plus-committed-not-pushed diff
- A user who invokes `/review-changes` on a diff that has no test
  files still gets coverage feedback — `judge-test-coverage` treats
  "production changed, no test changed" as its primary finding
- Project-specific syntax checks (e.g. `php -l`, linter pre-pass) are
  out of scope for the judges and belong in the optional step 7
  quality tools hand-off
- The new step 1 (`/prepare-for-review`) is **best-effort**: if no
  open PR exists for the current branch, it falls back to a plain
  `git fetch && git merge origin/main`. Existing invocations that
  ran on a fully detached or pre-PR branch keep working

## Use this command when

- Preparing a self-review before opening a PR
- Stress-testing a local branch with the same four lenses a reviewer
  would apply
- Sanity-checking a diff before handing it to `/create-pr`

## Do NOT

- NEVER apply fixes without showing the consolidated report first
- NEVER skip a judge because the diff "looks fine" — each judge must
  produce its own verdict
- NEVER merge two judges' outputs into a single block — the user
  needs to see which lens raised each finding
- NEVER commit or push from this command — review only
- NEVER run on an empty diff; fail fast

## See also

- [`/prepare-for-review`](prepare-for-review.md) — updates `main` and merges the full base-branch chain into the target branch (used by step 1)
- [`subagent-orchestration`](../skills/subagent-orchestration/SKILL.md) — dispatch and model-pairing rules
- [`/do-and-judge`](do-and-judge.md) — implementer + judge loop for a single change
- [`/judge`](judge.md) — standalone judge, no review-changes dispatch
- [`code-review`](../skills/code-review/SKILL.md) — human-oriented review patterns (tone, feedback handling)
- [`role-contracts`](../../docs/guidelines/agent-infra/role-contracts.md#reviewer) — Reviewer mode output contract (Summary / Risks / Findings / Required actions / Verdict)

## References

- **LLM-as-a-Judge** — [arxiv.org/abs/2306.05685](https://arxiv.org/abs/2306.05685)
  MT-Bench and Chatbot Arena — judging LLM outputs with LLM judges.
  This command adapts the pattern by dispatching to four specialized
  judges (bug, security, tests, quality) instead of a single generic
  judge, and consolidating their verdicts.
