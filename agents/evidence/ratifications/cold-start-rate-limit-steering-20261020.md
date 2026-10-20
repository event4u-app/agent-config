---
proposed_by: claude-opus-5/drain-road-to-a-cold-start-paid-once-2026-10-18
implemented_by: claude-opus-5.5/drain-road-to-a-cold-start-paid-once-20261020
reviewed_by: council/anthropic+openai-2026-10-20-cold-start-steering-round10
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — the transient-failure rule split by error class

Covers step 4.4 of `road-to-a-cold-start-paid-once` on branch
`drain/road-to-a-cold-start-paid-once-20261020`: the contract section
"Transient-failure retry — split by error class" in
`src/agent-src/contexts/execution/subagent-steering.md`, and its pure, tested
reference `classifyTransientFailure()` / `transientFailureAction()` in
`src/scripts/_lib/subagent_steering.ts`. The retry rule it replaces was
council-decided, so the change needed the council (decision D9 of the roadmap).

## Decision

Both seats, round 10, CLI subscription transport, `ratified`, no dealbreaker.
The split: a `rate_limit` causes no same-turn re-dispatch, parks the slice once
until a recovery signal and never downshifts; `overloaded`, 5xx and timeout keep
one downshift; only a slice the dispatcher declared read-only or idempotent is
retried; once any response byte arrived nothing is transient; a spent N=3 slot
is refused; malformed input (read once as own data) escalates unretried and
carries no next state.

## How it got here

Ten rounds over the same two seats. Rounds 1–4 (2026-10-18) refused the state
machine around the split, never the split itself; their findings and the round-4
prompt are recorded at the step and in
`agents/evidence/council/cold-start-steering-review-r4-20261018.question.md`.
Rounds 5–10 (2026-10-20), prompts beside it — the last is
`agents/evidence/council/cold-start-steering-review-r10-20261020.question.md` —
each fixed what the previous one found, test-first:

| Round | Verdict | Blocking finding |
|---|---|---|
| 5 | refused 2/2 | a `null` slot threw inside the escalate helper |
| 6 | refused 2/2 | the malformed decision cast the input slot to `SlotState`; a missing `retry_safe` was not malformed; the classifier read fields unchecked |
| 7 | refused, degraded 1/2 | `in TIER_RANK` admitted inherited names such as `toString` (the other seat's local call counter was exhausted and was reset) |
| 8 | split 1–1 | inherited values, getters and proxy traps reached both validators |
| 9 | refused 2/2 | `Array.isArray` ran outside the `try` and throws on a revoked proxy |
| 10 | ratified 2/2 | — |

## Conditions carried, non-blocking

Named by the seats as gaps the change does not close, recorded so a later run
does not read the ratification as covering them:

- **No caller.** The reference functions dispatch nothing; the contract text is
  what an orchestrating model reads, so compliance is model-carried.
- **No operational kill criterion.** No parked-at-run-end metric, no maximum
  park age, no rollback trigger beyond `emergency.orchestration_halt`; the
  roadmap's `rate-limit-stops-per-drain` claim (step 6.1) is the measurement
  that would show the benefit false.
- **A non-finite or negative `retry_after_ms` is read as absent**, not as
  malformed. Fail-safe (no wait is invented), and covered by an existing test;
  one seat asked for it to be documented or rejected.
