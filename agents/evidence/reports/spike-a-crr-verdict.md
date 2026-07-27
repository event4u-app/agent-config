# Spike A — Correction-Repeat Rate (CRR): Verdict

Part of `road-to-ai-employee-borrowings`. Full method, labelled table, and
raw counts: `agents/evidence/reports/spike-a-crr-labelled-set.md`.

## Pre-registered decision rule (verbatim)

> CRR < 0.15 → the self-evolution category solves a non-problem for this
> package — that verdict must be applied in writing.

> Also record extraction reliability: if corrections cannot be reliably
> identified, the CRR metric itself is unmeasurable and that finding parks
> the category too.

## Measured result

```
Sessions used:          40  (of 77 total; all ≥1 usable user turn)
Total usable user turns: 459
Corrections (labelled):  18
Repeats (of an earlier-
  session correction):    3
CRR = repeats / corrections = 3 / 18 = 0.1667 (16.7%)
```

Two distinct repeat clusters account for all 3 repeats:

1. **verification-accuracy** (agent asserts a completion/status claim that
   is false) — 3 occurrences, 2 repeats. Domain already covered by the
   existing `verify-before-complete` kernel rule.
2. **tmp-inbox-workflow** (consumed inbox files must move to `tmp.old`) — 2
   occurrences, 1 repeat. Domain already covered by the existing
   `roadmap-progress-sync` § inbox-workflow step.

The remaining 15 corrections were singletons with no semantic match anywhere
else in the 40-session sample.

## Applied verdict

**CRR = 0.167, which is NOT < 0.15.** The pre-registered auto-park condition
does **not** fire on the letter of the rule — this spike does **not**
conclude "the self-evolution category solves a non-problem for this
package" on the strength of the threshold alone.

That said, three things about this result must be stated plainly, because
the rule says apply it in writing, not launder it:

1. **The margin is razor-thin and N is small.** 3/18 repeats vs. a 0.15
   threshold needs ≤ 2 repeats out of 18 to pass (2/18 = 0.111). A single
   reclassification of one borderline turn (two were in fact reclassified
   from correction → new-instruction during labelling, per the conservative
   default) would have moved the result across the line in either
   direction. This is not a robust "yes, build it" signal — it is a
   coin-flip-adjacent measurement on 18 data points.
2. **Both repeat clusters are already closed loops, not open problems.**
   The two domains that actually repeated (verification-accuracy claims,
   tmp-inbox-workflow) are *already* encoded as standing rules in this
   package (`verify-before-complete`, `roadmap-progress-sync`). That is the
   existing, human-in-the-loop mechanism — operator notices a repeat,
   authors a rule, the repeat stops recurring — and it demonstrably worked
   here: these are historical corrections from June–July 2026 sessions, and
   the corresponding rules now exist in `src/rules/`. An automated
   self-evolution layer would need to beat "the maintainer already fixed
   it by hand" to earn its keep, and this data does not show a backlog of
   *un*-addressed repeats waiting for automation.
3. **15 of 18 corrections were singletons.** 83% of the corrections found in
   this sample never recurred at all across 40 sessions spanning roughly
   five weeks of real usage. A self-evolution mechanism optimized for
   catching repeats would have had nothing to catch in five out of six
   cases.

**Net reading:** the measured CRR sits just above the pre-registered
non-problem line, but the qualitative picture underneath it (thin margin,
both repeat clusters already remediated by existing rules, singleton-heavy
distribution) does not support treating this as evidence *for* building new
self-evolution infrastructure either. The honest verdict is: **the
threshold rule, applied literally, does not authorize parking the category
as a non-problem — but the data offers no positive case for funding it
either.** It must not be silently upgraded to "build it" on the back of a
0.017 margin over a pre-registered line.

**Resolution under the roadmap's own park mechanics (applied in
writing):** the governed-evolution loop stays PARKED. Its un-park clause
requires ALL of: (1) the freeze unblock list cleared — NOT met; (2) Spike A
showing CRR ≥ 0.15 with reliable extraction — now MET (0.167, κ = 1.0,
with the thin-margin caveat above); (3) the invariant sweep reusing
existing detectors — untested. One of three conditions is satisfied; the
park holds without any new decision. What changes is only the record:
condition (2) is banked, and any future un-park evaluation must weigh the
qualitative counter-evidence (repeat clusters already closed by existing
rules) alongside the raw threshold.

## Reliability verdict

- **Extraction reliability: 50-item double-blind-approximation pass →
  100% agreement, κ = 1.0 (> 0.6 threshold — met).**
- Corrections **can** be reliably identified under the stated definition
  (vocabulary-gated + negates-and-references-prior-output test) — this
  finding does **not** independently park the category. See the labelled-set
  report for the honest caveat on what "double-blind" means when the same
  labeller runs both passes in one continuous session (self-consistency, not
  classical inter-rater independence).

## See also

- `agents/evidence/reports/spike-a-crr-labelled-set.md` — method, labelled
  table, raw counts, reliability detail.
