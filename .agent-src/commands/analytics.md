---
model_tier: medium
name: analytics
pack: meta
tier: 2
description: Analytics orchestrator — routes to show, prune. Local-only workspace event log under `~/.event4u/agent-config/workspace/analytics/`.
cluster: analytics
type: orchestrator
auto_detect: true
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

## Non-interactive & auto-detection

`/analytics` honors the [`non-interactive-contract`](../contexts/execution/non-interactive-contract.md)
(surface detection, confidence tiers, `--yes`/`--json`, abort schemas,
the `auto_detect` kill-switch, rollback). Detection table:

| Basis (signal) | Sub-command | Confidence |
|---|---|---|
| Explicit sub given (`/analytics prune`) | that one | — (detection skipped) |
| `--prune` flag, or explicit "drop/prune old events" intent | `analytics/prune` | HIGH (destructive — see below) |
| Any read intent (show, report, top prompts), or no argument | `analytics/show` (read-only safe default) | HIGH |

`show` is the read-only safe default — a bare `/analytics` always renders.
`prune` **mutates** (drops events): per the contract it NEVER fires on an
auto-detect/safe-default fallback — only on an explicit `prune` sub /
`--prune`, and in CI only with an explicit `--yes`.

## Dispatch

1. Parse the user's argument: `/analytics <sub-command> [args]`.
2. **Explicit sub** → look it up and route. Otherwise run the detection
   table above per the non-interactive-contract (default → `show`).
3. Load the body of the routed file and follow its `## Steps` section
   verbatim with the remaining args.
4. On `--no-auto-detect` with no sub: interactive → print the table and
   ask; non-interactive → route to `show` (read-only default).

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
