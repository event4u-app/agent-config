---
complexity: lightweight
status: later
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-a-return-that-names-its-price
entry_condition:
  what: price rows for the current model generation land in the default price table (blocker current-model-price-rows), or probe 3 of stubs/road-to-a-limit-the-host-actually-signals is observed (blocker resume-binding-ratification)
  when: whichever of the two arrives first
  who: an implementer for 2.4 once the rows exist; the council for the 2.3 ratification
review_by: 2026-12-15
estate_growth_exempt: >-
  Parked carry of road-to-a-return-that-names-its-price steps 2.3 and 2.4
  (1.2 and AC-3 cancelled by the council on 2026-11-01), each waiting on an
  artifact that cannot be produced inside a run (blockers
  current-model-price-rows, resume-binding-ratification). The parent was opened and archived in the same
  change, so the active count is unchanged while the later count rises by one.
  open_blockers +2: both newly raised on 2026-11-01 by measured ceilings and a
  gated manifest edit, not repaired undercounts.
---
# Road to a return that names its price — carried

> **Source:** carried by the archival sweep on 2026-11-01 from
> [`road-to-a-return-that-names-its-price`](../archive/road-to-a-return-that-names-its-price.md), which closed every other step.
> Each step below was `[~]` there and is restated verbatim as open work, so
> archiving the parent buried nothing. Blockers the steps name moved with them.

## Goal

The cold-cache notice speaks on resume before the first request, and metered logins see the amount on the status line. Every step road-to-a-return-that-names-its-price deferred is either done here or explicitly disposed
of — a step that still cannot run is re-deferred with its reason, never
left to read as finished.

## Phase 1 — Deferred steps carried from road-to-a-return-that-names-its-price

- [-] **1.2 Fallback counters.** `session_eol` counters gain
      `last_response_at`, `last_write_ttl` and `first_context_tokens`.
      verify: `tests/scripts/_lib_session_eol.test.ts` fixture with a 1h write.
      Deferred 2026-11-01, blocked-by: cache-notice-chunk-ceiling — built and
      measured twice — in `session_eol` (+782 B in the dispatch bundle, which
      sits ~281 B under its ceiling) and as a transcript-tail reader in the
      `quota_notice` chunk (23,958 B against 22,800). Both ceilings rise only
      by a ratified edit. The 4.1 replay then showed a transcript-only cold
      reading is wrong on 46 % of returns, so the item needs a decision before
      a raise.
      Cancelled 2026-11-01 by the council (D1): the transcript is a log, not
      the cache state; no ceiling raise is made for it.
- [ ] **2.3 Resume says it before the first request.** Bind the notice on
      claude `session_start` for `source: resume|fork` and read the host's
      four fields (F4). Manifest edit with its ratification artifact.
      verify: a fixture whose resume payload marks the cache as likely expired emits the line, and `./scripts-run src/scripts/check_kernel_edit_ratified --base origin/main` -> 0
      Deferred 2026-11-01, blocked-by: resume-binding-ratification
- [ ] **2.4 Money only where money is billed — on the status line.** For
      `metered` logins the tap appends the repriced cache-write amount to its
      AC cache segment; the `quota_notice` hook stays token-only and imports
      no pricing (D2). Plan logins show tokens only. The amount has its own
      switch and is suppressed — tokens stay — when the model, billing class
      or write TTL is not a validated combination. Released only when: price
      rows for the current models exist, billing-class detection is tested on
      miscategorised fixtures, the removal trigger is written down, and the
      price-table owner and refresh cadence are named.
      verify: `npx vitest run tests/scripts/statusline_tap.test.ts -t metered` -> 0 with a plan case asserting no `$`, a metered case asserting one, and an unpriced-model case asserting tokens only.
      Deferred 2026-11-01, blocked-by: current-model-price-rows

## Blockers

### blocker: current-model-price-rows
- **Status:** open — raised 2026-11-01 (replaces cache-notice-chunk-ceiling, resolved by D1 and D2)
- **Class:** 1 — mechanical: rows and their validation are effort, not a decision
- **Run:** `grep -n "claude-" src/scripts/ai_council/_default_prices.ts` — today it lists only the 4.x generation
- **Owner:** implementer
- **Blocks:** step 2.4 only
- **Question:** none — which rows, at which published rates, with a named owner and refresh cadence for the table.
- **What to do:** add and source the current-generation rows in `src/scripts/ai_council/_default_prices.ts`, then build 2.4 in the status-line path with its own switch and the suppression rule.
- **Recommendation:** do it together with 2.4, not before; rows nobody reads go stale.
- **If you do nothing:** metered logins see tokens only, the shipped state.
- **Resolved when:** the rows exist with a source and 2.4's verify passes.

### blocker: resume-binding-ratification
- **Status:** open — raised 2026-11-01
- **Class:** 2 — governance: a `hook_manifest.yaml` binding is a gated plumbing edit
- **Run:** `./scripts-run src/scripts/check_kernel_edit_ratified --base origin/main`
- **Owner:** council (provider-diverse ratification, 2 seats per `src/config/ratification-policy.json`)
- **Blocks:** step 2.3 only
- **Question:** bind `quota-notice` on claude `session_start` for `resume|fork`, reading `prompt_cache_likely_expired` and `context_tokens`?
- **What to do:** first let probe 3 in `stubs/road-to-a-limit-the-host-actually-signals` confirm the four fields arrive; then the binding, its fixture and a ratification artifact in one change.
- **Recommendation:** wait for the probe — binding to fields nobody has observed here is the order the manifest refuses.
- **If you do nothing:** a resumed session gets the line with its first prompt instead of before it (2.1).
- **Resolved when:** the binding ships with its ratification artifact.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | council 2026-11-01, two-round debate, anthropic `claude-sonnet-4-5` + openai `codex-default`, converged 2/2; owner asked for the council | Cancel the transcript-only fallback (1.2, AC-3). Keeping it parked "until the TTL can be read" was rejected as illusory: the transcript is a log, not the cache state. | `agents/evidence/analysis/cold-return-calibration-2026-11-01.md` — 46 % of transcript-cold returns still read the cache | the host contract guarantees transcript records determine cache validity, and a replay then shows acceptable false-cold rate against a defined outcome |
| D2 | reversible-technical | same council round, converged 2/2 | The metered amount moves to the status-line tap (not budgeted, already holds model and re-write tokens), decoupled from the hook chunk, behind its own switch and four release conditions (2.4). | `src/scripts/_lib/prompt_cache_reading.ts` holds the snapshot the amount needs; the `quota_notice` chunk sits 268 B under its ceiling | observed use shows the status line misses the moment the user decides |
| D3 | reversible-technical | same council round, a finding of both seats | The `/clear` figure is a start price, never advice to restart: a fresh session may have to rebuild context it lost. The notice wording stays a statement of cost. | council round record of 2026-11-01 (inline here; council artefacts are local-only and pruned) | users act on the figure as advice and report a costly rebuild |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-01 | reviewer: archive-sweep/auto-carry -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Carried steps stay blocked indefinitely | implementation | A step deferred once for elapsed time or a decision can sit here as long as it sat in the parent | It now counts as open work in the dashboard instead of as 100 %, and its blocker is listed where the estate gates count it | Phase 1 — Deferred steps carried from road-to-a-return-that-names-its-price |

## Acceptance Criteria

- [-] AC-3 — Without the tap, 2.1 still fires from the fallback counters.
      Cancelled with 1.2 (D1): without the tap the notice stays silent.
