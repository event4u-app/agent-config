---
type: "always"
tier: "2a"
description: "Verify before completion — run tests and quality tools before claiming done"
alwaysApply: true
load_context:
  - ../contexts/execution/verification-mechanics.md
workspaces:
  - engineering
packs:
  - engineering-base
---

# Verify Before Completion

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

No verification command run **in this message** → you cannot claim it passes.

## The Gate

Before claiming ANY work is complete:

1. **IDENTIFY** — What command proves this claim? (tests, type-checker, linter, build — whichever the project actually runs)
2. **RUN** — Execute the full command (fresh, complete, not cached)
3. **READ** — Full output, check exit code, count failures
4. **VERIFY** — Does the output actually confirm the claim?
5. **ONLY THEN** — Make the claim

Skip any step = the claim is unverified.

## When this applies

- About to claim **all work is done** (not after individual edits)
- About to say "done" or "complete"
- Before suggesting to commit, push, or create a PR
- Any statement implying all work is finished

## Red flags — STOP immediately

- Using "should pass", "probably works", "seems fine"
- Expressing satisfaction before running verification
- About to commit/push without running tests + quality
- Trusting a previous run from earlier in the conversation
- Relying on partial verification (ran tests but skipped the type-checker / linter)
- ANY wording implying success without fresh evidence

## Verification commands

For specific commands → see the `quality-tools` skill.

For the detailed evidence-gate playbook (claim→command mapping, output
inspection, end-of-work sequence) → see the `verify-completion-evidence`
skill.

## Mechanics — when to run what, per-task evidence, confidence, break-glass

The decision logic for **when** to run quality tools vs. tests, the
per-task-type minimum-evidence table, confidence gating (High /
Medium / Low), and the break-glass reduction during live incidents
all live in
[`verification-mechanics`](../contexts/execution/verification-mechanics.md).
The Iron Law and the Gate above are the obligation surface; the
mechanics context is the lookup material the agent pulls when the
gate fires.

## Examples

Pattern Memory — wrong / right / why demos for the Iron Law and the
red-flags list:
[`verify-before-complete-demos`](../docs/guidelines/agent-infra/verify-before-complete-demos.md)
(hedged claims, trusting earlier runs, partial-verification creep).
Outcome baseline locked at
[`tests/golden/outcomes/verify_before_complete.json`](../../tests/golden/outcomes/verify_before_complete.json).
