# Reasoning Discipline Protocol — eval substrate

The falsifiable measuring ground for RDP (roadmap
`agents/roadmaps/road-to-frontier-grade-reasoning.md`, decision **L8**). Built
**before** the features so every later phase has a baseline to beat, and so the
orchestrator's keep/revert decision (**L6**) and the verifier cost gate (**L12**)
are settled by data, not assertion.

> "Assertion without falsifiability is marketing, not engineering." The whole
> point of RDP is that a new rule is **measured, then kept or deleted** — not
> kept because it feels better.

## Two layers (hybrid, per L8)

1. **Trigger layer — *did the right discipline fire?***
   `trigger-fixtures.json`, in the repo's standard `{q, trigger, note}` schema
   (+ additive `discipline` / `tier`). Live scoring reuses the existing runner
   `src/scripts/skill_trigger_eval.py` (model calls → **billable, Phase 7**).
   When each RDP skill lands (Phases 4–6) it gets its own
   `skills/<skill>/evals/triggers.json` seeded from these rows, per the
   per-skill convention.
   - Cost-free now: `python3 tests/reasoning-layer-eval/validate_fixtures.py`
     checks shape + that the L10/L12/L13 cost-gating invariants are exercised.

2. **Quality layer — *did firing it produce better work?***
   `rubric.md` + `golden-transcripts/` — 12 tasks (4 per host-strength band), each run
   **baseline** (no RDP) vs **treatment** (RDP on), **hand-scored** on a 4-point
   rubric (there is no app runtime to auto-judge). Slots use `_template.md`.

## Metrics

- **Trigger precision / recall** per discipline (target ≥ 60%).
- **Rubric mean** across treatment transcripts (target ≥ 70% = 2.1/3).
- **Treatment − baseline delta** per host-strength band (≥ +15% standard host; ≥ 0 strong-reasoning host).
- **Token-overhead delta** (treatment vs baseline) per host band — the L10 cost guard.
- **Calibration accuracy** — predictions logged vs actual outcomes (Prediction
  Tracking component).
- **Decision-reuse rate** — decisions consulted from the ledger vs re-derived.
- **Uncertainty → effort** audit — did higher logged uncertainty actually draw
  more effort/verification?

## Fail conditions (→ revision, not tuning)

- Trigger precision < 60% → the discipline mis-fires.
- Rubric mean < 70% → scaffolding insufficient.
- Any `reasoning_extraction` refusal attributable to a suite instruction →
  notes-first architecture failed (L2).
- Frontier/trivial token-overhead > ~5% → cost gate broken (L10).
- Orchestrator < 10% gain over distributed-only **or** > 15% false-positive
  interventions → revert the orchestrator (L6).

## What runs when

| step | cost | when |
|---|---|---|
| `validate_fixtures.py` | free (no model) | now / CI |
| live trigger scoring (`skill_trigger_eval.py`) | billable | Phase 7 |
| baseline + treatment transcript capture (`run_quality_eval.py`) | billable | Phase 7 |
| rubric hand-scoring | human time | Phase 7 |

Baseline capture is intentionally **not** done during authoring — it needs real
host-model runs and is the first billable step in Phase 7.

## Results (run 2026-06-17)

- **Trigger layer** — `RESULTS-trigger-2026-06-16.md`. 3/8 disciplines are
  trigger-measurable (prediction clean; complexity + decision borderline); the
  other 5 are lenses/gates → quality layer. Spend ~$2.76.
- **Quality layer** — `RESULTS-quality-2026-06-17.md`. Controlled
  two-system-prompt differential (`run_quality_eval.py`), 12 slots ×
  baseline/treatment, single rater. Spend $0.086.
  - Treatment rubric mean **95.8%** (≥70% ✅). Treatment − baseline:
    **standard band +14.6 pp / +17.9% rel** (≥15% bar: marginal on pp, pass on
    relative), **strong band +25 pp** (≥0 no-regression ✅).
  - Strong/trivial token overhead **+1.7%** (≤~5% ✅). **Zero
    `reasoning_extraction` refusals** (no hard fail).
  - **L12 verifier gate: keep** (caught a data-loss migration + a blind
    1600-token over-production). **L6 orchestrator: unsettled** — needs a
    dedicated orchestrator-on/-off run. **L7 promotion**: zero-refusal condition
    met; decision stays Phase 2 (own PR + ADR + soak).

## Files

- `trigger-fixtures.json` — RDP trigger fixtures (21 rows, 8 disciplines).
- `validate_fixtures.py` — cost-free structural + invariant validator.
- `rubric.md` — the 12-slot plan + 4-dimension hand-scoring rubric + thresholds.
- `run_quality_eval.py` — quality-layer runner: controlled two-system-prompt
  differential (baseline = no RDP / treatment = +RDP), dry-run by default,
  `--confirm` to spend. Mirrors `skill_trigger_eval.py`'s key + cost-gate.
- `golden-transcripts/corpus-prompts.json` — the 12 task prompts (machine form).
- `golden-transcripts/_template.md` — per-slot transcript + scoring template.
- `golden-transcripts/<NN>-<slug>.md` — captured baseline+treatment transcripts.
- `RESULTS-trigger-2026-06-16.md` / `RESULTS-quality-2026-06-17.md` — scored runs.
