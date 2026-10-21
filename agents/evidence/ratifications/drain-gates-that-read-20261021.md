---
proposed_by: claude-opus-5.5/drain-gates-that-read-20261021
implemented_by: claude-opus-5.5/drain-gates-that-read-20261021
reviewed_by: ai-council/anthropic-claude-sonnet-4-5+openai-codex-default-2026-10-21
providers: [anthropic, openai]
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
subject: d75ce8f4134e59e296f1224cff1105d652473148fa716cdc85e21c488cafa427
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — the speaking-inbox guard's deny message says what it recognizes

Covers branch `drain/gates-that-read-20261021`, step 3.5 of
`road-to-gates-that-read-what-was-written`. One gated file,
`src/scripts/hooks/block_speaking_inbox_dir.ts`. The subject above is
`ratification_subject` over the branch's whole changed-file list, computed at
`ae1133533`, the head the council reviewed. It equals the subject the
2026-10-20 round 4 was shown (`1418c8c8a`), because the gated file carries the
same bytes; that round did not reach quorum.

## What changed

Two lines of `denyMessage` only. The hint "a shell command reaches it only by
its absolute path" described shell resolution; it now reads "this guard
recognizes it in shell commands only when referenced by absolute path; relative
arguments may resolve elsewhere and are judged as new" — the wording both
round-3 seats proposed on 2026-10-20. No parsing, branching or path-handling
line changed. `tests/hooks/block_speaking_inbox_dir.test.ts` pins the new line
and asserts the old one is gone.

## The review — one round, CLI seats, nothing billed

Prompt and seat texts are committed verbatim beside each other as
`agents/evidence/council/speaking-inbox-guard-mention-review-20261021-r5.*`.

| Round | Reviewed | anthropic/claude-sonnet-4-5 | openai/codex-default |
|---|---|---|---|
| 5 | `ae1133533` (whole branch diff) | confirmed-non-expanding | confirmed-non-expanding |

Quorum after the run: 2/2 present. Neither seat reported a defect. The openai
seat noted that the newline in the pinned assertion makes it sensitive to a
harmless reflow and judged that acceptable, since the two-line message is the
regression surface. Both seats reviewed only the supplied hunks.

## Classification

`confirmed-non-expanding`, 2/2: operator-facing text only; what the guard
allows and refuses is unchanged in every direction, and no recorded security,
privacy or safety floor moves.

## Measured

At `ae1133533`: `tests/hooks/block_speaking_inbox_dir.test.ts` 92/92. The new
assertion was observed red against the previous message (1 failed, 91 passed)
before the message change.

## What this record does NOT establish

Anything about the guard's logic beyond what the 2026-10-20 record
(`drain-gates-read-written-20261020.md`) already covers; this round reviewed a
wording delta, not the guard.
