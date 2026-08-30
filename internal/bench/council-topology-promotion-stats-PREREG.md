# Council topology — promotion statistics policy (pre-registration)

Registered 2026-08-31 · owner: maintainer ·
`road-to-inbox-harvest-2026-08-e-council-topology-evidence` step **2.6**
("No promotion from N=1: confidence intervals or explicit variance bands").

**This record is written before any arm has run, and that is the point.** A
variance bar chosen after seeing a result is not a bar. Phase 2's benchmark
harness does not exist yet and step 2.1's family list is not committed, so
nothing here can have been fitted to data — the ordering is checkable in the
git history rather than asserted.

Scope: this file fixes **how a promotion claim must be reported**. It does not
fix *what* is measured (step 2.3's metric set) or *which* families are eligible
(step 2.1). Those are separate pre-registrations and neither is bought by this
one.

## The bar

```
NO TOPOLOGY, SYNTHESIS POLICY, ROUTE, OR STAGE IS PROMOTED ON A SINGLE TRIAL.
EVERY PROMOTION CLAIM CARRIES A TRIAL COUNT AND A BAND, IN THE CLAIM ITSELF.
A RESULT WITHOUT BOTH IS AN OBSERVATION, NEVER A PROMOTION.
```

## What counts as a promotion claim

Any statement that changes what the suite does by default, or that licenses a
later change to do so:

- a topology becoming the default for a task family (Phase 6-8, Phase 13);
- a synthesis policy winning the Phase 5 showdown;
- a stage (ranking, peer critique, synthesis) being credited with an
  improvement under step 2.4's ablation;
- an early stop or depth reduction being enabled under step 13.2's
  non-inferiority clause;
- the learned challenger of Phase 11 clearing step 11.3's Pareto bar.

**Not a promotion claim, and deliberately not gated here:** a published null, a
declared gap, a descriptive count, or a single exploratory run reported as
exploratory. Those are cheap and honest; requiring a band for them would price
honesty out of the run.

## The two mandatory fields

Every promotion claim renders both, adjacent to the claim and not in a
footnote:

| Field | Requirement |
|---|---|
| **trial count** | `n` per arm, stated separately per arm. Errored trials are dropped from **both** arms and the drop asymmetry is reported alongside `n` — an attrition difference is itself a finding. |
| **band** | a 95 % confidence interval where the metric supports one, otherwise an explicit variance band (min / median / max across reruns). "Band unavailable" is a permitted value **only** with the reason named; it blocks promotion but not publication. |

A claim missing either field is not weakened — it is **not a promotion claim**,
and the row is reported as an observation.

## Minimum trial counts — floors, not targets

| Metric class | Floor | Why this number |
|---|---|---|
| Deterministic correctness / executable oracle (step 2.3) | **n ≥ 5 per arm** | The outcome is binary and the run is cheap to repeat; 5 is the smallest count at which a unanimous result is not a coin-flip artefact. |
| Rubric-judged quality | **n ≥ 10 per arm** | Judge noise is the dominant variance term, so the floor sits above the deterministic one. |
| Cost / latency / call count | **n ≥ 5 per arm** | Low-variance instrumented metrics; the floor exists to catch a single anomalous run, not to establish an effect. |

These are **floors on admissibility, not evidence of an effect.** Clearing a
floor permits a promotion claim to be *made*; the band still has to support it.
A floor met with a band spanning zero is a null, and publishing it as one is the
correct outcome.

The numbers are stated defaults, not derived optima, and are declared here so
they cannot be tuned to a result later. *Revisit-if:* a completed Phase 2 arm
shows the rerun-variance figure (step 2.3) is materially larger or smaller than
these floors assume — in which case the floors move **before** the next
promotion round, never during one.

## Statistics

Paired non-parametric tests, matched over the same artefacts. Significance is
two-sided at p < 0.05; a "no significant regression" guard means the test does
not reject in the harmful direction. This matches the convention already
pre-registered in `ab-v2-phase3-PREREG.md` § Binding thresholds rather than
inventing a second house style for the same repository.

**Unmatched runs are inadmissible.** Comparing arms over different artefacts
lets a change in task difficulty pass for a change in topology quality — the
same defect the roadmap's Phase 1B prose already names for the `unparsed`
comparator.

## Failure modes this bar exists to stop

- **The single dazzling run.** One trial where the expensive topology found the
  seeded defect, promoted because the result was legible. n=1 has no band; there
  is nothing to promote on.
- **The silent band.** A trial count in the appendix and a bare percentage in
  the headline. The two fields are required *in the claim* for exactly this
  reason.
- **Asymmetric attrition.** Arm A errors on 4 of 12 hard tasks, arm B on 1, and
  the surviving means are compared as if the populations matched. The drop
  asymmetry is a reported field, not a cleanup step.
- **Floor-as-evidence.** Reading "n ≥ 5 met" as "the effect is real". The floor
  is admissibility; the band is the evidence.
