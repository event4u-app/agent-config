---
proposed_by: claude-opus-5.5/drain-danger-gate-governs-20261015
implemented_by: claude-opus-5.5/drain-danger-gate-governs-20261015
reviewed_by: ai-council/anthropic-claude-sonnet-4-5+openai-codex-default-2026-10-15
providers: [anthropic, openai]
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
subject: bc584fc0c4bef1b57acdb88692a7715cdd8f7a188a1332a638c2b1cd18574ded
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — a bypass of the ratification gate gets a record with a closing

Covers branch `drain/danger-gate-governs-20261015`, Phase 4 of
`road-to-a-danger-gate-that-sees-what-governs` (steps 4.1 and 4.2). Named for the
branch because the gate reads this file before the pull request exists.

## The gated surfaces

The gate classifies exactly two files of this diff as gated, both on
`ANCHOR_PATHS` of `check_kernel_edit_ratified.ts`:

- `src/scripts/_lib/platform_anchor.ts` — gains the pure evaluator
  `evaluateBypassRecords` and its constants;
- `src/scripts/check_platform_anchor.ts` — reads the bypass records on every
  run, compares the record set against the base revision, and checks that a
  closing review is a committed council review citing the record's subject.

`ratification_subject` prints the subject above at `09526f740`, over those two
files, both for the two paths alone and for the whole changed-file list.

Not gated, in the same diff: `docs/contracts/ratification-artifact.md` (§ Emergency
use and § The bypass record), the test file, `lint_evidence_artifacts` (one new
evidence type) and the Phase 3 and 5 changes of the same roadmap.

## Why `confirmed-non-expanding`

```
NOTHING HERE EXPANDS ANY AUTHORITY.
THE BYPASS ROUTE IS THE OWNER'S AND STAYS HIS; THIS CHANGE RECORDS IT AND
REDS WHILE ITS CLOSING IS MISSING.
A RUN NEVER PERFORMS, WIDENS OR RESTORES A BYPASS — THE CONTRACT SAYS SO.
NO THRESHOLD, FLOOR OR WATCH LIST MOVES.
```

`check_platform_anchor` gains one more way to fail and none to pass. Its
existing evaluation of the forge's rulesets is unchanged.

## The review — ten rounds, both seats each round

Prompts and the round-10 seat texts:
`agents/evidence/council/danger-gate-bypass-closing-review.md` and the
`danger-gate-bypass-closing-review*-20261015.question.md` prompts beside it. Every
round reached quorum 2 of 2 through the CLI seats, nothing billed.

| Round | Reviewed | anthropic/claude-sonnet-4-5 | openai/codex-default |
|---|---|---|---|
| 1 | `646d2c822` | ratified | refused |
| 2 | `aa6a7760d` | ratified | refused |
| 3 | `778cc3be1` | ratified | did not conclude |
| 4 | `9336a43d6` | confirmed-non-expanding | did not conclude |
| 5 | `e7291e37d` | confirmed-non-expanding | did not conclude |
| 6 | `6483ebbcf` | confirmed-non-expanding | refused |
| 7 | `84fc7837e` | confirmed-non-expanding | refused |
| 8 | `473333aa0` | confirmed-non-expanding | did not conclude |
| 9 | `e07c84c83` | confirmed-non-expanding | did not conclude |
| 10 | `09526f740` | confirmed-non-expanding | confirmed-non-expanding |

What the rounds changed: required fields and the two open ones; fail-closed
reads of a record and its directory; a review that must be a committed council
file citing the subject, first committed after the restore, and never a bypass
record; chronology and a seven-day ceiling; deletion read from Git against the
base; one descriptor per record without following a link; bounded reads and a
byte-counted review budget; sanitised findings.

Not taken from round 10, both named as non-blocking by the seats: anthropic's
rollback criterion (more than three bypasses in 90 days triggers a process
review) — a policy for the owner, not a property of the reader; and openai's
low finding that a review committed in the same second as a fractional
`restored_at` is rejected, because Git's committer time has whole-second
precision. That errs toward refusing a closing, never toward accepting one.

## Who decides

The contract's § When the user decides, condition 4, reserves a change to "this
contract" to the owner, and this diff edits the contract. The council review
above is the content review; the authorization is the owner's merge.
