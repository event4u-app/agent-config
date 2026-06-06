---
model_tier: medium
name: judge
pack: engineering-base
intent: "Adversarial-judging dispatcher — solo, on-diff, steps"
routes_to: [judge:solo, judge:on-diff, judge:steps]
replaces: []
tier: 1
description: Judge orchestrator — routes to solo, steps, on-diff
cluster: judge
type: orchestrator
auto_detect: true
suggestion:
  eligible: true
  trigger_description: "judge this diff, review with verdict, run an implementer→judge loop, step-by-step judged execution"
  trigger_context: "user wants a verdict on a diff, a do-and-judge loop, or a step-gated execution"
workspaces:
  - agent-config-maintainer
packs:
  - meta
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
[`docs/contracts/command-clusters.md`](../docs/contracts/command-clusters.md).
The standalone reviewer surface lives at [`/review`](review-changes.md).

## Non-interactive & auto-detection

`/judge` honors the [`non-interactive-contract`](../contexts/execution/non-interactive-contract.md)
(surface detection, confidence tiers, `--yes`/`--json`, abort schemas,
the `auto_detect` kill-switch, rollback). Detection table:

| Basis (signal) | Sub-command | Confidence |
|---|---|---|
| Explicit sub given (`/judge solo`) | that one | — (detection skipped) |
| User gives an ordered plan / step list to gate | `judge/steps` | HIGH |
| Intent is "fix and re-judge" / iterate **and** a diff exists | `judge/on-diff` | MEDIUM (mutating — confirm interactive, `--yes` in CI) |
| A diff / range / PR is named, verdict only | `judge/solo` | HIGH |
| Only an unscoped change present, no iterate intent | `judge/solo` (safe default — read-only) | MEDIUM |
| No target, or signals conflict | — | LOW → menu (interactive) / `ambiguous_routing` (CI) |

`judge/solo` is the read-only safe default; `judge/on-diff` mutates via
the implementer loop, so it never fires on a bare safe-default fallback.

## Dispatch

1. Parse the user's argument: `/judge <sub-command> [args]`.
2. **Explicit sub** → look it up in the table above and route. Otherwise
   run the detection table above per the non-interactive-contract.
3. Load the body of the routed file and follow its `## Instructions`
   section verbatim with the remaining args.
4. On **LOW** confidence (or `--no-auto-detect`): interactive → print the
   table and ask; non-interactive → emit `ambiguous_routing` and stop.

   > 1. solo — verdict only, no loop
   > 2. on-diff — implementer→judge revision loop
   > 3. steps — judge gate between ordered steps

## Rules

- **Do NOT commit, push, or open a PR** unless the sub-command
  explicitly authorizes it.
- **Do NOT chain sub-commands.** One `/judge <sub>` per turn.
- Auto-detection emits the structured pre-routing block (per the
  contract) before routing; on LOW confidence it shows the menu
  (interactive) or aborts (CI) — it **never** guesses past LOW.

## See also

- [`subagent-orchestration`](../skills/subagent-orchestration/SKILL.md)
- [`/review`](review-changes.md) — human-oriented self-review (Reviewer-mode contract)
- [`role-contracts`](../docs/guidelines/agent-infra/role-contracts.md#reviewer)
