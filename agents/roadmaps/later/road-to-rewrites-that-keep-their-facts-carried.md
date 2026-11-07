---
complexity: lightweight
status: later
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-rewrites-that-keep-their-facts
entry_condition:
  what: the owner resolves blocker(s) owner-instrument-change, kernel-edit-own-pr
  when: whenever the owner takes the next step
  who: owner
review_by: 2027-02-01
estate_growth_exempt: >-
  Owner-chosen archive of road-to-rewrites-that-keep-their-facts: its deferred steps wait on owner
  blocker(s) owner-instrument-change, kernel-edit-own-pr and are parked here instead of left active. The parent
  is archived in the same change, so the active count drops by one.
---
# Road to rewrites that keep their facts — carried

> **Source:** carried by the archival sweep on 2026-11-03 from
> [`road-to-rewrites-that-keep-their-facts`](../archive/road-to-rewrites-that-keep-their-facts.md), which closed every other step.
> Each step below was `[~]` there and is restated verbatim as open work, so
> archiving the parent buried nothing. Blockers the steps name moved with them.

## Goal

Every step the parent roadmap deferred is either done here or explicitly disposed
of — a step that still cannot run is re-deferred with its reason, never
left to read as finished.

## Phase 1 — Deferred steps carried from road-to-rewrites-that-keep-their-facts

- [ ] **3.4 Corpus repair and claim narrowing.** blocked-by: owner-instrument-change (owner).
      verify: `./scripts-run src/scripts/check_claims` -> 0 after the narrowed row.
       Remove supplied facts from the
      17 after-files as a new epoch, drop "same content" from the judge prompt,
      narrow `humanizer-tell-reduction` to what is measured. Changes the
      instrument behind a backed claim and a judged rerun is billable.
- [ ] **8.2 Prose-fact clause in `ask-when-uncertain`** — a kernel-rule edit
      (own PR, 24 h soak). blocked-by: kernel-edit-own-pr (owner).
      verify: `task lint-skills` -> 0 in that PR.

## Blockers

### blocker: owner-instrument-change
- **Status:** open — raised 2026-11-03
- **Owner:** user
- **Blocks:** step 1.1 only
- **Question:** repair the 17 after-files of `tests/fixtures/ai-tells/` as a new epoch, drop "same content" from the judge prompt and narrow `humanizer-tell-reduction` to what is measured — yes / no? It changes the instrument behind a backed, pre-registered claim, and a judged rerun is billable.
- **Recommendation:** (a) yes — the corpus already fails the skill's own fact check (16 of 20 pairs), so the claim currently rests on an instrument that rewards supplied facts.
- **If you do nothing:** the claim stays broader than its instrument; `check_claims` keeps listing it under the stale-`last_verified` baseline on every run.
- **What to do:** (a) yes — land the corpus epoch under `tests/fixtures/ai-tells/`, drop "same content" from `internal/bench/core/bench_humanizer_eval.ts`, narrow the row in `docs/CLAIMS.md`, then run `./scripts-run internal/bench/core/bench_humanizer_eval --judge --confirm-spend`; (b) no — mark step 1.1 `[-]` with the answer quoted.
- **Resolved when:** the owner answers; on no, step 1.1 becomes `[-]` with the answer quoted.

### blocker: kernel-edit-own-pr
- **Status:** open — raised 2026-11-03
- **Owner:** user
- **Blocks:** step 2.1 only
- **Question:** none — `ask-when-uncertain` is a kernel rule, and its edits ship in their own PR with a 24 h soak (`scope-control` § Kernel-rule edits).
- **Recommendation:** (a) open the PR — the clause closes the prose-fact gap the witness can only detect after the fact.
- **If you do nothing:** facts about people, outcomes or status keep falling under "state the assumption, proceed" in `src/rules/ask-when-uncertain.md`.
- **What to do:** (a) open a separate PR editing `src/rules/ask-when-uncertain.md` with the step 2.1 clause, merge after the 24 h soak; (b) decline — mark step 2.1 `[-]` with the answer quoted.
- **Resolved when:** that PR merges after its soak.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-03 | reviewer: archive-sweep/auto-carry -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Carried steps stay blocked indefinitely | implementation | A step deferred once for elapsed time or a decision can sit here as long as it sat in the parent | It now counts as open work in the dashboard instead of as 100 %, and its blocker is listed where the estate gates count it | Phase 1 — Deferred steps carried from road-to-rewrites-that-keep-their-facts |

## Acceptance Criteria

- [ ] AC-1 — No step carried from `road-to-rewrites-that-keep-their-facts` is still `[ ]` without a recorded disposition.
