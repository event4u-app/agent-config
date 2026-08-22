<!-- evidence-type: analysis -->
# The independence claim — `unmeasurable-here`, not a null

**Recorded:** 2026-08-22 · **Pre-registration:** `agents/evidence/analysis/test-independence-prereg.md`
**Outcome:** the third registered state — `unmeasurable-here`

## Why no number exists

The registered measurement is: dispatch a test author that reads **only** the
acceptance criteria, never the diff, over a frozen corpus of past changes, then
grade both suites with `judge-test-coverage`.

That requires a **subagent dispatch primitive**, and this run had none available
to it — the operating instruction for the session forbids agent dispatch. So the
measurement could not be started, let alone produce a count against the ≥ 1-per-5
threshold.

## Why this is not a null, and why the distinction is load-bearing

The pre-registration names three outcomes precisely so this case cannot be
mis-filed:

* **null** = measured, and below threshold → the claim is *not supported*, and a
  later run should not re-litigate it without new evidence.
* **unmeasurable-here** = the measurement never ran → the claim is *not
  addressed*, and a later run with a dispatch primitive should run it.

Folding this into `null` would record "we measured and the claim failed" when
what happened is "we could not measure". Those license **opposite** future
decisions, and the second must not be able to masquerade as the first. That
sentence was written into the pre-registration before this outcome was known,
which is the only reason it can be trusted now.

## Consequence, per the registered route

The independence half of Phases 1–2 closes as `[-]` **labelled unmeasurable, not
refuted**:

* **1.1** the spec-test-writer stage — closed. Building it would ship a
  mechanism with no measurement behind it, and the roadmap's own Risk 4 says the
  failure mode is that nobody can ever retire it, because nothing recorded what
  it was supposed to improve.
* **2.1 / 2.2** the severity-conditioning and the degraded path — closed with
  it; they condition a mechanism that does not exist.

**Phase 3 ships regardless**, which is the property that makes this a completed
spike rather than an abandoned one. `test_authorship` in the envelope, with
`unknown` as the default and absence resolving to it, is what would let a later
run re-open this question with real data instead of a fresh archaeology pass.

## What would make it measurable

A dispatch primitive, and nothing else — the corpus, the grader
(`judge-test-coverage`, unforked), and the threshold are all already fixed by
the pre-registration. The re-run is not a redesign.

**And one warning that survives this outcome.** A future pass must not read a
result about the from-spec form as evidence about the weaker form — a test author
that reads the finished diff. That form has arrived in this tree before, and a
measurement of one is not evidence about the other.
