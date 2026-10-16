<!-- evidence-type: analysis -->

# Decision — the danger-gate test made red by restoring the pinned blob (2026-10-16)

Context: #2383 restored `src/scripts/_lib/ratification_subject.ts` to its pinned
blob `3842d915…` to unblock main (council, Option A, 2/2 —
`agents/evidence/council/pin-deadlock-decision.md`). That blob declares parameter
properties, so the danger gate's base classifier cannot run under type stripping
and takes its `tsx` fallback. The #2375 test "where node strips types the base
copy needs no node_modules, so a poisoned one cannot hide a gated change" turned
red: it received `needs-council (runtime-uncertain)` where it asserts
`needs-owner`.

## Council, two rounds (prompts committed beside this file)

- Round 1 (`pin-deadlock-red-test-20261016.question.md`): both seats asked for
  revision — an exact, self-expiring skip rather than a red or loose one, the
  fallback path asserted separately, and proof the fallback fails closed.
- Round 2 (`pin-deadlock-red-test-r2-20261016.question.md`), on a blob-keyed skip
  plus the existing residual tests as evidence: both REQUEST_CHANGES.
  - anthropic: document at the skip why it exists and when it ends.
  - openai: the skip conceals a real downgrade — a gated change bundled with a
    manifest change under a poisoned runtime reaches `needs-council` instead of
    `needs-owner`; close it in the fallback policy before merging.

## Owner decision

Decided by: owner, 2026-10-16, chat — of: admin-merge #2382 (move the pin) /
make fallback plus manifest change `needs-owner` for the window (partially
lifting owner decision D11 of 2026-10-15) / merge #2383 accepting the bounded
weakening until #2375's refactor returns, the owner merged #2383: the third.

## What this change does

- The test is skipped exactly while the module is blob `3842d915…`; any other
  blob runs it again, so the skip ends by construction when the refactor
  returns. A failed `git hash-object` yields a mismatch and re-enables the test.
- A comment at the skip states the accepted weakening (anthropic's request).
- openai's behavioural change is not taken: the owner accepted the weakening for
  the window instead. The residual tests for the no-strip branch keep running
  and keep asserting its bounds (never `routine`; a crashing or malformed
  fallback is `needs-owner`).

Seat verdicts are transcribed by the implementing session; the council
responses are gitignored and not committed.
