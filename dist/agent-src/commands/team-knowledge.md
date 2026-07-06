---
model_tier: medium
name: team-knowledge
disable-model-invocation: true
pack: meta
intent: "Manage the repo-tracked team-knowledge layer — consolidate typed observation events into agents/knowledge/ pages, bootstrap a project baseline"
routes_to: [team-knowledge-consolidate, team-knowledge-bootstrap]
replaces: []
tier: 2
visibility: internal
description: Team-knowledge orchestrator — routes to consolidate and bootstrap
cluster: team-knowledge
type: orchestrator
suggestion:
  eligible: true
  trigger_description: "consolidate knowledge events, review pending knowledge observations, promote captured knowledge into pages"
  trigger_context: "user wants to turn accumulated in-flight observations into committed agents/knowledge/ pages"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /team-knowledge

Top-level orchestrator for the `/team-knowledge` family — the
consolidation gate over the typed knowledge-observation events
captured during normal task work (see
[`knowledge-pages`](../templates/contexts/knowledge-pages.md) and the
event schema in `src/scripts/_lib/knowledge_events.ts`).

Not to be confused with the pre-existing `/knowledge` cluster (local
file ingestion into `agents/memory/knowledge/`) — different concern
(arbitrary local documents), unrelated to this repo-tracked,
lifecycle-typed team-knowledge layer under `agents/knowledge/`.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/team-knowledge consolidate` | `commands/team-knowledge/consolidate.md` | Read pending intake events, propose tracked-page creates/updates as a reviewable batch, write only on approval |
| `/team-knowledge bootstrap` | `commands/team-knowledge/bootstrap.md` | One-shot deterministic seed of a fresh project's knowledge pages from real config/directory detection — staged, never auto-committed |

Sub-command names match the locked contract in
[`docs/contracts/command-clusters.md`](../docs/contracts/command-clusters.md).

## Dispatch

1. Parse the user's argument: `/team-knowledge <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the routed file and follow its `## Steps` section
   verbatim with the remaining args.
4. If the sub-command is unknown or missing, print the table above and ask:

   > 1. consolidate — review pending knowledge events and file them as pages
   > 2. bootstrap — seed a fresh project's knowledge pages from detection

## Rules

- **Never writes a tracked page without human approval.** Intake is
  proposal-only; the consolidate flow always shows a batch and waits.
- **Never fires automatically** — the user invokes this explicitly.
- **Do NOT commit, push, or open a PR** unless the sub-command
  explicitly authorizes it.
