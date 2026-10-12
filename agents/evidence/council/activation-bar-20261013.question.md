<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-13, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence: a recorded verdict whose prompt is not
     recoverable is not evidence). Not edited after the run. -->

# Can an activation bar be pre-registered before the thing it measures exists?

You are deciding one question for `road-to-authority-routing-mechanism` step
8.2. Answer on the evidence below. Do not summarise the evidence back.

## The step, verbatim

> **8.2 Run the council on the shadow-run's acceptance bar** — what
> false-positive / false-negative rate, over what N, justifies activation.
> Record the verdict.

Its two neighbours:

> **8.1 Shadow-run the Phase 3 verifier** against the last N merged PRs (N
> decided by the council in 8.2) without gating anything — collect a
> false-positive / false-negative report comparing its verdicts against what
> actually happened.

> **8.3 Activate the verifier as a required gate ONLY through the external
> bootstrap authorisation** … never silently, never on the agent's own
> determination that the shadow run looked good.

And the acceptance criterion the bar exists to make enforceable:

> AC-4 — The Phase 3 verifier is never activated as a required gate except
> through the `break-glass-authority-and-bootstrap-approval` blocker's
> resolution (Phase 8.3) — never on the agent's own determination that a shadow
> run "looked good enough".

## The state of the tree, measured 2026-10-13

1. **The verifier does not exist.** Step 3.3 would build it. Phase 3 is
   blocked.
2. **Its decision surface is undefined.** Steps 2.3–2.5 would define what it
   classifies (a three-way verdict split, an extended refusal vocabulary, a
   review-instance model). All blocked.
3. **The blocker is not merely unturned-on, it is unsatisfiable today.**
   Measured against the live forge: one active ruleset with
   `required_approving_review_count: 0`, `require_code_owner_review: false`,
   `required_reviewers: []`; CODEOWNERS maps every path to the sole
   maintainer, who is also the only active proposer; the one reachable org
   team has that same single member. A council on 2026-10-13 resolved this
   2/2 as "dormant-but-declared": the requirement is declared and reported,
   never activated, and Phases 2–3 stay blocked.
4. **Step 8.1 therefore has no input.** There is nothing to shadow-run.

## The precedent this question is deliberately measured against

Step 7.1 of this same roadmap asked a council to classify 16 live-tree checks.
Both seats produced the classification **and withheld greenlight on the step**,
with this reason:

> both seats refuse to let a check's semantics be derived from its observed
> failure, because that grants the classifier discretion exactly when a red
> trunk creates pressure to weaken enforcement. They want a stable per-check
> contract first.

The structural shape is the same here: a bar derived after seeing the data
grants whoever reads the data discretion exactly when a blocked roadmap creates
pressure to activate. That is the argument FOR pre-registering now. The
argument AGAINST is that a rate over an undefined classification surface is a
number with no referent, which is the other half of what 7.1's seats objected
to.

## The options

**(a) Pre-register a numeric bar now.** Name a false-positive rate, a
false-negative rate and an N, binding on whoever later reads the shadow-run
report. Accept that the surface is undefined and that the numbers may need
restating once Phase 3 defines it.

**(b) Pre-register the FORM of the bar, not its numbers.** Decide now what a
shadow-run report must contain, which error classes are disqualifying
regardless of rate, and who may read it — and defer the numeric thresholds to
a second round held once the decision surface exists. The step closes on the
form; a successor step carries the numbers.

**(c) Hold the step.** Record that the bar cannot be set before the surface
exists, name the prerequisite, and leave 8.2 open with that prerequisite
stated — the disposition step 7.1 took.

**(d) Something none of the above names.**

## What would make each option WRONG

State which of these you believe applies, and to which option.

- **(a) is wrong if** a rate over an undefined classification surface is not a
  falsifiable commitment, so pre-registration buys the appearance of rigour
  while the number is unmoored — and a number that must be restated later was
  never binding.
- **(b) is wrong if** splitting form from numbers is how a bar gets quietly
  relaxed: the form passes, the numbers arrive later under activation
  pressure, and the pre-registration that was supposed to constrain that moment
  happened for the half that did not matter.
- **(c) is wrong if** a bar is exactly the kind of thing that must be fixed
  before data exists, so deferring it to the moment the data arrives is the
  failure AC-4 names — the bar then gets set by whoever wants the activation.
- **(d) is wrong if** it requires a capability or an artefact this repository
  is not measured to have.

## Two moves this question forbids by name

1. **Do not pick (c) because 7.1 picked it.** A precedent is an argument, not
   an answer. 7.1's prerequisite was a registry that does not exist; say
   explicitly whether this step's prerequisite is of the same kind, or whether
   a bar differs from a classification in a way that makes pre-registration
   possible where classification was not.
2. **Do not pick (a) because it is the option that closes a box.** An option's
   effect on the roadmap's open count is not an argument for it.

## What to answer

1. Which option, and the wrongness conditions you believe do and do not apply.
2. If (a) or (b): what must a shadow-run report contain, and which findings
   are disqualifying **regardless of rate** — i.e. the errors no N and no
   threshold can trade away.
3. Whether the party who reads the shadow-run report may be the party that
   built the verifier, and if not, who.
4. Your confidence, and the single piece of evidence that would move you.
