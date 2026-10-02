---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-behavior-vocabulary-and-runner-truth
---
# Road to behavior vocabulary and runner truth — carried

> **Source:** carried by the archival sweep on 2026-10-02 from
> [`road-to-behavior-vocabulary-and-runner-truth`](archive/road-to-behavior-vocabulary-and-runner-truth.md), which closed every other step.
> Each step below was `[~]` there and is restated verbatim as open work, so
> archiving the parent buried nothing. Blockers the steps name moved with them.

## Goal

Every step road-to-behavior-vocabulary-and-runner-truth deferred is either done here or explicitly disposed
of — a step that still cannot run is re-deferred with its reason, never
left to read as finished.

## Phase 1 — Deferred steps carried from road-to-behavior-vocabulary-and-runner-truth

- [ ] **1.3 Register the canonical spellings.** Deferred by decision, not by
      omission: the blocker below is **resolved with option (b)** on
      2026-10-01 — the terms stay unregistered for this roadmap and Phase 1
      routes on the vocabulary without pinning its spelling.

      **Evidence (2026-10-01).** `grep -n 'behavior contract'
      src/config/canonical-terms.yml` returns nothing, which is the recorded
      state option (b) asks for rather than a gap. The reasoning is the
      blocker's own and was re-checked rather than inherited: registering a
      term in `canonical-terms.yml` arms `lint_canonical_terms`, which
      ratchets, so every later variant spelling anywhere in the tree becomes a
      build failure — a cost worth paying once a term has several consumers and
      not before. After this roadmap the terms have exactly one consumer
      (`test-case-discovery`), so the ratchet would buy consistency across a
      set of size one. **What a future session needs to close this instead:** a
      second surface that genuinely uses the terms — the stack-and-rig half
      held by `road-to-executable-specification-adapter` is the expected one —
      at which point registering both spellings becomes cheap and the drift
      this defers becomes real. Revisit-if: a second artefact in `src/` states
      *behavior contract* or *acceptance scenario* in its own prose.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-02 | reviewer: archive-sweep/auto-carry -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Carried steps stay blocked indefinitely | implementation | A step deferred once for elapsed time or a decision can sit here as long as it sat in the parent | It now counts as open work in the dashboard instead of as 100 %, and its blocker is listed where the estate gates count it | Phase 1 — Deferred steps carried from road-to-behavior-vocabulary-and-runner-truth |

## Acceptance Criteria

- [ ] AC-1 — No step carried from `road-to-behavior-vocabulary-and-runner-truth` is still `[ ]` without a recorded disposition.
