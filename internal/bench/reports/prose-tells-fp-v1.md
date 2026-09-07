# Prose-tell false-positive count — v1

> Instrument: `src/scripts/bench_prose_tells_fp.ts`.
> Pre-registration: `internal/bench/corpora/prose-tells-fp-PREREG.md`, committed
> at `822b5b2dd` — **before** the corpus, the bench, and every number below.
> Corpus: `tests/fixtures/ai-tells/clean/{en,de}/`, 32 files, clean by
> construction.

## Run 1 — the detector as shipped, before any repair

Corpus pin `8d8a3b22b653cc60c9e285fb15ecd40e903039425b20b76f44078e87e2518ab2`.

| Rule | M1 (clean files hit) | Files |
|---|---|---|
| `tell-de-connector-stack` | 2 | `de/01-konnektor.md`, `de/02-darueber-hinaus.md` |
| `tell-ai-vocabulary` | 1 | `en/05-technical-vocabulary.md` |
| `tell-bold-header-list` | 1 | `en/08-bold-list.md` |
| `tell-curly-quotes` | 1 | `en/06-curled-quotes.md` |
| `tell-filler-phrase` | 1 | `en/09-filler-near-miss.md` |
| `tell-rule-of-three` | 1 | `en/01-list-of-three.md` |
| `tell-title-case-heading` | 1 | `en/07-title-case-heading.md` |
| the other 18 rules | 0 | — |

**Rules with a non-zero M1: 7 / 25.**
**Clean files the shipped thresholds reject outright: 15 / 32.**

Of the 15 rejections, 7 are cluster-score and 8 are dash-density (one file is
both). Four of the dash rejections — `en/12`, `en/17`, `en/19`, `de/03` — are
files carrying a **single** em dash in 78 to 97 words. That is the denominator
defect at a milder amplitude than `en/04`'s six-word line: at a cap of 2 per
500 words, no text under about 250 words can carry one dash and pass, so the
metric cannot distinguish "one dash" from "dash-heavy" anywhere in that range.

## Predictions, scored against run 1

| # | Prediction | Outcome |
|---|---|---|
| 1 | `tell-rule-of-three` records M1 ≥ 1 | **Held** — 1, on the Oxford-comma file step 1.2 exists to repair. |
| 2 | The dash threshold rejects at least one clean file, and it is a short one | **Held** — `en/04-four-word-line.md`, six words, 83.33/500w. |
| 3 | Between 2 and 6 rules record a non-zero M1 | **FALSIFIED — 7.** The three the prediction named all fired (`tell-ai-vocabulary`, `tell-curly-quotes`, `tell-de-connector-stack`); the three it did not name (`tell-bold-header-list`, `tell-filler-phrase`, `tell-title-case-heading`) took it past the stated ceiling. Recorded as written rather than widened after the fact. |
| 4 | After 1.2 and 1.3, `tell-rule-of-three` is 0 and no clean file is rejected on density alone | Scored under run 2 below. |
| 5 | Honest-null branch: an all-zero M1 would be a statement about the corpus | Not triggered — the corpus discriminates. |

## Run 2 — after the 1.2 disarm and the 1.3 density floor

Corpus pin `8d8a3b22b653cc60c9e285fb15ecd40e903039425b20b76f44078e87e2518ab2`
(unchanged — the corpus was not edited to move a number).

| Rule | M1 run 1 | M1 run 2 |
|---|---|---|
| `tell-rule-of-three` | 1 | 0 |
| `tell-de-connector-stack` | 2 | 2 |
| `tell-ai-vocabulary` | 1 | 1 |
| `tell-bold-header-list` | 1 | 1 |
| `tell-curly-quotes` | 1 | 1 |
| `tell-filler-phrase` | 1 | 1 |
| `tell-title-case-heading` | 1 | 1 |

**Rules with a non-zero M1: 6 / 25** (was 7).
**Clean files rejected: 10 / 32** (was 15).

### Prediction 4, scored

**Half held, half FALSIFIED.**

`tell-rule-of-three` records M1 = 0 — the disarm works, and the seeded fixture
that legitimately carries the tell keeps its hit (asserted in
`tests/scripts/detect_ai_tells.test.ts`).

"No clean file is rejected on density alone" is **false**. Four files still are:
`en/02` (2 dashes / 125 words), `en/12` (1 / 78), `en/17` (1 / 97) and `en/19`
(1 / 89); `en/08` (3 / 89) fails on both axes. The five files the floor did
clear are `en/01`, `en/04`, `de/02`, `de/03` and `de/04`. The floor is set
at 50 words because step 1.3's own verify requires a 60-word text with three
dashes to keep failing; a floor high enough to clear these files would be
around 250 words and would take that verify with it.

**This is a measured precision finding, published rather than repaired.** The
cap of 2 per 500 words is a council decision of 2026-07-11 (CP1 parity) and
this roadmap does not hold authority to move it; the floor closes the extreme
case the roadmap names and leaves the mild one visible with a number attached.

*Reopening condition:* a decision record or council session that revisits the
dash cap for documents shorter than the cap's own implied denominator
(~250 words). Until then the four files stay in the corpus and stay counted.

## What this instrument does not measure

Precision on real drafts — nothing here is usage telemetry, and that question
is gated separately. Recall — the seeded corpus and
`tests/scripts/detect_ai_tells.test.ts` carry it, and mixing the two into one
score would let a good recall figure hide a bad precision one.
