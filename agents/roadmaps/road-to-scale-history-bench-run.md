---
complexity: lightweight
status: ready
---

# Road to the scale-history bench run — fire the pre-registered Phase-4 bench

> **Source:** PR #1016 review (maintainer, 2026-07-27) — the
> scale-and-history-discipline roadmap archived with its Phase-4 paid run
> spend-gated; this follow-up keeps that gate VISIBLE on the dashboard
> next to the other benchmark-spend entries instead of becoming a third
> silent "built, never fired" blocker (the launch-announcement pattern).
> Infra is committed and dry-verified: pre-registration
> `internal/bench/corpora/scale-history-PREREG.md`, harness + hardened
> scorer `internal/bench/scale-history/` (`score.ts --dry` runs
> end-to-end; artifact-root confinement + hardenedSpawnEnv + timeout).

## Goal

Run the pre-registered scale-history bench (3 arms × ≥2 model families,
N=16/arm per the registered power analysis) and publish lift OR honest
null. Until published, the packs stay default-off and no marketing claim
ships ("keeps your AI-built app from falling over at 10k rows" is
POST-bench copy, never pre-bench).

## Phase 1 — Run and publish

- [ ] **Fire the paid run** once benchmark-spend-authorization clears:
  arms A/B/C per the prereg, artifacts written under
  `internal/bench/scale-history/artifacts/` (confinement root), manual
  rubric scored blind BEFORE `score.ts` output is viewed.
  *Verify:* per-family results in `internal/bench/reports/`; thresholds
  evaluated exactly as registered (no post-hoc α).
- [ ] **Publish verdict + claims-ledger entry**: lift claim only if the
  registered thresholds clear; otherwise honest null in the house format,
  packs stay default-off, follow-up re-scope recorded.
  *Verify:* claims ledger entry matches the published report; R-A8
  over-application guardrail (>20% distractor queueing = pack design
  finding) reported either way.

## Blockers

### blocker: benchmark-spend-authorization
- **Status:** resolved
- **Owner:** user
- **Resolution (2026-08-14):** **run budget GRANTED in-session**, at the
  pre-registered shape — 3 arms × 16 runs × ≥2 families on the agentic build
  task. The decision half is permanently discharged and needs no re-asking; this
  is the same standing authorization the team-mode Phase-5 bench references.

  **The run was not fired in the granting session, for capacity rather than
  permission.** A paid multi-family agentic sweep is long-running and its results
  need shepherding into the Phase-1 verdict and the claims ledger; starting one
  at the tail of a session that could not supervise it to completion would risk
  spending the grant on a run nobody reads. No dollar figure is asserted here —
  the cost sheet lives in the pre-registration, and inventing a number would be
  worse than pointing at it.

  **PRE-AUTHORIZED — executes without further ask.** The next session with
  capacity renders the estimate from the prereg for the record, fires the run,
  and proceeds to the Phase-1 verdict. No new spend question exists.
- **Blocks:** Phase 1 (both steps) — everything author-able is already
  committed and dry-verified in PR #1016.
- **What to do:**
  1. Approve the run budget in-session (estimate rendered before the
     first call: 3 arms × 16 runs × ≥2 families on the agentic build
     task; same standing authorization the team-mode Phase-5 bench
     waits on).
- **Resolved when:** the user confirms the run budget in-session.
