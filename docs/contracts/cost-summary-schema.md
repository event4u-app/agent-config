---
stability: beta
keep-beta-until: 2026-08-15
---

# cost-summary schema (`cost-summary/v1`)

Stable JSON contract for inter-tool consumption of cost-tracking data
emitted by [`scripts/cost_summary.py`](../../src/scripts/cost_summary.ts).
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
| `by_date` | array | Per UTC calendar day (`YYYY-MM-DD`) of the row's `startedAt`; ordered ascending. A row with no or unparseable timestamp lands under `unknown`, which sorts last. **v1 additive extension.** **Honest limit:** the key is the START day only, so a session spanning midnight or several days attributes its whole cost to the day it began — a day's figure is "spend from sessions that started that day", not "spend that occurred that day". Splitting a session across days would need per-message costs the source row does not carry (it keeps `startedAt`/`endedAt` and one total), so the alternative is not a better number but an invented one. |
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

## Unpriced rows — `rate_missing`, a v1 additive extension

A source row may carry `rate_missing` (bool) and `rate_missing_models`
(string[]): the session contained at least one message whose model matched no
price tier, so those messages were costed at **$0** and the row's
`total_cost_usd` is **understated** — it is not a record of cheap work.
Written by [`cost/track.mjs`](../../src/scripts/cost/track.mjs); token counts
are kept untouched so the row can be re-priced once a rate exists.

The summary surfaces it rather than silently aggregating past it:

- `totals.rate_missing_sessions` — how many source rows were flagged, and
  `totals.rate_missing_models` — the sorted distinct union of the unpriced ids.
- Every `by_session` / `by_conversation` / `by_date` / `by_model` row carries
  its own `rate_missing_sessions` count, because the understatement propagates
  into whichever grouping the flagged row lands in. A non-zero count on a row
  means that row's `total_cost_usd` is a floor, not a figure.

Additive per the rule below: absent on rows and summaries written before this
extension, which read as `0` / `[]` — the same absent-reading as the cache
fields. No version bump, no required field.

## Re-priced rows — `rate_backfill`, a v1 additive extension

A row that was flagged and has since been re-priced by
[`cost/backfill_rates.mjs`](../../src/scripts/cost/backfill_rates.mjs) carries
`rate_backfill`: an array with one entry per repaired model id
(`model`, `tier`, `cost_usd`, `cache_ttl_assumed`, `bucket_split_repaired`,
`at`). Its purpose is that a re-priced total is not mistaken for an originally
priced one — without it, `rate_missing: false` on a repaired row and on a row
that was never flagged are indistinguishable.

`rate_missing` is cleared **only** when nothing unpriced remains. A row
re-priced for one model while another still has no rate keeps the flag and
keeps the unrepaired id in `rate_missing_models`, because such a row is still
understated.

The summary surfaces it as `totals.rate_backfilled_sessions` (how many source
rows were re-priced) and `totals.rate_backfilled_models` (the sorted distinct
union of the re-priced ids). **Totals only, deliberately** — unlike
`rate_missing_sessions`, this does not propagate into `by_session` /
`by_conversation` / `by_date` / `by_model`. A flagged row makes its grouping's
total a *floor*, which is a property of the slice; a repaired row understates
nothing, so no slice changes. What changes is the provenance of the figure as a
whole — part of it is priced at operator-supplied rates rather than measured.

Two **honest limits** ride on every backfilled figure, and both are properties
of what the stored row retains rather than of the pass — the same stance
`by_date` takes above:

- `cache_ttl_assumed: "5m"` — the row aggregates 5m and 1h cache writes into
  one `cache_creation_input_tokens` tally, so a backfill prices all of them at
  the 5m rate. A session that really used 1h writes stays under-priced by the
  difference.
- `bucket_split_repaired: false` — the row carries per-bucket totals and
  per-model totals but no per-bucket-per-model tokens, so the recovered cost
  cannot be attributed across `main` / `subagent`. `byBucket[*].cost_usd` is
  therefore left as captured; inventing a split would be a worse number, not a
  better one.

Additive per the rule below: absent on every row written before this extension,
which reads as "never re-priced". No version bump, no required field.

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
- [`scripts/cost_summary.py`](../../src/scripts/cost_summary.ts) — implementation.
- [`scripts/cost_by_conversation.py`](../../src/scripts/cost_by_conversation.ts) — narrower per-conversation lens with the same JSONL source.
- [`scripts/telegraph_stats.py`](../../src/scripts/telegraph_stats.ts) — telegraph-only delta lens with the same JSONL source.
