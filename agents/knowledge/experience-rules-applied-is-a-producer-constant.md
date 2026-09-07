---
kind: experience
id: rules-applied-is-a-producer-constant
retired: 2026-09-07
retired_by: road-to-observed-learning-signal Phase 4
retired_because: >-
  The falsifier fired. `_lib/orchestration_record.ts` and
  `_lib/review_skipped_record.ts` no longer write the literal
  ['delegation-policy']; both call `appliedIds` in
  `_lib/audit_field_provenance.ts`, carrying what the caller observed and
  writing [] when the caller observed nothing. Mining a fixture stream of mixed
  runs built through the changed producers returns more than one pattern with a
  top count strictly below the line count
  (tests/scripts/rules_applied_is_observed.test.ts). The registration row in
  PRODUCER_CONSTANT_FIELDS was removed in the same change, because removing it
  IS the assertion that the field is now observed.
retirement_scope: >-
  The historical stream is NOT covered. Audit lines are append-only, so every
  line written before 2026-09-07 still carries the constant and mining the real
  stream will keep surfacing it until new lines accumulate. A reader aggregating
  across the cutover must segment; this card's strategy remains correct FOR
  THOSE LINES and is wrong only about lines written after it.
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
  RETIRED 2026-09-07 — do not apply to lines written after that date. For lines
  written BEFORE it, the card stands: `rules_applied` was the literal
  ['delegation-policy'] on every line, so a per-asset rate over those lines
  measures the producer, not the rule. A reader spanning the cutover segments
  on `ts` rather than aggregating across it.
falsifier: >-
  FIRED 2026-09-07. Both producers now compute `rules_applied` from what the
  run carried, and mining a fixture stream of mixed runs returns more than one
  pattern with a top count strictly below the line count. The card is retired
  against road-to-observed-learning-signal Phase 4.
anti_patterns:
  - reporting-a-per-rule-win-rate-over-a-constant-field
  - reading-the-count-as-evidence-delegation-policy-is-effective
---

# `rules_applied` is a producer constant, not an observation — RETIRED

> **Retired 2026-09-07** by `road-to-observed-learning-signal` Phase 4. Kept
> rather than deleted because it remains correct about the lines it was written
> from, and a reader mining the append-only stream will still meet them.

## Strategy (as it now stands)

For audit lines written **before 2026-09-07**, the original strategy holds: do
not read `rules_applied` as evidence that a rule fired, because both shipped
producers wrote the literal `['delegation-policy']` on every line, so a
per-asset rate over those lines measures the producer, not the rule.

For lines written **after** it, the field is an observation: the producers carry
what the caller observed and write `[]` when nothing was observed. A reader
spanning the cutover segments on `ts`; it must not aggregate across it.

## The pattern that produced this card

`extract_audit_patterns --min-count 2` over 935 real audit lines mints exactly
one pattern: `implement:success:delegation-policy`, **count 914**. That looks
like a strong behavioural regularity and is not one — it is a constant, written
identically on every line by `orchestration_record.ts` and
`review_skipped_record.ts`.

The mining gate did its job. The signal it surfaced is real; what it is a signal
*about* is the writer, not the work.

## Falsifier — fired

A producer computes `rules_applied` from rules that actually fired, and the
mined pattern's count falls below the line count.

**Both halves fired on 2026-09-07.** `_lib/orchestration_record.ts` and
`_lib/review_skipped_record.ts` call `appliedIds` instead of writing a literal,
and mining a fixture stream of mixed runs built through those producers returns
more than one pattern with a top count strictly below the line count
(`tests/scripts/rules_applied_is_observed.test.ts`).

**What is honestly NOT shown:** the same statement over the *real* stream. Audit
lines are append-only, so the 1074-of-1104 reading stands for the lines that
already exist and cannot be made to fall by any change to the producers. The
fixture is the only stream where the second half is demonstrable on the day the
change lands, and saying so is cheaper than implying a measurement nobody took.

## Anti-patterns

- Reporting a per-rule win rate over `rules_applied` while it is a constant: the
  rate is 100 % for `delegation-policy` and undefined for all 118 other rules,
  which reads as a finding and is an artefact.
- Reading the count as evidence that delegation-policy is effective.
