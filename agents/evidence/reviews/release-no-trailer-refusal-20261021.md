<!-- evidence-type: analysis -->

# Removing the Consumer-Impact span refusal — the verdict behind the weaker test

`tests/lib/consumer_impact.test.ts` asserts less after this change, and
`check_test_weakening` asks for the verdict that licenses it. The weakening is
not a test bent to fit the code: the behaviour those assertions pinned was
removed on purpose, and the decision to remove it was not the implementer's.

## The decision

The squash merge of #2565 kept only the PR title and a `Co-authored-by` line, so
its `Consumer-Impact: action` trailer never reached `main`. `task release` then
refused the 17.0.0 cut on `76f4136`, and a landed commit can be repaired only by
rewriting `main`. Offered a committed backfill ledger as the repair, the
repository owner rejected it on 2026-10-21 and directed that the refusal be
removed, on the ground that a lost trailer happens and is of no consequence to
a consumer. The decision is the owner's; this record states it, it does not
make it.

## What the tests lost, and what they still hold

Removed with `impact_span_verdict`: the assertions that a breaking commit
without a valid trailer exits 2, that the same commit passes once a trailer
closes its body, and the three fixture-span cases asserting the refusal message.

Kept or rewritten against the new behaviour: every breaking-detection case still
asserts `breaking === true`, now together with the trailers it records (`none`
without one, `action` with one); conflicting trailers on a breaking commit stay
`invalid` and unrecorded; the real-git-log fixture asserts the release entry is
`none` without the trailer and `action` with it. The bump still follows
breaking-ness, so a breaking commit still forces a major.

## What this does not establish

No independent reviewer read the diff. The verdict discharging the weakening is
the owner's directive, recorded here because the gate can see only that a
record exists, not whether one was independent.
