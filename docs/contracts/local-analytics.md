---
stability: experimental
---

# Local Analytics Contract

> **Status** · v0 / design · 2026-05-24. Phase 7 of the
> employee-product workstream.
> **Local-only.** Does NOT lift the Hard-Floor item from 3.1.0 — no
> network egress, no remote Worker, no POST. Inertia of the prior
> telemetry roadmap is preserved.

## Position vs the 3.1.0 telemetry SDK

3.1.0 shipped the telemetry SDK + Cloudflare Worker as **source-only**;
the kill-switch defaults off and nothing is deployed. Phase 7 builds
a **separate local-only** analytics path:

| Surface | Lives | Egress | Default |
|---|---|---|---|
| 3.1.0 remote telemetry | Worker (undeployed) | ✗ inert | off, Hard-Floor |
| **Phase 7 local analytics** | `~/.event4u/agent-config/workspace/analytics/` | ✗ never | **on** for local-only |

The two surfaces share **event vocabulary** where it overlaps; they
never share a transport. Local analytics writes to disk; remote
telemetry remains undeployed.

## Event vocabulary

Re-uses the `install_stage` schema (3.1.0) where applicable, and
adds the `workspace_event` schema for launcher / document / explain
interactions:

| schema | source | example fields |
|---|---|---|
| `install_stage/v1` | installer (3.1.0) | `stage`, `outcome`, `duration_ms`, `package_version` |
| `workspace_event/v0` | Phase 4–6 workspace | `event`, `role`, `task`, `host_tier`, `duration_ms` |

`workspace_event/v0` event names (closed set):

- `launcher.opened` · `launcher.task_picked` · `launcher.task_launched`
- `session.started` · `session.host_turn` · `session.completed`
- `document.created` · `document.edited` · `document.exported`
- `explain.opened` · `explain.mode_toggled` · `why.invoked`
- `knowledge.queried` · `knowledge.source_clicked`
- `rule.tier2_loaded` · `persona.cited` · `skill.activated` — **6.0.0-C
  evidence-based-pruning measurement.** `rule.tier2_loaded` fires when a
  router-gated (tier-2) rule is loaded; `persona.cited` when a persona is
  cited-in-use by a skill/command; `skill.activated` when a skill activates
  under the active profile. Payload fields: the artefact `id` (or `rule`,
  `persona`, `skill`) and the active `profile` — nothing else. These feed the
  thresholds in [`evidence-based-pruning.md`](evidence-based-pruning.md) so a
  later, data-bearing roadmap cuts on usage, not on a guessed target.

No prompt bodies. No response bodies. No PII. Only counters, role
labels, task slugs (already public), artefact ids, and durations.

## Storage

```
~/.event4u/agent-config/workspace/analytics/
├── events.jsonl              ← append-only event log
└── retention.lock            ← prune-pass mutex
```

One JSON record per line:

```json
{
  "ts": "2026-05-24T12:08:00Z",
  "schema": "workspace_event/v0",
  "event": "launcher.task_launched",
  "data": { "role": "galabau", "task": "angebot-erstellen",
            "host_tier": 1, "duration_ms": 420 }
}
```

Rolling retention: **90 days local**. A prune pass on workspace
launch trims records older than 90 days; the lockfile prevents
concurrent prune (cheap fs lock, not a real mutex).

## Opt-out

Single env var, single config flag, both checked:

| Surface | Default | Override |
|---|---|---|
| Env | `AGENT_CONFIG_NO_LOCAL_ANALYTICS` unset | set to any non-empty value → no writes |
| Config | `.agent-settings.yml` → `analytics.local: on` | set to `off` → no writes |

Either set to off → emitter short-circuits before opening the file.
No retention pruning either; the existing log stays until the user
removes it.

## Emitter API

```python
# packages/core/src/workspace/analytics/emitter.py
class LocalAnalytics:
    def emit(self, event: str, data: dict) -> None: ...
    def query(self, since: datetime, event: str | None = None) -> list[Event]: ...
    def prune(self) -> int: ...   # returns number of records dropped
```

The emitter is a synchronous append-line write. Never blocks the UI
thread above 5 ms (90th percentile); no async / queue / batch
machinery in v0.

## `/analytics:show` command

Local-only query. Renders to ASCII / Markdown table; never POSTs.

```
$ npx @event4u/agent-config analytics:show --window 30d

Top prompts (last 30 days)
  galabau · angebot-erstellen          47
  content-creator · video-from-script  31
  consultant · meeting-memo            24

Launcher → completion rate per role
  galabau           87% (47 launched · 41 completed)
  content-creator   71% (31 launched · 22 completed)
  consultant        92% (24 launched · 22 completed)

Average session length: 4m 12s
Knowledge sources clicked: 18 (handbuch.pdf · offer-template.md · …)
```

Flags: `--window <30d|7d|24h>` · `--event <name>` · `--role <slug>` ·
`--format <markdown|csv|json>`. No `--upload`, no `--share`; the
command can only read and render.

## Coverage (Phase 7 Step 4)

- pytest against fixture JSONL stores (`tests/fixtures/local-analytics/`):
  emitter writes, query filters by window + event + role, prune
  drops correctly at the 90-day boundary.
- Env-flag short-circuit: emitter is a no-op when
  `AGENT_CONFIG_NO_LOCAL_ANALYTICS=1`; no file is created.
- Concurrency: two emitters writing the same file produce
  well-formed lines (POSIX `O_APPEND` semantics — test on Linux,
  document Windows caveat).

## Failure modes

- Disk full → emitter logs warning to stderr, drops the event, never
  raises. UI thread is unaffected.
- Malformed line in `events.jsonl` → query skips the line, increments
  a `malformed_lines` counter exposed via `/analytics:show --health`.
- Schema bump (`workspace_event/v0` → `v1`) → emitter writes the new
  schema; query reads both. Migration is forward-compatible.

## Cross-references

- Phase 4 shell that produces the events: [`daily-workspace`](daily-workspace.md).
- Phase 5 document events: [`workspace-documents`](workspace-documents.md).
- Phase 6 explain events: [`explain-modes`](explain-modes.md).
- 3.1.0 telemetry inertia: archived `road-to-product-adoption.md` Phase 4.
- Walkthrough doc (Phase 7 Step 5): `docs/guides/local-analytics.md` (deferred).
