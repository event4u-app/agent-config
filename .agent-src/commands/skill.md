---
model_tier: medium
name: skill
tier: 2
description: Single-skill orchestrator — routes to preview. Non-destructive "what will this skill do?" before you run it.
cluster: skill
type: orchestrator
suggestion:
  eligible: true
  trigger_description: "what does this skill do, preview this skill before running, is this skill safe to run, what will it change, /skill:preview <name>"
  trigger_context: "user wants to see a skill's declared steps + targets before committing to running it"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /skill

Top-level orchestrator for the `/skill` family — **single-skill** operations
(singular `skill` for one target; plural `/skills` is the catalog-wide
discovery cluster). Today it carries one verb: `preview`.

Anchors: [`skill-dry-run`](../docs/contracts/skill-dry-run.md) contract —
what "preview" means, the explicit non-goals, and the surface.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/skill preview` | `commands/skill/preview.md` | Render a skill's declared steps, execution type, tools, and file/command targets before running it |

Sub-command names match the locked contract in
[`docs/contracts/command-clusters.md`](../docs/contracts/command-clusters.md).

## Dispatch

1. Parse the user's argument: `/skill <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the routed file and follow its `## Steps` section verbatim.
4. Unknown / missing sub-command → route to `preview` (the only verb today).

## Rules

- **Read-only.** Preview reads a skill's SKILL.md; it never runs the skill.
- **Not a sandbox.** Preview surfaces *declared intent*, not a guarantee of
  side-effect-freeness — a contract non-goal.
- **One skill per invocation.** Do not chain.
