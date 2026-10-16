---
proposed_by: claude-opus-5.5/fix-gate-header-matches-hooks-20261016
implemented_by: claude-opus-5.5/fix-gate-header-matches-hooks-20261016
reviewed_by: ai-council/anthropic-claude-sonnet-4-5+openai-codex-default-2026-10-16
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
subject: 611276120fee1278c9d819d284d1a3872ba2c106571b6e1bf085198cb05c2bc4
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — the gate's header states which of its paths no hook denies

Covers branch `fix/gate-header-matches-hooks-20261016`, step 4.3 of
`road-to-self-modification-that-a-council-must-pass`: a comment-only change to
the gated `src/scripts/check_kernel_edit_ratified.ts`.

## Decision

`docs/contracts/ratification-artifact.md` § "When the user decides", condition 4,
names the owner for a change to the reviewer itself. Owner's standing direction,
2026-10-16, chat: technical decisions about the ratification gate's modules go to
the council. The council review below decides the content; the merge stays the
owner's, as the danger gate classes a change to this file `needs-owner`.

## The change

The header said `dispatch_hook.ts` and `kernel_rules.ts` "are also denied at
tool-call time". It now says no `pre_tool_use` concern bound in
`hook_manifest.yaml` denies an edit to either, names what the two guards it
had cited actually do — the plumbing guard protects four generated build
outputs, not three as rounds 1 and 2 were told — and states that for these two
paths the record is the only layer. Both the base revision's gate and the head's
print the subject above at `394511192` and after, covering only
`src/scripts/check_kernel_edit_ratified.ts`.

Evidence for the sentence, taken rather than read: with the hook bundle built in
the branch's worktree, an `Edit` of each path was sent through the real
dispatcher as a `PreToolUse` payload. Both passed every bound concern (exit 0, no
deny); the controls `hooks/hooks.json` and `src/rules/non-destructive-by-default.md`
were refused (exit 2) through the same harness.

`tests/scripts/check_kernel_edit_ratified_header_claims.test.ts` keeps it true:
the two guards the header names let both paths through for Write, Edit and a Bash
redirect while denying their controls, and every concern bound to `pre_tool_use`
in any profile is pinned, so a new binding fails until it is checked against the
two paths. Sensitivity: adding `dispatch_hook.ts` to the plumbing guard's list,
and dropping an entry from the pinned list, each turned a case red.

## The review — seven rounds, both seats each round

Prompts, committed verbatim:
`agents/evidence/council/gate-header-matches-hooks-review{,-r2,-r3,-r4,-r5,-r6,-r7}-20261016.question.md`.
Quorum 2 of 2 through the CLI seats each round, nothing billed.

| Round | Reviewed | anthropic/claude-sonnet-4-5 | openai/codex-default |
|---|---|---|---|
| 1 | `91dd93b6c` | APPROVE | REQUEST_CHANGES |
| 2 | delta to `7a66dd1ac` | APPROVE | APPROVE |
| 3 | delta to `394511192` | REQUEST_CHANGES | REQUEST_CHANGES |
| 4 | delta to `8aeec4558` | REQUEST_CHANGES | APPROVE |
| 5 | delta to `9eaa755d0` | APPROVE | REQUEST_CHANGES |
| 6 | delta to `85d209961` | REQUEST_CHANGES | APPROVE |
| 7 | delta to `3d3db4340` | APPROVE | APPROVE |

Findings and dispositions:

1. Round 1 (openai) — "neither is denied" rested on two guards. The bound
   `pre_tool_use` concerns were enumerated and probed, and the sentence scoped to
   that population.
2. Round 3 — after `check_test_delta` asked for a test (its escape, a label, is the
   owner's), the follow-up both round-2 seats named was written; both seats found
   its wording claimed more than it checked. Narrowed to the two guards.
3. Round 4 (anthropic) and round 5 (openai) — the manual half needed a trigger a
   maintainer meets. The pinned `pre_tool_use` list is that trigger.
4. Round 6 (both) — the failing case needed an instruction. Written above the list.

Round-7 stances, in the seats' words:

- anthropic: "**APPROVE** — Delta completes round 6's request with no defects
  introduced."
- openai: "APPROVE — the maintenance ambiguity is resolved with negligible
  shipping risk".

Not taken: a test that drives the built dispatcher, which needs the esbuild hook
bundle inside the test run; the one-off probe above did that by hand.

The seat verdicts are transcribed by the implementing session; the council
responses are gitignored and not committed. The prompts are committed, so what
was asked can be checked; what was answered rests on this transcription.
