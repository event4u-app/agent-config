---
model_tier: medium
name: analytics-show
pack: analytics
tier: 2
visibility: internal
cluster: analytics
sub: show
description: Render top prompts, launcher → completion rate per role, average session length, and knowledge-source usage from the local analytics log.
skills: [file-editor]
suggestion:
  eligible: true
  trigger_description: "show analytics, top prompts last 30 days, which role launched what, completion rate per role"
  trigger_context: "user wants a human-readable report from the local workspace event log"
workspaces:
  - agent-config-maintainer
packs:
  - analytics
---

# /analytics show

Renders the local event log as a report. Never reads remote data, never
POSTs. Defaults to a 30-day window and markdown output.

## Prerequisites

- Python 3.10+ on the host.
- `~/.event4u/agent-config/workspace/analytics/events.jsonl` exists or
  is empty (empty is a normal result, not an error).

## Steps

### 1. Parse the argument

```
/analytics show [--window 24h|7d|30d] [--event <name>] [--role <slug>]
                [--format markdown|csv|json]
```

- `--window` defaults to `30d`.
- `--format` defaults to `markdown`.
- `--event` and `--role` are optional filters.

### 2. Run the implementation

```bash
python3 packages/core/installer/python/workspace_analytics.py \
    show [--window=...] [--event=...] [--role=...] [--format=...]
```

### 3. Surface the result

**Markdown** view (default):

```
# Workspace analytics — last 30d

## Top prompts

- `tradesperson` · `estimate` — 12
- `content-creator` · `script-video` — 7

## Launcher → completion rate per role

- `tradesperson` — 83% (12 launched · 10 completed)

**Average session length:** 3m 41s
**Knowledge sources clicked:** 14
```

**CSV** view — one row per event: `ts,event,role,task,host_tier,duration_ms`.
Pipe into `awk`/`csvkit` for ad-hoc queries.

**JSON** view — full event array; useful for `jq` filters or chart
pipelines.

### 4. Empty log

Print the markdown shell with `_No events recorded in this window._`
and offer the next step:

```
> 1. open the workspace tab to start recording events
> 2. /analytics prune  — drop stale records older than 90 days
```

## Safety

- Read-only. Never writes to the JSONL, never opens the network.
- The opt-out check (env + settings) short-circuits before the file is
  opened — see [`local-analytics`](../../../docs/contracts/local-analytics.md)
  § Opt-out.

## See also

- [`/analytics prune`](prune.md) — drop events older than 90 days.
- [`local-analytics`](../../../docs/contracts/local-analytics.md) — full
  schema and retention contract.
- [`local-analytics walkthrough`](../../../docs/guides/local-analytics.md)
  — the 3-minute read for end-users.
