<!-- evidence-type: analysis -->

# Re-attestation at revision 23

AI council, 2026-10-24, the twenty-eighth round that day.

| Field | Value |
|---|---|
| Seats | anthropic/claude-sonnet-4-5 + openai/codex-default |
| Mode | design, 2 rounds with peer review |
| Transport | CLI |
| Cost | `$0.00` |
| Present | **2/2** |

This was attempt 3 on the renewal target. It evaluated revision 23. The prompt is
committed verbatim beside this file as
`gate-classification-renewal-r3-20261024.question.md`.

## Verdicts

| Question | anthropic | openai |
|---|---|---|
| Q1. Renew revision 23's set? | **do not renew**. `yamlBlocks`/`wiringScope` define the trust boundary *"using textual heuristics rather than semantic execution guarantees"*; the ledger-row change is not shown; no post-renewal clean run | **do not renew**: *"I would reject the move from whole-file hashes to heuristic YAML fragments. Attestation should fail conservatively."* |
| Q2. Item 4 | **not met**. `excluded` is bookkeeping, not runtime precedence (what does `--strict --list` do?); the default-row bypass skips validation; validation checks membership, not behaviour | **not met**. The validator *"proves correspondence, not runtime selection"*; it asks for *"a truth-table test [that] should enumerate valid combinations of relevant mode flags and compare actual program behavior"* |
| Q3. 7.1 closed? | no (0.85) | no (0.92) |

openai's kill switch: *"restore conservative whole-file pins whenever semantic
scope resolution is incomplete."*

## Disposition

Three attempts on this target each drew a new set of requirements. Attempt 4
therefore changes strategy, under the fix-loop bound. It asks the council for a
**closed** acceptance list for the renewal and for item 4, and for a decision on
splitting the unit, rather than another renewal verdict. Round 20 used the same
move and ended the earlier drift.
