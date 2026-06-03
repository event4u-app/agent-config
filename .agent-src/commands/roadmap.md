---
model_tier: medium
name: roadmap
pack: product-basic
intent: "Roadmap dispatcher — create, process-step, process-phase, process-full, ai-council"
routes_to: [roadmap:create, roadmap:process-step, roadmap:process-phase, roadmap:process-full]
replaces: []
tier: 1
description: Roadmap orchestrator — routes to create (authoring) and process-step / process-phase / process-full (autonomous execution).
cluster: roadmap
type: orchestrator
suggestion:
  eligible: true
  trigger_description: "create a roadmap, process a roadmap, work through a roadmap autonomously, plan or abarbeiten"
  trigger_context: "user wants to scaffold or autonomously execute a roadmap under agents/roadmaps/"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /roadmap

Top-level orchestrator for the `/roadmap` family. Carries authoring
(`create`) and the three autonomous-execution scopes (`process-step`,
`process-phase`, `process-full`). The legacy `/roadmap execute` (which
paused for confirmation before every step) was removed —
`process-phase` is the default execution scope.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/roadmap:create` | `commands/roadmap/create.md` | Interactively scaffold a new roadmap in `agents/roadmaps/` |
| `/roadmap:ai-council` | `commands/roadmap/ai-council.md` | Challenge an existing roadmap with the AI council (deep tier) and refactor from convergence findings |
| `/roadmap:process-step` | `commands/roadmap/process-step.md` | Autonomously process the next open step, then stop |
| `/roadmap:process-phase` (**default execution scope**) | `commands/roadmap/process-phase.md` | Autonomously process every open step in the current phase |
| `/roadmap:process-full` | `commands/roadmap/process-full.md` | Autonomously process every open step across every phase |

Sub-command names match the locked contract in
[`docs/contracts/command-clusters.md`](../docs/contracts/command-clusters.md).
`:` and space are equivalent at the cluster boundary — see
[`slash-command-routing-policy-mechanics`](../contexts/communication/rules-auto/slash-command-routing-policy-mechanics.md#routing-semantics).
The three `process-*` subs share the canonical loop in
[`contexts/execution/roadmap-process-loop`](../contexts/execution/roadmap-process-loop.md);
each only binds a scope delta.

## Dispatch

1. Parse the user's argument: `/roadmap[:<sub>] [args]` or
   `/roadmap <sub> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the routed file and follow its `## Instructions`
   section verbatim with the remaining args.
4. **Legacy forwarding:**
   - `/roadmap execute` or `/roadmap-execute` → forward to
     [`/roadmap:process-phase`](roadmap/process-phase.md) (default
     scope) with a one-time migration notice.
   - `/roadmap-process[:<sub>]` (legacy top-level cluster) → forward
     to `/roadmap:process-<sub>` with a one-time migration notice.
5. If the sub-command is unknown or missing, print the table above
   and ask:

   > 1. create — scaffold a new roadmap interactively
   > 2. ai-council — challenge + refactor an existing roadmap (deep tier)
   > 3. process-step — process the next open step, then stop
   > 4. process-phase — process the current phase (default)
   > 5. process-full — process every open step across every phase

## Rules

- **Do NOT commit, push, or open a PR** unless the sub-command
  explicitly authorizes it. Roadmap-listed commit steps follow the
  single-upfront-ask flow in
  [`roadmap-process-loop § 3`](../contexts/execution/roadmap-process-loop.md#3-commit-step-pre-scan--one-upfront-ask).
- **Do NOT chain sub-commands.** One `/roadmap <sub>` per turn.
- If the user invokes `/roadmap` with no argument, **show the menu** —
  do not guess which sub-command they meant.
- Execution intents (*"work through the roadmap"*, *"abarbeiten"*,
  *"finish this phase"*) default to
  [`/roadmap:process-phase`](roadmap/process-phase.md) unless the user
  named a different scope.
