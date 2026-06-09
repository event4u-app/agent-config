---
model_tier: medium
name: override
disable-model-invocation: true
pack: meta
tier: 2
description: Override orchestrator — routes to create, manage
cluster: override
type: orchestrator
auto_detect: true
suggestion:
  eligible: true
  trigger_description: "create an override, manage existing overrides, refactor an override"
  trigger_context: "user wants to add or curate project-level overrides under agents/overrides/"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /override

Top-level orchestrator for the `/override` family. Replaces 2 standalone
commands with a single entry point + sub-command dispatch.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/override create` | `commands/override/create.md` | Create a project-level override for a shared skill, rule, or command |
| `/override manage` | `commands/override/manage.md` | Review, update, and refactor existing overrides |

Sub-command names match the locked contract in
[`docs/contracts/command-clusters.md`](../docs/contracts/command-clusters.md).

## Non-interactive & auto-detection

`/override` honors the [`non-interactive-contract`](../contexts/execution/non-interactive-contract.md)
(surface detection, confidence tiers, `--yes`/`--json`, abort schemas,
the `auto_detect` kill-switch, rollback). Detection table:

| Basis (signal) | Sub-command | Confidence |
|---|---|---|
| Explicit sub given (`/override manage`) | that one | — (detection skipped) |
| Named target artefact has **no** existing override under `agents/overrides/` | `override/create` | MEDIUM |
| An existing override is named, or intent is review/update/refactor | `override/manage` | MEDIUM |
| No target, or create-vs-edit signal conflicts | — | LOW → menu (interactive) / `ambiguous_routing` (CI) |

create-vs-edit is the only disambiguation: `create` for a target with no
existing override, `manage` to curate an existing one.

## Dispatch

1. Parse the user's argument: `/override <sub-command> [args]`.
2. **Explicit sub** → look it up and route. Otherwise run the detection
   table above per the non-interactive-contract.
3. Load the body of the routed file and follow its `## Instructions` section
   verbatim with the remaining args.
4. On **LOW** confidence (or `--no-auto-detect`): interactive → print the
   table and ask; non-interactive → emit `ambiguous_routing` and stop.

   > 1. create — author a new project-level override
   > 2. manage — review, update, refactor existing overrides

## Rules

- **Do NOT commit, push, or open a PR** unless the sub-command explicitly
  authorizes it.
- **Do NOT chain sub-commands.** One `/override <sub>` per turn.
- Auto-detection emits the structured pre-routing block before routing; on
  LOW confidence it shows the menu (interactive) or aborts (CI) — it
  **never** guesses past LOW.
