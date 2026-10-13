<!-- evidence-type: analysis -->

# A registry that classifies two of the sixteen checks it is for

AI council, 2026-10-13. anthropic/claude-sonnet-4-5 + openai/codex-default,
2/2 present, 2 rounds with blind peer review, `$0.00` (both seats
subscription-authed). The prompt is committed verbatim beside this file as
`gate-contract-registry-shape-20261013.question.md`.

Asked for step 7.1 of `road-to-authority-routing-mechanism`, whose completion
D14 withheld pending *"a per-check contract registry … from which class,
prerequisites, gate membership and refresh authority derive mechanically"*.

## Verdict — convergent, and step completion WITHHELD again

**Do not greenlight closure of 7.1.** Both reviewers and the chairman reached it
independently: this round **defines a mechanism to satisfy the revisit
condition; it does not satisfy it.** Chairman confidence 0.77 on the structural
analysis, lower on intent.

The round was asked by the same agent that produced the measurement and would
implement the result, and the question said so. The seats used that licence:
they found an error in the measurement before answering anything.

## The error in the measurement, and it was ours

The evidence file claimed the repaired predicate *"separates 16 of 16"* while
also carrying D14's **3 unclassified** abstentions. A reviewer called it a
logical impossibility and the chairman escalated it:

> A measurement claiming 100 % success while admitting 19 % gaps should not be
> trusted until this is resolved.

Correct, and the mechanism of the error is worth keeping: the headline number
silently sorted the three abstentions into `invariant` because the predicate
found no baseline on them — which is the **default answer** the same file's
limits section had already named as "the discretion the seats refused wearing a
mechanical coat". The small print disclaimed what the headline asserted. The
file now reads **13 of 16**, with the three recorded as unresolved rather than
sorted.

## Q1 — the predicate is NOT an acceptable derivation. Five reasons

1. **It covers two of four classes.** The corpus holds 1 snapshot, 12
   invariants, **0 tolerances and 0 observations**. A predicate built on
   baseline direction cannot recognise a tolerance (an accepted-risk trade-off)
   or an observation (informational) at all, because neither depends on a
   baseline. Perfecting it still leaves half the taxonomy asserted.
2. **"Permissive" is a semantic reading, not a fact.** Raising a *minimum floor*
   permits more gaps; raising a *maximum-allowed-failures* count also permits
   more. Which direction weakens depends on what the number means, so the
   predicate needs human judgement exactly at derivation time — the thing the
   seats rejected.
3. **Fitted, not validated.** The predicate was repaired after seeing its
   counter-examples: zero predictive power. It may fit these sixteen and fail on
   the seventeenth.
4. **It does not dissolve the "TWO objects" dissent** — see below.
5. **The 16/16 claim** contradicted the corpus, as above.

**What would make "direction" mechanical:** each baseline file declaring its own
contract — metric, comparison operator, which direction weakens, which
strengthens, change authority, what a change requires, the exceptional
procedure, and a test pinning the direction. Even then it works only for checks
with orderable baselines.

## The "TWO objects" dissent is a taxonomy problem, not a schema problem

This is the chairman's hardest push-back, and it rejects the repair this round
was built on. The proposal had answered openai's D14 dissent by splitting the
check's two aspects into two *fields*. That does not dissolve it:

> Choosing one class **loses semantic information**.

If `check_gate_completeness` is a snapshot in its floor and an invariant in its
prohibition on unjustified new gaps, then two tidy fields do not change which of
the two the `class` field reports. The live options are a **multi-valued class**
(`class: [snapshot, invariant]`), **aspect-level rows**, or **splitting the
check**. The standing challenge: demonstrate that every check in the tree fits
exactly one of the four classes with no loss. The dissent suggests it does not —
and if two of four classes never appear, the four-class taxonomy may itself be
wrong.

## Q2 — a separate registry, `gate-classification.yml` (option b)

Unanimous. `gate-coverage.yml` answers *"does this gate inspect anything"* —
factual, low-controversy. Classification answers *"what class, and who may
weaken it"* — governance, high-stakes. Merging them is a **governance leak**:
a PR bumping `min_scanned: 237 → 250` would travel the same approval surface as
a PR writing `class: invariant → snapshot`.

Requirements that come with the split: both keyed by a stable check identifier
rather than a renameable filename stem; mechanical reconciliation, where every
classified check must have a coverage entry and an orphan fails CI; schema
separation, coverage = measurements and classification = decisions; and
different CODEOWNERS approval rules. The stated condition for *not* splitting —
that both already carry identical approval processes — was examined and doubted,
with separation as the default until redundancy is shown.

## Q3 — three of the four fields cannot derive, and asserting them is acceptable

| Field | Derivable? |
|---|---|
| `class` | partially — 2 of 4 classes, and only once baseline contracts exist |
| `prerequisites` | **the question is underspecified**: a technical dependency derives from the import graph, a logical ordering does not, a data dependency needs semantic analysis. "Cannot derive" is meaningless until the kind is named. |
| `gate_membership` | no — a risk decision, not a check property |
| `refresh_authority` | no — authorisation policy |

**The reading that makes this workable**, and the chairman flags it as the one
interpretive move the whole answer rests on: *mechanical* means **rule-following
with recorded inputs**, not computation with zero human input. The seats rejected
*discretion at derivation time*, not *human judgement in setting a baseline*. On
that reading a field asserted with `value`, `asserted_by`, `asserted_on`,
`reasoning`, `reviewed_by` and `review_date` satisfies the condition — the
mechanical part is the recording procedure, not a computation.

**This interpretation is not confirmed.** The single fact that would most change
the answer is what the two D14 seats meant by the phrase, and the proposed way to
settle it is to show them this schema and ask directly.

## Q4 — 31.9 % does not block. **2 of 16 does**

> The measurement shows an **inverted priority**: good coverage on irrelevant
> checks, terrible coverage on relevant ones.

113/354 is acceptable if the denominator is verified (how many of the 354 does
CI actually invoke — the rest may be utilities, self-tests or dead code), if the
113 include every check that could become required, if an unregistered check
**fails closed** and cannot be made required, and if the scope is documented as
"113 checks" rather than "the repository". But a registry cannot be claimed to
enable derivation while 14 of the 16 checks the decision is about have no entry.

One finding neither the question nor D14 anticipated: if 113 checks were
registered and only 2 of the 16 classified ones appear, **the classification
round appears to have proceeded without consulting the registry** — which makes
the revisit condition circular. A registry cannot enable a derivation it was not
used for.

## Q5 — Phase 1 of 3. What is still required to close 7.1

Baseline contracts with machine-readable direction semantics · all 16 checks
registered, not 2 · the three abstentions resolved, since they cannot stay
unresolved if the predicate works · the predicate validated on a holdout (the
other 111 registered checks, a sample of the 241 unregistered, and any genuine
tolerance or observation) · explicit handling of tolerance and observation ·
the "TWO objects" dissent resolved in the schema · rollback and kill-switch
criteria · a governance procedure for modifying a registry entry ·
reconciliation of effective against declared gate membership · and
re-classification **from the contracts**, rather than copying D14's outcomes
forward.

## Sequencing, stated as an order

Schema finalised → baseline contracts established → all 16 registered →
rollback procedures defined → **only then** may a class change anything.

> Landing a weaker class before the controls exist creates a window where
> enforcement can be bypassed.

## Gate membership splits in two

Raised by the chairman, unprompted. "Gate membership" conflates
`effective_gate` (does CI run it — derivable from CI config) with
`required_gate` and `blocking_on_failure` (governance decisions). A check can run
on every PR without blocking. Any mismatch between effective and required should
fail CI.

## What this round did NOT decide

- Whether the four-class taxonomy is right at all. Two of its classes have zero
  instances here, and that is noted as a reason to doubt it, not a verdict.
- Whether `src/config/gate-coverage.yml`'s 354-script denominator is the right
  one. The chairman asked for it to be re-derived from what CI invokes before any
  threshold is set, and nobody re-derived it in this round.
- What the D14 seats meant by *derive mechanically*. The whole Q3 answer is
  conditional on a reading that was not put to them.
