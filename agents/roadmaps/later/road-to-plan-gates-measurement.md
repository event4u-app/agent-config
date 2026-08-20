---
complexity: lightweight
status: later
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
> window is full). Stage B cannot be executed before the baseline exists
> (council 2026-08-04, anthropic/claude-sonnet-4-5 + openai/gpt-4o,
> convergent: split the now-work from the data-gated work; a draft follow-up
> carries the future obligation instead of a deferred-item archival block).
> **Amended 2026-08-20:** this sentence used to read "until then this roadmap
> stays `status: draft` by design". The disposition is now `status: later` and
> the file is parked in `later/` — the same intent (do not execute before the
> baseline) expressed through the repository's purpose-built home for work
> gated on an external trigger, rather than through a draft that the dashboard
> silently omits. The trigger itself is unchanged.

> **Parked in `later/` (2026-08-20).** Parked **whole** — not executed, not
> deleted, not cancelled. Every open `[ ]` item is intentionally kept open and
> every phase is intact; the roadmap resumes unchanged when its trigger fires.
> **Owner:** the plan-governance-gates track (parent roadmap:
> `road-to-plan-governance-gates`).
>
> **Blocked until / Resume when:** `agents/evidence/metrics/gate-metrics.jsonl`
> carries **at least 10 `r2_review` events** (Stage B); Phase 2 additionally
> needs 20.
> **Probe:** `grep --line-number 'r2_review' agents/evidence/metrics/gate-metrics.jsonl | wc -l`
> — the bar is that count reaching 10. **Measured at parking time: 0**, over a
> file that is one line long and whose single line is the
> `gate_metrics_initialized` record of 2026-08-04.
> **Why parked rather than executed:** the trigger is an external event count
> that fires on its own as gated PRs merge — no decision, no human input and no
> work inside this roadmap can advance it. Executing anything now would mean
> deriving from zero observations; see § Outcome.

## Outcome

**Outcome state: `transferred`.** Nothing in this roadmap was satisfied. All
five steps and both acceptance criteria are open, and the Ready-check table
below records the measured trigger state (0 of 10) so a future reader can tell
movement from noise rather than re-deriving it.

Why nothing was executed, rather than partially executed: Phase 1 Step 2 commits
to a threshold that is **set exactly once and never lowered**. Deriving that
value from zero observations is precisely the failure this roadmap's own Risk 2
names — "Stage B derives the threshold AFTER seeing the data — cherry-picking
risk" — in its most extreme form, because a threshold fitted to an empty sample
is fitted to nothing at all and yet becomes permanent. Steps 1, 3 and both
Phase 2 steps are each downstream of that value or of the same empty event
stream. A partial execution here would not be progress; it would be an
irreversible commitment dressed as one.

Framework of record for this disposition:
`agents/evidence/council/drain-blocker-dispositions-a.md` <!-- ref-ignore -->
(present on `origin/drain/council-records`, PR #1463; not yet on `main`, which is
why the reference carries the marker).

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

#### Status 2026-08-20 — the R2 half is fixed; one instance of the same wrong construct is still live in R1

Re-checked while screening this roadmap for executable work.

**Fixed, on the R2 side.** `dispatch_r2_reviewer.extractAcceptanceCriteria`
(`src/scripts/dispatch_r2_reviewer.ts:491`) now recognises both declaration
forms — an `## Acceptance criteria` heading matched case-insensitively and
without an end anchor (`:508`), and inline `- **AC-n:**` bullets with their
continuation lines (`:560`). The silent-empty case is loud where it matters: the
prompt line at `:736` states outright that nothing could be extracted, names both
recognised forms, and tells the reviewer to open the roadmap and decide which of
the two causes applies. A real-tree test asserts which roadmaps are blind
(`tests/scripts/dispatch_r2_reviewer.test.ts:1167`). Nothing further is owed
here.

**Still live, on the R1 side — the same construct, a different gate.**
`lint_plan_risk_register.extractFeatures` restates the matcher instead of
sharing it, and its copy carries both of the defects the R2 extractor already
removed:

```
src/scripts/lint_plan_risk_register.ts:118
    if (/^##\s+Acceptance Criteria\s*$/.test(entry.line)) {
```

Case-sensitive and end-anchored. Measured **by hand** over the 35 active
roadmaps on 2026-08-20 — deliberately not with this script, since its matcher is
the artefact under measurement:

| Declaration form | Roadmaps | Seen by `lint_plan_risk_register` |
|---|---|---|
| `## Acceptance Criteria` (capital C) | 13 | yes |
| `## Acceptance criteria` (lowercase c) | 8 | **no** |
| inline `- **AC-n:**`, no heading | 4 | **no** |
| declares no criteria | 10 | n/a |

So it sees **13 of the 25** roadmaps that declare acceptance criteria. For the
other 12 `acBody` stays `''`, `acHash` is the sha256 of the empty string, and any
edit to those roadmaps' acceptance criteria is invisible to the contract § 3
substantial-change trigger — the check passes because it extracted nothing. The
two heading spellings never co-occur (0 of 35 carry both), and no roadmap carries
more than one AC heading, so the fix is a recognition change and not a precedence
question.

Why this is worth recording next to the R2 defect rather than filed elsewhere:
it is the same looks-like-success shape, and the R2 extractor's own header warns
about exactly this ("a divergence between the two would silently re-break the
gate") for its other consumer while this third consumer diverged unnoticed. It is
untested in both directions — `tests/scripts/lint_plan_risk_register.test.ts`
exercises only the capital-C spelling, which is why the R2 fix of 2026-08-09 did
not travel.

**Not fixed here, and the reason is measured, not cautionary.** The one-line
change (matcher → `/^##\s+acceptance criteria\b/i`, keeping the existing body
walk and the checkbox-state normalisation that contract § 3 requires) was applied
and run. It reveals a real previously-hidden violation and therefore reds the
gate:

```
❌  1 Risk-Register violation(s):
  agents/roadmaps/road-to-solution-minimalism.md:1 — missing_register
    │ no `## Risk Register` section and the plan changed substantially since
    │ the activation date 2026-08-04 — the grandfather exemption is lifted
```

`lint_plan_risk_register` goes exit 0 → exit 1. The verdict is correct — that
roadmap's criteria did change and the exemption should have lifted — but clearing
it means authoring a Risk Register on an unrelated roadmap, which is the
agent-written pro-forma register that contract § 1 names as the Risk-4
gate-fatigue failure. The change therefore cannot verify in its own commit, so it
was reverted rather than shipped.

**What closes this:** the matcher fix plus a decision on
`road-to-solution-minimalism` (register authored by its owner, or the finding
baselined the way `lint_roadmap_blockers:decidability` baselines revealed debt),
taken as one change that is about R1 rather than about this roadmap. Reusing the
R2 extractor wholesale is **not** the fix: it keeps the heading line and does not
normalise checkbox state, so importing it would make every `[ ]`→`[x]` flip a
substantial change, which contract § 3 lists under "Never substantial".

## Phase 1: Stage B — derive and freeze the threshold

- [ ] **Step 1:** Compute the observed critical/high catch rate over the
      10 advisory-window PRs from `agents/evidence/metrics/gate-metrics.jsonl`
      (`r2_critical_catch_rate` = share of gated PRs where R2 reported ≥1
      critical/high finding before merge).
      <!-- verified 2026-08-20: NOT DONE — no baseline to compute over. The
      whole of `agents/evidence/metrics/gate-metrics.jsonl` is 1 line
      (`wc -l` = 1) and that line is the `gate_metrics_initialized` record
      of 2026-08-04; `grep --line-number 'r2_review'` over the file returns
      zero matches. Advisory window: 0 of 10 gated PRs. Not cancelled —
      awaiting the baseline named in this roadmap's own trigger. -->
- [ ] **Step 2:** Derive the enforced-mode success threshold from that
      baseline, commit it to `docs/CLAIMS.md` (update the
      `plan-gates-measurement-protocol` entry; regen `docs/proof.md` via
      `task build-proof`) — set exactly once, never lowered afterwards.
      <!-- verified 2026-08-20: NOT DONE — strictly downstream of Step 1.
      The protocol pre-registers derivation from a 10-PR baseline and
      set-once-never-lowered; deriving a threshold from 0 observations is
      the cherry-picking Risk 2 of this roadmap names, and a set-once value
      cannot be corrected afterwards. -->
- [ ] **Step 3:** Flip R2 to enforced: remove `--advisory` from the
      `check_completion_review` invocations (CI workflow + taskfile), per
      `docs/contracts/plan-review-gates.md` § Advisory window.
      <!-- verified 2026-08-20: DELIBERATELY NOT DONE. The edit is
      mechanical and this environment could make it, so what is missing is
      not capability but the threshold: enforcing before Step 2 exists
      inverts the pre-registered order (baseline -> threshold -> enforce)
      and would produce a blocking verdict with no committed success
      criterion behind it. Left advisory on purpose. -->

## Phase 2: 20-PR measurement report

- [ ] **Step 1:** After 20 gated PRs, write the measurement report
      (catch rate vs threshold, `gate_latency_p50/p95` vs the 5-min
      ceiling, `honest_null_rate`, `r2_skip_rate`, `gate_c_bypass_rate`)
      to `agents/evidence/reports/plan-gates-measurement.md` <!-- ref-ignore --> — published
      regardless of outcome; missed thresholds → honest-null publication
      and rework/rollback of the gates, never threshold-lowering.
      <!-- verified 2026-08-20: NOT DONE — needs 20 gated PRs; the metrics
      file holds 0 `r2_review` events (see Phase 1 Step 1). All five
      reported quantities are functions of that empty event stream, so the
      report would have no denominator, which is not the same thing as a
      null result. -->
- [ ] **Step 2:** Run the first quarterly `annotate_r1_outcomes` pass and
      fold `r1_mitigation_hit_rate` into the report.
      <!-- verified 2026-08-20: NOT DONE — two independent blockers.
      (a) The pass is human judgement and refuses non-interactive use:
      `./scripts-run src/scripts/annotate_r1_outcomes` prints
      "annotate_r1_outcomes needs an interactive terminal (stdin is not a
      TTY). Use --list for the read-only pending inventory." What is
      missing is a human at a TTY to rule on each mitigation; `--list` does
      run and reports 352 un-annotated mitigations in archived roadmaps.
      (b) There is no report to fold the rate into (Phase 2 Step 1). -->

## Acceptance Criteria

- [ ] The enforced-mode threshold is committed after the 10-PR baseline
      and before the enforced window; it is never lowered afterwards.
      <!-- verified 2026-08-20: NOT MET, and deliberately left unmet — the
      10-PR baseline does not exist (0 of 10), so committing a threshold
      now would violate the ordering this criterion states. -->
- [ ] The 20-PR report exists regardless of outcome.
      <!-- verified 2026-08-20: NOT MET — 0 of 20 gated PRs recorded.
      "Regardless of outcome" governs a measured window; it does not make a
      report over zero observations publishable. -->

## Ready check — the measured state of the trigger

<!-- Recorded 2026-08-20 so the next reader does not repeat the measurement. -->

| Trigger input | Required | Observed 2026-08-20 | Command |
|---|---|---|---|
| `r2_review` events in `gate-metrics.jsonl` | 10 (Stage B), 20 (Phase 2) | 0 | `grep --line-number 'r2_review' agents/evidence/metrics/gate-metrics.jsonl` |
| Lines in `gate-metrics.jsonl` | — | 1 (`gate_metrics_initialized`, 2026-08-04) | `wc -l agents/evidence/metrics/gate-metrics.jsonl` |
| R2 mode in CI | `--advisory` until Phase 1 completes | still `--advisory` | Phase 1 Step 3, deliberately not flipped |

<!-- decision 2026-08-20: `status:` is `later`, not `draft` and not `ready`.
Superseded an earlier decision in this same run to keep it `draft`: that reading
was correct that the work must not execute, but wrong about the disposition. Work
gated on an external event count that fires on its own is parked, not drafted --
`agents/roadmaps/later/README.md` defines exactly this case ("gated on an
external trigger ... they resume when the trigger fires") and both dispositions
are equally excluded from the dashboard, so `later/` costs nothing extra and
carries a resume condition the contract enforces. `ready` remains wrong: no work
completed, and it would pull the file into the gate R1 corpus, which reported it
`draft-exempt` before the park. -->

<!-- decision 2026-08-20: the seven boxes were reverted from `[-]` back to `[ ]`
as part of the park. `[-]` reads as cancelled, and nothing here is cancelled --
`later/README.md` requires open items be "kept open" and
`road-to-contract-integrity` states the reason for the identical case ("parked
whole, not dropped"). Every `verified 2026-08-20:` evidence comment is retained
unchanged: the measurement of why each step could not run today stays true and
is the thing a future reader needs. -->

<!-- decision 2026-08-20: the R1 matcher defect recorded in Context was measured
and reported, NOT fixed in this run. The one-line fix was written and its blast
radius measured: it lifts the grandfather exemption on
`road-to-solution-minimalism.md`, turning `lint_plan_risk_register` from exit 0
into exit 1 with `missing_register`. Clearing that means authoring a Risk
Register on an unrelated roadmap — the pro-forma-register failure contract § 1
explicitly warns against — so the change does not verify in its own commit and
falls outside the fix-now tier. Reverted; the finding is recorded with its
measurement so the fix can be taken as its own change. -->

<!-- decision 2026-08-20: the number used for that measurement is the hand count
over this tree (13 of 25), never a figure produced by `lint_plan_risk_register`
itself. That script's matcher IS the artefact under measurement, so a count
derived from it would be the matcher grading its own coverage — the
self-measurement failure its R2 sibling already recorded twice. -->

<!-- decision 2026-08-20: the finding is recorded as Context prose rather than as
a `### blocker:` entry. A new open blocker increments both the
`lint_roadmap_blockers:decidability` population and the estate-ratchet JSON,
which are baselined counters — reddening two ratchets to file a note is a worse
trade than extending the section this roadmap already dedicates to this exact
defect class. -->

<!-- decision 2026-08-20: no event was appended to
`agents/evidence/metrics/gate-metrics.jsonl` for this run. Nothing gated ran, so
any event would be a fabricated observation in the very file whose emptiness is
the finding. -->

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-04 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Baseline window never fills | product | Few roadmap-completing PRs → the 10-PR window takes months and the advisory mode ossifies | The trigger is event-count-based, not date-based; the parent's metrics bootstrap makes progress visible in one `wc -l` | Phase 1 Step 1 |
| 2 | Threshold gamed at derivation time | implementation | Stage B derives the threshold AFTER seeing the data — cherry-picking risk | Derivation formula + venue pre-registered in Stage A; set-once-never-lowered is part of the committed protocol | Phase 1 Step 2 |
