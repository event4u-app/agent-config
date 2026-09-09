# Emphasis budget

Authoring guideline. **This is a review-time discipline, NOT a merge-blocking
linter** — there is no CI gate; PR review owns the judgment.

## The principle

Emphasis is a currency, and inflation debases it. Reserve the loud channels —
ALL-CAPS, `## Iron Law` fences, spaced repetition of the same imperative — for
**asymmetric, irreversible harm**: data loss, credential/secret exposure, a
safety floor, a legal/compliance breach. When everything shouts, nothing does:
an over-emphasized doc trains the reader to skim past the caps, so the one caps
line that guards a `DROP TABLE` loses its signal.

## The discipline

When you add emphasis, be able to answer — in the artifact or the PR — two
questions:

1. **What specific harm does this prevent?** Name it (not "this is
   important" — *what* goes wrong, to *whom*, how badly).
2. **Why is post-hoc correction insufficient?** Emphasis is justified when the
   harm is irreversible or asymmetric (a wrong send/delete/charge can't be
   taken back). If a normal-weight sentence + a later fix would do, use normal
   weight.

If you cannot answer both, down-weight to plain prose.

## Why not a linter

A mechanical caps-quota is unenforceable — semantic substitution ("Critically:
never…", bold, block quotes) defeats a caps count while keeping the shout — and
it blocks ready work on a cosmetic metric. The Iron-Law *count* is also a
denominator artifact: most existing Iron Laws already guard data-loss /
credential / safety domains, so the raw number is not evidence of inflation.
Judgment at review time, keyed to the harm-asymmetry test above, is the control.

## Overlap (why a separate guideline)

Distinct from [`preservation-guard`](../../../src/rules/preservation-guard.md)
(preserve existing emphasis through a transform — this governs *adding* it),
[`size-enforcement`](../../../src/rules/size-enforcement.md) (line budgets, not
emphasis weight), and [`token-budget-discipline`](../../../src/rules/token-budget-discipline.md)
(load cost, not signal-to-noise). None owns the emphasis-rationing judgment;
this guideline does.
