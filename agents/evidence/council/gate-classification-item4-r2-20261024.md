<!-- evidence-type: analysis -->

# Item 4 with a positive invariant predicate, and closure

AI council, 2026-10-24, the twenty-third round that day.

| Field | Value |
|---|---|
| Seats | anthropic/claude-sonnet-4-5 + openai/codex-default |
| Mode | design, 2 rounds with peer review |
| Transport | CLI |
| Cost | `$0.00` |
| Present | **2/2** |

The prompt is committed verbatim beside this file as
`gate-classification-item4-r2-20261024.question.md`. It stated that items 2 and
3 are not required, per the owner's directive.

## Verdicts

| Question | anthropic | openai |
|---|---|---|
| Q1. Is item 4 met? | **not met**: the keyword predicate accepts negations such as *"does not fail"* and *"no contract"* | **not met**: *"49/49 demonstrates agreement between the ledger and its regex classifier, not that every invariant aspect satisfies the intended class predicate"* |
| Q2. Re-attest the revision-17 pins | **do not renew**: it would freeze a flawed predicate | **renew**: the diff is a strengthening, and renewal is not acceptance |
| Q3. Is 7.1 closed? | no | no (0.90) |

openai named what would change its verdict: *"structured fields — such as an
asserted contract, enforcement mechanism, and failing outcome — or tests
proving rejection of negated, quoted, hypothetical, and informational uses"*.

## Disposition

- **Q1** is 2/2 not met. Revision 18 of
  `agents/evidence/analysis/gate-classification-ledger-20261024.md` removes
  every prose predicate. invariant and observation now derive from the
  independent branch inventory's structured `effect` field, through the
  independently reviewed mapping. snapshot and tolerance need structured fields.
  The one semantic/behaviour divergence, `R16.d`, is recorded as owed to 7.2.
- **Q2** split, so nothing is renewed (D38). The reconciler and ledger-table pins
  stay at their revision-16 values, and the record reads quarantined until
  round 24 attests the cumulative diff.
