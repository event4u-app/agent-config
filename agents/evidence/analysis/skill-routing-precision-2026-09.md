# Skill-routing precision, measured on a labelled corpus

<!-- evidence-type: analysis -->

Produced by `road-to-a-menu-whose-precision-is-measured` Phases 1.1-1.3, on
2026-09-29. Regenerate every figure below with:

```bash
./scripts-run src/scripts/measure_skill_ranker_baseline --corpus labelled
./scripts-run src/scripts/measure_skill_ranker_baseline --corpus routing-matrix
./scripts-run src/scripts/measure_skill_ranker_baseline --corpus all
```

Ranker under measurement: `keyword-v1` (`skill_tools/score_skill_relevance.rank`),
over the 299 skills in `src/skills/`.

## The headline, and why the old number was not one

| Corpus | n | top-1 | 95 % CI | top-3 | 95 % CI | verdict |
|---|---:|---:|---|---:|---|---|
| `corpus-{dev,non-dev}` | 26 | 0.615 | 0.425 – 0.776 | 0.769 | 0.579 – 0.890 | `underpowered` |
| routing matrix (labelled) | 390 | 0.208 | 0.170 – 0.251 | 0.338 | 0.293 – 0.387 | `measured` |
| both pooled | 416 | 0.233 | 0.195 – 0.276 | 0.365 | 0.321 – 0.413 | `measured` |

Intervals are Wilson score intervals at 95 % (`_lib/capture_rate.wilsonInterval`).

**The 26-prompt figure and the 390-prompt figure do not overlap, in either
column.** That is the finding this roadmap existed to produce. 0.615 was never
wrong as arithmetic; it was a measurement of 26 prompts written alongside the
thing they measure, and its interval was 35 points wide — wide enough that
nobody could have told a good ranker from a poor one with it. On a corpus large
enough to carry an interval, and labelled by seats that had not read the
scoring, top-1 is **0.208**, and the 26-prompt interval's lower bound (0.425)
sits far above the larger corpus's upper bound (0.251).

Two readings are available and this report does not choose between them, because
nothing here settles it:

1. The small corpus is optimistic — its prompts were written by people who knew
   the skill they wanted, so they carry its vocabulary.
2. The two corpora ask different questions. The small one is 26 prompts aimed at
   a skill; the matrix is 390 prompts drawn from rule fixtures, where a skill
   expectation is a secondary judgement about a prompt written for another
   purpose.

Both are plausible and they are not exclusive. What is settled is that **0.615
may not be quoted as this ranker's precision**, and that the number which can be
quoted comes with an interval of ±4 points rather than ±18.

## What the corpus is

| | |
|---|---:|
| cases in `tests/eval/routing-matrix/` | 588 |
| carrying a non-empty `expected_skills` | 390 |
| carrying a deliberate `expected_skills: []` | 198 |
| carrying no `expected_skills` key (a defect) | 0 |
| packs with at least one shipped skill | 27 |
| packs below the 3-prompt floor | 0 |

The deliberate empties are the half a reader is most likely to misread. They are
not unlabelled rows: they are rows a seat judged to have no skill answer — most
of them prompts about the agent's own conduct, settings, or reply format, where
no catalogue skill is a better starting point than the agent reasoning directly.
They are excluded from the accuracy denominator and are never counted as a miss.
Folding them in would drop top-1 to 0.138 by construction and would measure
nothing.

The labelling protocol, the independence constraint on who may write a label,
and the blind second-seat agreement figures are in
`tests/eval/routing-matrix/README.md`. Summary: exact set agreement 39/55
(70.9 %), agreement on whether a prompt has a skill answer at all 50/55 (90.9 %),
and of the 30 rows both seats labelled, 29 share at least one skill (96.7 %).

## The coverage arm

Over all 588 cases, labelled or not, the ranker returns at least one result for
583 and its top answer scores a mean of 19.89. Coverage is not accuracy: it says
the ranker answers, never that the answer is right. It is reported because the
five prompts it answers nothing for are a different defect class from the ones it
answers wrongly.

## Figures in the roadmap that did not reproduce

Recorded rather than silently corrected, since the roadmap's Source block
presents them as tree facts at `8de8a4c`.

| Roadmap says | Measured 2026-09-29 | Note |
|---|---|---|
| routing matrix is "496 lines today" | 1,007 lines, 550 cases before this change | The roadmap's own body already flags 496 as stale in two places and says the size must be measured, never asserted. It then asserts it. |
| `skill.schema.json:28` caps descriptions at 200 | the cap is at line 72 | Value correct, line wrong. |
| description median 181 | 181 | Reproduces exactly. |
| trigger corpus 101 / 299 | 101 / 299 | Reproduces exactly. |
| "the remaining 198" | 198 | Reproduces exactly. |
| 26 labelled prompts in `corpus-{dev,non-dev}` | 26 | Reproduces exactly. |

## The pack unit, stated because two definitions exist

"Every pack" is measured over the distinct values of the `packs:` frontmatter key
across `src/skills/*/SKILL.md` — 27 today. It is NOT measured over the 17
directories in `src/packs/`, and the difference is not cosmetic: four of those
(`analytics`, `core`, `memory`, `product-reasoning`) contain no skill at all
(`catalog_tokens: 0` in their generated manifests), so a floor stated over that
set could never be met by any corpus. The frontmatter set is the one a labelled
prompt can be attributed to.
