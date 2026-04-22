---
name: judge
skills: [subagent-orchestration]
description: Run a standalone judge on an existing diff or code change — no implementer, no revision loop, verdict only
disable-model-invocation: true
---

# judge

## Instructions

### 1. Identify the target

The user invoked `/judge` on one of:

- The current working-tree diff (`git diff`)
- A specific commit range (`git diff A..B`)
- A PR by number or URL
- A single file or set of files

Confirm the target in one sentence before proceeding. Do not silently
assume the working tree.

### 2. Gather the context

Collect what the judge needs:

- The diff in full
- The original task, ticket, or PR description
- Relevant acceptance criteria (tests, linter config, design doc)

If any of these is missing and the judgment would be shallow without
it, **stop** and ask.

### 3. Resolve the judge model

Read `.agent-settings.yml`:

- `subagents.judge_model` → empty = one tier above session model

Unknown alias → stop. Silence is not a fallback.

### 4. Invoke the judge

The judge reviews the diff against the task. Return one of:

| Verdict  | Meaning                                      |
|----------|----------------------------------------------|
| `apply`  | Correct, complete, ready to land             |
| `revise` | Specific issues listed — user decides next   |
| `reject` | Fundamentally wrong approach                 |

Unlike `/do-and-judge`, this command does **not** loop — no revision
cycles. The verdict is the deliverable.

### 5. Report

```
Mode:    judge (standalone)
Target:  <diff | commit range | PR #N | files>
Judge:   <resolved model>
Verdict: apply | revise | reject
Issues:  <numbered list if revise/reject>
Next step: <what the user should do based on the verdict>
```

## Use this command when

- A diff already exists and the user wants a second opinion
- Reviewing someone else's PR before approving it
- Double-checking a change before opening a PR
- Stress-testing a refactor without committing to revisions

## Do NOT

- NEVER apply the diff — this command judges only
- NEVER loop into a revision cycle — use `/do-and-judge` for that
- NEVER run the judge on an empty diff — fail fast
- NEVER silently fall back to the session model for the judge

## See also

- [`subagent-orchestration`](../skills/subagent-orchestration/SKILL.md)
- [`/do-and-judge`](do-and-judge.md) — if a revision loop is wanted
- [`/review-changes`](review-changes.md) — human-oriented self-review
- [`role-contracts`](../guidelines/agent-infra/role-contracts.md#reviewer) — Reviewer mode output contract (Summary / Risks / Findings / Required actions / Verdict)
