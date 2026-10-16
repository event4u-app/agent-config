---
proposed_by: claude-opus-5.5/fix-restore-pinned-subject-calculator-20261016
implemented_by: claude-opus-5.5/fix-restore-pinned-subject-calculator-20261016
reviewed_by: ai-council/anthropic-claude-sonnet-4-5+openai-codex-default-2026-10-16
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
subject: 650802bc54cc6a001f44740d74c9efd53f138b0b293b2b2d4d96b86c75a30c37
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — move the subject calculator's pin to the blob main holds

Covers branch `fix/restore-pinned-subject-calculator-20261016`: one line of
`src/scripts/check_kernel_edit_ratified.ts`, the `PENDING_MECHANISM_PINS` entry
for `src/scripts/_lib/ratification_subject.ts`, from blob
`3842d91528ec5229819dbd0da2f1a67a1f0eb06c` to
`176f6532cbb2a9c60492e9aceecf39021d691f69`.

## Owner decision

Decided by: owner, 2026-10-16, chat — under
`docs/contracts/ratification-artifact.md` § "When the user decides", condition 4
(the change is to the reviewer itself). Of: move the pin to the blob main holds /
revert the module to the pinned blob / gate the module now (stage 2), the owner
chose to move the pin. The owner also directed that technical decisions of this
kind go to the council rather than to the owner.

## Why the pin was stale

#2379 (`a10aa16a1`, stage 1 of 2) pinned the module to the blob its council
round 5 reviewed at `4b1e3f15a`. Its branch then merged `origin/main`
(`c18297eeb`), which carried #2375 (`85d00e56a`): the module's three refusal
classes declare their fields instead of using parameter properties, which
`node --experimental-strip-types` cannot carry and the danger gate's
base-classifier run now needs. #2375's council round 5 had the module in scope;
round 9 approved 2/2. Main therefore held `176f6532…` while the pin named
`3842d915…`, and the gate refused every diff on the pin. A revert would have
taken the danger gate off its node-only path.

## The review — one round, both seats

Prompt: `agents/evidence/council/repin-subject-calculator-review-20261016.question.md`,
reviewed commit `aea2db8be`. Quorum 2 of 2 through the CLI seats, nothing billed.

| Round | Reviewed | anthropic/claude-sonnet-4-5 | openai/codex-default |
|---|---|---|---|
| 1 | `aea2db8be` | APPROVE | APPROVE |

Stances, in the seats' words:

- anthropic: "**APPROVE** — the pin correctly moves to a council-reviewed,
  behavior-identical blob."
- openai: "**APPROVE** — no correctness or shipping blocker is shown".

Refinement recorded from openai: the refactor is "no relevant behavioral
change" rather than "zero" — native class-field semantics could differ for a
subclass installing a setter on the same property; none exists and no gate
behaviour depends on it.

Not taken, named by the seats as non-blocking: a docstring sentence on when a
pin may move (anthropic) — a further edit to the gated file, left to stage 2,
which removes the pin; a test that the pin equals the repository blob (openai) —
already present since #2379 round 4 (the pin test compares `gitBlobId` with
`git hash-object`), and passing at `aea2db8be`.

The seat verdicts are transcribed by the implementing session; the council
responses are gitignored and not committed. The prompt is committed, so what
was asked can be checked; what was answered rests on this transcription.
