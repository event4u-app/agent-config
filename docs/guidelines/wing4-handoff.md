# Wing-4 Handoff

Wing-4-specific prose for the four load-bearing senior-skill chains
in the Money / Strategy / Operations cluster. The mechanical contract
— initiator → delegated(input) → output-artifact, lint rules, worktree
boundary — lives in
[`docs/contracts/cross-wing-handoff.md`](../contracts/cross-wing-handoff.md).
The cross-wing routing prose (when to hand off at all, L4 / C8
boundary, decision tree) lives in
[`docs/guidelines/cross-role-handoff.md`](cross-role-handoff.md). The
Wing-3 sibling — chains inside GTM / Growth — lives in
[`docs/guidelines/gtm-handoff.md`](gtm-handoff.md). This guideline
covers **what crosses each Wing-4 boundary**, **what the typed
artifact looks like**, and **who owns the failure mode when the
chain breaks**.

Cycle / dangling / tier-mismatch enforcement is not duplicated here —
`task lint-handoffs` (per cross-wing-handoff § 4) is the mechanical
gate.

## Chain 1 — money → strategy

Three-step chain that turns unit-economics cognition into a
build-buy-partner verdict. Finance cluster owns the first two steps;
the cluster line crosses on the handoff to Strategy.

```
unit-economics (O1)
  → scenario-modeling (O4)
    → build-buy-partner (P1)
```

| Step | Hands off when | Typed artifact crossing the boundary | Failure-mode owner |
|---|---|---|---|
| O1 → O4 | CAC / LTV / contribution-margin / payback-period cognition locked for the segment. | `unit-economics-frame.md` — CAC / LTV ratio, contribution margin, payback band, burn-multiple verdict, segment scope. | O1 owns drift: a margin frame O4 cannot stress-test = O1's unit definition was wrong scope. |
| O4 → P1 | Three-statement scenarios + sensitivity bands + optionality reasoning locked across at least two cases. | `scenario-set.md` — base / upside / downside cases, sensitivity table, decision-relevant variables, optionality cost per case. | O4 owns drift: scenarios without an optionality-cost row force P1 to re-derive build-vs-buy economics. |

P1 self-closes against `build-buy-partner.md` — insource-vs-outsource-
vs-acquire verdict, integration-cost band, dependency-risk score,
exit-cost analysis.

## Chain 2 — strategy → people

Two-step chain that turns a build-buy-partner verdict into an
org-design shape. Strategy cluster ships the verdict; People-Strategy
cluster reads it as input and owns the structure decision.

```
build-buy-partner (P1)
  → org-design (Q1)
```

| Step | Hands off when | Typed artifact crossing the boundary | Failure-mode owner |
|---|---|---|---|
| P1 → Q1 | Insource-vs-outsource verdict + dependency-risk profile + integration-cost band locked. | `build-buy-verdict.md` — verdict (build / buy / partner / acquire), capability scope, dependency-risk score, integration cost, exit cost, optionality preservation note. | P1 owns drift: a verdict without exit-cost reasoning leaves Q1 designing teams against an unowned constraint. |

Q1 self-closes against `org-design-shape.md` — team-shape (functional /
cross-functional / squad), span-of-control band, Conway's-law alignment
note, reorg-cost ledger.

## Chain 3 — people → EM

Two-step chain that specializes a generalized hiring loop for
engineering. People-Strategy cluster owns the generalized cognition;
Engineering-Manager cluster owns the engineering specialization.

```
hiring-loop-design (Q-generalized, composed inside `org-design`)
  → hiring-loop-design × eng-context (S2)
```

| Step | Hands off when | Typed artifact crossing the boundary | Failure-mode owner |
|---|---|---|---|
| Q → S2 | Generalized loop stages + calibration-design + signal-vs-noise audit locked at people-strategy level. | `hiring-loop-shape.md` — stage list, per-stage signal, calibration cadence, bar-raiser logic, signal-vs-noise findings. | Q owns drift: a generalized loop without a calibration cadence forces S2 to invent one for engineering and the cognition diverges from the rest of the org. |

S2 self-closes against `eng-hiring-loop.md` — eng-specific stage
specialization (screen → take-home / system-design / coding /
behavioral / leadership), per-stage rubric, bar-raiser assignments,
candidate-throughput target.

## Chain 4 — finance → GTM

Cross-wing chain — the only Wing-4 chain whose endpoint sits in
Wing 3. Finance owns the **cognition**; RevOps owns the **call**.
Interface-first-stub per iter-2 OQ4: O2-interface ships before the
H10 sibling can start, parallel to O2 implementation.

```
forecasting (O2)
  → forecast-accuracy (H10, Wing 3)
```

| Step | Hands off when | Typed artifact crossing the boundary | Failure-mode owner |
|---|---|---|---|
| O2 → H10 | `forecast-construction-shape` ADR locked: top-down vs bottom-up enum, confidence-band signature, retro-loop signature. | `forecast-band.json` — commit value, best-case value, pipeline value, confidence band, retro signature, construction-shape tag. | **Interface contract owned by O2** (per cross-wing-handoff § 5 / W4 chain): if the ADR drifts, O2 breaks the contract, not H10. Mirrors `gtm-handoff.md` Chain 2 H10 → O2 framing from the Wing-3 side. |

H10's parallel-development rule (starts after O2-interface ≥ 100 %,
runs in parallel with O2 implementation) is recorded in the
`road-to-money-strategy-ops.md` O2 entry, the
`road-to-gtm-and-growth.md` H10 entry, and the cross-wing-handoff
contract — not duplicated here.

## Reading the failure-mode column

The column answers one question: **when a downstream skill cannot
do its job, which upstream skill rewrites its artifact?** The owner
is the **upstream** skill, not the consumer — drift is always a
producer-side fix. This mirrors the W3 sibling and the W4 / W3
forecasting chain in the contract (O2 owns the interface; H10 only
consumes it).

## See also

- [`docs/contracts/cross-wing-handoff.md`](../contracts/cross-wing-handoff.md)
  — typed-handoff mechanical contract; `task lint-handoffs` enforces
  cycles, dangling references, and tier mismatches over the graph.
- [`docs/guidelines/cross-role-handoff.md`](cross-role-handoff.md)
  — when to hand off at all, how to phrase the routing, L4 / C8
  boundary.
- [`docs/guidelines/gtm-handoff.md`](gtm-handoff.md) — Wing-3 sibling
  for the brand → channel, discovery → pipeline, and funnel →
  retention chains.
- [`docs/contracts/context-spine.md`](../contracts/context-spine.md)
  § Wing-4 slots — `fiscal-period`, `org-stage`, `regulatory-regime`;
  every chain step opts into ≥ 1 slot or carries an ADR opt-out.
- [`docs/contracts/adr-wing4-context-spine.md`](../contracts/adr-wing4-context-spine.md)
  — durable record for the Wing-4 slot extension.
- `agents/roadmaps/road-to-money-strategy-ops.md` (archived after
  merge) — the eighteen Wing-4 skills this guideline maps; pending
  skills appear here as backtick slugs until shipped.
