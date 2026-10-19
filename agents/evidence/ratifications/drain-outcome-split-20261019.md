---
proposed_by: claude-opus-5.5/drain-road-to-self-modification-that-a-council-must-pass-20261019y
implemented_by: claude-opus-5.5/drain-road-to-self-modification-that-a-council-must-pass-20261019y
reviewed_by: ai-council
subject: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
providers: [anthropic]
verdict: ratified
seats:
  anthropic: ratified
  openai: no-final-verdict
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review — the header/disposition split, third attempt

Part of step 3.4 of `road-to-self-modification-that-a-council-must-pass`, on
branch `drain/road-to-self-modification-that-a-council-must-pass-20261019y`
against `origin/main` @ `c0968e1f5`, 2026-10-19. Two rounds, both seats each
round, `--prompt-mode pr --rounds 1` through the CLI seats
(anthropic/claude-sonnet-4-5, openai/codex-default), nothing billed. The header
above is round 2's, printed by `ratification_header`.

`subject` is the digest of the empty gated set: `ratification_subject` over the
three changed paths prints "nothing in this change is gated, so no record is
owed". The record is kept as the evidence of the review, not as a record the
gate depends on. **It does not pass**: one provider concluded against the two
`src/config/ratification-policy.json` requires, so the reader refuses it on
`diversity-required`. Under ADR-281 § Amendment a passing record would be
advisory anyway; the merge of a change to the council's code is the owner's.

Prompts, committed verbatim:
`agents/evidence/council/outcome-split-review-20261019.question.md` (round 1)
and `agents/evidence/council/outcome-split-review-r2-20261019.question.md`
(round 2). Both carry the nine questions of `modification_review_questions.ts`
and the full diff under review, and state no expected outcome.

## What the change is

`deriveModificationOutcome` in `src/scripts/ai_council/modification_review.ts`
returns the canonical header (`deriveRatificationHeader`) and the run's
disposition (`accepted`, `refused`, `quorum-short`) under different names. It
starts from the list the 2026-10-17 refusal left
(`drain-record-writer-20261017.md` § What the next attempt starts from, item 1):
`requiredProviders` must be a positive integer (`RangeError` otherwise, in both
derivations), the seat maps are prototype-free (`Object.create(null)` in
`readSeatConclusions`, a `Map` into the header), the tests cover zero, negative,
fractional and non-finite thresholds and a `__proto__` seat, and the contract
says the split is a clearer interface, not an enforced one.

## Round 1 — header `ratified`, one provider

| Seat | Stance line | What it said |
|---|---|---|
| anthropic | `ratified`, high, no dealbreaker | The three 2026-10-17 findings are addressed and tested. |
| openai | none — closed `REQUEST_CHANGES` on the lens line | High: a seat value outside the declared union (parsed JSON carrying `"garbage"`) counted toward quorum and could yield `accepted`. Low: "Both functions refuse" was ambiguous among three named functions. |

The high finding was real and was measured: `{a: "garbage", b: "garbage"}`
derived `accepted`. Disposition: fixed — every seat value is checked at run time
and anything but a label or `null` throws a `TypeError`, in both derivations,
with six malformed-input cases seen red with the check neutralised (6 of 20
failing) and green with it restored. The wording names both functions.

## Round 2 — header `ratified`, one provider

| Seat | Stance line | What it said |
|---|---|---|
| anthropic | `ratified`, high, no dealbreaker | — |
| openai | none — closed `APPROVE` on the lens line | "closes the known validation and prototype hazards without widening authority"; suggested more mixed-verdict and non-JSON malformed-value test cases. |

openai's `APPROVE` is recorded as `no-final-verdict` and not as `ratified`: the
review asks each seat for the stance line, and `seatConclusion` reads a seat
that did not write one as not concluded — reading the lens line instead would be
this record inferring a verdict the seat did not give in the asked form. Both of
its rounds closed without the stance line, so the prompt's closing instruction
does not reach that seat under `--prompt-mode pr`; that is a finding about the
review verb, recorded here and in the roadmap.

The suggested extra test cases were not added after the review: an edit after
the seats answered would be content no seat saw.

One edit followed round 2, and it is named so nobody has to find it: the
pre-push typecheck refused a test's `Object.fromEntries` value as `string`
rather than `SeatVerdict`, and a type assertion was added to that line. No
assertion, case or source line changed.
