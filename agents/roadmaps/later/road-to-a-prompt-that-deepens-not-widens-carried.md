---
complexity: lightweight
status: later
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-a-prompt-that-deepens-not-widens
entry_condition:
  what: the next run resolves blocker(s) depth-block-waits-on-a-scripted-corpus
  when: whenever the owner takes the next step
  who: agent
review_by: 2027-01-25
estate_growth_exempt: >-
  Owner-chosen archive of road-to-a-prompt-that-deepens-not-widens: its deferred steps wait on owner
  blocker(s) lyra-persona-is-a-taste-decision, depth-block-waits-on-a-scripted-corpus and are parked here instead of left active. The parent
  is archived in the same change, so the active count drops by one.
---
# Road to a prompt that deepens, not widens — carried

> **Source:** carried by the archival sweep on 2026-10-27 from
> [`road-to-a-prompt-that-deepens-not-widens`](../archive/road-to-a-prompt-that-deepens-not-widens.md), which closed every other step.
> Each step below was `[~]` there and is restated verbatim as open work, so
> archiving the parent buried nothing. Blockers the steps name moved with them.

## Goal

Every step road-to-a-prompt-that-deepens-not-widens deferred is either done here or explicitly disposed
of — a step that still cannot run is re-deferred with its reason, never
left to read as finished.

## Phase 1 — Deferred steps carried from road-to-a-prompt-that-deepens-not-widens

- [x] **2.1 The optimizer's Lyra role-play welcome (supplied 1.4).** Done 2026-10-28 per OQ-27 (b): the persona name and the welcome line are gone from both files.
      verify: `git grep -n -w -i lyra -- src` -> /^$/
- [ ] **2.2 Depth corpus with script oracles and pre-registered arms (supplied Phase 0).** <!-- blocked-by: depth-block-waits-on-a-scripted-corpus -->
      verify: a lint fails a corpus prompt without an oracle command.
- [ ] **2.3 Opt-in `depth:` block with witnesses and the deeper-not-bigger invariant (supplied Phase 2).** <!-- blocked-by: depth-block-waits-on-a-scripted-corpus -->
      verify: an invariant test with a positive control that adds a deliverable.
- [ ] **2.4 Instruments and an oracle line on the seven review personas (supplied Phase 3).** <!-- blocked-by: depth-block-waits-on-a-scripted-corpus -->
      verify: a warn-only lint names personas without a runnable instrument.
- [ ] **2.5 Run the arms; the intake oracle runs before the judges (supplied Phases 4–5).** <!-- blocked-by: depth-block-waits-on-a-scripted-corpus -->
      verify: the bench report carries every pre-registered metric.

## Blockers

### blocker: lyra-persona-is-a-taste-decision

- **Status:** resolved — 2026-10-28, OQ-27 answered (b) and applied (2.1).
- **Class:** 3 — owner-reserved taste.
- **Owner:** user — `agents/owner-questions.md` OQ-27.
- **Run:** `grep -n 'OQ-27' agents/owner-questions.md`
- **Blocks:** 2.1.
- **What to do:** answer OQ-27 (options a / b / c) in `agents/owner-questions.md`.
- **Resolved when:** OQ-27 sits under `## Answered`.
- **Recommendation:** keep the name, drop the role-play welcome.
- **If you do nothing:** the welcome stays; nothing else depends on it.

### blocker: depth-block-waits-on-a-scripted-corpus

- **Status:** open — raised 2026-10-27.
- **Class:** 1 — a measurement, no decision owed.
- **Owner:** the next run of this roadmap's carry.
- **Run:** `ls tests/eval/depth-corpus.yaml`
- **Blocks:** 2.2–2.5.
- **What to do:** write `tests/eval/depth-corpus.yaml` — the twenty-prompt corpus whose oracles are scripts, pre-register arms and the flip threshold, then build and bench the block.
- **Resolved when:** the corpus file exists and its lint passes.
- **Recommendation:** start with the ten non-dev prompts; they have no oracle today.
- **If you do nothing:** intake keeps refining for clarity only; Phase 1 still ships.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-27 | reviewer: archive-sweep/auto-carry -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Carried steps stay blocked indefinitely | implementation | A step deferred once for elapsed time or a decision can sit here as long as it sat in the parent | It now counts as open work in the dashboard instead of as 100 %, and its blocker is listed where the estate gates count it | Phase 1 — Deferred steps carried from road-to-a-prompt-that-deepens-not-widens |

## Acceptance Criteria

- [ ] AC-1 — No step carried from `road-to-a-prompt-that-deepens-not-widens` is still `[ ]` without a recorded disposition.
