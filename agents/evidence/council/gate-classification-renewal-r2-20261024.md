<!-- evidence-type: analysis -->

# Re-attestation at revision 22

AI council, 2026-10-24, the twenty-seventh round that day.

| Field | Value |
|---|---|
| Seats | anthropic/claude-sonnet-4-5 + openai/codex-default |
| Mode | design, 2 rounds with peer review |
| Transport | CLI |
| Cost | `$0.00` |
| Present | **2/2** |

This is the second renewal round on this target. It evaluated **revision 22**, a
changed revision, under the coordinator's fix-loop authorisation. The prompt is
committed verbatim beside this file as
`gate-classification-renewal-r2-20261024.question.md`.

## Verdicts

| Question | anthropic | openai |
|---|---|---|
| Q1. Renew the twelve inputs? | **do not renew**. Its defects: the unexamined `--enforce` wiring, circular grounds, independence not demonstrable, and the 36/37 self-test. | **do not renew**: *"an attestation-scope mismatch: the proposed renewal operates on whole-input hashes, while the supplied examination explicitly excludes a behavior-changing portion of those inputs"* |
| Q2. Item 4 | **not met**: only 38 % of blocking branches are code-confirmed; the `every(nonBlocking)` blind spot; label exclusivity only | **not met**: *"demonstrates exclusivity of the reconciler's derived result labels, but not … of the underlying operational predicates"*. It would accept *"an explicit precedence table implemented by the classifier and tested for every permitted overlap"*. |
| Q3. 7.1 closed? | no (0.93) | no (0.90) |

openai rejected one of anthropic's grounds. Treating the pre-renewal self-test
failure as a reason never to renew *"would make D38 circular"*.

## Disposition

Revision 23 of `agents/evidence/analysis/gate-classification-ledger-20261024.md`
answers the findings:

- wiring pins scoped to Phase 7 steps;
- an explicit, tested precedence table for mode overlaps;
- the five self-test and freshness rows given structured modes;
- the narrowest-branch contradiction rule;
- the independence sessions' prompts committed.

The pins stay unrenewed. Round 28 is attempt 3 on this target.
