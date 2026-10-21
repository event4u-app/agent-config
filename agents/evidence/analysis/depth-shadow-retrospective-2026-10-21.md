<!-- evidence-type: analysis -->

# Depth shadow, read backwards over the review corpus

Measured 2026-10-21 against `origin/main` for step 2.3 of
`road-to-a-step-that-costs-what-it-changes`. The step asks how many
high/critical findings a lowered review depth would have missed. A receipt
counts that forward, one step at a time; the review corpus already holds the
answer for every review that ran, so this reads it backwards first.

## Method

1. Each review slug under `agents/evidence/reviews/` is joined to the merged
   PR whose commits contain its first header `diff:` sha (GitHub PR search by
   sha): 185 of 189 slugs matched. 189 counts slugs whose artefact carries a v1
   header with a `diff:` sha; the 293 "reviews" a first version of the sibling
   severity analysis cited counted every file, honest-null and skip artefacts
   included, and was replaced by 188 reviews that carry a finding row.
2. The PR's change class is `classify_change_risk` over its squash commit on
   the first-parent line; 74 of the matched PRs have one (the rest merged
   without a `(#N)` squash subject and are left out rather than guessed).
3. A would-have-escape is a high/critical row the class's `review` row in
   `src/config/step-depth-table.json` would not have run: every such row for
   R0 (deterministic gates only), rows of round ≥ 2 for R1 (one round), none
   for R2 and R3.

## Result

| class | reviews | with ≥ 1 high/critical | high/critical rows | critical | would-have-escaped rows |
|---|---|---|---|---|---|
| R0 | 0 | — | — | — | 0 |
| R1 | 4 | 3 | 9 | 2 | 0 |
| R2 | 22 | 12 | 35 | 1 | — |
| R3 | 48 | 22 | 76 | 4 | — |

Re-run after the completion review's findings 2, 3 and 12 with
`probe_depth_shadow --reviews`, whose parser reads archived round records and
the `round:` header and drops non-finding rows: R1 9 high/critical rows, 0
would have escaped — unchanged; R2 40 and R3 96 rows, the archived rounds
added.

**R0 has no reviews at all.** An R0 change is non-behavioural by definition,
and the completion review already takes the skip declaration for a diff with
no code surface (`plan-review-gates` § 2.4). The table's R0 review row is
what happens today.

**R1 found high/critical rows in round 1 in 3 of 4 reviews, and none after.**
So "one round" would have lost nothing on this sample, and "no review" for R1
would have lost 9 high/critical rows, 2 of them critical. The table's R1 row
is one round, not none, and this is the measured reason.

## Limits

- n = 4 for R1 is far below the 30 the pre-registered threshold (D14) needs.
  This reading informs the shadow; it does not discharge it.
- The join drops 111 reviews whose PR has no squash subject, so the classes
  above are a subset, not the corpus.
- Only the `review` row is measurable from the corpus. Council, evidence,
  retro and revalidation leave no per-step severity record to read backwards.

## Reproduce

`./scripts-run src/scripts/probe_depth_shadow --reviews` runs the three method
steps above; it reads only `agents/evidence/reviews/`, `git log` and
`gh pr list --search <sha>`.
