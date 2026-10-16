---
proposed_by: claude-opus-5.5/fix-subject-calculator-strippable-20261016
implemented_by: claude-opus-5.5/fix-subject-calculator-strippable-20261016
reviewed_by: ai-council/anthropic-claude-sonnet-4-5+openai-codex-default-2026-10-16
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
subject: a2bcf5e882e6a117c7e683a77b01855f8676c778964a1fac7b9e707f899bbd69
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — restore the strippable subject calculator, end the danger-gate window

Covers branch `fix/subject-calculator-strippable-20261016`, the last step of the
recovery that #2383 began.

## Decision

`docs/contracts/ratification-artifact.md` § "When the user decides", condition 4,
names the owner for a change to the reviewer itself. Owner's standing direction,
2026-10-16, chat: technical decisions about the ratification gate's modules go to
the council. The council review below decides the content; the merge stays the
owner's, as the danger gate classes this change `needs-owner`.

## The gated surface

Both the base revision's gate (current main, run from a detached worktree with
`--root <head>`) and the head's gate classify exactly one file of this diff as
gated, `src/scripts/_lib/ratification_subject.ts` (gated since #2386), and print
the subject above at `830b5b037`:

- the module becomes blob `176f6532…`, byte-identical to #2375's council-reviewed
  refactor: three refusal classes declare their fields instead of using parameter
  properties, which `node --experimental-strip-types` cannot run;
- `tests/scripts/classify_merge_risk_base_revision.test.ts` drops the blob-keyed
  skip #2384 added, so the strip-types danger-gate test asserts `needs-owner`
  again wherever node strips types.

## The review — one round, both seats

Prompt: `agents/evidence/council/subject-calculator-strippable-review-20261016.question.md`,
reviewed commit `830b5b037`. Quorum 2 of 2 through the CLI seats, nothing billed.

| Round | Reviewed | anthropic/claude-sonnet-4-5 | openai/codex-default |
|---|---|---|---|
| 1 | `830b5b037` | APPROVE | APPROVE |

Stances, in the seats' words:

- anthropic: "**APPROVE** — The diff restores a council-approved refactor … and
  removes its temporary test exception exactly as intended."
- openai: "**APPROVE** — the constructors remain behaviorally equivalent and the
  temporary skip is removed coherently".

Condition both seats named: CI evidence that the restored strip-types test passes
on a node that supports type stripping. It is read from this pull request's Node
Tests run before merge.

Measured locally: 7 suites, 129 tests pass, the restored strip-types test
included.

The seat verdicts are transcribed by the implementing session; the council
responses are gitignored and not committed. The prompt is committed, so what was
asked can be checked; what was answered rests on this transcription.
