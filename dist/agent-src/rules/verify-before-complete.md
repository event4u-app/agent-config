---
type: "always"
tier: "2a"
description: "Verify before completion — run tests and quality tools before claiming done"
alwaysApply: true
load_context:
  - ../contexts/execution/verification-mechanics.md
workspaces: [engineering]
packs: [engineering-base]
enforced_by:
  - "hook:verify-before-complete"
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

## Turn-completion — one explicit stop condition

Fresh evidence answers *may I claim done*; this answers *may I end the turn*. Pair
them: **end the turn only when the work is complete-and-verified, OR you are blocked
on input only the user can provide.** If the last paragraph is a plan, an open
question the context already answers, or a promise of unexecuted work ("I'll…",
"next I will…"), that is not a stop condition — do that work now with tool calls
instead of ending. The mechanics (N=3 / Hard-Floor bounds) live in the
[`end-of-turn checkpoint`](../contexts/execution/autonomy-mechanics.md); this line
unifies its promissory-closing half with the verification Gate above so "done"
means *verified and nothing promised-but-unbuilt remains*.

## Red flags — STOP immediately

- Using "should pass", "probably works", "seems fine"
- Expressing satisfaction before running verification
- About to commit/push without running tests + quality
- Trusting a previous run from earlier in the conversation
- Relying on partial verification (ran tests but skipped the type-checker / linter)
- ANY wording implying success without fresh evidence

## Verification commands

Specific commands → `quality-tools` skill. Evidence-gate playbook
(claim→command mapping, output inspection, end-of-work sequence) →
`verify-completion-evidence` skill.

## Mechanics — when to run what, per-task evidence, confidence, break-glass

When to run quality tools vs. tests, the per-task minimum-evidence table,
confidence gating (High/Medium/Low), and the break-glass reduction live in
[`verification-mechanics`](../contexts/execution/verification-mechanics.md) —
pull it when the Gate fires.

## Examples

Wrong/right/why demos (hedged claims, trusting earlier runs,
partial-verification creep): [`verify-before-complete-demos`](../docs/guidelines/agent-infra/verify-before-complete-demos.md).
Outcome baseline:
[`tests/golden/outcomes/verify_before_complete.json`](../../tests/golden/outcomes/verify_before_complete.json).
