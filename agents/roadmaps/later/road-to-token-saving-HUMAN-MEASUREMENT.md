---
status: later
slug: token-saving-human-measurement
title: "token-saving — human-measurement track: verdict-gated phases split off the autonomous parent"
parent_roadmap: token-saving
---
<!-- check-refs: skip -->

# Road to Token-Saving — Human-Measurement Track

> Split off `road-to-token-saving.md` per the autonomous-mandate master-plan
> council (claude-sonnet-4-5 + gpt-4o, deep, 2026-06-23,
> `agents/runtime/council/responses/master-plan-2026-06-23.json`). The council <!-- council-ref-allowed: predecessor council trace (transient roadmap citation) -->
> defined the autonomous/deferred boundary for the 52-step token-saving roadmap:
> an unattended agent can build the measurement *harness* and the disabled-by-
> default scaffolding, but it **cannot** produce the trustworthy human-judged
> measurement, falsify host non-compliance, or flip the default projection — those
> require a human in the loop. Those verdict-gated phases live here.
>
> **Status `later`:** parked, blocked on the human-run measurement. It resumes the
> moment the operator runs the Phase-0 measurement harness (built in the parent's
> autonomous track) and has real verdicts. Open `[ ]` items are intentionally
> retained — this track is parked whole, not cancelled.

## Why these are NOT autonomous (council ruling)

The headline lever is the **thin projector flip (−46k tok/req)**, which the
package ships **DISABLED** on purpose. Flipping it is gated on:

1. A **length-controlled paired-judge** experiment (pairwise A/B, randomised
   order, human verdicts) proving thin projection does not regress answer
   quality — an agent cannot judge its own output quality credibly.
2. A **host-compliance falsification**: proving every demoted rule still fires
   under the thin projection on a real host — a real-world test, not a self-claim.
3. A **48h opt-in rollout + kill-switch** — a production-shaping rollout decision
   the operator owns.

An agent marking any of these "done" from self-assessment is exactly the
false-"done" failure the master-plan forbade.

## Resume trigger

The operator has run the Phase-0 measurement harness (real tokenizer + golden
set + paired judge + host-compliance probe — built in the parent's autonomous
track) and holds real verdicts. Then flip this roadmap to `ready` and execute.

## Phase H1 — Thin projection flip (parent Phase 4, the −46k lever)

- [ ] Run `task tokensave:falsify` (built in the parent autonomous track) and
  confirm ALL pass: every demoted rule fires under thin projection on the CI
  corpus; the paired judge shows no quality regression; the real-tokenizer
  delta is the claimed saving.
- [ ] Flip the default projection to `thin` behind the tight rollout (48h opt-in
  → default), with the kill-switch armed (rule-firing <100% on the CI corpus →
  instant rollback to `eager-all`).
- [ ] Operator sign-off on the rollout decision (production-shaping; not autonomous).

## Phase H2 — Retire telegraph-speak (parent Phase 6), gated on the measurement

- [ ] Confirm from the Phase-0 real-tokenizer measurement that telegraph-speak is
  net-negative (the D3 premise) BEFORE deleting a shipped rule + its CI gate.
- [ ] On confirmation: delete `src/rules/telegraph-speak.md` + its CI gate, trace
  downstream refs (frugality-charter index, router, projections), changelog note.

## Phase H3 — Condensation ROI decision (parent Phase 7)

- [ ] Measure on the real tokenizer: does skills-condensation save ≥500 tok AND
  stay deterministic AND readable?
- [ ] Decide per the gate and apply (keep, or remove the rule-condensation CI
  machinery if it does not clear the bar) — a measurement-gated decision.

## Phase H4 — Rule-surface audit (parent Phase 9), after thin is proven

- [ ] Only after the thin flip (H1) is proven in production: audit the 50 tier-2
  rules — which genuinely need a router pointer vs could collapse.
- [ ] Move the qualifying rules; re-measure the always-loaded surface against the
  Phase-8 budget linter.

## Acceptance criteria (human-measurement track)

- [ ] Paired-judge experiment run with human verdicts; no quality regression at
  the chosen projection.
- [ ] Host-compliance falsification passed on a real host.
- [ ] Thin flip rolled out with kill-switch, or explicitly decided against with
  the measurement recorded.
- [ ] telegraph-speak / condensation-ROI / rule-surface decisions each backed by
  a real-tokenizer measurement, not self-assessment.

## See also

- `road-to-token-saving.md` — the autonomous parent (measurement harness +
  disabled-by-default scaffolding + RTK wiring + CI linters).
