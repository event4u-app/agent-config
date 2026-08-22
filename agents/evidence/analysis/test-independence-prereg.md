<!-- evidence-type: analysis -->
# Pre-registration — test independence and mutation evidence

**Written and committed BEFORE either measurement.** That ordering is the whole
point and it is checkable: this file's commit date must strictly precede both
measurement artefacts', which a retrofit cannot satisfy. A threshold chosen
after the numbers are in is a description of the result, not a test of it.

## Question 1 — the independence claim

**Claim under test.** A test suite authored by the same context that wrote the
implementation inherits that context's blind spots, so a suite authored from the
**spec alone, before the diff exists**, catches defects the same-context suite
missed.

**How it would be measured.** Dispatch a test author that reads only the
acceptance criteria — never the diff — over a frozen corpus of past changes in
this tree, then grade both suites with the existing grader
`judge-test-coverage`. No new grader: a grader introduced alongside the
mechanism it grades cannot measure it.

**Threshold, registered now:** the spec-first suite must catch **≥ 1 defect per
5 corpus changes** that the same-context suite missed. Below that, the mechanism
does not pay for a dispatch per change.

**Why that number.** It is the rate at which one extra dispatch per change buys
one caught defect per five changes. Stated as a **judgement, not a derivation** —
nothing in this tree establishes a defect-cost curve, and pretending otherwise
would be the same failure this file exists to prevent.

## Question 2 — the mutation claim

**Claim under test.** A negative test nobody has watched fail constrains
nothing, and a measurable share of the negative tests in this tree are that
claim rather than that evidence.

**How it is measured.** Take a defined sample of negative tests — tests whose
stated purpose is to pin a guard, a refusal, or a rejection. For each, delete or
invert the control it claims to pin, run **that spec only**, and record whether
it fails. Restore immediately. This is the hand-probe the tree already ships at
`src/skills/testing-anti-patterns/SKILL.md:171-185`, applied as a census rather
than as an authoring step.

**Threshold, registered now:** **> 10 %** of sampled negative tests surviving
their own control's removal supports the claim and opens the tool-assisted
half. **≤ 10 %** is a null — the hand-probe is keeping up and a rig is not worth
its maintenance.

**Why that number.** One in ten is the point at which a reader can no longer
assume a negative test in this tree is evidence. Also a judgement, also not a
derivation.

## The three outcomes, and the route for each

Registered before the numbers so no outcome can be re-routed afterwards.

| Outcome | Meaning | Route |
|---|---|---|
| **pass** | the number clears the threshold | the corresponding half of Phases 1–2 opens |
| **null** | measured, and below the threshold | that half closes as `[-]` with the artefact cited at each step; **Phase 3 still ships** |
| **unmeasurable-here** | the measurement could not be run in this environment at all | that half closes as `[-]` **labelled unmeasurable, NOT refuted**; Phase 3 ships and is what would let it be re-opened |

**`unmeasurable-here` is a distinct third state on purpose, and it is the one
most likely to be needed.** Question 1's measurement requires dispatching a
subagent, and a run without that primitive cannot produce the number. Folding
that into `null` would record "we measured and the claim failed" when what
happened is "we could not measure" — the two license opposite future decisions,
and the second must not be able to masquerade as the first.

**Ambiguous is not a fourth state and is not a re-run.** A number that lands on
the threshold routes as `null`: the threshold is registered here, so the
boundary belongs to the side that does not open new work.

## What no outcome authorises

A pass on Question 1 says nothing about the **weaker** form of the idea — a test
author that reads the finished diff. That form has arrived in this tree before
and is what the source argues is worthless. Tests written from the spec before
the diff exists and tests written from the diff are **different mechanisms**; a
measurement of one is not evidence about the other. Recorded here so a later
reader cannot use this file to justify the other thing.
