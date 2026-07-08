---
complexity: lightweight
parent_roadmap: road-to-discipline-profile-tiering
---

# Roadmap: Follow-up to discipline-profile tiering — full-tier disposition

> Decide the `full` tier's fate with evidence: either graduate it through the
> open-source-host gate or drop it from the enum via council follow-up.

## Context

This roadmap collects items deferred from
[`agents/roadmaps/archive/road-to-discipline-profile-tiering.md`](archive/road-to-discipline-profile-tiering.md).
See the parent's archive entry for the original rationale. Standing state:
`full` (~11.7x) is an EXPERIMENTAL opt-in labeled "residual lift over
essential not established (p=0.37, n=24, Haiku 4-5)"; the P2 non-Claude
replication FAILED (gpt-5-mini, `docs/benchmark.md § P2 gate`), which makes
an open-source-host full-tier lift doubly speculative. A non-gating
system-surface experiment (API-loop harness with a true system message on a
non-Claude host) could un-confound the P2 reading and feeds the same gate.

> Blocked until an open-source-host adapter exists AND the maintainer wants
> the graduation answer — or the next cycle's council follow-up on dropping
> `full` fires first. Execution starts when either condition clears.

## Phase 1: Full-tier disposition (carried from parent Phase 5)

- [ ] Graduation gate (only if an open-source-host adapter exists and the
      maintainer wants the answer): full sweep on ≥2 weak hosts incl. one
      open-source model; requires significant residual over `essential`
      (p<0.05, Δ>0.1) on tasks where essential does not ceiling. Until run:
      `full` keeps the experimental label everywhere it is documented.
      Optional pre-step (non-gating, from the P2-verdict council): the
      system-surface injection experiment on a non-Claude host.
- [ ] If the gate FAILS or is not pursued within a cycle: council follow-up
      on whether `full` is dropped from the enum entirely (gpt-4o's round-2
      dissent position in the original tiering debate).

## Notes (added 2026-07-08)

- **Optional, pre-registered covariate analysis** (from the 2026-07-07
  subagent-usage review; council 2026-07-08 folded it here as the bench
  owner): before anyone proposes a task-difficulty gate for the discipline
  lift, run difficulty (step/tool-count) as a covariate over the EXISTING
  n=24/84/90 bench pairs and test whether discipline-Δ correlates with
  difficulty vs trap-family presence. Predicted: null vs difficulty,
  positive vs trap-family — i.e. the family/trigger axis stays the right
  gate and a difficulty gate stays unbuilt. Zero new runs; analysis of
  pinned reports only. Do this only if the difficulty-gate idea resurfaces.

## Acceptance Criteria

- [ ] `full` is either graduated (evidence), still-labeled experimental with
      a fresh disposition, or removed from the enum — never an unlabeled
      recommendation. Every measurement pinned in `docs/benchmark.md` +
      CLAIMS.
