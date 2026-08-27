---
complexity: lightweight
review_by: 2026-11-27
---

# Road to council cost truth — the surface the point fix did not reach — stub

> **Source:** found 2026-08-27 while answering "why does the council cost money
> when it is CLI-first?". It does not. The agent had reported $0.21 across two
> runs by quoting `cost_usd_actual`, a field that prices subscription answers at
> API rates. The reporting was wrong, not the transport.

> **Class:** follow-up to a landed point fix. `sumBillableCost` /
> `isBillableResponse` in `src/scripts/ai_council/pricing.ts` now close the
> aggregation defect, with `tests/scripts/ai_council/billable_cost.test.ts`
> covering both the boolean and the persisted-string form. What is listed here is
> everything that fix deliberately did **not** touch.

## What was fixed, so this stub is not read as still-open

`council_cli.ts` computed `cost_usd_actual` by running `estimate_cost` over every
non-errored response with **no `billable` check**, at three sites. The same run
printed two contradictory lines two apart:

```
council:run · mode=pr · members=2 (billable=0)
  TOTAL:  $0.0000                                        ← pre-run path, filters on billable
council:run · wrote … (estimated $0.0000 / actual $0.1055)  ← post-run path, did not
```

Proven against the two real artefacts after the fix: recorded `0.105525` and
`0.10077`, billable-aware **0** and **0**, both seats `billable=false`
(`claude-pro`, `chatgpt-plus`).

## What remains, and why each was left

### 1. `String(v)` flattens every metadata value — the field-semantics question

`council_cli.ts:_serialise_responses` stringifies **all** metadata with
`String(v)`, so the persisted artefact carries `"billable": "false"`,
`"cli": "true"`, `"billable": "true"`. Consequences:

- `Boolean("false") === true` in JavaScript, so any consumer reading the field
  back with a bare `Boolean()` inverts the answer. `isBillableResponse` now
  coerces defensively, which fixes the reader rather than the writer.
- `response_render.ts:33` still does exactly that bare `Boolean()`. In memory it
  is correct — `_stamp_transport_metadata` stores a real boolean — so this only
  bites on a **replayed or re-read** artefact. Unverified whether any live path
  reaches it; that measurement is step one below.

Left because changing the serialiser changes the shape of every persisted
artefact, which is a contract change for `replay`, `cache_realization_report`
and the airgap golden tests. A defensive reader was the smaller correct move.

### 2. `cache_realization_report.ts:373` sums the same field

`recorded += numOrUndef(data.cost_usd_actual) ?? 0` over historical artefacts.
Every council artefact written before 2026-08-27 carries a subscription-priced
figure there, so the report's "recorded" column systematically overstates.
The fix does not rewrite history and should not — the honest repair is either a
schema version bump the reader can branch on, or a stated caveat in the report.

### 3. `cost_usd_actual` is a misleading field name in a persisted schema

The field now holds spend. It held an API-price valuation. Both are called
`cost_usd_actual` in artefacts a reader cannot distinguish without checking the
write date. Options: a `schema_version` bump, a sibling
`cost_usd_notional` field, or leaving it and documenting the cut-over date.
This is the decision that makes this a stub rather than a second commit.

### 4. No gate asserts the two output lines agree

The defect's whole signature was two contradictory cost lines in one run. A
check that the pre-run `TOTAL:` and the post-run spend figure agree when no
member is billable would have caught it, and nothing does. Cheap, and it belongs
with whatever answers 3.

## Tracks, with what would open each

| Track | Gate that must open first |
|---|---|
| Measure whether any live path reaches `response_render` with deserialised metadata | none — a read, and it decides whether 1 is live or latent |
| Fix the writer instead of the readers (typed metadata, no `String(v)`) | the schema decision in 3, because it changes every artefact's shape |
| `cache_realization_report` honesty | the schema decision in 3 |
| Field rename or sibling field | maintainer decision — a persisted-schema change |
| Cross-check gate on the two cost lines | the field decision, so it checks the right thing |

## What this stub does NOT claim

That any of it should be built now. The user-visible defect — a council that
reported spend it never incurred — is closed. What is left is a persisted-schema
question and one historical report that overstates a column, neither of which
misleads an operator about money in the moment.
