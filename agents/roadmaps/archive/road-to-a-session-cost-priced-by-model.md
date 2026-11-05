---
complexity: lightweight
status: ready
tree_pin: 8206cc0274
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Owner search: grep -rlF -e track.mjs -e 'family row' -e family-keyed over agents/roadmaps/*.md, later/ and stubs/ returned only archived roadmaps and road-to-cost-parity-2-state-aware-dispatch, whose 1.5 forbids a fifth price surface and owns none of the existing four's rates. Folding into road-to-episode-finalizer-and-outcome-attribution-v2 was rejected because that file is parked behind a cross-machine ledger this fix does not need; parking this in later/ was rejected because the reader misprices every current session today. Opened, processed and archived in one change, so the active count is unchanged at merge."
---
# Road to a session cost priced by model

> **Source:** `agents/tmp.old/inbox-2026-11-na/` — an owner round on roles, second
> agents and A/B learning, re-verified at `main@8206cc0`. Every other finding of that
> round landed on an existing owner; this is the one defect with no owner.

## The defect

`src/scripts/cost/track.mjs` prices a session by **model family** only
(`modelTier()` → `PRICING.haiku|sonnet|opus`). The family rows carry a former
generation's rates, so every current model is mispriced:

| Served model | Family rate used (in/out $/MTok) | Rate in `internal/bench/pricing.yaml` |
|---|---|---|
| `claude-haiku-4-5` | 0.25 / 1.25 | 1.00 / 5.00 (4× under) |
| `claude-haiku-5-5` | 0.25 / 1.25 | 0.10 / 0.50 (2.5× over) |
| `claude-sonnet-5-5` | 3.00 / 15.00 | 2.00 / 10.00 (1.5× over) |
| `claude-opus-4-6`, `-4-7`, `-4-8` | 15.00 / 75.00 | 5.00 / 25.00 (3× over) |

`pricing.yaml` already carries these per-model rows and says readers that know the
served model id prefer them; `track.mjs` is the session reader every whole-episode
cost argument depends on (the next step on the owner's thread is a usage join over
it, `road-to-episode-finalizer-and-outcome-attribution-v2` 7.2), and it never got them.

## Phase 1 — Price by model id where a row exists

- [x] **1.1** Red first: a test runs `track.mjs` on a one-message fixture per per-model <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/cost/track.mjs -->
  row of `pricing.yaml` (1M input, 1M output tokens) and expects the row's
  `input + output` as the session cost.
  verify: `npx vitest run tests/scripts/cost_track.test.ts` -> /×.*claude-haiku-4-5/ (before 1.2)
- [x] **1.2** `track.mjs` carries the per-model rows beside the family rows and prices a <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/cost/track.mjs -->
  message by the longest model id that the served id equals or extends (a date suffix
  like `-20251001` or a context tag like `[1m]`); anything else keeps the family row.
  The `1h` cache-write rate follows the existing 2× of input. Per-tier and per-model
  aggregation are unchanged.
  verify: `npx vitest run tests/scripts/cost_track.test.ts` -> 0
- [x] **1.3** The test reads the rows from `pricing.yaml`, so a rate bumped there and not <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/cost/track.mjs -->
  in `track.mjs` fails CI instead of drifting (the header of both files asks for the
  mirror by hand today).
  verify: changing one per-model rate in a scratch copy of `pricing.yaml` turns the test red

**Exit:** every model `pricing.yaml` prices by id is priced the same by `track.mjs`.
**Rollback:** revert the two files; the family rows are untouched.

## Not in scope

- A model with no per-model row (Opus 5.5, Sonnet 5.5's long-context rate) keeps its
  family rate. Adding a rate the tree has not sourced would be an invented number.
- `cost-parity-2` 1.5 forbids a fifth price surface; this adds none — it makes an
  existing one agree with another.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-11-06 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Historic totals shift | product | Re-running the reader re-prices old sessions, so stored totals move | The reader is report-only; the change is named in the PR and old rows keep their token counts for a re-price | Phase 1 — Price by model id where a row exists |
| 2 | Prefix match too loose | implementation | `claude-opus-4-6` must not price `claude-opus-4-60` | Match only the exact id or the id followed by `-` or `[`; a test pins the boundary | Phase 1 — Price by model id where a row exists |

## Acceptance Criteria

- Each per-model row of `pricing.yaml` produces its own rate through `track.mjs`.
- A date-suffixed id prices like its base id; an unrelated longer id does not.
- The `rate_missing` behaviour is unchanged.
