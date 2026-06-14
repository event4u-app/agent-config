# Golden-transcript rubric (RDP quality layer, L8)

The trigger layer (`trigger-fixtures.json`) answers *did the right discipline
fire?* This rubric answers *did firing it produce better work?* — the quality
half of the hybrid eval. Transcripts are **hand-scored** (no app runtime to
auto-judge), 4 dimensions × 4 points each (0–3), per the L8 fail thresholds.

## The 12 slots

12 tasks = 4 per host-strength band (standard host + strong-reasoning host, agent
self-assessed — table-free per L17), spanning the
four task families the disciplines target:

| # | Family | Tests |
|---|---|---|
| 1–3 | Ambiguous discovery | grounding + intent |
| 4–6 | Multi-stage implementation | complexity-first + adaptive-stop |
| 7–9 | Verification / risky change | verifier (structural gate) + notes-first |
| 10–12 | Cross-run / calibration | notes persistence + prediction calibration + decision ledger |

Each slot is run **twice**: **baseline** (suite without RDP) and **treatment**
(suite + RDP). Store both transcripts in `golden-transcripts/<NN>-<slug>.md`
(see `_template.md`).

## The four dimensions (score each 0–3)

1. **Notes-first adherence** — reasoning (hypotheses, predictions, decisions)
   lives in notes, NOT echoed into the response. `3` = clean separation;
   `0` = reasoning dumped into the user-facing answer (also a hard
   `reasoning_extraction` red flag).
2. **Grounding** — environment/constraints/info-gaps closed before designing.
   `3` = grounded then acted; `0` = jumped to a solution against assumptions.
3. **Premature-solution avoidance** — for complex tasks, the hardest/load-bearing
   unknown was resolved before dependent work; no lock-in on the first idea.
   `3` = risk-first; `0` = built easy parts first, reworked later.
4. **Coherence / re-grounded summary** — the final summary is readable by someone
   who saw none of the working thread (outcome-first, no arrow-chain shorthand).
   `3` = clean re-ground; `0` = dense working-shorthand mush.

## Scoring & thresholds (per L8)

- **Rubric mean** = mean of all dimension scores across all treatment transcripts,
  normalised to 0–100% (`score/3`). **Pass ≥ 70%** (i.e. ≥ 2.1/3 mean).
- Compute the **treatment − baseline delta** per host-strength band. Pass requires
  **≥ +15% on a standard host** and **no regression (≥ 0) on a strong-reasoning
  host** (L10: strong hosts are auto-gated light/off, so treatment ≈ baseline there).
- **Hard fails** (any one → architectural revision, not tuning):
  - any `reasoning_extraction` refusal attributable to a suite instruction;
  - frontier/trivial **token-overhead delta > ~5%** (cost gate broken, L10);
  - orchestrator **< 10% gain over distributed-only OR > 15% false-positive
    interventions** (revert per L6).

## Scoring sheet (fill during Phase 7)

| slot | host band | dim1 notes | dim2 ground | dim3 premature | dim4 coherence | mean | variant |
|------|-----------|------------|-------------|----------------|----------------|------|---------|
| 01 |  |  |  |  |  |  | baseline / treatment |
| … |  |  |  |  |  |  |  |

Two raters where possible; record disagreement. Single rater is acceptable for a
first pass but note it as a confidence caveat.
