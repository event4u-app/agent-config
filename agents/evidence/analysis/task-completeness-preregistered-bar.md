# `task-completeness` — the pre-registered bar for detector D

**Written:** 2026-08-12 · **Step:** completion-loop Phase 2, step 2.1 ·
**Status:** pre-registration, committed BEFORE the measurement commit.

This document fixes, in advance, the values at which a fourth turn-end-gate
detector (D) is worth building and the values at which the track closes as a
published null. It exists because the alternative — reading the number and then
deciding what number would have been convincing — is unfalsifiable, and because
the sibling `recursive-verification` null is the precedent for a measurement that
correctly ended in "do not build".

## Disclosure: what was already seen when this was written

Honesty first, because a pre-registration that hides its own contamination is
worse than none.

**Seen:** the raw hit COUNT of the first run — **3 hits over 28 sessions** — and
the three hits' missed-token lists.

**Why it was seen:** step 1.2's own `verify:` line requires running
`--why task-completeness` to prove the definition prints. `--why` prints the
definition **and the hits together** by design. So verifying 1.2 against the live
store necessarily revealed the count that 2.1 asks to be unread. As written, the
two `verify:` lines are **mutually exclusive** — this is a defect in the
roadmap's step ordering, not a shortcut taken here. The fix for the next roadmap
of this shape: verify a `--why` definition against a **fixture** store, never
against the corpus the bar will later be read against.

**NOT seen, and genuinely blind at the time of writing:**

- the **hand-validated precision** — no hit had been adjudicated;
- the **rate over eligible windows** — the denominator
  (`completeness_windows`) did not exist yet when the count was read, and the
  scan has not been re-run since it was added.

**Consequence, built into the bar below:** the rate threshold is deliberately set
so that it is **not the binding constraint**, because it is the contaminated
dimension. The binding constraint is precision-with-confidence, which was blind.

## The bar

Detector D is built **only if all three hold**:

| # | Dimension | Threshold |
|---|---|---|
| B1 | Hand-validated precision | ≥ **0.80** |
| B2 | 95 % one-sided lower bound on that precision | ≥ **0.80** |
| B3 | Hit rate over eligible reply windows | ≥ **2.0 %** |

Any one missed → **do not build D**; publish the null.

### B1 — why 0.80

D is a **refusal**. Since 2026-08-12 the turn-end gate has no settings switch, so
a misfiring detector is revertible only by a code revert. A gate that is wrong
more than **one time in five** does not get lived with; it gets reverted, and it
takes the maintainer's trust in the sibling detectors with it. 0.80 is a
judgement, stated as one — it is **not** calibrated against detectors A/B/C,
because none of them has a published precision. That absence is itself worth
recording: this is the first detector in the family whose precision is measured
before it ships.

### B2 — why a confidence bound, and what it costs

A precision of 3/3 is not evidence of 100 %; it is evidence of very little. The
exact one-sided Clopper-Pearson lower bound for *k* of *k* true positives at 95 %
is `0.05^(1/k)`:

| k (all true) | 95 % one-sided lower bound |
|---:|---:|
| 3 | 0.368 |
| 5 | 0.549 |
| 10 | 0.741 |
| 12 | 0.779 |
| **14** | **0.807** |

So clearing B1 **with confidence** needs **≥ 14 consecutive true positives**, and
more than 14 hits if any is false. This is the same discipline
`conformance_scan` already applies to the language rate through
`BAND_MIN_TURNS`: a verdict that is really about corpus size must not be
published as a verdict about behaviour.

**The consequence is stated before the measurement, and it is the point of this
document:** with 3 hits the outcome is **already determined** — the bound cannot
reach 0.80 at any validation result, so the verdict is null-by-corpus-size no
matter how the three adjudicate. Recording that in advance is what keeps a later
"3 of 3 validated, ship it" from looking reasonable.

### B3 — why 2.0 %, and why it is deliberately slack

Below ~2 % of eligible windows the gate almost never fires, so its expected
benefit is small while its false-positive exposure is permanent. The threshold is
set low on purpose: this is the dimension whose raw numerator was already seen,
so leaving it slack keeps the contaminated axis from deciding anything. If B3
turns out to be the only failing dimension, that result must be reported as
**weak evidence** and re-measured on an unseen corpus before it is treated as a
null.

## The three verdict shapes

1. **BUILD** — B1, B2, B3 all hold. Phase 3 proceeds: negative corpus first
   (3.1), detector into the existing guard (3.2), post-flip re-measurement
   against a pre-registered reduction (3.3).
2. **NULL — measured, not worth it** — enough hits to decide (B2 reachable) and
   B1 or B3 fails. Publish; do not build D. The `task-completeness` check itself
   **stays** either way: it is a report, and a measured zero is worth keeping.
3. **NULL — corpus too small to decide** — B2 unreachable. Publish as
   inconclusive-by-design and treat it as *do not build*, the conservative
   direction given the missing kill-switch. Name the hit count the corpus would
   need (14 all-true) so a future run knows when to re-ask.

Shape 3 is not a way to avoid a verdict: it is a verdict about the corpus, and it
carries a falsifiable re-ask condition rather than an open end.

## What a hand-validation decides, per hit

A hit is a **true positive** only if the reply window left an enumerated file
untouched **and none** of the four legitimate shapes explains it:

- a **blocking question** — the window asks rather than delivers;
- a **hand-back** — the window returns scope to the user on purpose;
- a **user-fenced scope** — the prompt itself narrowed what to touch
  ("nur die erste Datei", "plan only");
- an **explicitly deferred item** — the window names the omission and defers it.

Any of the four → **false positive**. A fifth outcome is possible and must be
recorded separately rather than folded into either bucket: the token was touched
but under a name the matcher cannot see (a rename, a generated path). That is an
**instrument defect**, not a behaviour finding.

## Pre-registered reduction for 3.3, if D is ever built

If D ships, the post-flip re-measurement must show the `task-completeness` rate
**at least halved** on a corpus of comparable size. Per the
`recursive-verification` null's binding falsification shape: if the reduction
does not appear, **revert D** — do not narrate why the number stayed flat.
