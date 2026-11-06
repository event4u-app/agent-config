# Check v2 / v2.1 of the corpus v3 truth — report

Registration: `PREREGISTRATION-v3-2026-11-05.md` § The owner deviation for the check,
§ Check v2, § Check v2.1. No arm had been scored against any truth when this ran.

## Who decided

| Role | Provider | Sees |
|---|---|---|
| Reader (files, v1) | Anthropic | the subject checkout |
| Reader (edges, v2.1) | Anthropic | the subject checkout |
| Judge | OpenAI (`codex exec`, reasoning `medium`) | the question, candidate paths, source lines — nothing about who proposed what |
| Judge | Google (`agy`, `gemini-3.8-flash-medium`) | the same |

No judge shares a provider with the reader. Every file or edge in the truth carries at least
two providers' assent.

## Result by rule

| Rule | Items | How a file enters |
|---|---|---|
| Derived (class 3) | 6 | model file + migrations that create/alter/rename/drop its table (`model_table.ts`) |
| Edges (v2.1) | 14 | reachable over edges stated by the reader and ruled `VALID` by ≥ 1 judge, chained by enclosing symbol |
| Two of three (v2) | 18 | reader + two blind judges, ≥ 2 `IN` |

All 45 questions carry truth (39 file sets, 6 expected-empty).

## Measurements

| Measure | Value |
|---|---|
| Calibration, OpenAI (7 oracle-complete items, 52 gold files, 13 decoys) | recall 0.788, precision 1.0 |
| Calibration, Google | recall 0.846, precision 1.0 |
| File-level judge agreement (Cohen's κ, v2) | 0.602 |
| Edge-level judge agreement (κ, after the context round) | 0.336 |
| Class 3: independent 2-of-3 vote vs derivation | 6/6 identical |
| Edges stated / standing | 1086 / 1011 (498 distinct: 378 both judges `VALID`, 90 Google only, 30 neither) |

Both judges are conservative on files (no decoy accepted, about one gold file in five missed).
On edges OpenAI stays `UNSURE` on 117 edges even with imports, receiver declarations and route
registration shown, while Google accepts them; those 90 edges stand on the reader and Google
alone. That is the weakest part of this truth, and it is concentrated in route and framework
hops (tests reaching a controller through a route, events reaching a listener).

## What changed against v1

37 of 45 items were identical between v1 and v2. The closure items moved most, in both
directions:

- **Smaller where v1 over-reached:** `uo-e-01` lost 12 files of the AgentService chain no edge
  reader could tie to the target.
- **Larger where the static closure is large:** `uo-c-tests-03` (9 → 50) and `uo-e-02`
  (13 → 62) — every product write path runs `guardVariantLevelWrite`, which calls the target;
  the tests that reach it through `products.update`, `bulk-edit.save` and the API routes are in
  the closure as the question is worded.
- **`uo-b-02`** ("within two call hops"): 6 in v1, 13 now — hop-2 callers through
  `AiApiClient` and `WebhookService` that v1's reader had placed at hop 3.

## Known limits

- The closure is **static**. A test whose queue or event bus is faked, or whose test double
  overrides the call, still counts when the source chain exists; the edge readers flagged
  these in their notes, and no rule removes them.
- **`uo-e-03` and `uo-e-01` are incomplete on the event side**: the readers listed the files
  that fire the product events but not every route and test above them. The truth for those two
  is a lower bound.
- File-level chaining remains for TypeScript, Vue and Blade lines, which `enclosing.php` cannot
  resolve; the TS closure items (`ls-b-05`, `ls-b-06`) are small enough that this changed no
  file.
- v2.1 and its symbol-level chaining were fixed **after** reading v2 and a file-level
  computation, respectively; the registration says so at each point.
