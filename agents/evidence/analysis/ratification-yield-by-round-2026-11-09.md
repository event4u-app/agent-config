<!-- evidence-type: analysis -->

# Council ratification yield by round

Measured for step 3.1 of `road-to-a-review-that-ends` (Phase 3, council
ratification rounds), read at `8494dab7f3`. It counts, per ratification round
of one change, how many defects the council raised that had not been raised
before, how many of those were fixed before the next round, and how many were
caused by the fix made after the previous round. It is the F6 table for the
ratification loop. It makes no recommendation about a cap.

## Method

**Read.** Every question packet of the three subjects with three or more
rounds:

- `agents/evidence/council/session-pins-phase-2-20261108.question.md` and
  `.round2` … `.round56.question.md` (56 rounds);
- `agents/evidence/council/compact-checkpoint-concern-20261108.question.md` and
  `.round2` … `.round20.question.md` (20 rounds);
- `agents/evidence/council/denies-name-no-bypass-20261108.question.md` and
  `.round2` … `.round11.question.md` (11 rounds);

and the three ratification records
`agents/evidence/ratifications/session-pins-phase-2-20261109.md`,
`compact-checkpoint-concern-20261108.md` and
`denies-name-no-bypass-20261108.md`. Council replies are not kept in the tree,
so round N is reconstructed from the packet for round N+1, which restates what
round N raised and what changed. The last round of each subject is
reconstructed from its ratification record (session pins: round 56's seat
replies are quoted verbatim there; the others summarise). `git log` did not
help date rounds: the packets of each subject were committed in one to three
batches.

**Counting rule.** One defect is one numbered item, or one clause of a
"round N found A, B and C" sentence, in the packet's "what changed" section.
Not counted: items that only re-measure or raise a byte ceiling as a
consequence of another change ("Budget."), and points the packet answers with
"not changed" or "stated, not fixed". "New" means not raised in an earlier
round of the same subject; a point raised again after an earlier round
declined or withdrew it is marked *re-raised* and not counted.

**Basis.** The packets do not all describe a round the same way, so every
count carries its basis:

- **F** — the packet states each item as what the round found (or as the
  defect itself: "X did Y; now …").
- **C** — the packet lists only the changes made after the round, without
  attributing each to a finding. These are counted as defects raised and fixed,
  because the packet presents them as the response to that round, but a C item
  may also be a change the author made unprompted. The packets do not let the
  two be told apart.
- **M** — mixed; the cell shows the split, e.g. `2F+3C`.

**Introduced by the previous fix.** Counted only when the packet says so
("added in round 3", "in the round-30 recovery") — marked *explicit* — or when
the defect's site is something the immediately preceding "what changed"
section introduced as new (a marker, file, branch, comment or test that did not
exist before that fix) — marked *traced*, with the trace in the notes. Every
other defect in the round is **unknown**: the packets do not show whether it
was latent in the original change or created by a fix, and no diff analysis
was done to decide it. `0` is written only where the packet states that no code
changed since the previous round.

**Unknown** in any cell means the files read do not let the value be
determined. Nothing was estimated.

**Spend.** No packet, ratification record or commit message read states the
council spend of any round. Spend is **not recorded** for all 87 rounds, so
cost per real defect fixed cannot be computed from these files.

**Seat verdicts.** As stated in a packet or ratification record. "against"
means the packet says the seat did not ratify without naming the verdict word.
Where only a round-level outcome is stated, it is given as such.

## Session pins (`session-pins-phase-2-20261108`, 56 rounds)

The change: session pins captured from `pin:` lines and restored after
compaction, plus three budget rows. Merged on the owner's word with round 56
refused by both seats and its fix not re-reviewed.

| round | new defects (basis) | fixed before next round | introduced by previous fix | seat verdicts | notes |
|---|---|---|---|---|---|
| 1 | 7 (F) | 7 | — | both `request_changes` | 1 point not changed |
| 2 | 6 (F) | 6 | unknown | both against | incl. packet budget figures not matching the diff |
| 3 | 3 (F) | 3 | unknown | both against | 2 points not changed |
| 4 | 6 (2F+4C) | 6 | 2 explicit | both against | "defects in the transcript-based follow-up added in round 3"; follow-up replaced |
| 5 | 4 (F) | 4 | 3 traced | both against | pending-marker restatement and count-only notice added after round 4 |
| 6 | 3 (F) | 3 | 2 traced | both against | `.restated` marker and prompt-first restatement added after round 5 |
| 7 | 3 (F) | 3 | unknown | both against | 1 point not changed |
| 8 | 4 (F) | 4 | 3 traced | one against, one timed out | generation and `.delivered` added after round 7; protocol redesigned to one record |
| 9 | 3 (F) | 3 | 3 traced | both against | generation ordering, record and in-band lock note added after round 8 |
| 10 | 2 (F) | 2 | 1 traced | both against | timestamp+UUID ordering added after round 9 |
| 11 | 4 (F) | 4 | 3 traced | both against | `beginCompaction` and counter added after round 10 |
| 12 | 3 (F) | 3 | 1 traced | both against | `.boundary` file added after round 11 |
| 13 | 5 (4F+1C) | 5 | 2 traced | both against | acknowledge-then-remove and unreadable-is-present added after round 12 |
| 14 | 5 (C) | 5 | unknown | both against | |
| 15 | 4 (3F+1C) | 4 | 3 traced | one against, one timed out | `tool_seen`, `unreadable_delivered` and race test added after round 14 |
| 16 | 2 (1F+1C) | 2 | 1 traced | both against | one-stamp-in-two-places design added after round 15 |
| 17 | 4 (C) | 4 | 1 traced | not recorded | acknowledgement set added after round 16 |
| 18 | 5 (C) | 5 | unknown | not recorded | |
| 19 | 6 (1F+5C) | 6 | unknown | not recorded | F item: both seats asked for evidence the packet omitted |
| 20 | 4 (2F+2C) | 4 | unknown | not recorded | "both seats found two defects"; 1 point stated, not changed |
| 21 | 3 (1F+2C) | 3 | unknown | not recorded | |
| 22 | 3 (1F+2C) | 3 | unknown | not recorded | |
| 23 | 4 (1F+3C) | 4 | unknown | not recorded | |
| 24 | 3 (2F+1C) | 3 | 1 traced | not recorded | attributed-opener rule added after round 23 |
| 25 | 4 (1F+3C) | 4 | 1 traced | not recorded | line-based opener parser added after round 24 |
| 26 | 4 (1F+3C) | 4 | 2 traced | not recorded | tag-line lead rule and claim-by-rename added after round 25 |
| 27 | 4 (C) | 4 | unknown | not recorded | |
| 28 | 2 (1F+1C) | 2 | unknown | not recorded | 1 point answered, not changed |
| 29 | 4 (C) | 4 | unknown | not recorded | |
| 30 | 3 (F) | 3 | unknown | not recorded | |
| 31 | 4 (F) | 4 | 3 explicit | not recorded | "three commit windows in the round-30 recovery" |
| 32 | 4 (2F+2C) | 4 | unknown | not recorded | 2 points considered, not changed |
| 33 | 3 (2F+1C) | 3 | 1 traced | not recorded | recovery count added after round 32 |
| 34 | 3 (2F+1C) | 3 | 1 traced | not recorded | rename-then-link count added after round 33; 3 points answered |
| 35 | 4 (3F+1C) | 4 | 1 traced | not recorded | ledger added after round 34 |
| 36 | 3 (2F+1C) | 3 | 2 traced | not recorded | fallback counter added after round 35 |
| 37 | 5 (4F+1C) | 5 | 1 traced | not recorded | empty-ledger removal added after round 36 |
| 38 | 2 (F) | 2 | unknown | not recorded | |
| 39 | 2 (F) | 2 | unknown | not recorded | 1 further request answered, not changed |
| 40 | 4 (F) | 4 | 1 traced | not recorded | bundle-side notice added after round 39 |
| 41 | 1 (C) | 1 | unknown | not recorded | |
| 42 | 4 (C) | 4 | unknown | not recorded | |
| 43 | 5 (F) | 4 | unknown | not recorded | "the round raised five points"; owner chose a simpler protocol; splitting the language change declined |
| 44 | 5 (C) | 5 | 3 traced | not recorded | envelope regex, unrecorded lock-failure line, removed-recovery test titles from the round-43 redesign |
| 45 | 3 (F) | 3 | 1 traced | one answered, one timed out | bare-opener check added after round 44 |
| 46 | 4 (C) | 4 | unknown | not recorded | 3 points not changed (one re-raised in round 56) |
| 47 | 3 (C) | 3 | 1 traced | not recorded | stamp-length refusal added after round 46 |
| 48 | 2 (C) | 2 | unknown | not recorded | the unreadable-record `null` was added after round 46, not after round 47 |
| 49 | 2 (C) | 2 | 1 traced | not recorded | `null`-means-lock-failure wording added after round 48 |
| 50 | 3 (C) | 3 | unknown | not recorded | |
| 51 | 3 (C) | 3 | unknown | not recorded | one item stated as pre-existing in `hooks/state_io.ts` |
| 52 | 3 (1F+2C) | 3 | unknown | not recorded | F item: a packet excerpt copied from an earlier round |
| 53 | 2 (C) | 2 | 1 traced | not recorded | lock-retry pacing added after round 52 |
| 54 | 2 (F) | 2 | unknown | not recorded | P1 stale-lock reclaim race, pre-existing on `main`; P2 notice; author also reported a flaky test |
| 55 | 3 (2F+1C) | 3 | 2 explicit | round refused; both asked for the lock work in its own change | both defects in the round-54 reclaim fix; fixed by withdrawing that fix |
| 56 | 1 (F) | 2, after the round | unknown | anthropic `refused`, openai `request_changes` (recorded `refused`) | new: test collected output on `exit`; the blocking point (strict callers inherit the reclaim race) is *re-raised* from round 54; fix commit `8767ad284f`, not re-reviewed |

Round 56's two seat replies, quoted in the ratification record, also name
points the earlier packets give no equivalent for: unreadable pin files kept
forever by retention, no combined-bound test for the lock-failed note, a
description error about how often marker failures are reported, and the
`LOCK_FAILED_NOTE` constant not visible in the diff. They are not in the count,
because no other round's non-blocking points are visible at that level of
detail. Windows rename portability is *re-raised* from round 46.

Total counted: 197 defects over 56 rounds.

## Compact checkpoint (`compact-checkpoint-concern-20261108`, 20 rounds)

The change: a telemetry-only `compact-checkpoint` concern and its budget row.
Ratified by both seats at round 20.

| round | new defects (basis) | fixed before next round | introduced by previous fix | seat verdicts | notes |
|---|---|---|---|---|---|
| 1 | 5 (F) | 5 | — | round-level: not ratified | ratification record: every round before 15 ended `request_changes` or `refused` |
| 2 | 5 (F) | 4 | 1 traced | round-level: not ratified | log read whole before trimming; trimming added after round 1. Concurrency stated, not fixed |
| 3 | 3 (F) | 3 | 1 traced | round-level: not ratified | bounded reader added after round 2 |
| 4 | 1 (F) | 1 | unknown | round-level: not ratified | one finding over three readers; two of them were the subject of a round-3 item. Fixed by removing task state from the marker |
| 5 | 4 (C) | 4 | unknown | round-level: not ratified | |
| 6 | 4 (C) | 4 | unknown | round-level: not ratified | ratification record names 2 defect classes here; storage moved out of the repository |
| 7 | 4 (C) | 4 | unknown | round-level: not ratified | |
| 8 | 1 (F) | 1 | 1 traced | round-level: not ratified | retention sweep added after round 7 |
| 9 | 1 (C) | 1 | unknown | round-level: not ratified | |
| 10 | 5 (F) | 5 | 2 traced | both seats named the same 2 blockers | 2 blockers + 3 follow-ups; write refusal added after round 9 |
| 11 | 4 (1F+3C) | 4 | 1 traced | round-level: not ratified | capacity rule added after round 10; 2 points stated, not fixed |
| 12 | 3 (F) | 3 | 2 traced | round-level: not ratified | 1 blocker + 2 follow-ups; comment and hook-entry tests added after round 11 |
| 13 | 4 (1F+3C) | 4 | unknown | round-level: not ratified | the race was narrowed, not closed |
| 14 | 2 (F) | 2 | 1 traced | round-level: not ratified | `written_at` comparison added after round 13 |
| 15 | 0 | — | — | anthropic `ratified`, openai approve | |
| 16 | 0 | — | 0 | one seat would not judge (seat not named) | base moved; packet omitted the implementation (a packet defect, not counted) |
| 17 | 0 | — | 0 | anthropic `ratified`, openai approve | |
| 18 | 1 (F) | 1 | 0 | one seat named a blocker; other not recorded | packet: no branch code changed since round 15; base moved again |
| 19 | 1 (F) | 1 | 1 traced | both seats named the blocker | flag check added after round 18 ran after the log-trim branch |
| 20 | 0 | — | — | anthropic `ratified`, openai approve | |

The ratification record lists four non-blocking follow-ups both seats named
without saying in which round; they are not in the count. Total counted: 48
defects over 20 rounds.

## Deny texts (`denies-name-no-bypass-20261108`, 11 rounds)

The change: five governance hooks' deny texts, plus the lint that checks deny
texts. Every round found the hook edits non-expanding; every counted defect is
in the lint (`lint_deny_text.ts`), which is not a gated file. Ratified.

| round | new defects (basis) | fixed before next round | introduced by previous fix | seat verdicts | notes |
|---|---|---|---|---|---|
| 1 | 4 (F) | 4 | — | not recorded per seat; hook text non-expanding | |
| 2 | 2 (F) | 2 | unknown | openai timed out; anthropic verdict not recorded | |
| 3 | 3 (F) | 3 | unknown | openai `request_changes` (lint) | |
| 4 | 2 (F) | 2 | unknown | openai `request_changes` (lint) | items from the ratification record; packet 5 does not enumerate them. Lint rewritten on the TypeScript AST, which found a fifth hook (author-found, not counted) |
| 5 | 2 (F) | 2 | unknown | openai `request_changes` (lint) | |
| 6 | 3 (F) | 3 | unknown | openai `request_changes` (lint) | |
| 7 | 3 (F) | 3 | unknown | anthropic `ratified`, openai `request_changes` (lint) | |
| 8 | 2 (F) | 2 | unknown | anthropic `ratified`, openai `request_changes` (lint) | |
| 9 | 1 (F) | 1 | unknown | anthropic `ratified`, openai `request_changes` (lint) | |
| 10 | 2 (F) | 2 | unknown | anthropic `ratified`, openai `request_changes` (lint) | fix-loop bound (10) reached; the lint header narrowed its claim |
| 11 | 1 (F) | 1, after the round | unknown | anthropic `ratified`, openai `confirmed-non-expanding` on the hooks, with one lint miss | item from the ratification record; no further round |

Anthropic's verdicts for rounds 1 and 3–6 and OpenAI's for round 1 are not
stated in the files read. Total counted: 25 defects over 11 rounds.

## Pooled yield by round

Mean new defects per subject at each round, over the subjects that had that
round. "all bases" uses every count above; "F only" uses only subject-rounds
whose basis is F.

| round | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| subjects contributing | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| mean new defects, all bases | 5.33 | 4.33 | 3.00 | 3.00 | 3.33 | 3.33 | 3.33 | 2.33 | 1.67 | 3.00 | 3.00 |
| subject-rounds with basis F | 3 | 3 | 3 | 2 | 2 | 2 | 2 | 3 | 2 | 3 | 2 |
| mean new defects, F only | 5.33 | 4.33 | 3.00 | 1.50 | 3.00 | 3.00 | 3.00 | 2.33 | 2.00 | 3.00 | 2.50 |

| round | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21–56 |
|---|---|---|---|---|---|---|---|---|---|---|
| subjects contributing | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 (session pins) |
| mean new defects, all bases | 3.00 | 4.50 | 3.50 | 2.00 | 1.00 | 2.00 | 3.00 | 3.50 | 2.00 | 3.17 per round (114 over 36 rounds) |
| subject-rounds with basis F | 2 | 0 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 9 of 36 |
| mean new defects, F only | 3.00 | — | 2.00 | 0.00 | 0.00 | 0.00 | 1.00 | 1.00 | 0.00 | 2.89 |

Bucketed the way F6 buckets the completion review (all bases): round 1 5.33,
round 2 4.33, round 3 3.00, round 4 3.00, round 5 3.33, rounds 6–10 2.73 (41
over 15 subject-rounds), rounds 11–20 2.76 (58 over 21), rounds 21–56 3.17 (114
over 36, one subject).

Rounds 12–20 pool session pins with compact checkpoint; from round 21 on the
pool is session pins alone. Of the 87 subject-rounds, 36 have at least one
defect traced or explicitly attributed to the previous round's fix (28
session-pins rounds, 8 compact-checkpoint rounds, no deny-text round); 7
defects are explicit (session pins rounds 4, 31, 55), the rest traced.

## What this does not show

- **Severity.** The packets rarely grade a finding. A count of three in round
  40 and a count of three in round 3 are not shown to weigh the same; F6's
  weight-by-round claim for the completion review has no equivalent here.
- **Whether the C items were findings.** 90 of the 197 counted session-pins
  items (46 %) have basis C, as do 19 of the 48 compact-checkpoint items. If some were changes the author made
  without being asked, those rounds are overcounted.
- **Non-blocking points.** Most packets restate what was fixed, not everything
  a seat said. Where a reply is visible in full (session pins round 56) it
  names more points than were counted. Counts are therefore of acted-on
  points, which is not the same as what the council raised.
- **Latent versus fix-created defects.** "unknown" in the introduced-by column
  is not zero. The traced figures rest on reading the packets, not the diffs;
  a diff-level check could move defects in either direction.
- **Whether a fix was correct.** "fixed before next round" means the packet
  says the code changed; several later rounds found the fix itself defective
  (session pins 55 explicitly).
- **Cost.** No spend is recorded, so nothing here says what a round or a
  defect cost.
- **Generality.** Three subjects, all on 2026-11-08/09, two of them reviewed
  by the same session and the same two providers. One of them supplies every
  data point past round 20. A curve from these three is not shown to hold for
  other ratifications.
- **When a review should stop.** The table shows yield, not whether the
  defects mattered to the outcome; session pins merged with its last round
  refused, and that decision is not evaluated here.
