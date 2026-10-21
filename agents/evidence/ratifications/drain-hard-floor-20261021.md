---
proposed_by: claude-opus-5.5/drain-road-to-a-hard-floor-the-shell-cannot-talk-past-20261018
implemented_by: claude-opus-5.5/drain-hard-floor-20261021
reviewed_by: ai-council/anthropic-claude-sonnet-4-5+openai-codex-default-2026-10-21
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
subject: 2814f4910e83f8bbd230554b9a2f3167d90f61ee165634496a1622d76d031b1f
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — category A stops granting what it cannot prove

Covers branch `drain/hard-floor-20261021`, Phase 0 of
`road-to-a-hard-floor-the-shell-cannot-talk-past` (steps 0.1–0.5). Named for the
branch because the gate reads this file before the pull request exists. The
Phase 0 work began on `drain/road-to-a-hard-floor-the-shell-cannot-talk-past-20261018`,
whose five rounds ended refused; that branch was merged into this one and the
review continued here. The header is derived from round 9 by
`ratification_header`, never typed.

## The gated surfaces

`check_kernel_edit_ratified` classifies two files, both hook-plumbing sources in
the dispatcher's import closure: `src/scripts/hooks/category_a.ts` and
`src/scripts/hooks/permission_gate.ts`. `ratification_subject` prints the
subject above at `68f20d8d3`; round 9 reviewed exactly that digest.

## What the change does, and its direction

It withdraws `permissionDecision: allow` from Bash shapes the classifier cannot
prove harmless; the call then takes the host's own confirmation. It adds no deny
and no ask. One edit widens: `isInsideWorkingTree` now reads `./...` and
`..cache/x` as inside (they are), a small intentional expansion named in round 4.

## The review — nine rounds, both seats each round, CLI only, nothing billed

Prompts, committed verbatim: `agents/evidence/council/hard-floor-phase0-review-20261018.question.md`,
its `-r2` … `-r5` siblings of 2026-10-18, and
`hard-floor-phase0-review-r6-20261021.question.md` … `-r9-20261021.question.md`.

| Round | Reviewed | anthropic/claude-sonnet-4-5 | openai/codex-default | Finding acted on |
|---|---|---|---|---|
| 1 | `01ff2e29a` | ratified | no stance line | branch-creating forms admitted; shell spellings untested |
| 2 | `0bb4500bc` | ratified | refused (dealbreaker) | dash-led separate option values; in-tree symlinks to outside |
| 3 | `27249a222` | confirmed-non-expanding | no stance line | resolver fell back to lexical on `EACCES`/`ELOOP` |
| 4 | `6161a2b06` | refused | no stance line | unquoted globs expand after the check |
| 5 | `9bab7bf22` | refused (dealbreaker) | no stance line, REQUEST_CHANGES | an in-tree dangling symlink read as a missing suffix on `ENOENT` |
| 6 | `7abad5f26` | ratified | ratified | refinement: the new `lstatSync` probe sat outside any `try`; a throw would end the dispatcher with exit 1 and drop another concern's deny |
| 7 | `f87200034` | refused (dealbreaker) | refused (dealbreaker) | both read the `""` sentinel as inside; the unchanged first line of `isInsideWorkingTree` already refused it, but the refusal is now explicit in `_reallyInside`, with end-to-end rows for `ENOENT`+`EACCES`, `ELOOP` and an unresolvable root |
| 8 | `c29e06aae` | refused (dealbreaker) | refused (dealbreaker) | `date` was exempt from argument inspection although `-f`/`--file` and `-r`/`--reference` open a path |
| 9 | `68f20d8d3` | ratified (high) | ratified (med) | none blocking |

Round 6 was a two-seat pass, but the refinement it raised was a real defect, so
it was fixed rather than shipped, which moved the subject digest and required
the later rounds. Every fix landed test-first: each new row was observed red
before its fix. The round-7 sentinel guard is deliberately redundant with the
unchanged `trim()` line; removing both reds the `ENOENT`+`EACCES` and `ELOOP`
rows.

## What round 9 left standing (non-blocking, recorded for whoever decides)

- **No operational kill switch** (raised in rounds 3, 6 and 9): withdrawing
  category A means reverting `permission_gate.ts`. Adding one is a new settings
  key, outside this phase.
- **No prompt-regression threshold**: the change can put a host prompt on shapes
  that used to be silent (`ls src/*.ts`, an unquoted `--include=*.ts`,
  `git branch new`); no measured rate is attached.
- **TOCTOU**: the check runs before the command, so a link swapped in between is
  not seen; the bound is the OS sandbox, as the contract says.
- **Not a per-program option grammar**: the classifier confines every positional
  and inline value it sees; it does not claim completeness against every
  program's options.
