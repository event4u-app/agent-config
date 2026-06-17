# RDP trigger-layer eval — first live run (2026-06-16)

Host: `claude-sonnet-4-5` · router: anthropic (240-skill catalogue) · 5 skill
disciplines (the 3 rule disciplines are out of scope per `TRIGGER-WIRING.md`).
Total spend ~$2.01 · 658k input tokens. Raw JSONs in `internal/evals/results/`.

| discipline (skill) | precision | recall | TP/FN | verdict (≥60% target) |
|---|---:|---:|---|---|
| complexity-first-planning | 1.00 | 0.60 | 3/2 | borderline (== threshold) |
| reasoning-orchestrator | 1.00 | 0.20 | 1/4 | **FAIL** |
| prediction-pool-optimizer | 1.00 | 1.00 | 9/0 | ✓ |
| decision-record | 1.00 | 0.40 | 2/3 | **FAIL** |
| verify-completion-evidence | 0.00 | 0.00 | 0/5 | **FAIL (never fires)** |

## Headline finding — precision-perfect, recall-collapse

Precision is 1.00 for every discipline that fires at all (zero false positives —
nothing mis-routes *to* these skills). But **recall collapses for 4/5**: the
skills *under*-fire, often badly. Only `prediction-pool-optimizer` is healthy.

This is not random. The pattern points to a **structural mismatch in the
metric**, not (only) weak descriptions:

- **Meta-disciplines are lenses, not routing destinations.** For a query like
  *"write the migration that drops the legacy accounts table"* the single-best-skill
  router correctly picks a **migration/coding** skill — not `verify-completion-evidence`.
  The verifier / orchestrator / decision disciplines are meant to apply
  *alongside* the task skill, but skill-routing is winner-take-one. So
  "does the query route to skill X?" structurally **under-counts** a lens that
  should co-fire with a concrete task skill.
- **`verify-completion-evidence` 0/0 is the clearest demonstration.** Its
  should-fire queries describe complex *tasks*; they route to task-skills. The
  verify gate fires at *completion-claim* time, not query time — the fixture
  conflated "task that should trip the verifier gate" with "query that routes to
  the verify skill". (Fixture-design error introduced in this same session.)
- **`prediction-pool-optimizer` is the exception because it is a genuinely
  distinct, named capability** (prediction pools / calibration) with no competing
  task-skill — so it routes cleanly (R=1.0).

## What this means for the L8 trigger layer

The trigger-precision-via-skill-routing metric **validly scores only
`prediction-pool-optimizer`** (and, marginally, `complexity-first-planning`).
For `reasoning-orchestrator`, `decision-record`, and `verify-completion-evidence`
the metric mis-frames the discipline — they are gates/lenses applied during task
work, measurable by the **quality layer** (rubric on baseline-vs-treatment
transcripts: *did the discipline shape the work?*), not by skill-routing.

This **extends** `TRIGGER-WIRING.md`: it is not just the 3 rule disciplines that
escape the skill-trigger metric — most of the "skill" disciplines do too. Net:
**1 of 8 RDP disciplines (prediction) is a true routable skill**; the rest are
lenses/gates and belong to the quality layer.

## Caveats (do not over-read)

- N=5 should-fire per discipline (10–14 queries each) — directional, low power.
- The FAILs are **not** evidence the disciplines don't work; they are evidence
  the **trigger metric** doesn't capture lens-disciplines. The real test for
  those is the quality layer.
- Sharper descriptions *might* lift orchestrator/decision recall somewhat, but
  the winner-take-one routing ceiling in a 240-skill catalogue caps how much.
- ~122k input tokens/run is dominated by the 240-skill routing catalogue (the
  cost of the routing prompt), not RDP overhead — irrelevant to the L10 cost
  guard, which measures treatment-vs-baseline *task* token delta.

## Re-run after description sharpening (2026-06-16, +~$0.75)

To separate "weak description" from "structural routing ceiling", the
`reasoning-orchestrator` and `decision-record` descriptions were sharpened with
the missed-case exemplars and re-run:

| discipline | recall before | recall after | precision | read |
|---|---:|---:|---:|---|
| reasoning-orchestrator | 0.20 | **0.20** | 1.0 | sharpening had **zero effect** — identical 4 FN |
| decision-record | 0.40 | **0.60** | 1.0 | sharpening **+0.20** (1 FN fixed) — at threshold |

Decisive: `reasoning-orchestrator` did not move at all (same 4 FN — refactor a
module, investigate flaky multi-service, drive a vague ticket, plan+implement a
migration). Those queries route to concrete task-skills (code-refactoring,
systematic-debugging, migration-architect) no matter how the lens describes
itself — the winner-take-one ceiling, confirmed empirically. `decision-record`
moved up (the explicit "X or Y?" exemplar now fires) but the other two
alternative-choice queries still route elsewhere → it sits at the 0.60 threshold,
partially routable.

**Final trigger-layer picture (post-sharpening):**

| discipline | recall | disposition |
|---|---:|---|
| prediction-pool-optimizer | 1.00 | trigger metric — clean pass |
| complexity-first-planning | 0.60 | trigger metric — borderline, watch |
| decision-record | 0.60 | trigger metric — borderline (sharpening-assisted) |
| reasoning-orchestrator | 0.20 | **quality layer** — lens, sharpening proven not to help |
| verify-completion-evidence | — | **quality layer** — gate, retired from trigger metric |
| grounding / intent / notes_first | — | **quality layer** — rules, never in the trigger metric |

So **3 of 8 disciplines are trigger-measurable** (1 clean + 2 borderline);
**5 of 8 belong to the quality layer**. The L8 "≥60% trigger precision per
discipline" gate applies only to those 3.

## Recommendation

1. Keep `prediction-pool-optimizer` in the trigger metric (it passes cleanly).
2. Move `reasoning-orchestrator`, `decision-record`, `verify-completion-evidence`
   (and the 3 rule disciplines) to the **quality layer** — drop them from the
   skill-trigger precision/recall metric (re-frame, per the finding above).
3. Re-shape the `verify-completion-evidence` fixtures to completion-claim queries
   *only if* it is kept as a routable skill; otherwise retire its triggers.json.
4. The L8 "≥60% trigger precision per discipline" fail-condition should apply
   only to the routable subset; otherwise it fails disciplines for being lenses.
