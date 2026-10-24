<!-- evidence-type: analysis -->

# The definition holds; the evidence for closure was not in the prompt

AI council, 2026-10-24, the tenth round that day. anthropic/claude-sonnet-4-5 +
openai/codex-default, 2/2 present, 2 rounds with peer review, design mode, CLI
transport, `$0.00`, no chairman synthesis. The prompt is committed verbatim
beside this file as `gate-classification-ledger-r4-20261024.question.md`.

## Verdict: definition accepted (openai), closure withheld on evidence (both)

- openai: *"Q1: yes, narrowly; Q2: no on the supplied evidence."* Confidence
  0.90 that the definition meets the condition the previous round set. On
  closure: *"A complete row-level reconciliation could readily change this
  answer to yes."*
- anthropic: Q1 and Q2 *no*. The reason is not a defect in the definition. The
  seat could not verify consistent application *"without seeing the ledger"*,
  and it listed five layers of trust placed in the asking agent.

## Why, and whose miss it was

The prompt said the 37 rows were "unchanged from revision 3" and left them out,
along with the Phase 7 inventory and the invocation inventory. That was the
asking agent's scoping error, and it made the round unable to answer. The
seats did not miss anything.

## What both seats asked for, applied in revision 5

1. The Phase 7 start inventory itself, not a citation of it.
2. The full ledger rows.
3. A check-to-row reconciliation. openai: *"independently checked"*. anthropic:
   `[inventory_check_id] → [ledger_aspect_ids] → [classification]`.
4. A justified aggregation rule. Both reject *"at least one classified aspect
   per check"* as an invented rule. Revision 5 now requires **every binding
   aspect** of a check to carry a class.

Revision 5 adds `agents/evidence/analysis/gate-ledger-reconcile.mjs`, which
checks items 1–4 mechanically. It was seen to fail on a sabotaged row. All four
items go into the eleventh round's prompt verbatim.

## Carried to 7.2, not 7.1

anthropic's hardest pushback is that classification without machine-checked
divergence detection will drift. It asks for a per-row schema with
`expected_exit`, `current_exit`, `divergence` and `last_verified`, maintained by
CI. That is a 7.2 item.
