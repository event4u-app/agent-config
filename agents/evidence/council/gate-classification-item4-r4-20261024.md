<!-- evidence-type: analysis -->

# Round 24's must-fixes, and the R16.d residue

AI council, 2026-10-24, the twenty-fifth round that day.

| Field | Value |
|---|---|
| Seats | anthropic/claude-sonnet-4-5 + openai/codex-default |
| Mode | design, 2 rounds with peer review |
| Transport | CLI |
| Cost | `$0.00` |
| Present | **2/2** |

The prompt is committed verbatim beside this file as
`gate-classification-item4-r4-20261024.question.md`.

## Verdicts

| Must-fix | anthropic | openai |
|---|---|---|
| 1. structured mode | closed | closed |
| 3. waiver reads `waived` | closed | closed |
| 4. no waiver for mixed, unreached or unknown | closed | closed |
| 5. approver, issue, expiry and milestone | **open**: the milestone is never validated | **open**: `owed_to` is inert, the issue check is cosmetic, and impossible dates pass |
| 6. snapshot and tolerance supplement behaviour | closed | closed |
| 7. atomic attestation | closed | closed, *"narrowly"*: set consistency, not authorization |

| Question | anthropic | openai |
|---|---|---|
| Q2. Renew the pin set? | do not renew, until must-fix 5 is closed and the owner has answered | do not renew; renew *"the complete attested set once"* afterwards |
| Q3. Is R16.d the only shortfall? | no, must-fix 5 as well | no, must-fix 5 as well; R16.d is owner-reserved |
| Q4. Recommendation for R16.d | correct the behaviour (0.75) | correct the behaviour; a waiver is *"defensible only as a short-lived migration mechanism"* (0.95) |

openai's strongest objection: a literal `"owner"` in repository files *"collapses
author, approver, and attester into the same write capability"*.

## Disposition

Revision 20 of `agents/evidence/analysis/gate-classification-ledger-20261024.md`
closes must-fix 5. The milestone must be an open roadmap step, and a ticked step
lapses the waiver. The issue text must occur in its file. The directive must be
tracked and must name the row. The expiry must be a real date.

The approval-provenance limit is recorded and stays owner-reserved. R16.d goes
to the owner as gate `7-1-r16d-waiver`. The attested set is renewed once, after
the owner's answer.
