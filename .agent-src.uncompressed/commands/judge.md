---
name: judge
description: Judge orchestrator — routes to solo, steps, on-diff
cluster: judge
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "judge this diff, review with verdict, run an implementer→judge loop, step-by-step judged execution"
  trigger_context: "user wants a verdict on a diff, a do-and-judge loop, or a step-gated execution"
---

# /judge

Top-level orchestrator for the `/judge` family. Replaces 3 standalone
commands with a single entry point + sub-command dispatch.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/judge solo` | `commands/judge/solo.md` | Standalone verdict on an existing diff — no implementer, no revision loop |
| `/judge on-diff` | `commands/judge/on-diff.md` | Implementer→judge loop on a single change with a two-revision ceiling |
| `/judge steps` | `commands/judge/steps.md` | Execute an ordered plan step by step, judge gate between steps |

Sub-command names match the locked contract in
[`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md).
The standalone reviewer surface lives at [`/review`](review-changes.md).

## Dispatch

1. Parse the user's argument: `/judge <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the routed file and follow its `## Instructions`
   section verbatim with the remaining args.
4. If the sub-command is unknown or missing, print the table above and
   ask:

   > 1. solo — verdict only, no loop
   > 2. on-diff — implementer→judge revision loop
   > 3. steps — judge gate between ordered steps

## Rules

- **Do NOT commit, push, or open a PR** unless the sub-command
  explicitly authorizes it.
- **Do NOT chain sub-commands.** One `/judge <sub>` per turn.
- If the user invokes `/judge` with no argument, **show the menu** —
  do not guess which sub-command they meant.

## See also

- [`subagent-orchestration`](../skills/subagent-orchestration/SKILL.md)
- [`/review`](review-changes.md) — human-oriented self-review (Reviewer-mode contract)
- [`role-contracts`](../../docs/guidelines/agent-infra/role-contracts.md#reviewer)
