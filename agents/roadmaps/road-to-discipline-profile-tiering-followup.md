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

## Acceptance Criteria

- [ ] `full` is either graduated (evidence), still-labeled experimental with
      a fresh disposition, or removed from the enum — never an unlabeled
      recommendation. Every measurement pinned in `docs/benchmark.md` +
      CLAIMS.
