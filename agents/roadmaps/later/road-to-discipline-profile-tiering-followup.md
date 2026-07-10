---
complexity: lightweight
status: later
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

> **Parked in `later/` — blocked-for-later (2026-07-10).** The council
> follow-up branch has now FIRED: a 2-round debate (claude-sonnet-4-5 + gpt-4o)
> set the disposition to **keep `full` experimental, opt-in only, revisit-if
> drop** (recorded in `docs/benchmark.md` § `full` discipline-tier disposition;
> Council notes below). The only remaining work is the optional graduation
> sweep, which is blocked on an absent open-source-host adapter.
>
> **Resume when:** an open-source-host adapter exists AND the maintainer wants
> the graduation answer (or the recorded revisit-if drop-condition fires).

## Phase 1: Full-tier disposition (carried from parent Phase 5)

- [~] Graduation gate (only if an open-source-host adapter exists and the
      maintainer wants the answer): full sweep on ≥2 weak hosts incl. one
      open-source model; requires significant residual over `essential`
      (p<0.05, Δ>0.1) on tasks where essential does not ceiling. Until run:
      `full` keeps the experimental label everywhere it is documented.
      Optional pre-step (non-gating, from the P2-verdict council): the
      system-surface injection experiment on a non-Claude host.
      <!-- deferred 2026-07-10: no open-source-host adapter exists, so the
      graduation sweep cannot run. The council follow-up below fired the OR
      branch and set the disposition to keep-experimental; this sweep is now the
      recorded revisit-if condition (docs/benchmark.md § full-tier disposition),
      not open work. Resume when an OSS-host adapter exists AND the maintainer
      wants the graduation answer. -->
- [x] If the gate FAILS or is not pursued within a cycle: council follow-up
      on whether `full` is dropped from the enum entirely (gpt-4o's round-2
      dissent position in the original tiering debate).
      <!-- done 2026-07-10: council (claude-sonnet-4-5 + gpt-4o, 2-round debate)
      converged KEEP-AND-RELABEL over drop. Round 1 favoured (B) drop; the
      rebuttal round reversed it — sonnet → (A) keep + honest experimental
      relabel (p=0.37 = absence-of-evidence not evidence-of-absence; removal =
      irreversible breaking change), gpt-4o → (C) keep + gate the recommendation.
      Converged disposition: `full` stays experimental, opt-in only, never a
      recommendation, with a revisit-if DROP condition. Recorded in
      docs/benchmark.md § `full` discipline-tier disposition. -->

## Council notes (2026-07-10, deep 2-round debate)

Members: anthropic/claude-sonnet-4-5 + openai/gpt-4o. Converged on
**keep `full`, relabel honest-experimental, opt-in only, never recommended**,
rejecting the round-1 drop consensus after the rebuttal round. Drop is deferred
behind a falsifiable revisit-if (a high-powered ceiling-adjusted Claude null
`p>0.20 ∧ effect<5%` plus an OSS-host null). Full disposition +
revisit-if: `docs/benchmark.md` § `full` discipline-tier disposition.

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

- [x] `full` is either graduated (evidence), still-labeled experimental with
      a fresh disposition, or removed from the enum — never an unlabeled
      recommendation. Every measurement pinned in `docs/benchmark.md` +
      CLAIMS.
      <!-- met 2026-07-10: still-labeled experimental with a FRESH disposition
      (council keep-and-relabel, opt-in only, revisit-if drop) recorded in
      docs/benchmark.md § `full` discipline-tier disposition. The p=0.37 / n=24
      / P2-null measurements were already pinned in docs/benchmark.md. -->
