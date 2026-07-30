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

1. **IDENTIFY** — What command proves this claim? (tests, type-checker, linter, build — whichever the project runs)
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

Fresh evidence answers *may I claim done*; this answers *may I end the turn*. **End the turn only when work is complete-and-verified, OR blocked on input only the user can provide.** Last paragraph a plan, an open question the context already answers, or a promise of unexecuted work ("I'll…", "next I will…") → not a stop condition; do that work now with tool calls. Mechanics (N=3 / Hard-Floor bounds): [`end-of-turn checkpoint`](../contexts/execution/autonomy-mechanics.md) — unifies its promissory-closing half with the Gate above, so "done" means *verified and nothing promised-but-unbuilt remains*.

## Red flags — STOP immediately

- Using "should pass", "probably works", "seems fine"
- Expressing satisfaction before running verification
- About to commit/push without running tests + quality
- Trusting a previous run from earlier in the conversation
- Relying on partial verification (ran tests but skipped the type-checker / linter)
- ANY wording implying success without fresh evidence

## Verification commands

Commands → `quality-tools`. Evidence-gate playbook (claim→command mapping, output inspection, end-of-work sequence) → `verify-completion-evidence`.

## Mechanics — when to run what, per-task evidence, confidence, break-glass

Quality-tools-vs-tests timing, per-task minimum-evidence table, confidence gating (High/Medium/Low), break-glass reduction: [`verification-mechanics`](../contexts/execution/verification-mechanics.md) — pull when the Gate fires.
