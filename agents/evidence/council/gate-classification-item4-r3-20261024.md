<!-- evidence-type: analysis -->

# Item 4 from structured fields, and re-attestation

AI council, 2026-10-24, the twenty-fourth round that day.

| Field | Value |
|---|---|
| Seats | anthropic/claude-sonnet-4-5 + openai/codex-default |
| Mode | design, 2 rounds with peer review |
| Transport | CLI |
| Cost | `$0.00` |
| Present | **2/2** |

The prompt is committed verbatim beside this file as
`gate-classification-item4-r3-20261024.question.md`.

## Verdicts

| Question | anthropic | openai |
|---|---|---|
| Q1. Is item 4 met? | **not met** (0.91) | **not met** (0.92) |
| Q2. Renew the pins (D38)? | **do not renew** | **do not renew**: revision 18 *"introduces a passing divergence channel and still reads mode from prose"* |
| Q3. Is 7.1 closed? | no | no |

The shared findings were these:

- R16.d's divergence records non-compliance and does not satisfy the predicate.
- The mode is still read from prose.
- Snapshot and tolerance metadata replaced behavioural validation rather than
  supplementing it.
- The grounds file is author-written.
- The waiver had no approver, expiry or issue.
- The inputs were not attested as one unit.

openai rejected one ground anthropic gave, that 21/22 alone forbids renewal: *"Requiring
already-renewed pins before deciding whether to renew them would be circular."*

Both seats named the only two ways past R16.d:

- **anthropic.** *"Path A: make mode structured, require all 49 aspects derive
  their class (0 divergences); Path B: owner formally amends item 4 to allow
  time-bounded, independently-approved waivers with expiry + mechanical
  enforcement."*
- **openai.** *"Remove R16.d's mismatch, or obtain an explicit owner amendment
  allowing waivers under item 4."*

## Disposition

Revision 19 of `agents/evidence/analysis/gate-classification-ledger-20261024.md`
delivers must-fixes 1 and 3–7.

Must-fix 2 is owner-reserved by both seats' own routing. Amending a closure
standard the owner set is the owner's decision. It goes to the owner as gate
`7-1-r16d-waiver`. The pins are not renewed.
