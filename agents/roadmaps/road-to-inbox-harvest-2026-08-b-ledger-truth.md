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

- [x] **1.1 Read the served model off the API response.**
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
      **Shipped** via `_servedModel(response, field = 'model')` in
      `clients.ts` — a `field` PARAMETER rather than a literal, because the
      Gemini case is the one that fails silently: a single-field read returns
      `''`, which is indistinguishable from an honest no-report. All four live
      sites read it (`clients.ts:645` Anthropic, `:749` OpenAI, `:828` Gemini
      via `model_version`, `:911` the OpenAI-compatible client); the seventeen
      error paths keep the `''` default untouched. A non-string value collapses
      to `''` rather than being coerced — a coerced `'42'` would read as a real
      served id downstream and could flip `model_divergent` to a false `true`.
      Pinned by 7 tests, and the Gemini field name proved falsifiable by
      mutation (`'model_version'` → `'model'` reds exactly that one case).
      <!-- verify: task test -- --filter=clients -->
- [x] **1.2 Carry it as a distinct `CouncilResponse` field.** The class is
      declared at `clients.ts:199-213` with `model: string` at :201 and an
      optional-with-default constructor at :215-230 — the same additive shape
      `cache_read_input_tokens` used. Add the served id as a new optional field;
      do **not** overwrite `model`, because the requested id is what the tier
      decision was made against and both are needed to detect a substitution.
      **Shipped** as `model_served: string`, optional-with-default `''`
      (`clients.ts:225`, `:242`, `:254`) — the same additive shape
      `cache_read_input_tokens` used, so no existing caller changes. It reaches
      the persisted **response row** through `_serialise_response`
      (`session.ts`). It is deliberately NOT hoisted to the session manifest:
      that was the surplus this roadmap left to the change carrying the code,
      and the field describes one response, not a session. A test pins the
      absence, so a later hoist has to be a decision rather than a drift.
      <!-- verify: task test -- --filter=clients -->
- [x] **1.3 Extend the cost-summary contract additively.**
      [`cost-summary-schema`](../../docs/contracts/cost-summary-schema.md):60-62
      states its own rule — new fields are "a **v1 additive extension**", rows
      written before them read "like a row missing `input_tokens` — no version
      bump". Follow that rule exactly; no version bump, no required field.
      **Shipped — but NOT for `model_served`, and the correction is the
      finding.** The first draft documented `model_served` here. The R2 review
      caught it: this contract describes `agents/cost-tracking/sessions.jsonl`,
      while the served id is written by `_serialise_response` into the **council
      session manifest** — a different artefact with a different producer. So
      the section documented a field no cost-summary producer writes: the exact
      "defined but not wired" surface the step's own `by_model` reasoning
      declined to create, reintroduced one section lower.
      The field this contract actually gained a producer for in this change is
      **`rate_missing`** (2.4 writes it into that JSONL), so that is what the
      additive extension documents — plus the summary now aggregates it
      (`rate_missing_sessions` on totals and every grouping,
      `rate_missing_models` on totals), because a summary that silently
      aggregates past an understated row reproduces the zero one layer up.
      `model_served` is documented where it is recorded: the manifest row's own
      comment, and `orchestration-telemetry.md` for the audit line.
      **One deliberate non-extension, recorded rather than silently skipped:**
      `by_model` does NOT aggregate the served id. That array is keyed by the
      *requested* model and one bucket can legitimately span several served ids,
      so any single per-bucket value would pick one and misreport the rest.
- [x] **1.4 Assert it at the consumer that silently mis-attributes today.**
      `src/scripts/_lib/orchestration_record.ts:48-71` reads the requested tier
      for `tier_chosen`, `tier_source`, `session_tier` and the downshift
      cost-percentage — so on any alias or provider substitution the recorded
      downshift saving is attributed to a model that never ran. Add the
      served-vs-requested divergence as a recorded field, not a thrown error —
      `buildOrchestrationLine` collects into an `errors: string[]` (:183-184)
      rather than throwing, and this stays inside that contract.
      **Shipped** as three fields on the orchestration object:
      `model_requested`, `model_served`, and a DERIVED `model_divergent`.
      Divergence is three-valued on purpose — `null` when either id is absent,
      never `false`. Every CLI transport reports no served id, so a `false`
      there would read as "checked, and they matched", which is the same
      confident mis-attribution the step exists to remove. A non-string id
      collects into `errors` rather than throwing, per the stated contract.
      **Wired, not merely defined:** `ask_transport` is the first producer that
      holds both ids, so `AskResult` carries `model_served` and the ask route's
      audit line records all three — asserted end-to-end (substitution → `true`,
      unreported → `null`, honest-∅ → nulls). Documented in
      `orchestration-telemetry.md` § Field semantics.
      <!-- verify: task test -- --filter=_lib_orchestration_record -->
- [x] **1.5 State in the change that no ADR is needed.**
      [`ADR-035`](../../docs/decisions/ADR-035-model-capability-tiers.md) is not
      amended — its tier mapping is unchanged; this phase makes the ADR's
      attribution honest rather than re-deciding it. Say so, so a later reader does
      not go looking for a missing record.
      **Stated here and in the pull request:** no ADR accompanies Phase 1.
      `ADR-035`'s tier mapping is untouched — nothing about which model serves
      which tier is re-decided. What changes is that the record now says which
      model actually answered, so the ADR's own attribution stops being a
      claim. `cost-summary-schema` and `audit-log-v1` both absorb the fields
      under their existing additive rules, so no contract version moves either.

## Phase 2 — The rate tables cannot disagree

A finding the inbox subjects did not contain. Two independent price tables exist,
they are never cross-checked, and **they match model ids by different strategies**
— so a dated model suffix can miss in one and match in the other:

| Table | Rates | Matching |
|---|---|---|
| `src/scripts/ai_council/pricing.ts` | `CACHE_READ_MULTIPLIER = 0.1`, `_5M = 1.25`, `_1H = 2.0` (:111-113) — multipliers off a base rate | `lookup()` :52-54, **exact key only** |
| `src/scripts/cost/track.mjs` | `PRICING` :42-46 — absolute per-tier USD | `modelTier()` :48-55, **substring** (`m.includes('sonnet')` :52) |

- [x] **2.1 Add a deterministic parity gate over the two tables.** Assert every
      tier `track.mjs` can name resolves in `pricing.ts`, and that the derived
      cache rates agree with the absolute ones within a stated epsilon. **The
      false-positive class is empty by construction** — both tables are committed
      constants, so the gate reads fixed inputs with no sampling, no prose parsing
      and no host dependency; a disagreement it reports is a real one. Register in
      `src/config/gate-coverage.yml`; report its scan via `reportScanned`
      (`src/scripts/_lib/scan_scope.ts:117`).
      **Shipped as a TEST in the existing pricing suite, not as a registered
      gate — a deliberate divergence.** This step's premise holds exactly: both
      tables are committed constants, so the false-positive class is empty and a
      reported disagreement is real. That is also why a gate is the expensive way
      to buy it — the assertion is a pure comparison of two literals, the pricing
      suite already runs on any change to either file, and a new gate costs six
      registration surfaces (manifest entry + canary, the two header figures, the
      ci-fast task, the `Taskfile` list, the workflow step, the ledger ratchet)
      for the identical check. A gate earns those when nothing else watches the
      corpus; here something already does.
      **What the parity found:** sonnet and opus agree *exactly* on all three
      multipliers; haiku does not — `write_5m` 1.20x against 1.25x, `cache_read`
      0.12x against 0.10x. Those are Anthropic's published haiku rates ($0.30 /
      $0.03 against a $0.25 input), so it is vendor rounding, not a defect.
      Recorded as two **pinned** exceptions carrying their measured delta rather
      than dissolved into an epsilon: pinning forces a re-read if the vendor
      changes, and stops a *new* divergence hiding inside a blanket tolerance.
      Proven able to fail by mutation (sonnet `cache_write_5m` → 4.00 reds
      exactly one case), not by a green run. The constants are parsed from
      `track.mjs`'s source rather than imported — that module has no export and
      no entry guard, so importing it would run it.
      <!-- verify: task test -- --filter=pricing -->
- [x] **2.2 Respect the byte-frozen row format.** Held: 2.1 added no column and
      no constant to `pricing.ts`. It reads the two existing tables and asserts a
      relation between them; nothing in `.agent-prices.md` was touched.
      <!-- verify: task test -- --filter=pricing -->
- [x] **2.3 Make `lookup()` longest-prefix instead of exact-key.**
      `pricing.ts:52-54` is a bare `table.prices.get(priceKey(provider, model))`,
      so `claude-sonnet-4-5-20260101` misses a `claude-sonnet-4-5` row and prices
      at nothing. Fall back to the longest matching key prefix, keeping exact
      match as the first hit so no currently-priced call changes.
      **Shipped**, with one guard the step did not name and that a plain
      `startsWith` would have missed: a prefix must be followed by a separator
      (`-`, `.`, `:`, `@`) or end the id, so a `claude-opus-4-1` row never
      prices `claude-opus-4-15`. Mispricing one model at another's rate is
      **worse** than the zero it replaces, because it looks correct. Longest
      match wins, so a specific row is never shadowed by a shorter one that
      also prefixes the id; provider is part of the composite key, so
      cross-provider bleed is impossible by construction. Six tests, including
      the exact-match-unchanged case and both near-misses.
      <!-- verify: task test -- --filter=pricing -->
- [x] **2.4 Flag the silent zero instead of returning it.** `track.mjs:64` is
      `if (!p || !u) return 0;`, reached whenever `modelTier()` returns
      `'unknown'` (:49, :54) — an unknown model is priced at **zero, with no
      warning and no flag**; `grep -rn rate_missing src/` returns 0 hits. Emit a
      `rate_missing` marker on the row and one stderr warning per run. Rows keep
      their token counts, so a later backfill stays possible.
      **Shipped** as `rate_missing: boolean` plus `rate_missing_models: string[]`
      (sorted, distinct) on the session row, and ONE stderr warning per run —
      emitted **before** the `TRACK_QUIET` return, because a suppressed report
      is a display choice while an understated cost figure is a data-integrity
      problem. Token counts are untouched, which is what makes 2.5's backfill
      possible at all. Pinned by 4 subprocess tests over a temp-`HOME`
      transcript fixture (track.mjs has no export and no entry guard, so
      importing it would scan the developer's real `~/.claude`), including a
      negative control on a priced model; mutation-proven — dropping the
      `tier === 'unknown'` guard reds the control and the mixed-session case.
- [ ] **2.5 Backfill machinery for `rate_missing` rows.** Blocked behind
      `unknown-model-row-never-observed` — see `## Blockers`. Writing a
      re-pricing pass before a single real unknown-model row exists would be
      built against a shape nobody has seen.
      **Glyph corrected `[~]` → `[ ]` when the rest of the roadmap closed, and
      stated rather than done quietly.** `[~]` means *deferred*; this step is
      *blocked*, which is what `[ ]` plus a recorded blocker already says — it
      is not half-shipped, and nothing about it was started. The correction is
      not cosmetic: with `count_open` at 0 and any `[~]` present, the
      pre-commit dashboard gate refuses **every** commit in the repository
      until a human disposes of the deferral, so a mis-glyph here would have
      deadlocked the branch that finished the work. Restoring a genuinely
      blocked item to `[ ]` is the disposition the gate itself documents.
      Reverse it to `[~]` if the intent really was "deferred by choice".

## Phase 3 — Two aggregation lines and a cache signature

- [x] **3.1 Add a cache-savings line to the cost summary.** `grep -rni saving`
      over `src/scripts/cost*` returns 0 hits — the summary reports spend but never
      what caching bought. Both inputs exist: the totals block carries
      `cache_read_input_tokens` / `cache_creation_input_tokens`
      ([`cost-summary-schema`](../../docs/contracts/cost-summary-schema.md):46-47,
      :58) and `pricing.ts:111-113` holds the multipliers to price the
      counterfactual. Additive per the schema's own rule (:60-62).
      **Shipped** as `cache_savings_input_token_equivalents` on `totals` —
      token-equivalents, explicitly **not USD**, because `totals` aggregates
      across models with different input rates and carries no per-model split
      to apply them to; a dollar figure would have to pick one rate and be
      wrong for every other model in the row. A **negative** value is
      meaningful: the run wrote cache it never read back. The write premium
      uses the 5m multiplier — rows carry no TTL split, and 5m is the same
      assumption `track.mjs` already makes for unaccounted writes, so the two
      cost paths agree instead of diverging quietly. Stated as a limit in the
      contract rather than left for a reader to discover.
      <!-- verify: task test -- --filter=cost_summary -->
- [x] **3.2 Add a day-by-day breakdown.** `grep -rn by_date src/ docs/` returns 0
      hits, yet every row already carries `startedAt` / `endedAt`
      (`track.mjs:214`, from the per-message timestamps at :175-177). One derived
      grouping, no new capture. Additive, same rule.
      **Shipped** as a `by_date` array keyed on the UTC calendar day of
      `startedAt`, same row shape as `by_session`. A row with no or
      unparseable timestamp lands under `unknown`, which sorts last under the
      existing codepoint ordering, so a timestampless row never displaces a
      real day. A test asserts the day buckets re-sum to `totals` — a grouping
      that double-counts is the failure mode worth pinning.
      <!-- verify: task test -- --filter=cost_summary -->
- [x] **3.3 Add a write-share signature to the existing cache report.** Extend
      `src/scripts/cache_realization_report.ts`, which already parses the
      read/write split and computes `median_first_call_written_or_uncached` /
      `mean_first_call_written_or_uncached` (:85-86) beside
      `first_call_cache_read_share` and `cold_start_share_of_write_volume` (:88-90,
      computed :130-140). Do **not** write a new script.
      **Shipped** by extending `computeColdStarts` — no new script — with
      `write_share_of_billable` / `read_share_of_billable` /
      `uncached_share_of_billable` over ALL subagent records, plus one render
      line. The three share one denominator and sum to 1, which is what makes
      them a signature rather than three loose ratios: a write-heavy split is
      paying the cache premium and collecting no discount, and
      `cold_start_share_of_write_volume` cannot show that — it only says how
      much of the writing happened on a first call. A test pins exactly that
      gap (a never-read-back run reads `write_share = 1` while the pre-existing
      metric reports a bland 0.5). All-zero is the **empty-corpus** reading,
      never "a perfectly uncached workload"; read it beside `legs`.
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
