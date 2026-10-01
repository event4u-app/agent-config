# Skill-ranker confusion report — keyword-v1, tuning slice

<!-- evidence-type: analysis -->

Produced by `road-to-a-ranker-that-routes` Phases 1 to 3 on 2026-10-01.
Read-only with respect to the ranker: **the default did not change**, and
§ The null below is why. Regenerate the measured figures with

```bash
./scripts-run src/scripts/report_skill_ranker_confusion --ranker keyword-v1 --slice tuning   # §§ 1–6
./scripts-run src/scripts/report_label_agreement                                             # § 7
./scripts-run src/scripts/sweep_skill_ranker_signals                                         # § 9
```

**Every TABLE and every measured figure** up to and including § The 20 most
frequent pairs is the first command's output verbatim — regenerate and diff the
tables to check it. This preamble is not: the generator emits a one-command
header and this file carries a three-command one, because two further tools
contribute sections below. The sections after the pair table carry the other two
commands' output plus the reading of them, and say which is which.

## What was read

| | |
|---|---:|
| labelled rows in the routing matrix | 390 |
| …in the tuning slice | 315 |
| …in the sealed slice | 75 |
| rows this report read (`tuning`) | 315 |
| deliberate `expected_skills: []` rows in the same slice | 153 |
| skills indexed | 299 |

The sealed slice is **not** read here. A confusion class derived from rows a
later lift is measured on would make that lift circular, which is the one
failure a held-out partition exists to prevent.

## The headline on this slice

| measure | value | 95 % CI |
|---|---:|---|
| top-1 | 0.219 | 0.177 – 0.268 |
| top-3 | 0.343 | 0.293 – 0.397 |
| mean reciprocal rank | 0.319 | — |

MRR is the average of 1 / (position of the first expected skill), counting a row
where no expected skill appears anywhere in the ranking as 0. It is the figure
that separates "the right answer was second" from "the right answer was never
returned", and top-1 alone cannot.

## How deep the misses are

| | count | share of misses |
|---|---:|---:|
| top-1 misses | 246 | — |
| …expected skill outside the top 10 | 141 | 57.3 % |
| …expected skill not ranked at all (score 0) | 82 | 33.3 % |

A miss inside the top ten is a ranking problem — the right skill is in the
candidate set and something else outscored it. A miss outside it, and above all
a row where the expected skill scores zero, is a RECALL problem: no re-weighting
of the existing signal can recover a skill the formula never surfaces. The two
take different fixes, which is why the split is reported rather than an average.

## False activation on the no-skill prompts

| | |
|---|---:|
| deliberate empties in this slice | 153 |
| correct top-1 hits the median is taken over | 69 |
| median top score of a correct hit | 28 |
| empties whose top score reaches that median | 25 |
| share | 16.3 % |

The threshold is the ranker's own median hit score rather than a cutoff chosen
here, because the question is whether the ranker's confidence separates the two
populations at all. A share near one half means it does not: a prompt a seat
judged to have no skill answer is scored as confidently as a prompt it got right.

## Per-pack top-1, worst first

| pack | labelled rows | top-1 |
|---|---:|---:|
| `analysis-workbench` | 9 | 0.000 |
| `ai-video` | 3 | 0.000 |
| `gtm-sales` | 3 | 0.000 |
| `nextjs` | 3 | 0.000 |
| `product-basic` | 3 | 0.000 |
| `python` | 3 | 0.000 |
| `product-discovery` | 2 | 0.000 |
| `meta` | 95 | 0.137 |
| `gtm-marketing` | 6 | 0.167 |
| `ai-image` | 5 | 0.200 |
| `finance-basic` | 5 | 0.200 |
| `founder-strategy` | 5 | 0.200 |
| `brand` | 9 | 0.222 |
| `engineering-base` | 138 | 0.239 |
| `forensics` | 4 | 0.250 |
| `react` | 4 | 0.250 |
| `typescript` | 4 | 0.250 |
| `ops-people` | 3 | 0.333 |
| `symfony` | 3 | 0.333 |
| `frontend-design` | 8 | 0.375 |
| `laravel` | 15 | 0.467 |
| `scale-discipline` | 4 | 0.500 |
| `fun` | 2 | 0.500 |
| `php` | 3 | 0.667 |
| `finance-advanced` | 4 | 0.750 |
| `history-discipline` | 3 | 1.000 |
| `legal-review-prep` | 3 | 1.000 |

A row counts once per pack of each skill its label names, so the column sums
above the row count — the same accounting the per-pack census uses.

## The 20 most frequent (expected, ranked-first) pairs

| expected (label, best fit first) | ranked first instead | rows |
|---|---|---:|
| `decision-review` | `adr-create` | 3 |
| `api-design` | `api-testing` | 2 |
| `blast-radius-analyzer` | `architecture-review-lens` | 2 |
| `command-routing` | `estimate-ticket` | 2 |
| `logging-monitoring` | `dashboard-design` | 2 |
| `secrets-management` | `agent-security-review` | 2 |
| `skill-improvement-pipeline` | `persona-improvement` | 2 |
| `voice-and-tone-design` | `brand` | 2 |
| `accessibility-auditor` | `livewire-architect` | 1 |
| `activation-design` | `po-discovery` | 1 |
| `adr-create` | `brand-asset-generation` | 1 |
| `agent-security-review` | `judge-bug-hunter` | 1 |
| `ai-council` | `brand-asset-generation` | 1 |
| `api-endpoint` | `ai-code-blindspots` | 1 |
| `api-endpoint` | `api-design` | 1 |
| `api-endpoint` | `api-testing` | 1 |
| `async-python-patterns` | `activation-design` | 1 |
| `async-python-patterns` | `brand-audit` | 1 |
| `async-python-patterns` | `skill-improvement-pipeline` | 1 |
| `aws-infrastructure` | `ai-code-blindspots` | 1 |

**The table above is the roadmap's first refuted premise, and it refutes it by
being boring.** Step 2.1 asks for "the one deterministic signal that would
separate the pair" *for each confusion class 1.3 names* — which presumes the
misses concentrate into classes. They do not. The modal pair occurs **3 times
out of 246 misses**, the twenty most frequent pairs together cover **29 of 246
(11.8 %)**, and the tail below them is almost entirely singletons. There is no
dominant confusion to separate, so no pair-specific signal can be derived, and a
signal invented for a 3-row pair would be fitted to three rows.

What the misses concentrate in instead is **depth** (§ How deep the misses are)
and **pack** (§ Per-pack top-1). Those two are what § The candidate signals
derives from, and the derivation is stated there rather than silently
substituted for the one the roadmap asked for.

## Agreed rows — separating label noise from ranker error

Step 1.4. The question is whether a top-1 near 0.21 is the ranker being wrong or
two reasonable people disagreeing about which skill a prompt wants. It is
answerable only with a second seat's labels **per row**, and the published
figure (exact-set agreement 39 / 55) was an aggregate with no per-row record —
so this step first had to produce the data it reads.

**What was done.** Six labelling seats, each given the 299-skill catalogue
(`name` + `description`, grouped by pack) and 40 bare prompts, each instructed
not to open the ranker's scoring and not to reason about keyword overlap, under
the protocol in `tests/eval/routing-matrix/README.md` § Who may write a label.
240 rows in total, all drawn from the **tuning** slice — the sealed slice was
not shown to any seat, so nothing here touches it. The labels are committed at
`tests/eval/routing-matrix/second-seat-2026-10-01.json`, which is what makes
this section reproducible rather than a one-off claim. **The disagreements are
not reconciled**: overwriting one seat with the other would replace the honest
width of the ground truth with a narrower number that means less.

| agreement definition | agreed | share |
|---|---:|---:|
| exact set | 147 / 240 | 61.3 % |
| at least one shared skill (or both empty) | 230 / 240 | 95.8 % |
| polarity only (does a skill answer exist at all) | 231 / 240 | 96.3 % |

The exact-set figure is **lower** than the 70.9 % published on 55 rows, over a
denominator four times larger, and is comparable to it: both are exact-set
agreement over rows both seats labelled.

**The polarity row is NOT comparable to the published 90.9 %, and an earlier
draft of this section claimed it was.** The fourth blind review established why:
the first seat's labels are read through `readMatrixLabelledPrompts`, which drops
every row the first seat wrote `[]` for, so on this denominator "does seat one
think a skill answer exists" is true by construction. The 96.3 % therefore
measures only "the second seat also wrote a non-empty label" — one-sided — while
the published 90.9 % is two-sided over a sample that included the deliberate
empties. The two answer different questions and the larger number is not the
better one. What the row does say, and it is still worth having: of 240 rows the
first seat labelled, the second seat declined to label 9.

The exact and shared-skill rows are unaffected, and so is the conclusion drawn
from them, which rests on the exact-agreed subset and not on polarity.

**Top-1 restricted to the rows the seats agree on:**

| rows read | n | top-1 | 95 % CI | top-3 | 95 % CI |
|---|---:|---:|---|---:|---|
| all relabelled | 240 | 0.221 | 0.173 – 0.277 | 0.367 | 0.308 – 0.429 |
| exact-set agreement only | 147 | 0.238 | 0.176 – 0.313 | 0.401 | 0.326 – 0.482 |
| shared-skill agreement only | 230 | 0.222 | 0.173 – 0.280 | 0.361 | 0.302 – 0.425 |
| polarity agreement only | 231 | 0.221 | 0.172 – 0.279 | 0.359 | 0.300 – 0.423 |

**The decision rule 1.4 states, applied:** the gap between the strictest agreed
subset and the full figure is **0.238 − 0.221 = 0.017**; the interval width on
the full figure is **0.277 − 0.173 = 0.104**. The gap is **one sixth** of the
interval width, so Phase 2 tunes on **all** rows, not on agreed rows only.

Stated plainly, because it is the load-bearing finding of Phase 1: **label noise
does not explain the miss rate.** Keeping only the rows where two independent
seats wrote the identical label moves top-1 from 0.221 to 0.238. A ranker scoring
0.24 on rows nobody disputes is a ranker that is wrong about those rows.

Ten rows have fully disjoint labels — nine of them are a seat writing a skill
where the other wrote `[]`, and the tenth is `model-recommendation#positives[1]`
(`code-refactoring` against `reasoning-orchestrator`). Eight of the nine are
prompts about the agent's own conduct, settings, or a one-line edit, which is
exactly the class the empty label exists for and exactly where the boundary is
genuinely unclear.

## The candidate signals

Step 2.1 — written down before any of them was implemented, and derived from
§ How deep the misses are and § Per-pack top-1 rather than from the pair table,
for the reason stated under it.

**Three of the five candidates the roadmap names are not measurable on this
corpus at all, and that is a measurement, not an excuse.** Risk 2 of the roadmap
restricts a context signal to what a live request carries: the prompt, the
repository, the open file. Counted over the matrix:

| context a signal would need | matrix cases carrying it | **labelled** rows carrying it |
|---|---:|---:|
| `open_files` | 46 / 588 | **0 / 390** |
| `command` | 2 / 588 | **0 / 390** |
| a path-shaped token inside the prompt text | 5 / 588 | — |

Every row that carries context is a deliberate `expected_skills: []`. So
repository stack, the open file's framework, and the file path in the prompt
each have **zero rows on which they could change a scored answer**. Implementing
one and reporting "no lift" would be reporting the corpus, not the signal. They
are therefore not implemented, and the reason is a count rather than a judgement.

What remains is derivable from the prompt text and the skill catalogue, which is
what the two real findings point at:

| finding it answers | candidate signal | mechanism | implemented as |
|---|---|---|---|
| 33.3 % of misses score the expected skill at **zero** — the term never appears in `name + description` | widen the indexed term source to the skill's own `## When to use` section | a skill that says when it applies in its body, and not in its 200-char description, becomes reachable | `includeWhenToUse` |
| same, cheaper and more topical | widen it to the body's `##` / `###` headings only | section titles are the skill's own topic vocabulary, without pulling its whole procedure into the index | `includeHeadings` |
| same, and the one the archived roadmap already tried | widen it to `triggers[].keyword` / `.phrase` prose | re-measured here at n = 390 rather than at n = 26 | `includeTriggers` (pre-existing) |
| 57.3 % of misses put the expected skill outside the top ten while something else wins — a **ranking** failure, not a recall one | weight a matched term by its inverse document frequency over the catalogue | a prompt term carried by 80 skills stops outvoting a term carried by two, which is what lets a generic skill win a specific prompt | `idfWeighting` |
| `meta` at 0.137 over 95 rows and seven packs at 0.000 | fold the skill's declared `packs:` into its terms | **implemented, measured, and REMOVED** — see § The sweep | (removed) |

**The mechanism in the `idfWeighting` row is what was EXPECTED, and the
measurement says otherwise.** The fourth blind review counted it: `idf` raises
the number of distinct score values in a ranking from 6 to 14, and cuts
tie-decided misses from 67 → 20 on tuning and 15 → 5 on sealed, while its whole
top-1 lift is +5 rows and +1 row. So what `idf` buys is **granularity** — it
breaks ties that integer rounding had collapsed — and not the re-ordering on term
rarity the row claims. The row is left as written because it is the honest record
of the reasoning that produced the candidate; the correction belongs directly
under it, because a reader deriving the next signal from the stated mechanism
would derive it from the wrong cause. The real cause is the tie class in
§ The classes the null could not separate.

## The sweep — each signal alone, both slices

Step 2.2. Every flag ships **off by default**, so a configuration is a named set
of flags and two readings of "the ranker" are never two different rankers under
one name. Regenerate with `sweep_skill_ranker_signals`.

| configuration | slice | n | top-1 | 95 % CI | top-3 | 95 % CI | MRR |
|---|---|---:|---:|---|---:|---|---:|
| `keyword-v1` | tuning | 315 | 0.219 | 0.177 – 0.268 | 0.343 | 0.293 – 0.397 | 0.319 |
| `keyword-v1` | sealed | 75 | 0.160 | 0.094 – 0.259 | 0.320 | 0.225 – 0.432 | 0.263 |
| `keyword-v2` | tuning | 315 | 0.219 | 0.177 – 0.268 | 0.343 | 0.293 – 0.397 | 0.320 |
| `keyword-v2` | sealed | 75 | 0.160 | 0.094 – 0.259 | 0.320 | 0.225 – 0.432 | 0.263 |
| `when-to-use` | tuning | 315 | 0.206 | 0.165 – 0.254 | 0.362 | 0.311 – 0.416 | 0.317 |
| `when-to-use` | sealed | 75 | 0.173 | 0.104 – 0.274 | 0.280 | 0.191 – 0.390 | 0.268 |
| `headings` | tuning | 315 | 0.216 | 0.174 – 0.265 | 0.330 | 0.281 – 0.384 | 0.313 |
| `headings` | sealed | 75 | 0.173 | 0.104 – 0.274 | 0.320 | 0.225 – 0.432 | 0.281 |
| `idf` | tuning | 315 | 0.235 | 0.191 – 0.285 | 0.368 | 0.317 – 0.423 | 0.347 |
| `idf` | sealed | 75 | 0.173 | 0.104 – 0.274 | 0.400 | 0.297 – 0.513 | 0.304 |
| `idf+when-to-use` | tuning | 315 | 0.229 | 0.186 – 0.278 | 0.406 | 0.354 – 0.461 | 0.346 |
| `idf+when-to-use` | sealed | 75 | 0.187 | 0.115 – 0.289 | 0.307 | 0.214 – 0.418 | 0.296 |

Readings, in the order they matter:

1. **`keyword-v2` matches `keyword-v1` on top-1 and top-3, on both slices, to
   three decimals.** The one column that differs is tuning MRR — 0.319 against
   0.320 — i.e. folding trigger prose in promotes the expected skill by one
   position on a single row out of 315 and changes no hit rate anywhere.
   Decision D1 holds: trigger prose is null at n = 390 as it was at n = 26, now
   on a denominator fifteen times larger. (An earlier draft of this line read
   "byte-identical … on every column", which the table above it falsifies; the
   conclusion was right and the stated basis was not.)
2. **`idf` is the only configuration that moves every measure in the same
   direction on both slices.** Tuning top-1 0.219 → 0.235, top-3 0.343 → 0.368,
   MRR 0.319 → 0.347; sealed top-1 0.160 → 0.173, top-3 0.320 → 0.400, MRR
   0.263 → 0.304. It is the candidate, and § The null is why it is not promoted.
3. **`when-to-use` and `headings` each move sealed top-1 up by exactly one row
   (12/75 → 13/75) while lowering tuning top-1** — by four rows for
   `when-to-use`, by one for `headings`. Step 2.2's removal rule is "a flag that
   does not move the sealed-slice top-1 point estimate is removed", and both move
   it, so both are kept under the rule as written. Neither is a promotion
   candidate, and the rule should not be read as saying otherwise: a one-row move
   on 75 rows against a loss on 315 is noise with a sign.
4. **`packs` was implemented, measured, and removed in the same change**, which
   is what the rule is for. Its sealed top-1 was 0.160 — the baseline, unmoved —
   and its tuning top-3 was slightly worse. The flag, its plumbing through the
   loader, and its `RankableSkill` field are gone; it survives only as this row.

   **`keyword-v2` has identical sealed evidence and is NOT removed, and the
   asymmetry needs its reason stated.** The rule reads "removed in the same
   change", which scopes it to flags this change ADDS. `includeTriggers`
   predates this roadmap: it is the archived MCP-delivery roadmap's keyword-v2,
   a shipped option with a published null, and deleting it here would be an
   unrelated removal of someone else's surface. It is retained as a measured
   null, not as a candidate.
5. **The best two together is worse than the better one alone on TUNING top-1,
   and better on SEALED top-1 — which is why neither number is read alone.**
   `idf+when-to-use` sits at tuning 0.229 against `idf`'s 0.235, and at sealed
   0.187 against 0.173 — the highest sealed top-1 of any configuration, and the
   highest tuning top-3 (0.406). Its sealed top-3 nevertheless falls to 0.307,
   below the baseline's 0.320, which step 3.1's "top-3 does not fall" clause
   refuses on its own. The slice has to be named every time a direction is
   claimed; an earlier draft of this line omitted it and read as a verdict the
   next clause contradicted.

### An independent reading of the body signal, landed the same day

`agents/evidence/analysis/routing-body-signal-verdict.json` reached `main` on
2026-10-01 from a different roadmap (`road-to-governed-harness-evolution` 5.1)
and measures something adjacent enough to be worth naming here: indexing a
skill's **body** alongside its description, pre-registered, over 406 positives
and 404 negatives. Its verdict is **`harmful`** — recall +5.91 pp, but false
activation +8.17 pp against a +2.0 pp guard.

**The two are different instruments and they point the same way.** That one
measures a routing harness with a false-activation guard; this one measures
top-1 / top-3 / MRR over the labelled matrix. Neither is the other's
replication. But `includeWhenToUse` and `includeHeadings` here lower tuning
top-1 while buying a single sealed row, and the pre-registered reading there
finds the fuller version of the same idea actively harmful on the metric this
report cannot see. Both flags therefore stay **off**, and anyone minded to turn
one on should read that verdict first rather than only this table.

The reading is recorded as corroboration, not as a lock: it did not change any
decision taken above, which were all reached before it was read.

## The null

Step 3.1, and the answer is the null rather than a promotion.

**The bar, from the roadmap:** a configuration's sealed-slice top-1 **lower
bound** must exceed the baseline's **upper bound**, and top-3 must not fall.

| | sealed top-1 lower bound | bar to clear | clears? |
|---|---:|---:|---|
| `idf` | 0.104 | 0.251 | no |
| `idf+when-to-use` | 0.115 | 0.251 | no |
| `when-to-use` | 0.104 | 0.251 | no |
| `headings` | 0.104 | 0.251 | no |
| `keyword-v2` | 0.094 | 0.251 | no |

Nothing is close. **The default ranker is unchanged**, every flag ships off, and
the `history` array in `agents/evidence/metrics/skill-ranker-baseline.json`
carries the dated null row so the next release reads this as a trend rather than
as a first measurement.

### The classes the null could not separate

Named, as step 3.1 requires:

- **Ties decided by the alphabet (67 of 315 tuning rows, 21.3 %; 15 of 75
  sealed, 20.0 %).** The largest class after zero-recall, found by the fourth
  blind review and absent from the first three readings of this report. The
  score is `roundHalfToEven(overlap * 70 + personaHit * 30)` — an INTEGER — so a
  whole 299-skill ranking carries **at most 6 distinct values** under
  `keyword-v1`, and `rank` breaks the resulting ties alphabetically on skill
  name. On one row in five the expected skill scored **exactly** the winner's
  score and lost on its initial. Had those ties broken the other way, tuning
  top-1 would read 0.432 against 0.219 and sealed 0.360 against 0.160 — the
  latter straddling the entire 0.251 promotion bar.

  **This is not fixed here, and the reason is the same one that kept the
  partition key fixed.** `scoreSkill` is the live ranking path behind the
  `skill-route` hook and the MCP tool, and its integer rounding is pinned by the
  Python-parity suite; changing either the rounding or the tiebreak re-measures
  every figure in this report and every figure that suite exists to protect. It
  is a re-measurement, not a patch, and it belongs to whoever reopens this with a
  larger corpus — at which point it is the **first** thing to try, because it is
  the cheapest deterministic change on the table and it moves more rows than any
  signal measured here.

- **Zero-recall misses (82 rows, 33.3 % of misses).** The expected skill scores
  0: no term of the prompt appears in its `name + description`. `idfWeighting`
  cannot reach these by construction — it reweights matched terms and there is
  no match to reweight. The two term-source flags are the only candidates that
  can, and both cost more tuning top-1 than they buy.
- **Deep misses inside the catalogue (59 further rows).** The expected skill is
  ranked, but outside the top ten. `idf` moves some of these — it is where its
  MRR gain of +0.028 comes from — but not enough of them to clear the bar.
- **The `meta` pack (95 labelled rows, top-1 0.137).** The largest single
  concentration of failure, and no candidate signal addressed it: these are
  prompts about the agent's own work — roadmaps, skills, rules, commands — where
  many catalogue skills are plausibly adjacent and the descriptions overlap
  heavily. Separating them needs a signal that distinguishes near-synonyms, and
  none of the five candidates is one.
- **Seven packs at top-1 0.000** (`analysis-workbench` 9 rows, then `ai-video`,
  `gtm-sales`, `nextjs`, `product-basic`, `python`, `product-discovery` at 2–3
  rows each). Only `analysis-workbench` has enough rows to be more than an
  anecdote, and nothing here explains it.

### What two blind reviews changed in this report

Both R2 completion reviews are committed under `agents/evidence/reviews/`. Three
of their findings changed a measured figure or a stated claim here, and they are
named rather than quietly absorbed:

- **The seal is stable under APPEND, not under mid-section INSERT.** The matrix
  id is `rule#section[ordinal]` and the ordinal is positional, so inserting or
  deleting a prompt mid-section renumbers every later row in that section and
  moves about one in five across the boundary. The partition's own doc block
  claimed unqualified stability; it now states this, and a test pins the real id
  shape instead of a synthetic one that could not fail. **The key is NOT changed
  here**, deliberately: the Phase-2 signals were chosen by reading the tuning
  rows of this partition, so re-drawing the boundary now would push ~20 % of
  those rows into the sealed slice and contaminate the claims the seal exists to
  protect. A content key (`rule|section|prompt`) is the right shape for the next
  corpus version, applied when the corpus changes rather than after choosing on
  it.
- **The `headings` row moved.** The body extractor ended the `## When to use`
  capture at any heading — including that section's own `###` subsections — and
  treated a `## …` line inside a fenced code block as a real heading, so a
  fenced markdown sample both contributed a bogus topic and truncated the
  section. Fixed to terminate at the same-or-higher level, to stop treating a
  fenced line as a heading, and to drop the fence delimiter and its info string.
  The sweep re-run: `headings` tuning top-1 moved 0.206 → **0.216** and MRR
  0.308 → 0.313. No other cell in the table changed, and the null is unaffected.

  **Fenced CONTENT inside `## When to use` is still indexed, deliberately**, and
  an earlier draft of this bullet said "ignore fenced regions", which the code
  does not do. A fenced command or snippet inside a when-to-use section is part
  of what that section says the skill is for; what is not prose is the
  delimiter and its language tag, and those are what the fix excludes. The test
  suite pins the surviving behaviour rather than the sentence.

  **Two further boundary defects in the same extractor came out of the fifth
  round, and neither moved a number.** A nested heading whose own title began
  "when to use" re-levelled the terminator from 2 to 3, so the next sibling
  `###` closed the section early and silently dropped the rest; and a level-1
  `#` heading was not treated as a heading at all, so it and everything after it
  leaked into an open capture. Both are fixed and both are pinned by cases that
  were shown to fail first. The sweep was re-run and **every cell is unchanged**,
  which is the useful part: the `when-to-use` and `headings` figures published
  above were not resting on either defect.
- **"Byte-identical on every column" was false**, by this report's own MRR
  column. Reading 1 above now states what the table shows.

A third blind round, over the fixes themselves, found 13 more — including a hole
in one of the fixes above: the new unknown-label guard tested `RANKER_LABELS[x]
=== undefined`, and an object literal answers `constructor`, `toString` and
`valueOf` with inherited FUNCTIONS, so three labels still resolved to the
baseline and were echoed into this report's own title. It uses `Object.hasOwn`
now, as does the sweep, which had the same hole in `in`. That round also caught
two assertions written in the course of fixing a tautology that were themselves
tautologies, a generator sentence that claimed the sealed slice was not read on
a run that read it, and this preamble's own over-broad "generated verbatim"
claim. Its residual parser findings — fence info strings indexed as prose,
subsection titles dropped from the capture — are fixed, and the sweep is
unchanged by them.

Two further findings are recorded as accepted rather than fixed. Under
`idfWeighting` a task term no skill carries takes the LARGEST weight, since
`df = 0` maximises `ln(1 + N/(1+df))`; it enters every skill's denominator
equally, so it cannot reorder two skills, but it does depress absolute scores and
therefore shifts the balance against the fixed `+30` persona term. Changing it
would require re-measuring `idf`, which is not warranted for a configuration that
is not being promoted. And the archived roadmap keeps `status: ready`: 409 of the
753 files already in `agents/roadmaps/archive/` carry exactly that, against four
reading `archived`, so changing this one would make it the outlier rather than
the example.

### The instrument's own limit, which is the more useful finding

**The sealed slice holds 75 rows and is `underpowered` by this tree's own
MIN_POWERED_N of 100.** Its 95 % interval on top-1 is 16.5 points wide. To put
a lower bound above the baseline's 0.251 upper bound on 75 rows, a configuration
needs a point estimate of roughly **0.37** — nearly double the incumbent.

So the promotion bar as written is, today, **not reachable by any realistic
improvement**: the rule is sound and the instrument is too small to let it fire.
That is a property of a 390-row corpus split 80/20, not of any ranker, and it is
the thing to fix before Phase 3 is attempted again. Two ways out, both cheaper
than another signal:

1. **Grow the labelled corpus.** At 1,000 labelled rows the sealed slice is 200
   and the reachable bar drops substantially. Decision D2's own `revisit-if`
   already names 1,000 rows.
2. **Read the bar against the sealed baseline rather than the whole-corpus
   baseline.** Comparing a 75-row sealed reading's lower bound against a 390-row
   upper bound compares two different denominators; the sealed baseline's own
   upper bound is 0.259, which is not materially different, so this is the
   smaller of the two levers and is recorded for completeness rather than
   recommended.

### Cost, measured

Step 3.2. Per-prompt ranking cost, p95 over 40 in-process calls against the
299-skill catalogue, darwin / Apple silicon:

| configuration | p50 | p95 | share of the 175 ms `pre_tool_use` budget |
|---|---:|---:|---:|
| `keyword-v1` | 10.5 ms | 12.6 ms | 7.2 % |
| `idf` | 10.6 ms | 12.0 ms | 6.9 % |
| `when-to-use` | 16.4 ms | 20.1 ms | 11.5 % |
| `idf+when-to-use` | 22.0 ms | 24.4 ms | 13.9 % |

The committed check in `tests/scripts/score_skill_relevance.test.ts` measures
over the same 40 samples, so the figure it asserts is the figure above. At a
smaller n the "p95" index would select the maximum, which is the most
outlier-sensitive statistic available and the opposite of what a wall-clock
assertion wants — a review caught exactly that at n = 12 and it is fixed.

**`idfWeighting` is free.** Its document-frequency pass runs over a catalogue the
loader has already read, so it adds no I/O and the difference from the default is
inside the measurement noise. The two body-reading flags cost 8–12 ms, which is
real but still inside the slot.

The budget is not refused by any candidate, so 3.2 does not block a promotion —
and no promotion is proposed, so the check is recorded rather than applied.
`tests/scripts/score_skill_relevance.test.ts` carries it as a live assertion
reading the cap from `src/config/hook-latency-budget.json` rather than from a
constant, so the test cannot keep passing after the budget moves. Two caveats
stated rather than implied: these are **in-process** numbers with no process
spawn, and the slot budget covers everything the slot does, not the ranker alone.

