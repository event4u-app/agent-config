<!-- evidence-type: analysis -->

# Re-attestation of the input set after D46

AI council, 2026-10-24, the twenty-sixth round that day.

| Field | Value |
|---|---|
| Seats | anthropic/claude-sonnet-4-5 + openai/codex-default |
| Mode | design, 2 rounds with peer review |
| Transport | CLI |
| Cost | `$0.00` |
| Present | **2/2** |

This was the renewal round D38 allows for the ten inputs that moved since
revision 16. The prompt is committed verbatim beside this file as
`gate-classification-renewal-20261024.question.md`.

## Verdicts

| Question | anthropic | openai |
|---|---|---|
| Q1. Renew the ten inputs as one set? | **do not renew**. The reconciler matches modes as substrings, and the inventory's effects are trusted, not derived. | **do not renew**: *"mode membership is inferred using `preds.includes(mode)` and arbitrary flag presence via `/--[a-z]/`"* |
| Q2. Item 4 | **not met** | **not met**: *"only output-bucket exclusivity is established, while branch/mode predicates remain permissive"* |
| Q3. 7.1 closed? | no (0.89) | no (0.90) |

Both seats call the behaviour fix itself sound. They also raised two further
points:

- The absent-store exit 0 needs an operational state distinct from success, and
  rollback triggers.
- The ten-input unit attests the `check_step_production_reach --enforce` wiring
  change without examining it.

## Disposition

Revision 22 of `agents/evidence/analysis/gate-classification-ledger-20261024.md`
answers each finding:

- exact flag tokens, with structured flags per flag-only branch;
- effect-versus-code contradiction refusal, with the confirmation coverage
  stated (63 of 167);
- the D46 operational state and revert triggers;
- the stated scope of the wiring pins.

The pins stay unrenewed. Another renewal round on the cumulative diff is needed.
