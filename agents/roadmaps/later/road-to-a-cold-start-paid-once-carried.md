---
complexity: lightweight
status: later
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-a-cold-start-paid-once
entry_condition:
  what: the worker-reuse shadow report returns ready true on a window not used to choose condition (c), blocker worker-reuse-window-not-ready
  when: once a shadow window holds at least one would_resume and 100 Agent calls or two weeks
  who: none until the report reads ready; then an implementer lands the flip with its council ratification
review_by: 2026-11-24
estate_growth_exempt: >-
  Parked carry of road-to-a-cold-start-paid-once step 3.6: its only step waits
  on blocker worker-reuse-window-not-ready, a shadow window that fills with time
  and cannot be produced inside a run (2026-10-25 reading: 96 calls, 0
  would_resume). The parent is archived in the same change, so the active count
  drops by one while the later count rises by one. open_blockers +1: the
  blocker is newly raised for a precondition first measured 2026-10-25 (the
  report passes null measurements to flipReadiness, so ready true is
  unreachable as shipped), not a repaired undercount.
---
# Road to a cold start paid once — carried

> **Source:** carried by the archival sweep on 2026-10-25 from
> [`road-to-a-cold-start-paid-once`](../archive/road-to-a-cold-start-paid-once.md), which closed every other step.
> Each step below was `[~]` there and is restated verbatim as open work, so
> archiving the parent buried nothing. Blockers the steps name moved with them.

## Goal

Every step road-to-a-cold-start-paid-once deferred is either done here or explicitly disposed
of — a step that still cannot run is re-deferred with its reason, never
left to read as finished.

## Phase 1 — Deferred steps carried from road-to-a-cold-start-paid-once

- [ ] **3.6 Flip only under the policy's four conditions** <!-- blocked-by: worker-reuse-window-not-ready -->
      (`concern-activation-policy.md:67-85`), with a council ratification
      artefact and the reverse trigger shipped in the same change. Blocking form:
      deny the `Agent` call with a reason naming the eligible worker. The resume
      half becomes blocking only if 1.5 observed a deny on `SendMessage` being
      honoured; otherwise documentation says the resume count is observed, not
      enforced.
      verify: `ls agents/evidence/ratifications/` -> /worker-reuse-guard-flip/
      Evaluated 2026-10-23, not flipped: `flipReadiness` misses all four conditions (no would-resume; 85 complete calls over 0.02 days). The 1 MiB tail read is indexed (40786bb420). Closes when a window under a decided (c) returns `ready: true`; blocking form, ratification and reverse trigger then land together.
      Re-evaluated 2026-10-25, still not flipped: the live ledger window reads 96 `Agent` calls over 2.4 days, 0 `would_resume`, every call refused `host_resume_unobserved`, `ready: false` on all four conditions. Deferred, not done — see blocker `worker-reuse-window-not-ready`.

## Blockers

### blocker: worker-reuse-window-not-ready
- **Status:** open — raised 2026-10-25; the flip's evidence does not exist yet and cannot be produced inside a run
- **Class:** 1 — mechanical: the window fills with time and traffic; no decision is owed until it reads ready
- **Run:** `./scripts-run src/scripts/worker_reuse_shadow_report <checkout-root>` — prints the window and `flipReadiness`
- **Owner:** implementer
- **Blocks:** step 3.6 only
- **Question:** none. Two preconditions are missing, both outside a single run: (1) a shadow window under a decided condition (c) (D15) that contains at least one `would_resume` — 2026-10-25 reading: 96 calls, 2.4 days, 0 `would_resume`, all refused `host_resume_unobserved`; (2) the report's `main()` and reconstruct path call `flipReadiness` with `false_positive_rate`, `cost_avoided` and `friction` all `null`, so `ready: true` is unreachable from the shipped report until those three measurements are wired in from the 6.2 claims evidence.
- **What to do:** (1) let the window fill and re-run `./scripts-run src/scripts/worker_reuse_shadow_report`; (2) wire the three measurements in `src/scripts/worker_reuse_shadow_report.ts` from `agents/evidence/analysis/warm-worker-claims-2026-10-22.md`'s successor reading; (3) once `ready: true`, land the blocking form, a ratification under `agents/evidence/ratifications/worker-reuse-guard-flip*` and the reverse trigger in one change.
- **Recommendation:** wait; flipping on a null window would deny `Agent` calls on a threshold that never caught a failure.
- **If you do nothing:** the guard stays in shadow, which is the safe state; nothing else waits on it.
- **Resolved when:** the report returns `ready: true` on a window not used to choose condition (c).

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-25 | reviewer: archive-sweep/auto-carry -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Carried steps stay blocked indefinitely | implementation | A step deferred once for elapsed time or a decision can sit here as long as it sat in the parent | It now counts as open work in the dashboard instead of as 100 %, and its blocker is listed where the estate gates count it | Phase 1 — Deferred steps carried from road-to-a-cold-start-paid-once |

## Acceptance Criteria

- [ ] AC-1 — No step carried from `road-to-a-cold-start-paid-once` is still `[ ]` without a recorded disposition.
