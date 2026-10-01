---
complexity: lightweight
status: ready
execution:
  mode: autonomous
estate_offset_exempt: "The skill ranker now has a powered measurement (top-1 0.208, n=390) and no roadmap that tries to move it: road-to-a-menu-whose-precision-is-measured built the instrument and closed on adoption, and the archived MCP-delivery roadmap's only ranker change measured null. Six of the round's sixteen reviews name ranker quality their first priority; parking or archiving an active roadmap to buy the slot would trade a measured gap for an unmeasured one."
relates:
  - slug: road-to-a-menu-whose-precision-is-measured
    relation: extends
    note: That roadmap built the labelled corpus and the interval; this one uses both and changes the ranker, which it never did.
  - slug: road-to-skill-delivery-over-mcp
    relation: extends
    note: Archived. Its keyword-v2 (triggers folded in) measured null on 26 prompts; re-measured here on 390 it is still null, so this roadmap does not retry it.
---
# Road to a ranker that routes

> **Source:** `agents/tmp.old/inbox-2026-10-a/` — a round of sixteen external
> reviews of the 16.2.0 release, six of which rank skill-routing quality as their
> first or second priority after the release published the powered measurement.
> Verified against `main` at `9bc8cd4f2` on 2026-10-01; disposition at
> `agents/evidence/analysis/inbox-2026-10-a-disposition.md`.

## Goal

The skill ranker beats its own measured baseline on a held-out slice of the
labelled routing matrix, or the attempt is published as a null with the reason.
Done means: the misses are explained by named confusion pairs and signal gaps,
each candidate signal is measured alone on a slice it was not tuned on, and the
default ranker changes only when its 95 % interval clears the baseline's — with
no second router built beside the first.

## Context

Reproduced on 2026-10-01:

- `./scripts-run src/scripts/measure_skill_ranker_baseline --corpus routing-matrix`
  → `keyword-v1`, n=390, top-1 **0.208** (95 % CI 0.170–0.251), top-3 **0.338**
  (0.293–0.387), verdict `measured`.
- The same with `--ranker keyword-v2` (triggers folded in,
  `measure_skill_ranker_baseline.ts:393-395`) → **identical** figures. The
  archived 26-prompt null holds at n=390: trigger prose is not the lever.
- Coverage arm: 583 of 588 matrix prompts get some answer — the ranker almost
  always answers, and is usually wrong.
- `agents/evidence/metrics/skill-ranker-baseline.json` still carries
  `top1: 0.615` over the 26-prompt corpus, a figure the precision report at
  `agents/evidence/analysis/skill-routing-precision-2026-09.md:46-48` says may
  not be quoted.
- Label quality is bounded: two seats agree on the exact skill set for 39 of 55
  rows (70.9 %) and on whether a skill answer exists at all for 50 of 55
  (`tests/eval/routing-matrix/README.md`, summarized at
  `skill-routing-precision-2026-09.md:73-76`). The matrix prompts were written
  for rule fixtures, so a skill label is a secondary judgement.

## Phase 1 — Explain the misses before changing anything

- [ ] **1.1 Retire the stale baseline row.** Write the 390-prompt reading into
      `skill-ranker-baseline.json` beside the 26-prompt row, mark the old row
      `underpowered`, and make the file's top-level `top1` the powered one.
      verify: `node -e "const b=require('./agents/evidence/metrics/skill-ranker-baseline.json');process.exit(b.top1===0.208?0:1)"` -> 0
- [ ] **1.2 Fix a held-out slice.** Partition the 390 labelled rows by a hash
      of the case id into a tuning slice (80 %) and a sealed slice (20 %), with
      the partition function in code and the slice sizes printed. Every later
      lift claim is read on the sealed slice only.
      verify: `npx vitest run tests/scripts/measure_skill_ranker_baseline.test.ts -t holdout` -> 0
- [ ] **1.3 Confusion report.** Over the tuning slice: per-pack top-1, the
      twenty most frequent (expected, ranked-first) pairs, mean reciprocal rank,
      the share of misses whose expected skill is outside the top ten, and — over
      the 198 deliberate empties — how often the ranker's top score clears the
      score of a median correct hit (false activation on no-skill prompts).
      Read-only, written to `agents/evidence/analysis/skill-ranker-confusion-<date>.md`.
      verify: `grep -c 'MRR' agents/evidence/analysis/skill-ranker-confusion-*.md` -> /^[1-9]/
- [ ] **1.4 Separate label noise from ranker error.** Report top-1 again over
      only the rows both labelling seats agree on. If the gap to the full figure
      is larger than the interval width, Phase 2 tunes on agreed rows only.
      verify: `grep -c 'agreed rows' agents/evidence/analysis/skill-ranker-confusion-*.md` -> /^[1-9]/

## Phase 2 — One signal at a time, each measured alone

- [ ] **2.1 Candidate signals, from 1.3 and nowhere else.** For each confusion
      class 1.3 names, write down the one deterministic signal that would
      separate the pair — pack or domain narrowing, repository stack from the
      existing stack detection, the file path in the prompt, the open file's
      framework as the code graph reports it, description terms already indexed — before implementing any of them.
      verify: `grep -c '^| ' agents/evidence/analysis/skill-ranker-confusion-*.md` -> /^[1-9]/
- [ ] **2.2 Measure each signal behind an option.** Add each as a
      `RankOptions` flag in `src/scripts/skill_tools/score_skill_relevance.ts`, off by default, and record
      top-1, top-3 and MRR with intervals on the sealed slice for each flag
      alone, then for the best two together. A flag that does not move the
      sealed-slice top-1 point estimate is removed in the same change.
      verify: `npx vitest run tests/scripts/score_skill_relevance.test.ts` -> 0

## Phase 3 — Promote only a lift the interval supports

- [ ] **3.1 Change the default, or publish the null.** If one configuration's
      sealed-slice top-1 lower bound exceeds the baseline's upper bound and top-3
      does not fall, make it the default and append a dated row to a `history` array in
      `skill-ranker-baseline.json`, so the figure is read as a trend per release. Otherwise
      record the null with the confusion classes it could not separate.
      verify: `node -e "const b=require('./agents/evidence/metrics/skill-ranker-baseline.json');process.exit(Array.isArray(b.history)?0:1)"` -> 0
- [ ] **3.2 Keep the per-prompt cost inside the slot budget.** Measure p95
      ranking cost per prompt for the promoted configuration against the
      `pre_tool_use` budget in `hook-latency-budget.json`, and refuse the
      promotion if it does not fit.
      verify: `npx vitest run tests/scripts/score_skill_relevance.test.ts -t latency` -> 0

## What this roadmap deliberately does not do

- No second router, no embedding or model-based ranker, and no council call per
  routing decision — the reviews that rank this first say so in the same breath.
- No fix that widens the result set: returning more skills in the top three is
  not a lift.
- No fixed target such as "top-1 ≥ 70 %". With 299 skills and 70.9 % label
  agreement the reachable ceiling is unknown; the interval decides, not a number
  chosen in advance.

## Gap table

| Source item | Verdict | Where |
|---|---|---|
| Improve the existing ranker against the new corpus | KEEP | Phase 2, Phase 3 |
| Confusion pairs, per-pack precision, MRR, no-skill discrimination | KEEP | 1.3 |
| Repo, file and framework context as signals | FOLD — one candidate signal each | 2.1, 2.2 |
| Two-stage shortlist plus semantic rerank | CUT until a deterministic signal is measured | non-goals |
| Top-1 ≥ 70 % / top-3 ≥ 90 % target | CUT as a target | non-goals |
| Trend per release | FOLD — the baseline file gains a history | 3.1 |
| Corpus must stay representative | KEEP | 1.4 |

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | Do not retry folded triggers | Re-measured null at n=390 on 2026-10-01, matching the archived 26-prompt null | A large share of expected skills gains `triggers:` |
| D2 | reversible-technical | evidence | Claims are read on a sealed 20 % slice | Tuning and reading on one corpus of 390 overfits it; the interval only means something on rows the tuning did not see | The labelled corpus grows past 1,000 rows |
| D3 | reversible-technical | evidence | No fixed accuracy target | Label agreement is 70.9 %, so a target above it is not attainable even by a perfect ranker | Agreement is re-measured above 90 % |
| D4 | deterministic | evidence | Closure-scan C1 (step 3.1 read as a typed operation) records a null or a default change inside this repository; nothing is published outside it | `publish the null` means writing the evidence row | — |
| D5 | reversible-technical | evidence | Closure-scan C2 (gap-table row read as ambiguous acceptance) is made decidable by AC-3's interval rule | AC-3 names the sealed-slice interval comparison | — |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-01 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The ranker is tuned to the matrix rather than to prompts | product | The matrix prompts were written for rule fixtures. A signal that separates fixture phrasings can lift the number and change nothing for a real request. | 1.4 reads agreed rows separately, every lift is read on the sealed slice, and 2.1 requires each signal to name the confusion class it separates. | Phase 1 — Explain the misses before changing anything |
| 2 | A context signal leaks the label | implementation | A signal derived from the case file itself — its path, its rule id — would score perfectly and generalize to nothing. | 2.1 restricts signals to what a live request carries: the prompt, the repository and the open file. | Phase 2 — One signal at a time, each measured alone |
| 3 | The promoted ranker costs more than the slot allows | implementation | Repository context needs stack detection, which can be slow on a cold call. | 3.2 measures p95 against the existing latency budget before promotion. | Phase 3 — Promote only a lift the interval supports |

## Acceptance Criteria

- [ ] AC-1 — The baseline file's headline figure is the powered 390-prompt
      reading, and the 26-prompt row is labelled underpowered.
- [ ] AC-2 — A confusion report names the most frequent miss pairs and reports
      MRR and false activation on no-skill prompts.
- [ ] AC-3 — The default ranker changed only on a sealed-slice interval that
      clears the baseline's, or a null is recorded with the classes it could not
      separate.
