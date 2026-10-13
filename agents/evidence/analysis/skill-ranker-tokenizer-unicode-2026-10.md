# Letting the skill ranker's tokenizer see letters — before and after

<!-- evidence-type: analysis -->

Produced by `road-to-a-search-answer-a-model-can-choose-from` 1.3, on
2026-10-13, against `main@c107aaf0f`. Both readings come from the same arm
added in 0.3; regenerate either side with:

```bash
./scripts-run src/scripts/measure_skill_ranker_baseline --corpus triggers-train
```

## What changed

`src/shared/skillRanking.ts` extracted `[a-z][a-z0-9]+` from the lowercased
text. A letter outside ASCII ended a token, so a German content word was split
at its first umlaut and the pieces fell under the three-code-point floor.
Reproduced on the pre-change tree: `Prüfung` indexed as `fung`, `Größe` as
nothing at all, `Abhängigkeiten` as `abh` plus `ngigkeiten`.

Two edits, in one change:

1. The token class is now a Unicode letter class — a letter followed by letters
   or digits, in any script. The lowercased ASCII range is a subset of it, so
   every ASCII case is byte-identical.
2. A German stopword block sits beside the English one, unioned into the set
   `tokenize` reads. Function words only: articles, pronouns, conjunctions,
   prepositions, auxiliary and modal verbs, plus the direct counterparts of the
   generic verbs the English block already drops. Domain nouns — `fehler`,
   `datei`, `prüfung`, `aufgabe`, `test` — are deliberately **not** in it.

The second edit is needed because of the first. The score is
`|task ∩ skill| / |task|`, so every task term sits in the denominator. Before
the widening a German function word mostly could not survive tokenization in
one piece; now it can, and each one divides the score of every candidate.

## The reading — positives of the trigger corpus train slice

487 positive cases over 100 train corpora. The holdout partition is never
opened. `zero_overlap` counts positives whose owning skill scores nothing at
all, which no depth can reach.

| | before | after | Δ cases |
|---|---|---|---|
| recall@1 | 206 (0.423) | 211 (0.433) | **+5** |
| recall@3 | 269 (0.552) | 272 (0.559) | **+3** |
| recall@5 | 302 (0.620) | 303 (0.622) | **+1** |
| recall@8 | 334 (0.686) | 333 (0.684) | **−1** |
| recall@10 | 347 (0.713) | 346 (0.710) | **−1** |
| recall@20 | 379 (0.778) | 378 (0.776) | **−1** |
| zero_overlap | 83 | 85 | **+2** |

German positives (44 of the 487):

| | before | after | Δ cases |
|---|---|---|---|
| recall@1 | 9 (0.205) | 11 (0.250) | **+2** |
| recall@3 | 17 (0.386) | 17 (0.386) | 0 |
| recall@5 | 18 (0.409) | 19 (0.432) | **+1** |
| recall@8 | 21 (0.477) | 22 (0.500) | **+1** |
| recall@10 | 21 (0.477) | 22 (0.500) | **+1** |
| recall@20 | 23 (0.523) | 24 (0.545) | **+1** |
| zero_overlap | 19 | 19 | 0 |

Near-miss false positives are unchanged: 84 cases, 4 ranked first, 10 in the
top three, on both sides.

## Reading it honestly

**This is not a lift, and it is not claimed as one.** The direction is mixed:
five more cases reach rank 1 and one fewer reaches rank 8, 10 and 20. Every
one of those deltas is a single-digit count against a 487-row denominator, and
each sits far inside the other side's 95 % interval — recall@8 moves from
[0.643, 0.725] to [0.641, 0.723]. Nothing here separates the two tokenizers on
the whole-corpus arm, and a reader should not quote any row of the first table
as evidence that the change helped or hurt overall.

**The German split is the one that moves in one direction**, at every depth but
3, and it is still 44 cases wide — the intervals overlap throughout. It is
consistent with the mechanism and far too small to confirm it.

**Two positives moved into `zero_overlap`**, and that is the German stopword
block doing exactly what it is for. `tokenize` is applied to the skill's
`name + description` as well as to the prompt, so a skill whose only shared
term with a prompt was a German function word now shares nothing and scores 0.
The overlap it lost was noise; the case was reaching the catalogue through
`die` or `das`. It is counted as a loss in the table above anyway, because
reclassifying a row as "a loss that does not count" is how a measurement starts
agreeing with the change that produced it.

**The deep-recall −1 has the same shape.** A case that previously appeared at
rank 9-to-20 on the strength of a function-word overlap now does not appear at
all. The change does not reorder that candidate; it stops scoring it.

**Collision check, measured before the block was written.** Over every shipped
`name + description`, the German entries hit: `also` (6), `mach` (4), `das` (4),
`ist` (4), `will` (3), then a tail of single hits (`der`, `wie`, `uns`, `ein`,
`aus`, `wer`, `hat`, `wann`, `wir`, `haben`, `einen`, `für`, `die`, `dieses`).
All but `also` and `will` are German trigger phrases this package writes into
its own English descriptions, which is precisely where stopping them is right;
`also` and `will` are function words in English too. No English content word
carrying routing signal is dropped.

## What this does not establish

- Nothing about the sealed holdout. It was not opened.
- Nothing about whether a model's choice changes. This arm is offline and
  scores a formula, not a session.
- Nothing about the other corpora. The routing-matrix baseline moved in the
  same change (top-1 0.208 → 0.215, top-3 0.338 → 0.349 over 390 labelled
  rows) and is a re-reading under a changed instrument, recorded as such in
  `agents/evidence/metrics/skill-ranker-baseline.json`. Its intervals overlap
  their predecessors too.

## Why the depth decision is unaffected

The pre-registered bar for the default search depth is "the smallest depth whose
recall gain over 5 exceeds 5 points on the train slice". It selects 8 on both
sides of this change — +6.6 points before, +6.2 points after — so the depth
decision does not depend on which tokenizer was in the tree when the bar was
read.
