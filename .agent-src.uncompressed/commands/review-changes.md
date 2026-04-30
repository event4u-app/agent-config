---
name: review-changes
skills: [code-review, subagent-orchestration, judge-bug-hunter, judge-security-auditor, judge-test-coverage, judge-code-quality]
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

### 1. Gather the diff

- `git diff origin/main..HEAD --stat` — overview of changed files
- `git diff origin/main..HEAD` — full committed-but-not-pushed diff
- `git diff --stat` + `git diff` — unstaged changes on top

If both diffs are empty, **stop** — nothing to review.

### 2. Resolve the judge model

Read `.agent-settings.yml`:

- `subagents.judge_model` → empty = one tier above the session model

Unknown alias → stop. Never silently fall back.

### 3. Dispatch to the four judges

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

### 4. Consolidate

Produce one combined report:

- List each judge's verdict side by side
- Merge issues into a single severity-sorted table (🔴 → 🟡 → 🟢),
  tagged with the judge that raised each one
- Highlight any finding that multiple judges flagged — those are the
  highest-confidence items

### 5. Decide next steps

- If **any** judge returned `reject` → stop; the approach must change
  before proceeding
- If **any** judge returned `revise` → fix 🔴 findings automatically,
  ask before fixing 🟡 findings, report 🟢 as suggestions
- If all four returned `apply` → the diff is ready; report and stop

### 6. Quality tools (optional)

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
  out of scope for the judges and belong in the optional step 6
  quality tools hand-off

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

- [`subagent-orchestration`](../skills/subagent-orchestration/SKILL.md) — dispatch and model-pairing rules
- [`/do-and-judge`](do-and-judge.md) — implementer + judge loop for a single change
- [`/judge`](judge.md) — standalone judge, no review-changes dispatch
- [`code-review`](../skills/code-review/SKILL.md) — human-oriented review patterns (tone, feedback handling)
- [`role-contracts`](../guidelines/agent-infra/role-contracts.md#reviewer) — Reviewer mode output contract (Summary / Risks / Findings / Required actions / Verdict)

## References

- **LLM-as-a-Judge** — [arxiv.org/abs/2306.05685](https://arxiv.org/abs/2306.05685)
  MT-Bench and Chatbot Arena — judging LLM outputs with LLM judges.
  This command adapts the pattern by dispatching to four specialized
  judges (bug, security, tests, quality) instead of a single generic
  judge, and consolidating their verdicts.
