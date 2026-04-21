---
name: do-and-judge
skills: [subagent-orchestration, verify-before-complete]
description: Run a single change through an implementer→judge loop with a two-revision ceiling, then hand back to the user
disable-model-invocation: true
---

# do-and-judge

## Instructions

### 1. Confirm scope

The user invoked `/do-and-judge` with a task description or a pointer
to an existing draft. Echo back the scope in one sentence and wait for
confirmation if the scope is ambiguous. Do not proceed until the
target is clear.

### 2. Resolve model pairing

Read `.agent-settings`:

- `subagent_implementer_model` → empty = session model
- `subagent_judge_model` → empty = one tier above implementer

If the two resolve to the same model in the same context, **stop** and
report per the `subagent-orchestration` Iron Law.

### 3. Run the implementer

Produce the diff in the current session — this is the implementer.
Capture the diff as the artifact the judge will review. Do **not**
apply the diff yet.

### 4. Run the judge

Invoke the judge model on the diff **with the original task** as
context. The judge must return one of:

| Verdict  | Meaning                                        |
|----------|------------------------------------------------|
| `apply`  | Diff is correct and complete, land it          |
| `revise` | Specific issues listed, implementer must fix   |
| `reject` | Fundamentally wrong approach, hand back        |

### 5. Apply or revise

- `apply` → write the diff, run targeted tests, run quality pipeline
- `revise` → hand the issue list back to the implementer, loop to step 4
- `reject` → stop, report to user, do not loop

**Hard ceiling: two revision cycles.** After the second `revise` fails
judgment, stop and hand back — further iteration is the user's call.

### 6. Report

```
Mode:       do-and-judge
Implementer: <resolved model>
Judge:      <resolved model>
Verdict:    applied | handed-back
Revisions:  <N>/2
Evidence:   <test result + judge transcript>
Next step:  <commit / open PR / abandon>
```

## Safety gates

- No apply without the judge's `apply` verdict
- No silent model fallback — unknown alias = stop and ask
- No more than two revisions without user consent
- No skipping of `verify-before-complete` on the final apply

## When to stop and ask

- Judge and implementer resolved to the same model in same context
- Revision loop still failing after ceiling
- Judge transcript contradicts the original task (off-task drift)
- User interrupts mid-loop

## Wrappable commands

Commands that document an optional `/do-and-judge` integration block:

- [`/commit`](commit.md) — judge reviews the commit plan + diff before
  staging. Useful on large, mixed-intent diffs.

Any command without an integration block is still wrappable in
principle, but the judge lacks a structured artifact to grade — expect
weaker verdicts.

## See also

- [`subagent-orchestration`](../skills/subagent-orchestration/SKILL.md)
- [`verify-before-complete`](../skills/verify-before-complete/SKILL.md)
- [`subagent-configuration`](../contexts/subagent-configuration.md)
