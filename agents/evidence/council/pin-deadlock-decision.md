<!-- evidence-type: analysis -->

# Council decision — unblock main from the pending-mechanism pin deadlock (2026-10-16)

Prompt, committed verbatim: `agents/evidence/council/pin-deadlock-decision-20261016.question.md`.
Seats: anthropic/claude-sonnet-4-5, openai/codex-default; quorum 2 of 2 through
the CLI seats, nothing billed. Decided by the council under the owner's standing
delegation of 2026-10-16 (technical decisions about the ratification gate's
modules go to the council, not to the owner).

## Verdict — Option A, both seats

1. This change: restore `src/scripts/_lib/ratification_subject.ts` to the pinned
   blob `3842d915…`, pin untouched, plus a test that the committed trunk
   satisfies its own pins.
2. Stage 2: gate the module and remove its pin, module unchanged.
3. Re-apply #2375's refactor (refusal fields instead of parameter properties)
   under a ratification record.

Rejected: B (merge #2382 past the failing required check — an administrative
bypass, both seats); C (revert plus stage 2 in one diff — couples the unblock to
a full stage-2 review; openai keeps it as a conditional acceleration only if
stage 2 is already review-complete).

#2382 (move the pin instead): keep open until this change lands, then close as
superseded by an in-band recovery, not as rejected (both seats).

## Conditions the seats attached, and how this change meets them

- Regression coverage of the pin invariant, read the way CI reads it — the new
  test runs `pinViolations` against the committed `HEAD`; red on main
  (`a10aa16a1`), green here. The existing negative fixture (a drifted pinned
  module is refused) stays.
- `check_test_delta` passes without the owner-only label — a test path changes.
- The exact merge candidate passes — verified by CI on the pushed head before
  merge; the base revision's gate (main) judges this head "nothing to ratify".
- The fallback is a bounded trust regression, not a hidden one (openai): until
  step 3, the danger gate's base classifier cannot run under type stripping and
  falls back to the checkout's `tsx`, under the trust rules #2375 already gives
  that fallback (a changed dependency manifest never yields below
  `needs-council`). Abort if the fallback loads head-controlled code beyond
  that, or classifications change beyond runtime-only differences.
- Not taken here, recorded for stage 2: anthropic's runtime-equivalence fixture
  (strip-types vs `tsx` classify identically) and openai's redesign so a pin
  cannot block unrelated work. Both belong to the change that removes the pin.

Seat verdicts are transcribed by the implementing session; the council
responses are gitignored and not committed.
