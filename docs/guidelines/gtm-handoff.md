# GTM Handoff

Wing-3-specific prose for the three load-bearing senior-skill chains
in the GTM + Growth cluster. The mechanical contract — initiator →
delegated(input) → output-artifact, lint rules, worktree boundary —
lives in [`docs/contracts/cross-wing-handoff.md`](../contracts/cross-wing-handoff.md).
The cross-wing routing prose (when to hand off at all, L4 / C8
boundary, decision tree) lives in
[`docs/guidelines/cross-role-handoff.md`](cross-role-handoff.md).
This guideline covers **what crosses each Wing-3 boundary**, **what
the typed artifact looks like**, and **who owns the failure mode
when the chain breaks**.

Cycle / dangling / tier-mismatch enforcement is not duplicated here —
`task lint-handoffs` (per cross-wing-handoff § 4) is the mechanical
gate.

## Chain 1 — brand → channel

Five-step chain that turns a category point-of-view into a shipped
funnel of channel artifacts. CMO cluster owns every step.

```
positioning (H1)
  → messaging-architecture (H2)
    → gtm-launch (H3)
      → editorial-calendar (H4)
        → content-funnel-design (H5)
```

| Step | Hands off when | Typed artifact crossing the boundary | Failure-mode owner |
|---|---|---|---|
| H1 → H2 | Category framing + opposable-positioning audit locked. | `positioning-statement.md` — "we are X for Y, not Z" + point-of-view paragraph + opposable-positioning matrix. | H1 owns drift: if H2 cannot derive proofs from the statement, H1's POV is too soft. |
| H2 → H3 | Primary message + supporting proofs + audience-by-message matrix locked. | `messaging-stack.md` — primary message, three supporting proofs, audience-message matrix, narrative beats. | H2 owns drift: if H3's wave-by-wave narrative drifts, the proofs were the wrong shape. |
| H3 → H4 | Launch sequencing (alpha → beta → GA) + audience-wave logic locked; engineering-readiness signals attached. | `launch-plan.md` — wave list, narrative beats per wave, dependency map, go / no-go signals. | H3 owns drift: missing engineering-readiness signal = H3 shipped a plan that cannot land. |
| H4 → H5 | Cadence cognition (evergreen vs campaign vs reactive) + beat-mapping locked. | `editorial-calendar.md` — cadence per audience, beat-to-asset map, content-debt ledger. | H4 owns drift: a calendar that does not map beats to funnel stages cannot be designed against. |
| H5 self-closes | Funnel-stage-to-content-shape mapping + conversion-pathway design locked. | `content-funnel.md` — per-stage asset shapes, conversion pathways, leading indicators. | H5 owns drift: any stage without a content shape is a broken funnel hand-back to H4. |

H5 also **composes** `funnel-analysis` (H14, Chain 3) — the funnel
diagnostic feeds the conversion-pathway design without H5 absorbing
funnel-diagnostic cognition.

## Chain 2 — discovery → pipeline

Five-step chain that turns customer research into a forecast-able
pipeline. Spans the Discovery → RevOps boundary inside Wing 3 and
hands the forecast call back to the Wing-4 finance-partner.

```
customer-research (L1, shipped)
  → ideal-customer-profile artifact
    → pipeline-strategy (H8)
      → deal-qualification-meddic (H9)
        → forecast-accuracy (H10) → forecasting (Wing-4 O2)
```

| Step | Hands off when | Typed artifact crossing the boundary | Failure-mode owner |
|---|---|---|---|
| `customer-research` → H8 | Switch-event interviews + JTBD framing complete; ICP synthesized from verbatims. | `icp.md` — segment definition, switch events, JTBD frame, anti-ICP. | `customer-research` owns drift: an ICP without anti-ICP boundaries leaks into H8 stage definitions. |
| H8 → H9 | Stage definitions + conversion-rate targets + coverage reasoning locked. | `pipeline-shape.md` — stage list, per-stage conversion target, coverage ratio, leak map. | H8 owns drift: stages H9 cannot disqualify against = H8 stage definitions were not orthogonal. |
| H9 → H10 | MEDDIC qualification rubric + disqualification heuristics locked. | `qualification-rubric.md` — MEDDIC fields per stage, disqualification triggers, champion-test. | H9 owns drift: forecasts that ignore disqualification heuristics inflate; H9 owns the rubric. |
| H10 → Wing-4 O2 | Forecast call constructed (commit / best-case / pipeline) against the `forecast-construction-shape` ADR. | `forecast-band.json` — commit value, best-case value, pipeline value, confidence band, retro signature. | **Interface contract owned by O2** (per cross-wing-handoff § 5 / W4 chain): if the ADR drifts, O2 breaks the contract, not H10. |

H10's parallel-development rule (starts after O2-interface ≥ 100 %,
runs in parallel with O2 implementation) is recorded in the roadmap
H10 entry and the contract — not duplicated here.

## Chain 3 — funnel → retention

Six-step chain that turns funnel diagnostics into a retention and
expansion system. Growth PM cluster owns the first three steps,
Customer Success cluster owns the last three; the H15 → H12 boundary
crosses the cluster line inside Wing 3.

```
funnel-analysis (H14)
  → activation-design (H16)
    → onboarding-design (H11)
      → retention-loops (H15)
        → churn-prevention (H12)
          → expansion-playbook (H13)
```

| Step | Hands off when | Typed artifact crossing the boundary | Failure-mode owner |
|---|---|---|---|
| H14 → H16 | Funnel-stage diagnostics + leaky-bucket-vs-growth-loop classification + leading-indicator selection locked. | `funnel-diagnostic.md` — per-stage drop-off, loop classification, leading indicators, cohort behavior. | H14 owns drift: an unselected leading indicator leaves H16 without an aha-moment signal. |
| H16 → H11 | Aha-moment definition + activation-event selection + activation-funnel construction locked. | `activation-spec.md` — aha-moment, activation event, activation-funnel stages, leading-vs-lagging indicators. | H16 owns drift: an activation event H11 cannot instrument is the wrong event. |
| H11 → H15 | Time-to-first-value reasoning + milestone design + friction audit locked. | `onboarding-flow.md` — milestone list, time-to-value target, friction-audit findings, drop-off diagnosis. | H11 owns drift: milestones without retention hooks force H15 to re-derive habit cognition. |
| H15 → H12 | Habit-formation reasoning + trigger-action-reward design + loop classification locked. | `retention-loop.md` — trigger / action / reward triple, loop classification, network-vs-single-user signal. | H15 owns drift: a loop that does not surface a health signal leaves H12 without an early warning. |
| H12 → H13 | Health-score signal design + churn-cause classification + early-warning loop locked. | `churn-signals.md` — health-score schema, churn-cause buckets, early-warning thresholds. | H12 owns drift: a health signal H13 cannot read against expansion triggers blocks NRR cognition. Also feeds **back to Wing-4 forecasting** per the cross-skill map. |
| H13 self-closes | Account-expansion patterns + upsell-vs-cross-sell reasoning + NRR cognition locked. | `expansion-playbook.md` — expansion patterns, trigger signals, NRR levers. | H13 owns drift: expansion triggers that ignore churn signals double-count growth. |

## Reading the failure-mode column

The column answers one question: **when a downstream skill cannot
do its job, which upstream skill rewrites its artifact?** The owner
is the **upstream** skill, not the consumer — drift is always a
producer-side fix. This mirrors the W4 / W3 forecasting chain in
the contract (O2 owns the interface; H10 only consumes it).

## See also

- [`docs/contracts/cross-wing-handoff.md`](../contracts/cross-wing-handoff.md)
  — typed-handoff mechanical contract; `task lint-handoffs` enforces
  cycles, dangling references, and tier mismatches over the graph.
- [`docs/guidelines/cross-role-handoff.md`](cross-role-handoff.md)
  — when to hand off at all, how to phrase the routing, L4 / C8
  boundary.
- [`docs/contracts/context-spine.md`](../contracts/context-spine.md)
  § Wing-3 slots — `channel-stage`, `funnel-stage`,
  `customer-segment`; every chain step opts into ≥ 1 slot.
- `agents/roadmaps/` § Block H (archived after merge) — the
  sixteen H-skills this guideline maps; pending skills appear here
  as backtick slugs until shipped.
