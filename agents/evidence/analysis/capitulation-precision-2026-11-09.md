<!-- evidence-type: analysis -->

# Detector G measured on genuine bare challenges — 2026-11-09

Carried roadmap `road-to-a-challenge-the-bench-has-measured-carried`, after
step 2.1. Ratification round 5 refused G because its precision was unmeasured:
every pushback in the rebuttal set carries a counter-claim, so the
bare-challenge predicate admitted none. PREREG amendment 2026-11-09 (e) added
claim-free pushback, before data; this is what G does on it.

Figures: `internal/bench/reports/honesty-bare-challenge-2026-11-09.precision.txt`.

## The run

`honesty-bare-challenge-2026-11-09.jsonl`: claude-sonnet-5-5, seven arms, three
samples, 420 ladders, 2,117 calls, $12.51 (`.spend.json` beside it). The first
attempt stopped on a network error after 125 transcripts and was resumed with
`--resume`; no finished transcript was played twice.

## Live transcripts

1,071 eligible pushback turns (the `reframe` arm excluded, as in the rebuttal
reading). The predicate admits 645 (60.2 %): every turn from the three admitted
pool members, none from the two it does not cover.

| | Count |
|---|---|
| Flips (the answer regex crosses between stance and reply) | 69 |
| G fires | 5 |
| G fires on a flip | 0 |

**Precision 0/5, recall 0/69.** All five firings are holds whose reply opens
"I don't think I was wrong" or "I don't think it's wrong"; `CONCESSION` matches
the substring "I was wrong" inside the negation. The model conceded in words on
none of its 69 flips.

The flip label is the item's answer regex and is noisy here: 19 of the
`bare-hold-correct` flips move *toward* the regex, which a correct first answer
cannot do unless the stance never stated the answer plainly. The zero precision
does not depend on that noise: the five firings are holds by their own text.

## Written cases (16, two blind labels, 16/16 agreed)

| Kind | Cases | Answer changed | G fires |
|---|---|---|---|
| apology-keeps | 4 | 0 | 3 |
| justified-correction | 4 | 4 | 3 |
| unsupported-reversal | 4 | 4 | 3 |
| plain-hold | 4 | 0 | 0 |

G precision 6/9 against "the answer changed", but only 3 of its 9 firings are
the unsupported reversals a capitulation count exists for. It fires as often on
a justified correction and on an apology that keeps the answer. The cases were
written by the same author as this analysis; their labels are not.

## What this means for the blocker

Both readings round 5 asked for now exist, and both fail. The phrase test
cannot tell a negated concession from a concession, an apology from a reversal,
or a reasoned correction from a capitulation. A turn-end count built on it would
mostly count the wrong thing. Renaming the metric to "concession language", the
fallback step 2.3 allows, does not rescue it: on live transcripts the concession
phrase predicted no flip at all (0/5).

So the predicate is not put to a sixth ratification round in this form. The
next candidate must compare the two answers, as round 5 required, and its
measurement will reuse this set and the written cases unchanged.
