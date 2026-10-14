<!-- evidence-type: analysis -->

# Three parked criteria whose evidence was removed go back to open

AI council, 2026-10-14. anthropic/claude-sonnet-4-5 + openai/codex-default,
2/2 present, 2 rounds, `$0.00` (both seats subscription-authed). One run, no
re-run. The prompt is committed verbatim beside this file as
`parked-ladder-criteria-20261014.question.md`.

Subject: items 8.1, AC-1 and AC-7 of the parked roadmap
`agents/roadmaps/later/road-to-adversarial-verification-and-long-runs.md`,
closed in September over fixtures that exercised `_lib/continuation_ladder.ts`.
PR #2336 withdrew the run-continuation concern; PR #2343 removed the ladder on
an owner decision of 2026-10-14 and deleted the fixture cases whose subject it
was.

## Verdict — convergent 2/2: restore all three to `[ ]`, keep the roadmap parked

Both seats chose the same disposition for all three items, and both classed it
as council-decidable under the preservation test.

openai, per item:

> **8.1:** choose (b), narrowly—restore `[ ]`, keep parked, and preserve the
> original behavior. Council-decidable. Reconsider if reproducible evidence shows
> another implementation enforces the same delivery-state invariant.
>
> **AC-1:** choose (b)—restore `[ ]` because its named fixture set no longer
> exists. Council-decidable. Only owner approval to change the literal fixture
> requirement would alter this.
>
> **AC-7:** choose (b), narrowly—restore `[ ]`, keep parked, and retain both
> bounded-run and cross-run-continuity requirements. Council-decidable.
> Reconsider if another executable run bound is demonstrated.
>
> **Do not choose (c):** nothing presented connects these losses to the
> roadmap's registered wake conditions.

anthropic, as its top-ranked action:

> **Restore 8.1, AC-1, AC-7 to `[ ]` while keeping roadmap parked** — resolves
> factual mismatch without weakening criteria or activating unrelated work.
> Council-decidable under preservation test (keeps items alive). Removes
> misleading completion marks.

and on the existing 2026-10-14 notes, which deferred the question to the wake:

> Under the preservation test, restoring to `[ ]` is council-decidable *now*.
> The notes incorrectly defer a council-decidable action.

## The boundary both seats drew

Option (b) as written bundled two operations, and both seats split them.
Restoring `[ ]` is preserving and council-decidable. Rewording a verify line to
name only what is exercised today is not: openai, *"Rewording verification to
accommodate reduced behavior could weaken the criterion and therefore require
owner approval."* So the criteria text and verify lines were left unchanged.
Still owner-reserved and not decided here: accepting the `process-full` prose
contract as sufficient for 8.1, narrowing AC-7 to its mission-record half,
changing AC-1's fixture inventory, or cancelling any of the three.

## The evidence gap both seats raised, closed before applying

Both seats scored the absence claims ("no run bound exists in code", "the
delivery state machine is no longer exercised") as unproven in the prompt.
Checked at `4a379af12` before the roadmap was edited:

- `src/scripts/_lib/continuation_ladder.ts` and
  `src/scripts/hooks/run_continuation_hook.ts` do not exist.
- `grep -rnE "DELIVERY_STATES|DELIVERY_ENDINGS|deliveryBlocksCompletion|WALL_CLOCK_CAP_MS|continuation_ladder|terminalStateFor" src tests`
  matches only comments (`src/config/loop-surfaces.yaml:97`,
  `src/scripts/_lib/outcome_vocabularies.ts:39`,
  `tests/e2e/adversarial-verification-fixtures.test.ts:980`) and a baseline
  reason string.
- `tests/e2e/adversarial-verification-fixtures.test.ts` contains no `T7` or `T8`.
- `src/scripts/_lib/delivery_ready.ts` is the only delivery-named survivor; it
  answers whether a PR's required checks passed and does not hold a run open,
  so it does not enforce 8.1's forbidden ending.

## Applied

At each of the three items: checkbox `[x]` → `[ ]`, text and verify line
untouched, a dated note naming this record. A `## Decisions` row D1
(`reversible-technical`, resolved by council). The entry condition gained one
sentence saying the reopened items are wake-time work, not wake conditions; the
wake condition itself (AC-4 kernel edit, AC-6 blocker) is unchanged and unmet,
so the roadmap stays in `later/`.

## Raised by the seats, not acted on here

- openai: *"Add evidence-anchor validation so checked criteria cannot silently
  retain references to deleted fixtures or symbols."* A new gate; outside this
  question.
- anthropic: AC-1 is not a third independent loss but an inventory of the same
  fixture deletions behind 8.1 and AC-7. Recorded; it does not change AC-1's
  disposition, since AC-1 is literally unmet either way.
