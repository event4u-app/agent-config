# RDP L6 — larger-N re-run + gate-time validation → keep-scoped (2026-06-22)

Settles `road-to-rdp-frontier-polish` Phase 1: the pre-registered larger-N L6
re-run (the N=5 run was too thin to settle), an independent model rater, and the
gate-time classification validation the council required before "keep-scoped"
could be called implementable.

## Runs

- Capture: `rdp_quality_eval.ts --mode l6` (TypeScript port — the Python harness
  was removed in the py2ts teardown; this calls the Messages API via `fetch`, no
  SDK dependency). 16 slots × distributed/orchestrated, standard host
  (`claude-haiku-4-5`), spend $0.75.
- **Rater 2 = independent model** (`claude-sonnet-4-5` scoring each transcript
  0–3 × 4 dims) — addresses the single-rater caveat from the 2026-06-17 runs.
- Gate-time classification: `rdp_gate_classify.ts`, spend $0.03.

## Result — the two-mechanism split replicates, decisively

| cohort | distributed | orchestrated | gain | FP (orch<dist) | out-tok overhead |
|---|---:|---:|---:|---:|---:|
| **multi-stage (n=8)** | 2.44 | 2.91 | **+19.2%** | 2/8 (both minor) | +54% |
| **stateless (n=8)** | 2.97 | 2.94 | **−1.1%** | 1/8 | +7% |
| all (n=16) | 2.70 | 2.92 | +8.1% | 3/16 | +31% |

The N=5 finding holds at N=16 with an independent rater: the orchestrator earns
its keep on **interdependent multi-step** work (+19.2%, well over the 10% bar;
slots 03 and 08 lifted distributed scores of 1.25 / 1.0 up to 3.0) and is a
**no-op on stateless single-turn** reasoning (−1.1%, +7% tokens). Zero
`reasoning_extraction` refusals across all 32 transcripts.

The aggregate (+8.1%, 19% FP) trips the *univariate* pre-registered flip
condition — but the aggregate is the artefact: it averages a strong multi-stage
win against a stateless no-op. This is the mis-specification the N=5 run flagged
and the N=16 run confirms.

## Gate-time classification validation (the council's blocker)

Council (2026-06-22) ruled keep-scoped is only honest if the agent can classify
a task **at gate time** (from the prompt alone, before doing the work).
`rdp_gate_classify.ts` had the standard host classify all 16 prompts multi-step
vs single-turn against ground truth:

**16/16 = 100% correct, all "high" confidence.**

Plus the property the cautionary review missed: **gate misclassification degrades
gracefully**. Wrong→multi-step costs only over-process (+7–54% tokens, quality
held); wrong→single-turn just means the orchestrator does not engage = the
distributed arm, which scores 2.70–2.97. A gate error picks a wrong-but-still-
functional arm; it does not break the task. So the gate is a real control, not
"vibes", and its failure mode is bounded.

## Verdict — keep-scoped (decided on data + validation)

**Keep `reasoning-orchestrator`, scoped to interdependent multi-step work; do NOT
engage it for single-turn analysis.** Encoded in the skill's engagement criteria
(non-kernel, tier-2 — no kernel soak). Detection = the existing `rdp-gate`
self-assessment, validated 16/16 at gate time.

### Council conditions — how each is met

- **"Don't silently override the pre-registered univariate flip."** Met
  explicitly: the univariate aggregate condition is **superseded** by the
  per-mechanism analysis, replicated N=5 → N=16. **Go-forward amendment:** RDP
  flip conditions are evaluated **per-mechanism**, never on a univariate
  aggregate that can average a win against a no-op.
- **"Self-assessment is unvalidated."** Met: 16/16 gate-time accuracy + graceful
  degradation. **Residual:** the 16 are clear-cut; borderline-case robustness is
  untested → a documented re-eval item, not a blocker (the failure mode is
  bounded by graceful degradation).
- **"No rollback telemetry."** In a no-runtime package there is no runtime
  monitor; the **eval harness is the telemetry** — the revert trigger is a
  scheduled re-eval (re-run this harness; if multi-stage gain drops below the bar
  or stateless over-process climbs, revert the scope). Documented in the skill.

## Caveats

- Single host model for capture (haiku); a second host band was not re-run here
  (the 2026-06-17 quality run already showed strong-host no-regression).
- Rater 2 is a model, not a human; clear-cut corpus → high scores cluster at 3.0.
- Borderline gate-classification untested (bounded by graceful degradation).
