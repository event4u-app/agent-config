---
proposed_by: claude-opus-5.5/fix-gate-the-subject-calculator-stage-2-20261016
implemented_by: claude-opus-5.5/fix-gate-the-subject-calculator-stage-2-20261016
reviewed_by: ai-council/anthropic-claude-sonnet-4-5+openai-codex-default-2026-10-16
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
subject: 964aabaeb4b741d2368bf3920c8d19e43451ff0da4bff7cae70e974eb8d44f2c
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — the gate watches the subject calculator; its pin retires (stage 2 of 2)

Covers branch `fix/gate-the-subject-calculator-stage-2-20261016`, stage 2 of the
widening of `check_kernel_edit_ratified`'s mechanism set that #2379 began.

## Decision

`docs/contracts/ratification-artifact.md` § "When the user decides", condition 4,
names the owner for a change to the reviewer itself. Owner's standing direction,
2026-10-16, chat: technical decisions about the ratification gate's modules go to
the council, not to the owner. The council review below is therefore the
decision on the content. The merge stays the owner's: the danger gate classes
this change `needs-owner` (governance surface), and ADR-281 makes a council
clearance of that surface advisory.

## The gated surface

Both the base revision's gate (main at `73eb69439`, run from a detached worktree
with `--root <head>`) and the head's gate classify exactly one file of this diff
as gated, `src/scripts/check_kernel_edit_ratified.ts`, and print the subject above
at `05856985b`:

- `MECHANISM_IMPORT_PATHS` gains `src/scripts/_lib/ratification_subject.ts`; its
  bytes are left alone (blob `3842d915…`, restored by #2383), so the base gate and
  the head gate digest the same files;
- `PENDING_MECHANISM_PINS`, `gitBlobId` and `pinViolations` go — no pending module
  is left, and the pin existed only to bind the module until this change;
- `main()` resolves the head and the base once for every run and judges the union
  of a `--files` list and `base..head`: a list can add paths, never hide one, and
  a revision or range that cannot be read refuses (exit 1 / exit 3).

## The review — four rounds, both seats each round

Prompts, committed verbatim:
`agents/evidence/council/gate-the-subject-calculator-stage-2-review{,-r2,-r3,-r4}-20261016.question.md`.
Every round reached quorum 2 of 2 through the CLI seats, nothing billed.

| Round | Reviewed | anthropic/claude-sonnet-4-5 | openai/codex-default |
|---|---|---|---|
| 1 | `5dd7b6e6e` | REQUEST_CHANGES | REQUEST_CHANGES |
| 2 | delta to `638c06dc5` | APPROVE | REQUEST_CHANGES |
| 3 | delta to `72ec820a2` | REQUEST_CHANGES | REQUEST_CHANGES |
| 4 | delta to `05856985b` | APPROVE | APPROVE |

Findings and their dispositions:

1. Round 1, both, HIGH — the pin bound the module whatever list a caller passed;
   gated, it is bound through the list. Disposition: a test drives `main()` with
   no `--files` over a fixture whose only change is the calculator and expects 1;
   the production callers in `.github/workflows/consistency.yml` pass no list.
2. Round 2, openai — a caller-supplied `--files` list could still omit the module.
   Disposition: `main()` judges the union of the list and the range.
3. Round 3, both — the fallback to the list alone when the range did not resolve
   failed open. Disposition: the fallback is gone; an unresolvable range exits 3;
   a test covers an unresolvable base with a list that omits the calculator.

Disclosed in round 4 and accepted: `classify_merge_risk_needs_owner.test.ts`'s
"each trigger fires alone" case moved its `reviewer-trust-chain` witness from the
calculator (now also a governance surface) to `_lib/merge_clearance_record.ts`;
the case asserting the calculator itself is `needs-owner` is unchanged.

Round-4 stances, in the seats' words:

- anthropic: "**APPROVE** — The round 3 fail-open path is completely closed with a
  clean, maintainable fix."
- openai: "APPROVE — the fail-open path is closed cleanly with focused regression
  coverage".

Not taken, named by openai as optional: a test for `changedFilesBetween` failing
after both revisions resolve.

Sensitivity: removing the module from `MECHANISM_IMPORT_PATHS` turns the closure
and CLI tests red; replacing the union with the list alone turns the omitted-list
case red. Both restored. The 13 suites that touch the gate or the classifier pass
(289 tests).

The seat verdicts are transcribed by the implementing session; the council
responses are gitignored and not committed. The prompts are committed, so what
was asked can be checked; what was answered rests on this transcription.
