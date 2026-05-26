---
stability: beta
keep-beta-until: 2026-08-15
---

# cost-summary schema (`cost-summary/v1`)

Stable JSON contract for inter-tool consumption of cost-tracking data
emitted by [`scripts/cost_summary.py`](../../scripts/cost_summary.py).
Schema-versioned so downstream consumers can pin and migrate explicitly.

Design reference: Ruflo `scripts/summary.mjs` (upstream cite). Our shape
diverges to align with the local `agents/cost-tracking/sessions.jsonl`
fields and the telegraph-suspended-multiplier contract.

## Envelope

```json
{
  "schema_version": "cost-summary/v1",
  "generated_at": "2026-05-16T23:45:00Z",
  "totals": { ... },
  "by_session": [ ... ],
  "by_conversation": [ ... ],
  "by_model": [ ... ]
}
```

| Field | Type | Notes |
|---|---|---|
| `schema_version` | string | Pinned to `cost-summary/v1`. Downstream consumers MUST refuse unknown versions. |
| `generated_at` | string (ISO-8601 UTC, `Z` suffix) | Emit time. |
| `totals` | object | Lifetime aggregates — see `totals` below. |
| `by_session` | array | Per `sessionId` row; ordered by `sessionId` ascending. |
| `by_conversation` | array | Per `conversation_id` row; ordered by `conversation_id` ascending. |
| `by_model` | array | Per `model` row; ordered by `model` ascending. |

## `totals` shape

```json
{
  "sessions": 123,
  "total_cost_usd": 1.2345,
  "input_tokens": 100000,
  "output_tokens": 50000,
  "telegraph_delta_tokens": 0,
  "telegraph_multiplier_version": "v1",
  "telegraph_multiplier_active": false
}
```

`telegraph_delta_tokens` is always `0` while
`telegraph_multiplier_active == false` — see
[`telegraph-telemetry.md`](telegraph-telemetry.md) for the suspension contract.

## `by_session` / `by_conversation` row shape

```json
{
  "key": "<sessionId or conversation_id>",
  "sessions": 12,
  "total_cost_usd": 0.4567,
  "input_tokens": 8000,
  "output_tokens": 4500,
  "telegraph_delta_tokens": 0
}
```

The `key` field is the grouping identifier; consumers identify the
group by inspecting which array the row lives in.

## `by_model` row shape

```json
{
  "model": "claude-3-5-sonnet-20241022",
  "sessions": 12,
  "total_cost_usd": 0.4567,
  "input_tokens": 8000,
  "output_tokens": 4500
}
```

`by_model` omits telegraph fields — the multiplier is dialect-scoped, not
model-scoped.

## Stability guarantees

- **Field additions** are **non-breaking**: consumers MUST ignore unknown fields.
- **Field removals or renames** bump the `schema_version` minor (`v1` → `v2`).
- **Type changes** bump the major (`v1.*` → `v2.0`).
- Downstream consumers SHOULD pin to a specific `schema_version` and
  refuse unknown ones; the pin is the migration boundary.

## Downstream consumers

- `agent-status` skill — surfaces lifetime / current-conversation slice.
- Future `cost-export-to-monitoring` scripts (deferred; trigger:
  consumer request) would wrap this JSON to push to Prometheus / OTLP.

## See also

- [`telegraph-telemetry.md`](telegraph-telemetry.md) — defines the
  `telegraph_*` fields and the suspended-multiplier contract.
- [`scripts/cost_summary.py`](../../scripts/cost_summary.py) — implementation.
- [`scripts/cost_by_conversation.py`](../../scripts/cost_by_conversation.py) — narrower per-conversation lens with the same JSONL source.
- [`scripts/telegraph_stats.py`](../../scripts/telegraph_stats.py) — telegraph-only delta lens with the same JSONL source.
