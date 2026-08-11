---
stability: beta
keep-beta-until: 2026-08-15
---

# cost-summary schema (`cost-summary/v1`)

Stable JSON contract for inter-tool consumption of cost-tracking data
emitted by [`scripts/cost_summary.py`](../../src/scripts/cost_summary.py).
Schema-versioned so downstream consumers can pin and migrate explicitly.

Design reference: the external runtime `scripts/summary.mjs` (upstream cite). Our shape
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
| `by_date` | array | Per UTC calendar day (`YYYY-MM-DD`) of the row's `startedAt`; ordered ascending. A row with no or unparseable timestamp lands under `unknown`, which sorts last. **v1 additive extension.** |
| `by_model` | array | Per `model` row; ordered by `model` ascending. |

## `totals` shape

```json
{
  "sessions": 123,
  "total_cost_usd": 1.2345,
  "input_tokens": 100000,
  "output_tokens": 50000,
  "cache_read_input_tokens": 20000,
  "cache_creation_input_tokens": 5000,
  "telegraph_delta_tokens": 0,
  "telegraph_multiplier_version": "v1",
  "telegraph_multiplier_active": false,
  "cache_savings_input_token_equivalents": 38
}
```

`cache_savings_input_token_equivalents` is what the prompt cache bought,
expressed in **input-token equivalents — not USD**: each cached read token
saved `1 - CACHE_READ_MULTIPLIER` of a full-rate input token, each written
token cost an extra `CACHE_WRITE_MULTIPLIER_5M - 1`, and the field is the net.
A **negative** value is meaningful and not an error — it says the run wrote
cache it never read back and paid the premium for nothing.

Two honest limits. It is not priced in dollars because `totals` aggregates
across models with different input rates and carries no per-model token split
to apply them to; any single rate would be wrong for every other model in the
row. And the write premium uses the **5-minute** multiplier, because rows carry
no TTL split — 5m is Anthropic's default and the assumption
[`cost/track.mjs`](../../src/scripts/cost/track.mjs) already makes for
unaccounted writes, so the two cost paths agree rather than diverging quietly.
A 1h-heavy workload therefore reads slightly optimistic.

Also a **v1 additive extension**: absent on a summary emitted before it
shipped, exactly like the cache fields above.

`telegraph_delta_tokens` is always `0` while
`telegraph_multiplier_active == false` — see
[`telegraph-telemetry.md`](telegraph-telemetry.md) for the suspension contract.

`cache_read_input_tokens` / `cache_creation_input_tokens` sum the source
rows' same-named fields (prompt-cache reads and writes, Anthropic-style
accounting). They are a **v1 additive extension**: rows written before this
extension shipped lack the fields and aggregate as `0` for them, exactly
like a row missing `input_tokens` — no version bump, per the additive rule
below.

## `by_session` / `by_conversation` / `by_date` row shape

```json
{
  "key": "<sessionId, conversation_id, or YYYY-MM-DD>",
  "sessions": 12,
  "total_cost_usd": 0.4567,
  "input_tokens": 8000,
  "output_tokens": 4500,
  "cache_read_input_tokens": 1600,
  "cache_creation_input_tokens": 400,
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
  "output_tokens": 4500,
  "cache_read_input_tokens": 1600,
  "cache_creation_input_tokens": 400
}
```

`by_model` omits telegraph fields — the multiplier is dialect-scoped, not
model-scoped — but DOES carry the cache fields: the prompt cache itself is
model-scoped (a cache write under one model is never read back under
another), so a per-model cache breakdown is meaningful here.

## Served-model attribution — `model_served`, a v1 additive extension

A recorded spend row may carry `model_served`: the model id the provider
reported **answering** with, beside `model`, which stays the id that was
**requested**. Keeping both is the point — on an alias or a provider
substitution the two differ, and a row that carries only one attributes the
spend to a model that never ran.

- **Additive per the rule above.** No version bump, no required field. A row
  written before this extension, and any transport that reports no served id
  (every CLI client), reads as `''` — exactly like a row missing
  `input_tokens`.
- **Attribution-only.** A consumer MUST NOT route, tier, or price on
  `model_served`; `model` is what the tier decision was made against.
- **Deliberately not aggregated into `by_model`.** That array is keyed by the
  requested `model`, and one such bucket can legitimately span several served
  ids, so a single per-bucket value would have to pick one and misreport the
  rest. The divergence itself is recorded per dispatch in the audit log
  ([`audit-log-v1`](audit-log-v1.md)) rather than summed here.

First producer: the AI council's per-member response row
(`src/scripts/ai_council/session.ts`, `_serialise_response`).

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
- [`scripts/cost_summary.py`](../../src/scripts/cost_summary.py) — implementation.
- [`scripts/cost_by_conversation.py`](../../src/scripts/cost_by_conversation.py) — narrower per-conversation lens with the same JSONL source.
- [`scripts/telegraph_stats.py`](../../src/scripts/telegraph_stats.py) — telegraph-only delta lens with the same JSONL source.
