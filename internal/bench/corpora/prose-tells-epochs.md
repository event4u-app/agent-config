# Prose-tell register — epoch ledger

> One family per epoch, promoted only at a zero clean-corpus false-positive
> count. The discipline is borrowed from the interaction-layer detector line
> rather than invented a second time, and is named as borrowed.
>
> Gate: `npx tsx src/scripts/bench_prose_tells_fp.ts --gate <rule-id...>` —
> exit 1 while any named family has a non-zero count, naming the files that hit.
> Contract test: `tests/scripts/tell_family_epochs.test.ts`.

## What a row means

**M1 at promotion** is the number of clean-corpus files the family matched on
the day it was promoted, measured against the pin in the same row. It is zero
for every row, because a non-zero count is a refusal and a refused family has
no row here.

**Seeded instances** is how many of the twenty before/after fixtures carry an
instance of the family. It is a recall figure and a weak one — the fixtures
were authored for the register as it stood in July, so a zero means *this
corpus contains no instance*, never *the family does not fire*. Families whose
seeded count is zero are measured by their own positive probe and negative
counter-probe in the contract test instead, which is the same shape the
design-side instrument uses and the same weakness it declares.

## Corpus pin

`abee8424da898d1cd35c737562b4a40ff70c67f0f340e192f5914667907c6e57`
— 35 files, `tests/fixtures/ai-tells/clean/{en,de}/`.

Three files were added to the corpus *before* the epochs below were promoted
(`en/23-direct-opener.md`, `en/24-strong-claim.md`,
`de/11-direkte-eroeffnung.md`), each carrying a near-miss for a family in this
table. That started a new epoch relative to the run-1 pin in
`internal/bench/reports/prose-tells-fp-v1.md`; the additions make the corpus
harder, never easier, and no file was edited to move a number.

## Epoch 0 — the two bounds the reference table already claimed (step 1.4)

| # | Family | Lang | M1 at promotion | Seeded instances |
|---|---|---|---|---|
| 0.1 | `tell-staccato-run` | any | 0 | 0 |
| 0.2 | `tell-uniform-bullet-run` | any | 0 | 0 |

Not register growth in the ordinary sense: both bounds were already published
in `anti-aiisms.md` as scanner-enforced and were implemented nowhere. They
pass the same gate anyway.

## Epochs 1-6 — the English recall families (step 2.2)

| # | Family | M1 at promotion | Seeded instances |
|---|---|---|---|
| 1 | `tell-throat-clearing` | 0 | 5 |
| 2 | `tell-emphasis-crutch` | 0 | 2 |
| 3 | `tell-false-agency` | 0 | 0 |
| 4 | `tell-narrator-distance` | 0 | 0 |
| 5 | `tell-vague-declarative` | 0 | 0 |
| 6 | `tell-binary-contrast` | 0 | 0 |

## Epochs 7-13 — the German half (step 2.3)

| # | Family | M1 at promotion | Seeded instances |
|---|---|---|---|
| 7 | `tell-de-throat-clearing` | 0 | 0 |
| 8 | `tell-de-signposting` | 0 | 0 |
| 9 | `tell-de-vague-declarative` | 0 | 0 |
| 10 | `tell-de-generic-conclusion` | 0 | 1 |
| 11 | `tell-de-emphasis-crutch` | 0 | 0 |
| 12 | `tell-de-false-agency` | 0 | 0 |
| 13 | `tell-de-narrator-distance` | 0 | 0 |

`tell-de-negative-parallelism` is an **extension**, not a new family: it gained
the `nicht um … sondern um` form alongside the literal `nicht nur` it already
required. Extensions clear the same gate — M1 = 0 — and are recorded here so
the widening is visible, but they do not consume an epoch.

## Measured effect on the seeded corpus

Mean cluster score on the `before` side rose **53.97 → 58.46 per 500 words**
across both halves (tune 55.54 → 59.69, holdout 51.61 → 56.62). The `after`
side stayed at **0** on all three metrics, so no landed family fires on
humanized prose. Figures: `internal/bench/reports/humanizer-v1.md`.

## What this ledger does not claim

That the families are the *right* families. That is the pattern catalog's
argument. That a zero M1 means a family is precise in general — the corpus is
35 files this repository authored, and the pre-registration says so up front.
