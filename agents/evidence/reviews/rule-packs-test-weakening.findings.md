# Findings: rule-packs-test-weakening
<!-- evidence-type: original-review -->

Independent verdict on the net assertion loss in PR #2731 (removal of the
legacy `projection.rule_packs` honouring), required by `check_test_weakening`.

- **Reviewer:** AI council, two providers (anthropic, openai), 2/2 present, run 2026-10-28.
- **Prompt:** `rule-packs-test-weakening.review-input/prompt.md`, sha256 `3e6f8501a4d6abd1fd9a21c9b1a1ba0fb5943573c4bfe4ce778e41e56869d234`.
  It carries the production diff and the test diff, and asks per file for LEGITIMATE or WEAKENING. It states no expected outcome.

## Verdict per file

| Test file | Verdict | Reason |
|---|---|---|
| `tests/install/rule_packs_auto.test.ts` | LEGITIMATE | The changed empty-list assertion verifies the intentional reversal. |
| `tests/install/rule_packs_retired.test.ts` | WEAKENING (both seats) | The doctor tests go with the deleted `rulePacksLegacyCheck`, which is legitimate. But the file dropped the leftover `auto` case and never tested the new precedence rule: a leftover value must not override `runtime.active_packs`. |
| `tests/install/rule_scoping_global_deploy.test.ts` | LEGITIMATE | It keeps the reap contract and moves to `runtime.active_packs`, the surviving control. |
| `tests/scripts/projection_key_downgrade.test.ts` | LEGITIMATE | Every removed assertion called the deleted `projectionModeOf`. |
| `tests/scripts/projection_key_migration.test.ts` | LEGITIMATE | It follows the warning's intentional change from "still honoured" to "ignored". |

## Disposition

The `rule_packs_retired.test.ts` finding is fixed in the same PR:

- A leftover `auto` is ignored.
- `runtime.active_packs` decides over a conflicting leftover list.
- `runtime.active_packs` decides over a leftover `[]` or `auto`.
- The tombstone names `runtime.active_packs`.

**Sensitivity:** with the pre-removal `src/install/rule_scope.ts` restored, 5 of the 11 tests in that file fail. With the current code all 11 pass.
