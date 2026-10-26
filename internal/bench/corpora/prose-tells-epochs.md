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

## Epochs 14-18 — structural families a matcher can read (road-to-tells-a-near-miss-can-refute 5.2)

Declared before the run: each lands only at M1 = 0 on the pinned corpus, in
this strength order; a non-zero count refuses the family and it gets no row.
All five cleared it on 2026-10-26.

| # | Family | Lang | M1 at promotion | Seeded instances |
|---|---|---|---|---|
| 14 | `tell-heading-echo` | any | 0 | 0 |
| 15 | `tell-repeated-openings` | any | 0 | 0 |
| 16 | `tell-repeated-closer` | any | 0 | 0 |
| 17 | `tell-strawman-preemption` | en | 0 | 0 |
| 18 | `tell-self-describing-document` | en | 0 | 0 |

Known reach, stated rather than found later: the corpus holds no deliberate
anaphora ("We will… We will… We will…" as a rhetorical device), so
`tell-repeated-openings` has M1 = 0 against a corpus that cannot refute it on
that case. A sentence repeated verbatim breaks its run — that is duplication,
and three of the scanner's own unit tests pad with exactly that.

German: the first three read structure and are language-agnostic. The last
two are English phrase families; their German equivalents ("Du denkst jetzt
vielleicht…", "In diesem Artikel werden wir…") are named gaps, not built.

## Metamorphic relations instead of an imported corpus (5.1, 2026-10-26)

The planned external before/after split was dropped by the owner (OQ-20): no
third-party corpus enters the tree. In its place,
`tests/scripts/prose_tells_metamorphic.test.ts` rewrites every clean file and
every seeded `before` draft six ways that cannot change what the text says (CRLF,
trailing spaces, doubled and trailing blank lines, soft-wrapped paragraphs
joined, no-break spaces) and requires every per-family count to stay where it
was. Sensitivity was shown on a seventh, meaning-changing rewrite (one injected
stock phrase moves 41 of the 55 files).

The first run found one real defect: a no-break space where a space belongs
changed the counts of 22 of the 55 files, so any phrase family could be dodged by it.
`analyzeText` now reads U+00A0 and U+202F as spaces. No count on either corpus
moved, so this is not a new epoch.

What the relations cannot see is a tell nobody here thought to write down.
They test the detector against itself, never against an outside reader.

## Measured effect on the seeded corpus

**Per family**, which is the figure that means something here. Six of the
sixteen promoted families find an instance in the twenty seeded pairs:
`tell-throat-clearing` in 5, `tell-de-negative-parallelism` in 3,
`tell-emphasis-crutch` in 2, `tell-de-generic-conclusion` in 1. The other ten
find none, because the fixtures were authored for the July register — a zero is
a statement about this corpus, and those families are measured by their own
probes in `tests/scripts/tell_family_epochs.test.ts` instead.

**The aggregate cluster score is deliberately NOT quoted as the recall figure.**
It moved 53.97 → 48.06 per 500 words across this roadmap, and two changes pushed
it in opposite directions: thirteen new families raised it, and step 4.2's
consistency discount (a pattern used uniformly through a document is charged
once, not N times) lowered it further than that. A number produced under two
different scoring rules is not a before-and-after of the same thing, and
reporting the fall as a recall loss — or the rise as a recall gain — would be
wrong in both directions.

What the aggregate does still establish: the `after` side is **0** on all three
metrics in both halves, so no landed family fires on humanized prose, and every
seeded `before` fixture still exceeds the thresholds (asserted per fixture in
`tests/scripts/detect_ai_tells.test.ts`). Figures, per split:
`internal/bench/reports/humanizer-v1.md`.

## What this ledger does not claim

That the families are the *right* families. That is the pattern catalog's
argument. That a zero M1 means a family is precise in general — the corpus is
35 files this repository authored, and the pre-registration says so up front.
