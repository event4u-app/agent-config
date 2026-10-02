---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-behavior-vocabulary-and-runner-truth
---
# Road to behavior vocabulary and runner truth — carried

> **Source:** carried by the archival sweep on 2026-10-02 from
> [`road-to-behavior-vocabulary-and-runner-truth`](road-to-behavior-vocabulary-and-runner-truth.md), which closed every other step.
> Each step below was `[~]` there and is restated verbatim as open work, so
> archiving the parent buried nothing. Blockers the steps name moved with them.

## Goal

Every step road-to-behavior-vocabulary-and-runner-truth deferred is either done here or explicitly disposed
of — a step that still cannot run is re-deferred with its reason, never
left to read as finished.

## Phase 1 — Deferred steps carried from road-to-behavior-vocabulary-and-runner-truth

- [x] **1.3 Register the canonical spellings.** Settled on 2026-10-02 by running
      the revisit condition rather than by letting the deferral stand. The
      condition had fired; executing it answers the step's question, and the
      answer is that there is nothing left to register.

      **The revisit condition fired.** It read: *a second artefact in `src/`
      states behavior contract or acceptance scenario in its own prose*. A
      second artefact does:
      `src/skills/judge-artifact-completeness/rubrics/ticket-quality-score.json:21`
      states *behavior contract* in its own criterion prose, a different skill
      from the original consumer `test-case-discovery`. So the 2026-10-01
      reasoning — "the terms have exactly one consumer, so the ratchet would buy
      consistency across a set of size one" — no longer describes the tree.

      **Running the registration shows it is a no-op on one term and harmful on
      the other.** `src/config/canonical-terms.yml` already carries
      `canonical: behavior / variant: behaviour`, and
      `lint_canonical_terms`'s `variantRegExp` matches a variant as a whole word
      anywhere in authored prose. Every occurrence of *behaviour contract* in
      `src/` is therefore already counted and already governed by that pair —
      seven occurrences across three files
      (`src/config/assurance-capability-registry.json`,
      `src/scripts/grade_target_readiness.ts`,
      `src/skills/test-case-discovery/evals/triggers.json`). Adding a separate
      `behavior contract` / `behaviour contract` pair would match the same seven
      spans a second time, raising the ratchet count above its 1004 baseline and
      failing the gate for a consistency the tree already has.

      **The second term has no variant to pin.** `acceptance scenario` occurs
      **zero** times in `src/` (`grep -ro 'acceptance scenario[a-z]*' src/ | wc
      -l` -> 0), while `acceptance criteri*` occurs 115 times. There is no
      measured pair, and this file's own § NOT decided entry is the precedent
      for refusing to pick a side to make a table look complete.

      **Disposition:** the vocabulary is pinned, by the pair that was already
      there. Recorded as decision D1 below.
      verify: `grep -c 'canonical: behavior$' src/config/canonical-terms.yml` -> /^1$/

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | No new entry in `canonical-terms.yml`; the vocabulary is pinned by the existing `behavior`/`behaviour` pair | `src/config/canonical-terms.yml` carries the pair; `lint_canonical_terms` matches variants as whole words in any prose, so the seven *behaviour contract* spans are already governed; `acceptance scenario` has zero occurrences in `src/` | a spelling of either term appears in `src/` that the `behavior`/`behaviour` pair does not match, or `acceptance scenario` acquires a measured competing form |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-02 | reviewer: archive-sweep/auto-carry -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Carried steps stay blocked indefinitely | implementation | A step deferred once for elapsed time or a decision can sit here as long as it sat in the parent | It now counts as open work in the dashboard instead of as 100 %, and its blocker is listed where the estate gates count it | Phase 1 — Deferred steps carried from road-to-behavior-vocabulary-and-runner-truth |

## Acceptance Criteria

- [x] AC-1 — No step carried from `road-to-behavior-vocabulary-and-runner-truth` is still `[ ]` without a recorded disposition.
