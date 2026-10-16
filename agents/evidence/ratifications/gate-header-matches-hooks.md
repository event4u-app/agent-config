---
proposed_by: claude-opus-5.5/fix-gate-header-matches-hooks-20261016
implemented_by: claude-opus-5.5/fix-gate-header-matches-hooks-20261016
reviewed_by: ai-council/anthropic-claude-sonnet-4-5+openai-codex-default-2026-10-16
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
subject: 8f03562275ae7150e3a37d7e09135f2d58625f8d68d7457eace378cf9667facf
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
had cited actually do, and states that for these two paths the record is the only
layer. Both the base revision's gate and the head's print the subject above at
`7a66dd1ac`, covering only `src/scripts/check_kernel_edit_ratified.ts`.

Evidence for the sentence, taken rather than read: with the hook bundle built in
the branch's worktree, an `Edit` of each path was sent through the real
dispatcher as a `PreToolUse` payload. Both passed every bound concern (exit 0, no
deny); the controls `hooks/hooks.json` and `src/rules/non-destructive-by-default.md`
were refused (exit 2) through the same harness.

## The review — two rounds, both seats each round

Prompts, committed verbatim:
`agents/evidence/council/gate-header-matches-hooks-review{,-r2}-20261016.question.md`.
Quorum 2 of 2 through the CLI seats each round, nothing billed.

| Round | Reviewed | anthropic/claude-sonnet-4-5 | openai/codex-default |
|---|---|---|---|
| 1 | `91dd93b6c` | APPROVE | REQUEST_CHANGES |
| 2 | delta to `7a66dd1ac` | APPROVE | APPROVE |

Round 1's finding (openai): "neither is denied" and "the only layer" were
universal claims resting on two guards. Disposition: the bound `pre_tool_use`
concerns were enumerated and probed as above, and the sentence was scoped to that
population.

Round-2 stances, in the seats' words:

- anthropic: "**APPROVE** — The delta directly addresses the REQUEST_CHANGES
  critique with both requested approaches (enumerate + scope)".
- openai: "APPROVE — the claim is now properly bounded and empirically supported".

Not taken, named by both seats as a follow-up: a regression test that turns the
four probes into an automated check across every profile.

The seat verdicts are transcribed by the implementing session; the council
responses are gitignored and not committed. The prompts are committed, so what
was asked can be checked; what was answered rests on this transcription.
