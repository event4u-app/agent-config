---
complexity: lightweight
status: later
tree_pin: 58d43073b7
execution:
  mode: phase-checkpoints
entry_condition:
  what: >
    A WIP slot is free under the cap of five. Phase 3 additionally waits on
    OQ-31 (a memory shared across providers vs. the ADR-249 floor).
  when: >
    The first run with a free slot after road-to-a-memory-that-arrives closes.
  who: >
    none for Phases 1-2 -- the maintainer moves this file; the owner for Phase 3.
review_by: 2026-12-15
estate_growth_exempt: "+1 later_roadmaps: parked topic T4 of round inbox-2026-10-bi (worker memory); no owner exists for the worker knowledge slice, writer/taint fields or the audience contract."
estate_offset_exempt: "Parked, not active. Owner search at 58d43073b7 (grep -rlF for resolveBundle, composeSpawnBrief, knowledge_refs, memory_signal origin over agents/roadmaps, later, stubs) returned nothing; neighbours own fork economics (later/road-to-a-cold-start-paid-once-carried) and graph memory (stubs/road-to-typed-knowledge-graph-memory)."
relates:
  - slug: road-to-a-cold-start-paid-once-carried
    relation: disjoint
    note: "Owns fork and warm-reuse economics; nothing here re-plans them."
  - slug: road-to-typed-knowledge-graph-memory
    relation: disjoint
    note: "Owns a typed graph store behind its gates."
---
# Road to a memory each worker is handed

> **Source:** `agents/tmp.old/inbox-2026-10-bi/` (topic T4).
> **Arrivals:** 1 — `inbox-2026-10-bi` (2026-10-29). Owner demand: subagents,
> councils and unpaid routes get the shared memory, or a cut of it, and no
> security-critical content reaches an unpaid route.

## Goal

A dispatched worker receives a bounded set of memory references cut for its
audience, and what a worker writes back carries who wrote it. At the pin the
slice helpers (`resolveBundle`, `composeSpawnBrief`) have no production caller
and no spawn template has a knowledge slot.

## Phase 1 — The audience contract

- [ ] **1.1 Audience table.** One table in `subagent-spawn-contract.md`
      (orchestrator / non-fork / fork / judge-seat / unpaid / cheap-paid), cited
      from the council skill's neutrality section; forks get nothing, judges
      facts with provenance, unpaid routes closed-vocabulary conventions only.
      verify: reference check and a test that the council skill links the anchor.
- [ ] **1.2 Knowledge slot in implementer templates.** `{{knowledge_refs}}`,
      labelled as leads, in implementer and researcher templates; absent from
      competitive, debate and adversarial ones.
      verify: `tests/scripts/subagent_prompt_audience.test.ts`.

## Phase 2 — Provenance and a shadow baseline

- [ ] **2.1 `writer` and `taint` on intake.** `memory_signal.ts`: a legacy
      line reads `writer: unknown`; unpaid and council-seat writers are
      refused; an `external_read` taint is excluded from aggregation.
      verify: three red-first unit tests.
- [ ] **2.2 Record-only guard on child writes to `agents/memory/`.** Never
      denies.
      verify: a payload with `agent_id` and a Write produces one record; without
      `agent_id` none.
- [ ] **2.3 Counts-only slice shadow.** At the orchestrator's `Agent`
      pre_tool_use, compute the slice and log `{ref_count, dropped, est_tokens}`;
      deliver nothing.
      verify: a fixture naming two curated paths logs `ref_count: 2` and emits
      no context.

## Phase 3 — Delivery (OQ-31)

- [ ] **3.1 Deliver the slice through the proven SubagentStart channel**, in
      its own concern so the safety-floor constraints budget is never crowded,
      after the shadow has two weeks of counts and OQ-31 is answered.
      verify: a delivery fixture plus the shadow's measured token delta.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-29 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Security-critical memory reaches an unpaid route | product | The owner's own constraint | The audience table lands first; unpaid routes get closed-vocabulary conventions only | Phase 1 — The audience contract |

## Acceptance Criteria

- [ ] AC-1 — Every spawn audience has a stated memory cut, and the templates
      carry it.
- [ ] AC-2 — Worker writes carry a writer, and unpaid writers are refused.
