---
complexity: lightweight
status: later
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-a-return-that-names-its-price
entry_condition:
  what: blocker cache-notice-chunk-ceiling decided (ship the transcript fallback ratified, or cancel it on the calibration evidence), or probe 3 of stubs/road-to-a-limit-the-host-actually-signals observed for blocker resume-binding-ratification
  when: at the next council round on hook budgets, or once the resume probe has an observed session
  who: council for both (reversible, budget-bounded); the owner only if a safety floor were lowered
review_by: 2026-12-15
estate_growth_exempt: >-
  Parked carry of road-to-a-return-that-names-its-price steps 1.2, 2.3, 2.4 and
  AC-3, each waiting on a decision or a governance artifact that cannot be
  produced inside a run (blockers cache-notice-chunk-ceiling,
  resume-binding-ratification). The parent was opened and archived in the same
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

The cold-cache notice reaches users without the status-line tap and on resume, or those paths are cancelled on the calibration evidence. Every step road-to-a-return-that-names-its-price deferred is either done here or explicitly disposed
of — a step that still cannot run is re-deferred with its reason, never
left to read as finished.

## Phase 1 — Deferred steps carried from road-to-a-return-that-names-its-price

- [ ] **1.2 Fallback counters.** `session_eol` counters gain
      `last_response_at`, `last_write_ttl` and `first_context_tokens`.
      verify: `tests/scripts/_lib_session_eol.test.ts` fixture with a 1h write.
      Deferred 2026-11-01, blocked-by: cache-notice-chunk-ceiling — built and
      measured twice — in `session_eol` (+782 B in the dispatch bundle, which
      sits ~281 B under its ceiling) and as a transcript-tail reader in the
      `quota_notice` chunk (23,958 B against 22,800). Both ceilings rise only
      by a ratified edit. The 4.1 replay then showed a transcript-only cold
      reading is wrong on 46 % of returns, so the item needs a decision before
      a raise.
- [ ] **2.3 Resume says it before the first request.** Bind the notice on
      claude `session_start` for `source: resume|fork` and read the host's
      four fields (F4). Manifest edit with its ratification artifact.
      verify: `./scripts-run src/scripts/check_kernel_edit_ratified --base origin/main` -> 0; fixture with `prompt_cache_likely_expired: true` emits the line.
      Deferred 2026-11-01, blocked-by: resume-binding-ratification
- [ ] **2.4 Money only where money is billed.** For `metered`, append the
      repriced cache-write amount; plan logins show tokens only (D5).
      verify: `npx vitest run tests/scripts/quota_notice_hook.test.ts -t metered` -> 0 with a plan case asserting no `$` and a metered case asserting one.
      Deferred 2026-11-01, blocked-by: cache-notice-chunk-ceiling — the price
      parser does not fit the chunk, and the shipped default price table
      carries no current Claude model row, so the amount would read "unpriced"
      anyway. Plan logins show tokens only, as shipped.

## Blockers

### blocker: cache-notice-chunk-ceiling
- **Status:** open — raised 2026-11-01
- **Class:** 3 — decision: whether a transcript-only fallback should exist at all, before any budget raise
- **Run:** `./scripts-run src/scripts/session_eol_report` — the cold-return line is the evidence
- **Owner:** council (a reversible, budget-bounded raise), owner only if a floor is lowered
- **Blocks:** steps 1.2, 2.4 and AC-3
- **Question:** ship the transcript fallback (ratified raise of the `quota_notice` chunk ceiling by ~1.6 KB), or drop it and keep the notice on the host reading?
- **What to do:** decide on `agents/evidence/analysis/cold-return-calibration-2026-11-01.md`; a raise needs a `raise_log` entry in `src/config/hook-bundle-budget.json` and a ratification artifact, since that file is on the gated set.
- **Recommendation:** drop the fallback — 46 % of transcript-detected cold returns still read the cache; recommend the status-line tap instead.
- **If you do nothing:** users without the tap get no cold-return line, as before this change; nothing else waits on it.
- **Resolved when:** the fallback ships ratified, or the item is cancelled with the evidence cited.

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

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-01 | reviewer: archive-sweep/auto-carry -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Carried steps stay blocked indefinitely | implementation | A step deferred once for elapsed time or a decision can sit here as long as it sat in the parent | It now counts as open work in the dashboard instead of as 100 %, and its blocker is listed where the estate gates count it | Phase 1 — Deferred steps carried from road-to-a-return-that-names-its-price |

## Acceptance Criteria

- [ ] AC-3 — Without the tap, 2.1 still fires from the fallback counters.
      Deferred with 1.2, blocked-by: cache-notice-chunk-ceiling
