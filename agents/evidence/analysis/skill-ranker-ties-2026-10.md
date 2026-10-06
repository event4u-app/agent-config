# Skill-ranker ties — the unrounded tie-break, tuning slice

<!-- evidence-type: analysis -->

Produced by `road-to-a-ranker-whose-ties-break-on-signal` Phases 2 to 5 on
2026-10-06. Read-only with respect to the ranker: **no default changed**. The
new flag, `RankOptions.tieBreakUnrounded`, orders a block of equal integer
scores by the unrounded score before the name; it changes no score. With every
flag off the ranking is the Python-parity `(-score, name)` one, byte-identical.

## What was read, and what was not

| | |
|---|---:|
| labelled rows in the routing matrix | 390 |
| …tuning slice (read) | 315 |
| …sealed slice (**not** read under the flag) | 75 |
| deliberate `expected_skills: []` rows in the tuning slice | 153 |
| skills indexed | 299 |

**The sealed slice was not read under the flag.** The council verdict recorded
as D1 in the roadmap (2026-10-06, `anthropic/claude-sonnet-4-5` +
`openai/codex-default`, two rounds, 2/2 convergent, $0 — subscription seats)
picked option (b): the 75 sealed rows already motivated this mechanism — their
15 alphabet-decided rows and the 0.360 counterfactual are published — so a read
of them now is not out of sample, and at n = 75 the Wilson interval is too wide
to settle the 0.251 bar either way. The flag is built and measured on tuning as
**exploratory**; the one sealed read waits for a freshly cut slice once the
labelled corpus passes 1,000 rows (archived D2's `revisit-if`). The
pre-registered sealed read, when it happens, reports overall top-1 with its
Wilson interval against 0.251, `top1_loss_due_to_tie`, and
`expected_in_top_score_block`.

The sealed figure 15 of 75 below is a `keyword-v1` re-derivation of the count the
2026-10-01 page already published, taken to prove the metric reproduces — not a
reading under the flag.

## The two tie metrics

`top1_loss_due_to_tie` counts top-1 misses whose expected skill shares the
winner's whole ordering key and loses on the name alone — the integer score
and, under the flag, the unrounded score too. `expected_in_top_score_block`
counts rows, hit or miss, whose expected skill scores the winner's integer.

| configuration | `top1_loss_due_to_tie` | `expected_in_top_score_block` |
|---|---:|---:|
| `keyword-v1` (every flag off), tuning | 67 / 315 (21.3 %) | 136 / 315 (43.2 %) |
| `keyword-v1`, sealed (re-derivation of the published count) | 15 / 75 (20.0 %) | — |
| `ties` = `{ tieBreakUnrounded }`, tuning | 67 / 315 (21.3 %) | 136 / 315 (43.2 %) |
| `idf` = `{ idfWeighting }`, tuning | 20 / 315 (6.3 %) | 94 / 315 (29.8 %) |
| `idf+ties` = `{ idfWeighting, tieBreakUnrounded }`, tuning | 14 / 315 (4.4 %) | 94 / 315 (29.8 %) |

Both 2026-10-01 figures reproduce exactly: 67 of 315 and 15 of 75, pinned by
`tests/scripts/skill_ranker_tie_metrics.test.ts`.

## The headline under the flag, tuning

| configuration | top-1 | 95 % CI | top-3 | MRR |
|---|---:|---|---:|---:|
| `keyword-v1` | 0.219 | 0.177 – 0.268 | 0.343 | 0.319 |
| `ties` | 0.219 | 0.177 – 0.268 | 0.343 | 0.319 |
| `idf` | 0.235 | 0.191 – 0.285 | 0.368 | 0.347 |
| `idf+ties` | 0.238 | 0.194 – 0.288 | 0.371 | 0.347 |

## The finding: alone, the flag moves nothing

`ties` alone reads **identical to the baseline on every row**, and that is
arithmetic, not noise. Under `keyword-v1` the overlap is
`matched / |task terms|` and the task's term set is the same for every skill, so
two skills share an integer score only when they match the same number of terms
— and then their unrounded scores are equal too. A difference that rounding hides
needs a task of more than 70 terms; the longest labelled prompt tokenizes to 20. The 67 alphabet
decisions are therefore **real ties of the unrounded formula**; no tie-break
derived from that formula can touch them.

Under `idf` the unrounded score varies continuously, and there the flag does
work: it breaks 6 of the 20 ties `idf` leaves (20 → 14) and moves top-1 by one
row (0.235 → 0.238). Ties `idf+ties` still loses on the name: 14 of 315, 4.4 %.

D4's `revisit-if` reads: *ties left after the unrounded score still decide more
than a tenth of tuning rows.* For the flag alone that fires (21.3 %); for
`idf+ties` it does not (4.4 %). The order inside a `keyword-v1` tie needs a
signal the formula does not carry — which the archived roadmap's cut keeps out
until measured.

## Abstention, beside its cost

Over the 153 deliberate empties in the tuning slice. The threshold is the
median top score of a correct hit, the same one the false-activation table uses.

| configuration | no-skill rate (empties scoring 0) | threshold | empties abstained below it | correct hits it suppresses |
|---|---:|---:|---:|---:|
| `keyword-v1` | 3 / 153 (2.0 %) | 28 | 128 / 153 (83.7 %) | 33 / 69 (47.8 %) |
| `ties` | 3 / 153 (2.0 %) | 28 | 128 / 153 (83.7 %) | 33 / 69 (47.8 %) |
| `idf+ties` | 3 / 153 (2.0 %) | 25 | 133 / 153 (86.9 %) | 37 / 75 (49.3 %) |

The ranker abstains on its own on 2 % of the no-skill prompts. Abstaining below
the median hit score would silence roughly 85 % of them, and costs about half of
the correct hits — by construction of a median threshold, which is why the
recall column is printed beside the gain rather than after it.

## Promotion

No promotion decision is taken here. Turning the flag on in the `skill-route`
hook or the MCP tool is a separate owner or council step, in its own change, and
on this page's evidence it has nothing to promote in isolation.

## Commands

```bash
./scripts-run src/scripts/report_skill_ranker_confusion --slice tuning --ranker keyword-v1
./scripts-run src/scripts/report_skill_ranker_confusion --slice tuning --ranker ties
./scripts-run src/scripts/report_skill_ranker_confusion --slice tuning --ranker idf
./scripts-run src/scripts/report_skill_ranker_confusion --slice tuning --ranker idf+ties
npx vitest run tests/scripts/skill_ranker_tie_metrics.test.ts tests/scripts/skill_ranking_tie_flag.test.ts
```
