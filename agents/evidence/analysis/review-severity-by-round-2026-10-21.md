<!-- evidence-type: analysis -->

# Completion-review severity by round

Measured 2026-10-21 against `main` `8d69deaf7`, for steps 0.1 and 0.2 of
`road-to-a-review-that-ends`. It re-derives the table that roadmap's Context
row F4 took from a supplied plan, so that no decision cites a figure the tree
did not produce. **Revised the same day after the completion review of the
change that produced it** (findings 2, 3, 7, 8, 9): the first parse read only
`*.findings.md`, ignored the `round:` header, and read a subject name as a
round; the figures below replace it.

## Result

`./scripts-run src/scripts/probe_depth_shadow --rounds` prints both tables.

| round | findings | high+critical | high+critical share | medium | low |
|---|---|---|---|---|---|
| 1 | 2000 | 280 | 14.0 % | 39.7 % | 46.0 % |
| 2 | 242 | 40 | 16.5 % | 40.9 % | 42.6 % |
| 3+ | 625 | 51 | 8.2 % | 37.4 % | 54.4 % |

| round | artefacts | findings | high+critical | high+critical per artefact | reviews ending here |
|---|---|---|---|---|---|
| 1 | 188 | 2000 | 280 | 1.49 | 162 |
| 2 | 26 | 242 | 40 | 1.54 | 8 |
| 3 | 18 | 146 | 14 | 0.78 | 4 |
| 4 | 14 | 100 | 11 | 0.79 | 0 |
| 5 | 14 | 81 | 10 | 0.71 | 2 |
| 6-10 | 32 | 162 | 12 | 0.38 | 10 |
| 11+ | 26 | 136 | 4 | 0.15 | 2 |

2,867 finding rows in 188 reviews that carry at least one row; 26 (14 %) ran
past round 1 and 18 past round 2. An artefact is one round of one review.

## What it says

- **Round 2 pays as much as round 1** — 1.54 high/critical rows per artefact
  against 1.49, and the highest severity share. A one-round cap would drop it.
- **Rounds 3-5 pay about half of round 1** (0.71-0.79 per artefact) — real
  findings, not noise. A two-round cap would cut them.
- **From round 6 the yield falls** to 0.38, and to 0.15 from round 11. The
  12 reviews that ran past round 5 carry 16 high/critical rows in those rounds.

The supplied plan read 14.1 % → 11.5 % → 7.4 % (rounds 1, 2, 3+). The shape from
round 1 to round 3+ holds; round 2 does not fall. This is the measured case for
a cap at five rounds over a cap at two — the roadmap's owner decision weighs it.

## Method and its limits

- **Corpus:** every `agents/evidence/reviews/*.findings.md` and every § 2.7
  archived round record `<slug>.roundN-review.md` (49 files, 400 rows).
- **A finding** is a table row whose first cell is a number and whose Status
  cell is not `example`, `rejected` or `invalid`; its severity is the second cell.
- **The round, in order of authority:** the `round:` header field; a
  `# Completion review round N` heading in a file holding several rounds; the
  file name — an archived `.roundN-review.md`, or a `-roundN` / `.roundN` / `-rN`
  suffix **when another file shares the slug**.
- **Known misreads of the sibling rule, stated:** it reads the lone
  `conformance-round7` correctly as a subject name (round 1). It also reads two
  genuine later rounds whose earlier rounds sit under a different slug —
  `release-ledger-round4` (5 high/critical rows; its round 3 is
  `release-ledger-in-ci`) and `run-continuation-round9` (1) — as round 1. Those
  6 rows belong in round ≥ 3; the 3+ count is therefore a slight undercount.
- **Why the review count is 188 and not 293:** the first parse counted every
  file as a review, honest-null and skip artefacts included; this one counts
  reviews that carry a finding row, the population a severity table describes.

## What round 3+ high/critical rows were (step 0.2)

Each high/critical row of round ≥ 3 was classified by a fresh subagent against
the previous round's artefact and, where that was silent, against the commit
that introduced the cited code. The first pass classified 44 rows; the revised
parse removed 8 of them (the two lone-name files and `conformance-round7`, now
round 1) and added 15 from archived round records, classified by a second fresh
subagent. Two rows were re-checked by hand
(`run-continuation-provenance.round5` row 1 — the finding names the round-4
reset; `worktree-long-horizon.round4` — `e8bc15e20` is an ancestor of the
round-1 diff `f631031b7`); both held.

| class | rows | meaning |
|---|---|---|
| fix-delta | 33 | introduced by a fix made in response to an earlier round |
| missed | 18 | present in the scope earlier rounds reviewed, not reported |

**Only `missed` is a cost of a round cap.** 18 rows over all reviews that ran
past round 2, against 320 high/critical rows found in rounds 1 and 2. The
fix-delta rows are the loop feeding itself: 33 of 51 are defects the previous
round's repair created. Two `fix-delta` calls were judgement calls (a fix two
rounds back with the round between silent); counted as `missed` instead, the
split is 31 / 20.

Per row (review · round · class · reason):

```
behavior-vocabulary-close	r13	fix-delta	round-11 fix half-closed it and pinned the wrong answer
behavior-vocabulary-close	r15	missed	roadmap already over the line cap at the round-1 diff
behavior-vocabulary-close	r3	fix-delta	round-2 finding 1 fix made the step 3.2 / AC-4 evidence stale
behavior-vocabulary-close	r4	fix-delta	MEDIUM downgrade and its comment were the round-2 finding 3 fix
drain-adversarial-verification-close	r3	fix-delta	stale figures written by the round-2 fix
drain-adversarial-verification-close	r4	fix-delta	misplaced provenance marker was the round-3 fix
drain-adversarial-verification-close	r4	fix-delta	figures written by the round-3 fix
drain-adversarial-verification-close	r5	fix-delta	two round-1 fixes combined into a fractional timeout
drain-corpus-refresh-cadence-close	r3	missed	ownership gap predates round 2, which hit only D4's circularity
drain-corpus-refresh-cadence-close	r4	fix-delta	round-3 triggers.json rewrite left the holdout pin stale
drain-corpus-refresh-cadence-close	r4	fix-delta	"exactly one row absent" broke with the round-3 triggers.json edit
drain-corpus-refresh-cadence-close	r6	fix-delta	round-5 refusal left the exit-0 verifies unsatisfiable (its own disposition)
drain-corpus-refresh-cadence-close	r7	missed	false "neither step exists" claim predates round 2
drain-corpus-refresh-cadence-close	r7	fix-delta	"green for this file" was written by the round-3 fix
drain-ranker-that-routes	r4	missed	rounding and tiebreak in round-1 scope, unreported in r1-r3
drain-roadmap-6-one-resolver	r3	fix-delta	segment() replaced stripNonCode as the round-2 fix
drain-roadmap-6-one-resolver	r4	fix-delta	AST check from the round-3 fix repaired one half only
drain-roadmap-6-one-resolver	r5	fix-delta	sits inside the repair that closed round-4 finding 2
drain-supervised-telemetry	r3	missed	spoolRecord had no production caller from the first commit
drain-supervised-telemetry	r3	missed	claimed-spool read and unconditional rmSync present from the first commit
drain-supervised-telemetry	r4	fix-delta	round-3 fix added imports the stub lacks
drain-supervised-telemetry	r4	fix-delta	alias only fails once the round-3 fix used it
drain-supervised-telemetry	r4	fix-delta	guard added by the round-3 fix
drain-supervised-telemetry	r5	missed	kill switch skipped from the first commit
drain-supervised-telemetry	r5	fix-delta	round-4 fix reopened the concurrent-append loss
feat-svg-roadmaps-all-20261011	r3	fix-delta	isPassSurface split was the round-1 finding 6 fix
feat-svg-roadmaps-all-20261011	r3	fix-delta	same widening from the round-1 fix
feat-svg-roadmaps-all-20261011	r3	missed	header claim and divergent skip present at the round-1 diff
feat-svg-roadmaps-all-20261011	r3	missed	static discharge and severity predate round 2
feat-svg-roadmaps-all-20261011	r5	missed	quote-only regex present at the round-1 diff
feat-svg-roadmaps-all-20261011	r5	missed	unconditional 'verified' return present at the round-1 diff
feat-svg-roadmaps-all-20261011	r5	missed	non-greedy svg regex present at the round-1 diff
feat-svg-roadmaps-all-20261011	r6	missed	the old regex had the same hole (disposition)
fix-release-shape-allows-its-own-census	r19	missed	rows already in the table at the round-1 diff
fix-release-shape-allows-its-own-census	r21	fix-delta	added by the round-20 finding 2 fix
road-to-plan-governance-gates	r3	fix-delta	scope binding came from the round-1 fix (round 2 silent)
road-to-plan-governance-gates	r8	fix-delta	fence pairing added by the round-7 fix
run-continuation-provenance	r3	missed	progress read predates the round-2 fix
run-continuation-provenance	r3	fix-delta	session_cwd added by the round-2 finding 1 fix
run-continuation-provenance	r5	fix-delta	history_source reset was the round-4 finding 2 fix
run-continuation-provenance	r5	fix-delta	per-directory resolution was the round-4 finding 1 fix
run-continuation-provenance	r6	fix-delta	new rung from the round-5 fix
run-continuation-provenance	r7	fix-delta	round-5 rung's state clear; round-6 guard covered one path
run-continuation-provenance	r7	fix-delta	absent branch from the round-5 fix lacks the round-6 guard
worktree-long-horizon	r3	fix-delta	readHead was the fix for round-2 finding 5
worktree-long-horizon	r4	missed	claim registered before the round-1 diff
worktree-long-horizon	r5	fix-delta	detectIndentWidth added by the round-4 fix
worktree-long-horizon	r6	missed	refusal set present at the round-1 diff
worktree-long-horizon	r6	fix-delta	file created by the round-1 fix commit
worktree-long-horizon	r6	fix-delta	routing through detectIndentWidth was the round-5 fix
worktree-long-horizon	r6	missed	classifier present at the round-1 diff
```

## Record-prose findings under the step 1.4 brief

Step 1.4 adds a `## Severity` section to the reviewer brief: style, naming,
formatting and wording are `low`, also in record prose; a false statement keeps
the severity of what it breaks. To see what that rubric would have done to the
corpus, the 35 high/critical round-1 rows whose File:Line points at
`agents/roadmaps/`, `agents/evidence/`, `docs/decisions/` or
`agents/roadmaps-` (of 224 high/critical round-1 rows in the first parse) were
classified by a fresh subagent:

| class | rows | severity under the brief |
|---|---|---|
| style | 0 | low |
| false claim nothing acts on | 2 | medium |
| wrong statement a gate, command or next step acts on | 33 | unchanged |

So the brief moves 2 of those rows (both in `release-written-answer-removal`:
ADR line counts and a stale commit citation nothing consumes) and none of the 33
that broke a gate, a blocker or an acceptance criterion. A blanket "record prose
is low" rule — the supplied plan's wording — would have downgraded all 35. Four
of the 33 were borderline; moving all four would make it 6. This is a re-scoring
of existing rows, not a re-run of 20 reviews: the brief changes how severity is
assigned, not what a reviewer looks at, so re-scoring is the direct measure of
its effect.

## Reproduce

`./scripts-run src/scripts/probe_depth_shadow --rounds` — the parser is
`parseReviewCorpus` and the per-round table `roundTable` in
`src/scripts/probe_depth_shadow.ts`, both covered by
`tests/scripts/probe_depth_shadow.test.ts`. The window moves with the review
corpus; this reading is pinned to `main` `8d69deaf7` plus this branch's own
review record.
