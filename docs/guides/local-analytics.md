# Local analytics — a 3-minute walkthrough

> Phase 7 of [`road-to-employee-product-and-external-proof`](../../agents/roadmaps/road-to-employee-product-and-external-proof.md).
> Contract: [`docs/contracts/local-analytics.md`](../contracts/local-analytics.md).

## What this is

A **local-only** event log of your workspace activity. The package never
POSTs these records anywhere. Storage is a single append-only JSONL file
under your home directory; pruning is a 90-day rolling window.

If you want to know *"which prompts do I actually run on Tuesday
mornings?"* — this is the file that knows. If you don't want that
question answered, flip one flag and the file never opens.

## Where it lives

```
~/.event4u/agent-config/workspace/analytics/
├── events.jsonl          # one workspace_event/v0 record per line
└── retention.lock        # presence = a prune pass is running
```

One event per line. Schema is `workspace_event/v0` (matches the
3.1.0 telemetry SDK vocabulary, but the transports never touch each
other — the SDK is the undeployed Worker surface, this is your disk).

## What's collected

Closed event set (rejected if not on the list):

| Event | When |
|---|---|
| `launcher.opened`         | Workspace tab opens. |
| `launcher.task_picked`    | User clicks a task in the launcher. |
| `launcher.task_launched`  | Host agent receives the rendered prompt. |
| `session.started` / `session.host_turn` / `session.completed` | Conversation lifecycle. |
| `document.created` / `document.edited` / `document.exported` | Phase 5 document workflows. |
| `explain.opened` / `explain.mode_toggled` / `why.invoked` | Phase 6 explain mode. |
| `knowledge.queried` / `knowledge.source_clicked` | Phase 2 knowledge pane interactions. |

Each record carries a UTC timestamp, the schema version, and a tiny
`data` dict (role, task, host_tier, duration_ms — never prompt or
response bodies).

## How to read it

```bash
# Render the last 30 days as markdown
python3 packages/core/installer/python/workspace_analytics.py show

# Last 24 h, JSON
python3 packages/core/installer/python/workspace_analytics.py show \
    --window 24h --format json

# Filter to one role
python3 packages/core/installer/python/workspace_analytics.py show \
    --role tradesperson --format csv
```

Output shape (markdown):

```
# Workspace analytics — last 30d

## Top prompts

- `tradesperson` · `estimate` — 12
- `content-creator` · `script-video` — 7
- `consultant` · `weekly-memo` — 4

## Launcher → completion rate per role

- `tradesperson` — 83% (12 launched · 10 completed)
- `content-creator` — 71% (7 launched · 5 completed)

**Average session length:** 3m 41s
**Knowledge sources clicked:** 14
```

## How to opt out

Two equivalent switches — either short-circuits before any file opens.

```bash
# Env (per-shell)
export AGENT_CONFIG_NO_LOCAL_ANALYTICS=1
```

```yaml
# .agent-settings.yml (per-project)
analytics:
  local: off
```

After either is in effect, `emit()` returns `False` and the JSONL is
never appended. The `show` command still works against existing data,
so you can opt out without losing what you already have.

## How to delete it

The file is plain JSONL. Delete it:

```bash
rm -rf ~/.event4u/agent-config/workspace/analytics/
```

Or prune the rolling window manually:

```bash
python3 packages/core/installer/python/workspace_analytics.py prune
# → pruned 47 event(s)
```

`prune` drops anything older than 90 days. The lock file prevents two
concurrent passes from racing each other.

## What this guide does not cover

- **Remote telemetry** — that's the Worker SDK (`packages/telemetry/`).
  Deployment is out of v0 scope; kill-switch defaults to disabled.
- **Workspace UI** — Phase 4 builds the browser tab that emits these
  events. See [`docs/contracts/daily-workspace.md`](../contracts/daily-workspace.md).
- **Encryption at rest** — Phase 8. Until then, the JSONL is plaintext
  on your local disk.
