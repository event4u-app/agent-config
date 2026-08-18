---
complexity: lightweight
status: draft
parent_roadmap: road-to-plan-governance-gates
---

# Roadmap: Plan-gates measurement — Stage B threshold + 20-PR report

> Execute Stage B of the two-stage pre-registered measurement protocol for
> the plan-governance gates (parent: plan-governance-gates; protocol:
> `docs/CLAIMS.md` § claim: plan-gates-measurement-protocol) — derive the
> enforced-mode `r2_critical_catch_rate` threshold from the 10-PR advisory
> baseline, freeze it, flip R2 to enforced, and publish the 20-PR report.

> **Trigger (flip to ready when):** `agents/evidence/metrics/gate-metrics.jsonl`
> holds `r2_review` events for **10 gated PRs** (the Stage-A advisory
> window is full). Until then this roadmap stays `status: draft` by design
> — Stage B cannot be executed before the baseline exists (council
> 2026-08-04, anthropic/claude-sonnet-4-5 + openai/gpt-4o, convergent:
> split the now-work from the data-gated work; a draft follow-up carries
> the future obligation instead of a deferred-item archival block).

## Context

- Stage A (protocol) is committed: metric definitions, denominators, the
  10-PR advisory window, cost ceiling `gate_latency_p95 <= 5 min`, alarm
  `honest_null_rate >= 90%` — see
  `docs/CLAIMS.md` § `plan-gates-measurement-protocol` and
  `docs/contracts/plan-review-gates.md` § Advisory window.
- R2 runs `--advisory` in CI until this roadmap's Phase 1 completes.

### Defect to fix BEFORE the enforced flip — the AC extractor can produce nothing, silently

Filed 2026-08-18 from a live R2 run on `road-to-catalogue-host-fit`
(finding 14 of `agents/evidence/reviews/catalogue-host-fit-phase1.findings.md`).
The reviewer reported it unprompted and out of its own scope, because it
degraded that review:

`dispatch_r2_reviewer` wrote a **0-byte** `acceptance-criteria.md` into the
review-input package while the roadmap plainly carried `AC-0` through `AC-3`,
and the manifest recorded `ac_hash` as the SHA-256 of the empty string without
complaint. The review therefore ran with no acceptance criteria and the artefact
recorded that silently — a reviewer cannot check a diff against criteria it was
handed none of.

This is Stage-A-shaped work, not Stage B: it belongs to the advisory window it
is currently corrupting. **An enforced gate whose AC input can be empty is worse
than an advisory one**, because the blocking verdict then rests on an input
nobody supplied. The extractor should fail loudly when a roadmap contains `AC-`
lines and yields none, and the baseline PRs whose packages carry a 0-byte AC file
should be identified before their catch rate is read as a threshold.

## Phase 1: Stage B — derive and freeze the threshold

- [ ] **Step 1:** Compute the observed critical/high catch rate over the
      10 advisory-window PRs from `agents/evidence/metrics/gate-metrics.jsonl`
      (`r2_critical_catch_rate` = share of gated PRs where R2 reported ≥1
      critical/high finding before merge).
- [ ] **Step 2:** Derive the enforced-mode success threshold from that
      baseline, commit it to `docs/CLAIMS.md` (update the
      `plan-gates-measurement-protocol` entry; regen `docs/proof.md` via
      `task build-proof`) — set exactly once, never lowered afterwards.
- [ ] **Step 3:** Flip R2 to enforced: remove `--advisory` from the
      `check_completion_review` invocations (CI workflow + taskfile), per
      `docs/contracts/plan-review-gates.md` § Advisory window.

## Phase 2: 20-PR measurement report

- [ ] **Step 1:** After 20 gated PRs, write the measurement report
      (catch rate vs threshold, `gate_latency_p50/p95` vs the 5-min
      ceiling, `honest_null_rate`, `r2_skip_rate`, `gate_c_bypass_rate`)
      to `agents/evidence/reports/plan-gates-measurement.md` — published
      regardless of outcome; missed thresholds → honest-null publication
      and rework/rollback of the gates, never threshold-lowering.
- [ ] **Step 2:** Run the first quarterly `annotate_r1_outcomes` pass and
      fold `r1_mitigation_hit_rate` into the report.

## Acceptance Criteria

- [ ] The enforced-mode threshold is committed after the 10-PR baseline
      and before the enforced window; it is never lowered afterwards.
- [ ] The 20-PR report exists regardless of outcome.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-04 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Baseline window never fills | product | Few roadmap-completing PRs → the 10-PR window takes months and the advisory mode ossifies | The trigger is event-count-based, not date-based; the parent's metrics bootstrap makes progress visible in one `wc -l` | Phase 1 Step 1 |
| 2 | Threshold gamed at derivation time | implementation | Stage B derives the threshold AFTER seeing the data — cherry-picking risk | Derivation formula + venue pre-registered in Stage A; set-once-never-lowered is part of the committed protocol | Phase 1 Step 2 |
