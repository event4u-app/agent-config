---
model_tier: inherit
name: analytics
tier: 2
description: Analytics orchestrator — routes to show, prune. Local-only workspace event log under `~/.event4u/agent-config/workspace/analytics/`.
cluster: analytics
type: orchestrator
suggestion:
  eligible: true
  trigger_description: "show my workspace analytics, top prompts last week, which role launched what, prune the analytics log"
  trigger_context: "user wants to read or maintain the local-only workspace event log"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /analytics

Top-level orchestrator for the `/analytics` family — the **local
workspace analytics** cluster. Local-only, never POSTs, opt-out via
env or `.agent-settings.yml`.

Anchors: [`local-analytics`](../docs/contracts/local-analytics.md)
contract — schema, retention, opt-out, event vocabulary.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/analytics show` | `commands/analytics/show.md` | Render top prompts, launcher → completion, session length, knowledge usage |
| `/analytics prune` | `commands/analytics/prune.md` | Drop events older than the 90-day retention window |

## Dispatch

1. Parse the user's argument: `/analytics <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the routed file and follow its `## Steps` section
   verbatim with the remaining args.
4. If the sub-command is unknown or missing, print the table above and ask:

   > 1. show — render the analytics report (markdown · csv · json)
   > 2. prune — drop events older than 90 days

## Rules

- **Local-only.** This cluster never POSTs. It is disjoint from the
  3.1.0 telemetry SDK Worker (which is undeployed by design).
- **Opt-out wins.** If `AGENT_CONFIG_NO_LOCAL_ANALYTICS=1` or
  `.agent-settings.yml → analytics.local: off`, every sub-command
  becomes a no-op before any file is opened.
- **Closed event vocabulary.** Emitters reject unknown event names —
  see [`local-analytics`](../docs/contracts/local-analytics.md)
  § Event vocabulary.
- **Do NOT commit, push, or open a PR** unless the user explicitly asks.
- **Do NOT chain sub-commands.** One `/analytics <sub>` per turn.
