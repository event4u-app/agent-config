<!-- evidence-type: analysis -->

# Can a gate's class be derived mechanically? One candidate rule, measured and refuted — and what survived

Measured 2026-10-13 from `origin/main` @ `8cd4c1e4d`, for step 7.1 of
`road-to-authority-routing-mechanism`.

## What this was looking for

D14 recorded the 7.1 classification as convergent and the step as withheld. Its
`revisit if` names the prerequisite:

> a per-check contract registry exists from which class, prerequisites, gate
> membership and refresh authority **derive mechanically**.

`derive mechanically` is the load-bearing phrase and it is easy to read past. A
registry in which an author types `class: invariant` on each row is not a
derivation — it is 354 assertions with a schema around them, and it reinstates
exactly the discretion both seats refused when they declined to let a check's
semantics be read off its observed failure. So the question is not *where does
the registry live*. It is: **is there anything already true in the tree from
which the class follows?**

This file tests one candidate and reports what happened to it.

## First, two claims in the roadmap's own screen that do not hold

The 2026-10-13 screen at step 7.1 located `src/config/gate-coverage.yml` as the
registry, which is right and useful, and then said two things about coverage
that the file does not support.

**Claim: "All four Phase 7 checks the round named … resolve against it."**
Measured — `grep` for each id in `src/config/gate-coverage.yml`:

| Check | Row? |
|---|---|
| `check_gate_completeness` | yes (line 820) |
| `check_council_layout` | no |
| `check_knowledge_cards` | no |
| `check_composite_arming` | no |

One of four, not four of four. The three unclassified checks — the ones whose
abstentions D14's `revisit if` names first — are precisely the three with no row.

**Claim, implied: the gap is "four fields on an existing registry".** Across all
16 checks the round classified, **2 have rows** (`check_gate_completeness`,
`check_augment_description_cap`). The other 14 do not. So the prerequisite is
four new fields *and* fourteen new rows, on a manifest that states its own
denominator as 113 of 354 scripts (31.9 %).

Neither correction is a reason to abandon `gate-coverage.yml` as the home. It is
a reason not to cost the work as an afternoon of schema editing.

## The candidate rule, and how it was tested

**Hypothesis.** A check that compares against a committed baseline is a
*snapshot*; a check with no committed baseline is an *invariant*. If it holds,
class derives from a fact already in the tree — the presence of a baseline file —
and nobody has to assert anything.

It has an obvious appeal: D14's single snapshot, `check_gate_completeness`, is a
count measured against a committed floor, and the twelve invariants are mostly
shape checks with nothing to compare to.

**Detector.** `grep -cE 'baseline|BASELINE|ratchet|RATCHET|golden'` over each of
the 16 scripts under `src/scripts/`.

**Positive control, run first.** `check_gate_completeness` returns 5 hits. The
detector fires on the one check known to be a snapshot, so an empty result
elsewhere means something.

## Result: refuted

Five of the sixteen return non-zero:

| Check | Hits | D14 class |
|---|---|---|
| `check_gate_completeness` | 5 | **snapshot** |
| `lint_rule_enforcement_declaration` | 35 | invariant |
| `check_token_quality_golden` | 17 | invariant |
| `check_rule_invariants` | 3 | invariant |
| `check_trigger_evals` | 1 | invariant |

Four counter-examples. The rule as stated is wrong.

**Then the hits were read rather than counted**, because a grep count is not a
finding:

- `check_token_quality_golden` — the hits are a golden *corpus* file
  (`internal/bench/corpora/token-quality-golden.yaml`) and repeated usage lines.
  No numeric baseline. False positive.
- `check_rule_invariants` — one hit, inside a mutation-selftest failure message
  (`"baseline broken — … not present in …"`). False positive.
- `check_trigger_evals` — one hit, in a comment about a *different* gate's
  ratchet. False positive.
- `lint_rule_enforcement_declaration` — **real.** A genuine ratchet over a
  committed file, `src/config/rule-enforcement-baseline.json`.

So after reading, exactly **two** of the sixteen read a committed baseline:
one snapshot and one invariant.

## What survived — the predicate is direction, not presence

The surviving counter-example is the informative one. `lint_rule_enforcement_declaration`
reads a committed baseline and is an invariant anyway, and the reason is in its
own header: the baseline is **shrink-only**. Entries may leave it, never join
it; a rule that gains a declaration frees a slot. There is no permissive move to
authorise, so there is no refresh authority to hold, so there is nothing a
snapshot's governance would be for.

`check_gate_completeness`'s baseline is the opposite: its floor can be *raised*,
and D14 spends most of its cell on who may raise it, when, and on what evidence.

So the candidate repairs to:

> A check whose committed baseline can be moved in the **permissive** direction
> is a governed snapshot. A check with no committed baseline, or whose baseline
> can only move in the **restrictive** direction, is an invariant.

On this corpus that rule separates **13 of 16** — one snapshot, twelve
invariants — from a property of the baseline file's own contract rather than
from anyone's reading of what the check means.

> **Corrected after independent review, 2026-10-13.** This sentence first read
> *"separates 16 of 16"*, and a council reviewer caught it as an overclaim that
> contradicts this file's own limits section two screens down. The three checks
> D14 recorded as **abstentions** are not thirteen-plus-three; counting them as
> invariants because the predicate finds no baseline is precisely the default
> answer the limits section says would be "the discretion the seats refused
> wearing a mechanical coat". The headline number was asserting what the small
> print disclaimed. 13 of 16 is what was measured; the remaining three are
> unresolved, not sorted.

It also lands on openai's recorded dissent from the other side. That dissent
says check #1 "holds TWO objects — the numeric baseline is a snapshot, the
prohibition on unjustified new debt is an invariant, and one class field cannot
carry both". Under the repaired rule the two objects are not two meanings
competing for one field: they are the baseline's **direction of travel** and the
gate's **finding set**, which are different properties of the row and can each
have their own field.

> **That reading was rejected on review, 2026-10-13, and the rejection is
> sharper than the proposal.** Calling the dissent a schema problem understates
> it: it is a **taxonomy** problem. If `check_gate_completeness` genuinely is a
> snapshot in its floor and an invariant in its prohibition on unjustified new
> gaps, then classifying the whole check as `snapshot` does not dissolve the
> dissent — it discards half the check's semantics, and two tidy fields on one
> row do not change which of the two the `class` field reports. The live options
> are a multi-valued class, aspect-level rows, or splitting the check; the
> reviewer's standing challenge is to demonstrate that **every** check in the
> tree fits exactly one of the four classes with no loss, which the dissent
> suggests is false.

## The limits, stated

- **One corpus, sixteen rows, no holdout.** The rule was repaired after seeing
  the counter-examples it is now scored against, so 13/16 is a fit, not a
  prediction. It has never been run against the other 338 scripts, and a
  reviewer put the consequence more plainly than this file had: zero predictive
  power, so it may fit these sixteen and fail on the seventeenth.
- **It covers two of four classes, not four.** The corpus holds one snapshot and
  twelve invariants and **zero tolerances, zero observations**, so a predicate
  built on baseline direction cannot recognise half the taxonomy however well it
  is perfected — a tolerance is an accepted-risk trade-off and an observation is
  informational, and neither depends on a baseline at all. Added after review;
  this file had framed the rule as deriving "one of four FIELDS" without noticing
  it also derives only two of four CLASSES.
- **"Permissive" is itself a reading.** Which direction weakens depends on what
  the number means: raising a minimum floor permits more gaps, raising a
  maximum-allowed-failures count also permits more. The predicate is mechanical
  only once each baseline file declares its own weakening direction in
  machine-readable form. Until then the word is asserted by whoever writes the
  row, which is the discretion this whole exercise is trying to remove.
- **It derives one field of four.** Prerequisites, gate membership and refresh
  authority are untouched, and D14 asks for all four. Gate membership in
  particular is a *decision* — anthropic's dissent says the step conflates it
  with classification — and no property of a file derives it.
- **Three unclassified checks stay unclassified.** `check_council_layout`,
  `check_knowledge_cards` and `check_composite_arming` have no committed
  baseline, so the rule calls all three invariants. D14 recorded them as
  abstentions *pending their predicates*, which is a different question, and a
  rule that answers it by default would be the discretion the seats refused
  wearing a mechanical coat.
- **Nothing here closes 7.1**, and it is not offered as doing so. 7.1 needs the
  registry, then a classification round against it.
