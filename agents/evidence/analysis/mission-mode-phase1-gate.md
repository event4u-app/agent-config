<!-- analyzed: 2026-06-15 | commit: 57588489 | files: 2 -->
# Mission-Mode Phase 1 — gate decision (G1)

**Date:** 2026-06-15 · **Verdict:** ✅ APPROVE — missions are thin recipes on `/work`.

## The gate question

Can a "mission" (`/mission:upgrade` Laravel X→X+1: analyze→breaking-changes→
plan→branch→change→test→fix→commit, gated, no auto-PR) be expressed as a thin
declarative recipe on the existing `/work` engine, or does it need engine
changes / a control-flow mechanism?

## Evidence (code audit of `/work`, not live-repo)

- `/work` is a gated 8-phase linear dispatch (refine→memory→analyze→plan→
  implement→test→verify→report) via a Python `work_engine`: confidence-band
  gating, halt conditions, persisted `.work-state.json`, exit 0/1/2, **no
  auto-git**.
- `work_engine/orchestration.py` already implements a step-pipeline DSL
  (`${{ inputs.X }}` / `${{ steps.Y.output }}` interpolation + when-guards). No
  loops/branching yet — and missions need none for v1.
- `dependency-upgrade` is stack-agnostic; a mission wraps it with a versionable
  breaking-change catalog (the Source-E-beating differentiator — Source-E has
  no upgrade mission at all).
- Thinnest `/mission:upgrade`: a manifest + a breaking-change YAML catalog,
  driven via `/work` on a provisional `mission/upgrade-…` branch. Rollback =
  git reset/revert — no `.mission-state/` daemon. Honours `no-runtime-boundary`.

## Decision (AI council, claude-sonnet-4-5 + gpt-4o, deep, peer-review, 2026-06-15)

1. **GATE: APPROVE.** A mission IS a thin recipe on `/work` (manifest + existing
   directives + catalog). Single-step missions fit the linear gated model;
   multi-step (10→11→12) = user sequences invocations on a provisional branch.
   **Control-flow DSL stays deferred** (trigger: ≥3 missions need branching).
2. **Code audit suffices for the gate.** With no consumer Laravel repo here, the
   gate is cleared by the design audit + a schema desk-check, NOT a live run.
   Operational validation (running the flagship on a real repo) is Phase 2B.
3. **Phase 2 split — 2A (infrastructure, shipped now) vs 2B (content, deferred):**
   - **2A (this pass):** mission-manifest schema + catalog JSONSchema (command
     safe-prefix allowlist = the security gate, no separate audit) + a MINIMAL
     5-entry proof catalog (proves schema expressiveness) + `lint_missions.py`
     + tests + the `/mission:upgrade` command spec + single-mission-per-branch
     guard. **Rationale:** if the catalog schema is wrong, learn it in 2A before
     writing 200 lines of unusable YAML.
   - **2B (deferred):** the full Laravel 10→11 breaking-change catalog (all N
     entries) — after the infrastructure is validated against a live repo.
4. **Phase 3 (mission catalogue: phpstan-raise, n+1-audit, pest-migrate,
   fat-controller, dead-code) — deferred** until the flagship infrastructure is
   proven operationally (council: "ship ONE mission's infrastructure, validate,
   then the catalogue").

## What shipped this pass (Phase 0 + 1 + 2A)

- Phase 0: `docs/contracts/no-runtime-boundary.md`, `mission.schema.json`,
  ADR-097 (trusted-mission vs user-recipe privilege split).
- Phase 1: this gate decision.
- Phase 2A: `mission-catalog.schema.json`, `src/missions/upgrade/` (manifest +
  5-entry proof catalog), `lint_missions.py` + tests, `/mission:upgrade` command.

## Deferred (trigger-gated)

- **2B — full breaking-change catalog content.** Trigger: a consumer Laravel
  repo validates the 2A infrastructure end-to-end.
- **Phase 3 — mission catalogue (5 missions).** Trigger: the flagship upgrade
  mission is proven operationally on a real repo.
- **Control-flow DSL.** Trigger: ≥3 missions need branching a linear manifest
  cannot express.
