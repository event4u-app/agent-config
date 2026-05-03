---
type: "always"
description: "Verify before completion — run tests and quality tools before claiming done"
alwaysApply: true
source: package
load_context:
  - .agent-src.uncompressed/contexts/execution/verification-mechanics.md
---

# Verify Before Completion

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command **in this message**, you cannot claim it passes.

## The Gate

Before claiming ANY work is complete:

1. **IDENTIFY** — What command proves this claim? (tests, PHPStan, build, etc.)
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
- Relying on partial verification (ran tests but not PHPStan)
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
