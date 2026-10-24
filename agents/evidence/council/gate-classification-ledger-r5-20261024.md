<!-- evidence-type: analysis -->

# The reconciliation was circular: the ledger defined its own population

AI council, 2026-10-24, the eleventh round that day. anthropic/claude-sonnet-4-5
+ openai/codex-default, 2/2 present, 2 rounds with peer review, design mode, CLI
transport, `$0.00`, no chairman synthesis. The prompt is committed verbatim
beside this file as `gate-classification-ledger-r5-20261024.question.md`. It
carried the Phase 7 inventory, the full ledger, the invocation inventory and the
reconciliation output.

## Verdict: convergent — not closed, one missing thing, not owner-reserved

- openai: Q1 *no*, Q2 *no*, confidence 92–94 %. *"The ledger is internally
  classified, but completeness against the implementation is unproven and
  check 16 already exposes a missing invocation mode."*
- anthropic: *"Do not greenlight 7.1 as written."* It gives a conditional yes
  once the missing row is added and check 16 is verified against source.
  *"The work is 90% done; the remaining 10% is identifiable."*

The missing thing, in both seats' words, is **a source-derived assertion-by-
invocation-mode inventory reconciled against the ledger**. Both say it
**does not need the owner-reserved second principal**. *"A reviewer, test
harness, or independently implemented extractor with repository read access can
supply it"* (openai). *"Even a grep-based extraction would suffice"*
(anthropic).

## Findings both seats named

1. **The reconciliation is circular for completeness.** Its row population came
   from the ledger itself, so it could not see an omitted mode.
2. **`check_composite_arming --self-test` has no row**, although the invocation
   inventory lists it at a failing step.
3. **The *store malformed* row may misstate the code.** It needed source or
   execution evidence. Verified in revision 6: the code exits 1 only when
   malformed lines leave no usable record. The row was wrong.
4. **Representative executions** should confirm the stated behaviour.

## Raised by one seat and carried

- Check 1's reclassification from governed snapshot to shrink-only invariant
  rests on governance intent, not an enforced boundary (openai). anthropic
  says it does not block. Carried, with the repository-consistency qualifier
  already on the row.
- The four classes lack operational definitions (both, as non-blocking for
  7.1).
- A kill switch before 7.2 consumes the ledger:
  - stop if source reconciliation finds an undeclared mode;
  - stop if an observed exit contradicts a recorded property;
  - reopen 7.1 if the implementation, flags, wiring or governed inputs change
    without a ledger update (openai).

## Applied in revision 6

- The reconciler extracts every `--flag` literal from each check's source and
  fails on one that is neither declared as changing no assertion nor named by
  a binding row. It was seen red on a sabotaged row.
- The source scan surfaced eight rows the ledger lacked: four self-test modes,
  `--global`, two legacy-warning modes and partial malformation.
- The *store malformed* row is corrected.
- Check 16 was executed against four stores (absent, all malformed, partially
  malformed, valid), and each result matches its row.
