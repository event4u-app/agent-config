<!-- evidence-type: analysis -->

# A degraded report-only run is not an operational success

AI council, 2026-10-24, the fifth round that day. anthropic/claude-sonnet-4-5 +
openai/codex-default, 2/2 present, 2 rounds with peer review, design mode, CLI
transport, `$0.00`, no chairman synthesis. The prompt is committed verbatim
beside this file as `gate-degraded-report-only-20261024.question.md`. It put the
split D28 left undecided to the seats as its own question, stating both earlier
positions and no expected outcome.

## Verdict: convergent on all three questions

- **Q1 — a distinct non-zero operational exit for `degraded`.** anthropic:
  *"Return a distinct non-zero exit (e.g., exit 2) for degraded runs, AND
  configure the job as 'allowed to fail' in CI."* openai: *"use a distinct
  non-zero process exit for `degraded`, separate from terminal operational
  failure if the CI environment preserves numeric codes."* Both ground it in the
  standing finding that absent or unverifiable evidence must never read as a
  pass: an exit of 0 would claim an operational success the validator did not
  achieve. openai adds that the CI behaviour has to be demonstrated before
  adoption, and that a platform's neutral conclusion is acceptable if a red job
  causes harm, but a green success is not. Confidence high on both seats.
- **Q2 — never `complete`, never a pass.** Both seats said this with very high
  confidence. Individual producers that were assessed keep their results. The
  aggregate is never promoted. openai: *"'Complete' claims coverage it did not
  achieve."*
- **Q3 — an executable, versioned, asymmetric mode contract.** An explicit
  mode value, and an unknown mode is refused. Enforcement needs a new mode value
  and separately reviewed code, never a Boolean or a fallback. Unknown states
  fail closed. The mode and contract version appear in the machine-readable
  summary. Tests cover every combination. Both seats have very high confidence
  on the invariant. openai has medium confidence on committing a future
  enforcement schema now.

The converged answer is also the fail-closed reading, so there is no dissent
on Q1–Q3 to record.

## Applied in the experimental slice

`src/scripts/_lib/gate_collector_experimental.ts`:

- operational exit `0` healthy, `2` degraded, `1` failed; evaluation exit
  always `0`;
- run status `complete` only when health is `healthy` and every producer is
  `complete`;
- `requireMode` refuses every mode but `report-only`; the run report and the
  summary carry `mode` and `contract: report-only/experimental-1`;
- an unknown producer status throws instead of reading as complete.

Tests: `tests/scripts/gate_collector_experimental.test.ts` § mode contract,
including an enumeration of all 108 combinations of two producer statuses and
three health values.

## Raised beyond the question, carried

- **The registry is the trust root, and the hardest pushback (openai).** A
  branch that edits the producer registry can shrink the set of producers the
  run assesses. Then the run is "complete" over the wrong set. The registry has
  to come from a trusted base revision or from independently governed policy.
  This is the P7 coverage question again, and it reaches
  `external-bootstrap-boundary-for-phases-2-3`.
- anthropic would drop the evaluation exit entirely from report-only. Not
  taken: it is constant 0 and documented as such, and removing it changes no
  behaviour.
- anthropic proposes runtime prerequisites for any enforcing mode (telemetry
  over time, failure rates). Recorded for that mode's own design. No enforcing
  mode exists.
- Both seats: CI propagation of a numeric exit has to be shown on the real
  platform before any CI job runs this.
