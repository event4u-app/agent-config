---
complexity: lightweight
status: later
execution:
  mode: phase-checkpoints
entry_condition:
  what: an active roadmap closes, so this one fits under the WIP limit of five
  when: at the next active-roadmap closure
  who: agent
review_by: 2027-01-28
estate_offset_exempt: >-
  Carries the owner's 2026-10-30 answer to OQ-10 of agents/owner-questions.md; no archive
  move is available, and it is parked rather than active because the WIP limit is full.
estate_growth_exempt: Parked carrier of the answered OQ-10; adds one later roadmap, no active one.
---
# Road to skill uplift, measured in stages

> **Source:** OQ-10 of `agents/owner-questions.md`, answered by the owner on
> 2026-10-30: measure in stages. The question, its six arrivals and the pilot
> preconditions are recorded in
> `agents/roadmaps/stubs/road-to-skill-uplift-against-a-no-skill-arm.md`.

## Goal

Answer, for at least one skill, whether invoking it improves the outcome of the
task it is for — against an arm where the skill is unavailable — and publish the
answer whichever way it falls. A run that cannot produce a reading is recorded as
"not measured", never as a result.

## Context

`src/scripts/run_skill_evals.ts` already scaffolds a `baseline` and a
`with-skill` arm, but `_spawn_subagent` throws and every rubric without a live
trace is graded `pass: null`. Most `evals/evals.json` files carry one scenario;
the stub's preconditions ask for at least three, one held out, and for the bench
task-validity gate to cover them.

## Phase 1 — A runner that runs

- [ ] **1.1 Implement `_spawn_subagent` for one host.** One host, a fresh
      session per scenario, the skill made available or withheld per arm.
      verify: a scenario run with a deterministic assertion grades `true` or `false`, never `null`.
- [ ] **1.2 Deterministic checks first.** A judge may only add a reading; it never
      turns a deterministic fail into a pass.
      verify: a test where the judge says pass and the deterministic check fails grades fail.

## Phase 2 — Pre-register, then one skill

- [ ] **2.1 Pre-register before any run.** Choose the pilot skill (one whose job
      is to beat stale model knowledge has the cheapest deterministic check),
      write the hypothesis, the metric (task success; tool calls, tokens, wall
      time and retries recorded alongside), the repetitions per arm and the
      threshold that counts as uplift.
      verify: the pre-registration is committed before the first run's output exists.
- [ ] **2.2 Meet the pilot preconditions.** At least three scenarios, one held
      out, one negative-trigger case; `check_bench_task_validity --gate` passes
      them, and a do-nothing arm passes none.
      verify: the gate run over the pilot scenarios exits 0.
- [ ] **2.3 Run both arms and publish.** Result against the pre-registered
      threshold, either way, with its honesty label.
      verify: the published report carries every pre-registered metric for both arms.

## Phase 3 — Three skills

- [ ] **3.1 Repeat 2.1–2.3 for two more skills.** Kill rule from the stub: no
      measurable advantage at a higher cost means the skill is improved, demoted
      or parked — never that the eval is adjusted.
      verify: three published reports, each against its own pre-registration.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-30 | reviewer: agent/oq-10-carrier -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The threshold moves after the data | product | A threshold chosen after seeing results manufactures the answer | Pre-registration is committed before the first run | Phase 2 — Pre-register, then one skill |
| 2 | Runs cost money and fail midway | implementation | Paid host sessions can stop before a reading exists | A run without a reading is recorded as not measured, and the stage stops there | Phase 1 — A runner that runs |

## Acceptance Criteria

- [ ] AC-1 — At least one skill has a published, pre-registered with/without reading, or a recorded "not measured" with its reason.
