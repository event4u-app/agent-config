---
proposed_by: claude-opus-5.5/fix-gate-the-subject-calculator
implemented_by: claude-opus-5.5/fix-gate-the-subject-calculator
reviewed_by: ai-council/anthropic-claude-sonnet-4-5+openai-codex-default-2026-10-15
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
subject: ee118a4b91c45a887ee9ce7c0e9121112643f3144c2c10a397d2cff9e41181fe
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — the gate watches the modules its verdict runs through (stage 1 of 2)

Covers branch `fix/gate-the-subject-calculator`, stage 1 of a two-stage widening
of `check_kernel_edit_ratified`'s mechanism set.

## Owner decision

Decided by: owner, 2026-10-15, chat — under
`docs/contracts/ratification-artifact.md` § "When the user decides", condition 4
(the change is to the reviewer itself). The decision: stage the change in two
pull requests; the gated mechanism set after both stages adds
`_lib/ratification_subject.ts`, `_lib/adr_frontmatter.ts`, `_lib/gate_ledger.ts`
and `_lib/scan_scope.ts` to what was already gated; the writer CLIs
(`src/scripts/ratification_subject.ts`, `src/scripts/ratification_header.ts`)
and the contract stay outside. The council review below is the content review
of the stage-1 diff, not the authorization.

## The gated surfaces

Both the base revision's gate (main at `f998ea3b5`, run from a detached worktree
with `--root <head>`) and the head's gate classify exactly one file of this diff
as gated, `src/scripts/check_kernel_edit_ratified.ts`, and print the subject
above at `4b1e3f15a`:

- `MECHANISM_IMPORT_PATHS` — `_lib/adr_frontmatter.ts`, `_lib/gate_ledger.ts`,
  `_lib/scan_scope.ts` join the mechanism set;
- `isMechanismPath` — the single membership predicate, exported;
- `PENDING_MECHANISM_PINS` and `pinViolations` — `_lib/ratification_subject.ts`
  is pinned to Git blob `3842d91528ec5229819dbd0da2f1a67a1f0eb06c`; a pinned
  module present at the head commit is compared to its pin whatever the diff
  lists, and an absent one named by the diff is refused as a deletion, before
  the "nothing to ratify" exit;
- the ledger counts every mechanism file in the diff as gated.

Not gated, in the same diff: `src/scripts/_lib/ratification_subject.ts` (its own
self list replaced by the gate's `isMechanismPath`), the two test files and the
council evidence. The subject calculator's bytes are bound through the pin,
which sits in the gated gate file: at `4b1e3f15a` it is blob `3842d915…`, and
the test `every pending module is pinned to its current blob` compares the
checkout against the pin. Stage 2 gates the module and removes its pin; its base
must carry this blob (`git rev-parse <stage-2 base>:src/scripts/_lib/ratification_subject.ts`).

## What the change does to authority

It widens what the gate gates — three modules join, and a change to the subject
calculator is refused outright until stage 2 gates it. It narrows nothing: the
digest's coverage is the gate's classification, which includes every file the
previous self list held. Recorded as `ratified` because it edits the
ratification mechanism.

## The review — five rounds, both seats each round

Prompts and seat texts: `agents/evidence/council/gate-the-subject-calculator-review.md`
and the `gate-the-subject-calculator-review*-20261015.question.md` prompts beside
it. Every round reached quorum 2 of 2 through the CLI seats, nothing billed.

| Round | Reviewed | anthropic/claude-sonnet-4-5 | openai/codex-default |
|---|---|---|---|
| 1 | `8ee2a3452` (one-PR design, superseded) | REQUEST_CHANGES | REQUEST_CHANGES |
| 2 | `59f504d8d` (stage 1) | REQUEST_CHANGES | REQUEST_CHANGES |
| 3 | delta to `7afc062c3` | REQUEST_CHANGES | REQUEST_CHANGES |
| 4 | delta to `5a2c68fb7` | REQUEST_CHANGES | REQUEST_CHANGES |
| 5 | delta to `4b1e3f15a` | APPROVE | APPROVE |

Round-5 stances, in the seats' words:

- anthropic: "**APPROVE** — findings addressed, tradeoffs documented, no
  merge-blocking defect."
- openai: "APPROVE — the delta closes the reported bypasses without a confirmed
  correctness or security regression; the highest-leverage pre-merge change is an
  end-to-end `main` test proving deletion or rename produces the source path
  consumed by `pinViolations`."

Not taken from round 5, both named as non-blocking by the seats: an end-to-end
test through `main` for a deleted pinned module, and splitting the closure-walk
regression cases into separate tests.
