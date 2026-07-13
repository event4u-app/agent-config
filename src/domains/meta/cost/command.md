---
model_tier: medium
name: cost
disable-model-invocation: true
argument-hint: "[report|profile] [args]"
pack: meta
intent: "Cost dispatcher — session cost report or rule-loading cost profile"
routes_to: [cost-report, cost-profile]
replaces: []
tier: 2
visibility: internal
description: Cost orchestrator — routes to report (session token cost + budget ladder) and profile (change the rule_loading_tier)
cluster: cost
type: orchestrator
suggestion:
  eligible: true
  trigger_description: "how expensive is this session, check token budget, change the cost profile"
  trigger_context: "user asks about token cost or budget tiers without picking report vs profile"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /cost

Top-level orchestrator for the `/cost` family — token-budget observability
and configuration.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/cost report` | `commands/cost/report.md` | Capture the active session's token cost, append to the local store, surface the 50/75/90/100% budget alert ladder |
| `/cost profile` | `commands/cost/profile.md` | Change the `rule_loading_tier` in `.agent-settings.yml` — shows each profile's meaning, applies the selection |

Sub-command names match the locked contract in
[`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md).

## Dispatch

1. Parse the user's argument: `/cost <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the corresponding `commands/cost/<sub>.md` file and
   follow its `## Instructions` (or `## Steps`) section verbatim.
4. If the sub-command is unknown or missing, print the menu and ask — do not
   guess:

   > 1. report — session token cost + budget alert ladder (read-only)
   > 2. profile — change the rule_loading_tier (settings mutation)

## Rules

- **`report` is read-only; `profile` mutates settings.** The profile change
  always shows the diff and asks before writing.
- **Do NOT chain sub-commands.** One `/cost <sub>` per turn.
- If the user invokes `/cost` with no argument, **show the menu** — do not
  guess which sub-command they meant.
