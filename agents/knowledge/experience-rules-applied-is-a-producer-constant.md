---
kind: experience
id: rules-applied-is-a-producer-constant
scope: repo
epistemic_type: observed
confidence: high
expiry: 2027-02-28
provenance:
  pattern_ref: "extract_audit_patterns --min-count 2 → implement:success:delegation-policy (count 914)"
trigger_context:
  - audit-log-aggregation
  - rules-applied
  - per-asset-report
contradictions: []
supersedes: []
strategy: >-
  Do not read `rules_applied` as evidence that a rule fired. Both shipped
  producers write the literal ['delegation-policy'], so a per-asset rate over
  that field measures the producer, not the rule.
falsifier: >-
  A producer computes `rules_applied` from rules that actually fired, and the
  mined pattern's count falls below the audit line count. At that point this
  card is wrong and should be retired.
anti_patterns:
  - reporting-a-per-rule-win-rate-over-a-constant-field
  - reading-the-count-as-evidence-delegation-policy-is-effective
---

# `rules_applied` is a producer constant, not an observation

## Strategy

Do not read `rules_applied` as evidence that a rule fired. Both shipped
producers write the literal `['delegation-policy']`, so a per-asset rate over
that field measures the producer, not the rule.

## The pattern that produced this card

`extract_audit_patterns --min-count 2` over 935 real audit lines mints exactly
one pattern: `implement:success:delegation-policy`, **count 914**. That looks
like a strong behavioural regularity and is not one — it is a constant, written
identically on every line by `orchestration_record.ts` and
`review_skipped_record.ts`.

The mining gate did its job. The signal it surfaced is real; what it is a signal
*about* is the writer, not the work.

## Falsifier

A producer computes `rules_applied` from rules that actually fired, and the
mined pattern's count falls below the line count. At that point this card is
wrong and should be retired.

## Anti-patterns

- Reporting a per-rule win rate over `rules_applied` while it is a constant: the
  rate is 100 % for `delegation-policy` and undefined for all 118 other rules,
  which reads as a finding and is an artefact.
- Reading the count as evidence that delegation-policy is effective.
