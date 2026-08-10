---
complexity: lightweight
parent_roadmap: road-to-inbox-harvest-2026-08-b.md
---

# Road to cost-ledger truth

> Make every recorded spend row attribute to the model the provider actually
> served, and priced from a table that cannot silently disagree with its sibling.

> Source (consumed inbox): `agents/tmp.old/ac-cost-ledger-mechanics` and
> `agents/tmp.old/ac-cache-breakpoints` — part of the 2026-08-10 batch triaged by
> [`road-to-inbox-harvest-2026-08-b.md`](road-to-inbox-harvest-2026-08-b.md).

## Context / What is verified

The ledger itself is not missing — it ships under other names
(`agents/cost-tracking/sessions.jsonl`, `src/scripts/cost/track.mjs`,
`src/scripts/cost_summary.ts`, [`cost-summary-schema`](../../docs/contracts/cost-summary-schema.md),
`/cost:report`, `src/scripts/cost/budget.mjs`, `src/config/budget-routing.json`).
What is missing is **truthfulness at two joints**: the model an entry claims, and
the rate it was priced at. Both are live defects with in-tree citations, both are
single-file fixes, and neither needs an ADR. Six proposals are cancelled against a
named citation in `## Cancelled` — the cache half of the batch turned out to be
already-shipped, which is why it contributes one signature step, not a phase.

## Phase 1 — Served-model truth

The single highest-value item in the batch. `grep -rn 'model_served\|model_requested' src/`
returns **0 hits**: nothing anywhere distinguishes the model that was asked for
from the model that answered.

**An implementation of 1.1–1.2 exists and is not yet applied.** It arrived out of
band as a patch (4 files, 7 tests, type-check and lint clean) and its premises were
re-verified independently against this tree: the field at 0 hits, the four live-API
success sites, and `_serialise_response` at `ai_council/session.ts:187`. It is
deliberately **not** carried by the change that authored this roadmap — a
documentation diff does not absorb a behavioural one, and a verified green patch is
not held behind a planning decision either; it lands in its own change. Two things
to settle when it does: it persists the field in the **session manifest** as well as
the response row, which is beyond what 1.1–1.2 specify and adjacent to 1.3 rather
than inside it (an AI-council pass split on whether that surplus is acceptable
coherence or plan drift, so it is the maintainer's call in that change, not here);
and its test run reported a count that is environment-conditional, where the
defensible figure is the **delta of +7** over whatever the local baseline is.

- [ ] **1.1 Read the served model off the API response.**
      `src/scripts/ai_council/clients.ts` has **22** `new CouncilResponse` sites
      (`:584`, `:616`, `:702`, `:719`, `:785`, `:796`, …), and each writes the
      **requested** id through a `model: this.model` assignment (`:545`, `:577`,
      `:586`, `:618`, `:704`, `:721`, `:780`, `:787`, `:798`, … — those are the
      assignment lines, not the constructor lines; an earlier draft of this step
      conflated the two counts). The response object's own model field is read
      nowhere. **Only four are live-API success sites** — `:616` Anthropic,
      `:719` OpenAI, `:796` Gemini, `:878` xAI/Perplexity via the shared
      OpenAI-compatible client; every other site is an error path and correctly
      keeps the default. **The field name is not uniform across providers:**
      Gemini reports it as `model_version`, not `model`, so a literal
      single-field read leaves Gemini silently empty. Read it beside the existing
      `_getattr(response, 'content')` (`:594`). CLI transports carry no
      served-model field at all, so `''` is the honest value there rather than a
      parsed guess.
      <!-- verify: task test -- --filter=clients -->
- [ ] **1.2 Carry it as a distinct `CouncilResponse` field.** The class is
      declared at `clients.ts:199-213` with `model: string` at :201 and an
      optional-with-default constructor at :215-230 — the same additive shape
      `cache_read_input_tokens` used. Add the served id as a new optional field;
      do **not** overwrite `model`, because the requested id is what the tier
      decision was made against and both are needed to detect a substitution.
      <!-- verify: task test -- --filter=clients -->
- [ ] **1.3 Extend the cost-summary contract additively.**
      [`cost-summary-schema`](../../docs/contracts/cost-summary-schema.md):60-62
      states its own rule — new fields are "a **v1 additive extension**", rows
      written before them read "like a row missing `input_tokens` — no version
      bump". Follow that rule exactly; no version bump, no required field.
- [ ] **1.4 Assert it at the consumer that silently mis-attributes today.**
      `src/scripts/_lib/orchestration_record.ts:48-71` reads the requested tier
      for `tier_chosen`, `tier_source`, `session_tier` and the downshift
      cost-percentage — so on any alias or provider substitution the recorded
      downshift saving is attributed to a model that never ran. Add the
      served-vs-requested divergence as a recorded field, not a thrown error —
      `buildOrchestrationLine` collects into an `errors: string[]` (:183-184)
      rather than throwing, and this stays inside that contract.
      <!-- verify: task test -- --filter=_lib_orchestration_record -->
- [ ] **1.5 State in the change that no ADR is needed.**
      [`ADR-035`](../../docs/decisions/ADR-035-model-capability-tiers.md) is not
      amended — its tier mapping is unchanged; this phase makes the ADR's
      attribution honest rather than re-deciding it. Say so, so a later reader does
      not go looking for a missing record.

## Phase 2 — The rate tables cannot disagree

A finding the inbox subjects did not contain. Two independent price tables exist,
they are never cross-checked, and **they match model ids by different strategies**
— so a dated model suffix can miss in one and match in the other:

| Table | Rates | Matching |
|---|---|---|
| `src/scripts/ai_council/pricing.ts` | `CACHE_READ_MULTIPLIER = 0.1`, `_5M = 1.25`, `_1H = 2.0` (:111-113) — multipliers off a base rate | `lookup()` :52-54, **exact key only** |
| `src/scripts/cost/track.mjs` | `PRICING` :42-46 — absolute per-tier USD | `modelTier()` :48-55, **substring** (`m.includes('sonnet')` :52) |

- [ ] **2.1 Add a deterministic parity gate over the two tables.** Assert every
      tier `track.mjs` can name resolves in `pricing.ts`, and that the derived
      cache rates agree with the absolute ones within a stated epsilon. **The
      false-positive class is empty by construction** — both tables are committed
      constants, so the gate reads fixed inputs with no sampling, no prose parsing
      and no host dependency; a disagreement it reports is a real one. Register in
      `src/config/gate-coverage.yml`; report its scan via `reportScanned`
      (`src/scripts/_lib/scan_scope.ts:117`).
      <!-- verify: ./scripts-run src/scripts/lint_price_table_parity -->
- [ ] **2.2 Respect the byte-frozen row format.** `pricing.ts:109` records why the
      multipliers are constants and not columns: the `.agent-prices.md` row format
      "is byte-frozen (see the file header) and downstream tests pin it". Any new
      value this phase needs is a **constant**, never a new column.
      <!-- verify: task test -- --filter=pricing -->
- [ ] **2.3 Make `lookup()` longest-prefix instead of exact-key.**
      `pricing.ts:52-54` is a bare `table.prices.get(priceKey(provider, model))`,
      so `claude-sonnet-4-5-20260101` misses a `claude-sonnet-4-5` row and prices
      at nothing. Fall back to the longest matching key prefix, keeping exact
      match as the first hit so no currently-priced call changes.
      <!-- verify: task test -- --filter=pricing -->
- [ ] **2.4 Flag the silent zero instead of returning it.** `track.mjs:64` is
      `if (!p || !u) return 0;`, reached whenever `modelTier()` returns
      `'unknown'` (:49, :54) — an unknown model is priced at **zero, with no
      warning and no flag**; `grep -rn rate_missing src/` returns 0 hits. Emit a
      `rate_missing` marker on the row and one stderr warning per run. Rows keep
      their token counts, so a later backfill stays possible.
- [~] **2.5 Backfill machinery for `rate_missing` rows.** Deferred behind
      `unknown-model-row-never-observed` — see `## Blockers`. Writing a
      re-pricing pass before a single real unknown-model row exists would be
      built against a shape nobody has seen.

## Phase 3 — Two aggregation lines and a cache signature

- [ ] **3.1 Add a cache-savings line to the cost summary.** `grep -rni saving`
      over `src/scripts/cost*` returns 0 hits — the summary reports spend but never
      what caching bought. Both inputs exist: the totals block carries
      `cache_read_input_tokens` / `cache_creation_input_tokens`
      ([`cost-summary-schema`](../../docs/contracts/cost-summary-schema.md):46-47,
      :58) and `pricing.ts:111-113` holds the multipliers to price the
      counterfactual. Additive per the schema's own rule (:60-62).
      <!-- verify: task test -- --filter=cost_summary -->
- [ ] **3.2 Add a day-by-day breakdown.** `grep -rn by_date src/ docs/` returns 0
      hits, yet every row already carries `startedAt` / `endedAt`
      (`track.mjs:214`, from the per-message timestamps at :175-177). One derived
      grouping, no new capture. Additive, same rule.
      <!-- verify: task test -- --filter=cost_summary -->
- [ ] **3.3 Add a write-share signature to the existing cache report.** Extend
      `src/scripts/cache_realization_report.ts`, which already parses the
      read/write split and computes `median_first_call_written_or_uncached` /
      `mean_first_call_written_or_uncached` (:85-86) beside
      `first_call_cache_read_share` and `cold_start_share_of_write_volume` (:88-90,
      computed :130-140). Do **not** write a new script.
      <!-- verify: task test -- --filter=cache_realization_report -->

## Cancelled — each against a named citation

- [-] **Chokepoint doctrine (instrument the call site, stream the cost).** Never
      true by architecture: this repo does not own the call sites it costs —
      `src/scripts/cost/track.mjs:1-20` reconstructs spend from
      `~/.claude/projects/**/*.jsonl` after the fact — and nothing streams
      (`clients.ts` non-streaming `messages.create`; CLI clients use
      `--print --output-format json`). Both halves have no call site.
- [-] **Statusline "API" tag, 60s aggregation cache, month-over-month delta.** No
      statusline surface exists here to tag: `src/scripts/hooks/session_eol_hook.ts:18-26`
      writes `agents/runtime/state/context-fill.json` as "display substrate for an
      **external** statusline".
- [-] **Spend caps and an alert ladder.** Shipped, and a separate surface:
      `src/scripts/cost/budget.mjs`, `src/config/budget-routing.json`,
      [`budget-routing`](../../docs/contracts/budget-routing.md), 50/75/90/100%
      ladder at [`/cost:report`](../../src/domains/meta/cost/report/command.md):67-71.
      [`ADR-133`](../../docs/decisions/ADR-133-subsystem-freeze-unblock-list.md):26
      rejected a standing WIP cap as "accounting theater for a solo maintainer".
- [-] **Recycling x caching interaction test.**
      [`ai-council-config`](../../docs/contracts/ai-council-config.md):1042-1044 —
      "**Host subagents are unaffected.** This key governs ONLY the council's own
      Anthropic API calls." Recycling lives in `cmd_session_recycle.ts`, **0**
      case-insensitive `cache` hits: no shared path, so the flagged blow-up has no
      call site to test.
- [-] **Cache-TTL extension and pre-warming.**
      [`archive/road-to-cache-economy.md`](archive/road-to-cache-economy.md):53
      measured blanket 1h at **+8.6% (worse)**, head-1h/tail-5m at +1.3% (worse);
      :57 records "98% of cache reuse happens within ~34 seconds". `'5m'` is a
      permanent default with a published falsification condition.
- [-] **Cache-breakpoint placement compiler.** Both breakpoints ship —
      `clients.ts:541-570` puts `cache_control` on the system block and the stable
      user prefix, volatile suffix after it ("The volatile suffix NEVER carries
      cache_control"); :530 "Two breakpoints (≤ the 4 allowed)"; :528-530 records
      the min-cacheable-prefix reasoning. The per-call opt-out is already stronger
      than proposed: `enable_prompt_cache` defaults **false** (:459, rationale
      :445-448).

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-10 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Prefix fallback re-prices a call that priced correctly before | implementation | Making `lookup()` longest-prefix can newly match a key the exact-match path deliberately missed, changing a live billed figure | Keep exact match as the first hit so no currently-resolving call changes path; pin the new fallback with a dated-suffix case in `pricing.test.ts` | Phase 2 — The rate tables cannot disagree |
| 2 | Parity gate lands red on the tree as it stands | implementation | The two tables have never been cross-checked, so the gate may report a real pre-existing disagreement on its first run | Classify every first-run finding before wiring the gate into CI; a genuine disagreement is a Phase 2 fix, not a gate to loosen | Phase 2 — The rate tables cannot disagree |
| 3 | Served-model field read as authoritative for tier decisions | product | A second model id in the record invites a consumer to route on the served id, when the requested id is what the tier decision was made against | Keep `model` as the requested id and document the served field as attribution-only in the schema extension | Phase 1 — Served-model truth |
| 4 | Additive schema fields drift past the additive rule | implementation | Three separate additive extensions (1.3, 3.1, 3.2) touch one contract; one required field or version bump breaks older rows | Cite `cost-summary-schema`:60-62 in each change; all new fields optional with a documented absent-reading | Phase 3 — Two aggregation lines and a cache signature |

## Blockers

### blocker: unknown-model-row-never-observed
- **Status:** open
- **Owner:** maintainer
- **Blocks:** step 2.5 only. Steps 2.1-2.4 are unblocked — 2.4 is what makes an
  unknown-model row detectable in the first place, and Phases 1 and 3 do not
  touch this path.
- **What to do:** after 2.4 ships, wait for the first `rate_missing` row in
  `agents/cost-tracking/sessions.jsonl` and record its actual shape.
- **Resolved when:** at least one real `rate_missing` row exists and its field set
  is written down, so a backfill pass can be built against an observed shape
  rather than a guessed one.
