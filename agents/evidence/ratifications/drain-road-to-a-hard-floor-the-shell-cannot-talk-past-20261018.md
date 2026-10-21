---
proposed_by: claude-opus-5.5/drain-road-to-a-hard-floor-the-shell-cannot-talk-past-20261018
implemented_by: claude-opus-5.5/drain-road-to-a-hard-floor-the-shell-cannot-talk-past-20261018
reviewed_by: ai-council/anthropic-claude-sonnet-4-5+openai-codex-default-2026-10-18
providers: [anthropic]
verdict: refused
seats:
  anthropic: refused
  openai: no-final-verdict
subject: 2aed9ba9b81513de49ec2c535d0c6b1fe50a59110fdd2d260397fecb3a4bb76e
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — category A stops granting what it cannot prove (not cleared)

Covers branch `drain/road-to-a-hard-floor-the-shell-cannot-talk-past-20261018`,
Phase 0 of `road-to-a-hard-floor-the-shell-cannot-talk-past` (steps 0.1–0.5).
Named for the branch because the gate reads this file before the pull request
exists.

**This record does not clear the change.** It is written because a non-passing
record is still owed to whoever decides: four review rounds, the drain's round
cap, produced no round in which both seats passed. The header is derived from
the last round by `ratification_header`, never typed.

## The gated surfaces

`check_kernel_edit_ratified` classifies two files, both hook-plumbing sources in
the dispatcher's import closure: `src/scripts/hooks/category_a.ts` and
`src/scripts/hooks/permission_gate.ts`. `ratification_subject` prints the
subject above at `d606eaa5d`.

## What the change does, and its direction

It withdraws `permissionDecision: allow` from Bash shapes the classifier cannot
prove harmless; the call then takes the host's own confirmation. It adds no deny
and no ask. One edit widens: `isInsideWorkingTree` now reads `./...` and
`..cache/x` as inside (they are), which a round-4 seat named as a small
intentional expansion — the reason `confirmed-non-expanding` was never the
right label even had both seats passed.

## The review — five rounds, both seats each round, CLI only, nothing billed

Prompts, committed verbatim: `agents/evidence/council/hard-floor-phase0-review-20261018.question.md`
and its `-r2`, `-r3`, `-r4`, `-r5` siblings.

| Round | Reviewed | anthropic/claude-sonnet-4-5 | openai/codex-default | Finding acted on |
|---|---|---|---|---|
| 1 | `01ff2e29a` | ratified | no stance line | branch-creating forms admitted; shell spellings untested |
| 2 | `0bb4500bc` | ratified | refused (dealbreaker) | dash-led separate option values; in-tree symlinks to outside |
| 3 | `27249a222` | confirmed-non-expanding | no stance line | resolver fell back to lexical on `EACCES`/`ELOOP` |
| 4 | `6161a2b06` | refused | no stance line | unquoted globs expand after the check (`cat le*` reaches an outward symlink) |
| 5 | `9bab7bf22` (`d606eaa5d` merged with `origin/main`; gated files unchanged) | refused (dealbreaker) | no stance line, REQUEST_CHANGES | an in-tree **dangling** symlink to an absent outside target: `realpathSync` reports `ENOENT`, the resolver reads it as a missing suffix and keeps the lexical answer, so `sort -o out src/input` still gets the allow |

Round 3's first attempt lost the openai seat to an exhausted local counter; the
counter was reset and the round re-run through the CLI, per the owner's
standing instruction. Only the re-run is counted.

`d606eaa5d` fixes the round-4 finding (an unquoted glob anywhere is a candidate
nothing confines). Round 5 reviewed it on 2026-10-18, under the owner's
instruction of that day to resolve the open decisions in the council and his
standing delegation of 2026-10-16. Both seats accept the glob fix and name one
new blocker: on `ENOENT` the resolver must `lstat` the failing component and
withhold when it exists as a symbolic link, recursing to the parent only when
the component is genuinely absent; with end-to-end rows through
`_permission_for` for a dangling link (write- and read-shaped) and a control
row for a genuinely missing suffix. Not fixed here: a split or refused round
stops the item. Every mechanism the branch adds has a sensitivity probe that
reds its own rows when removed (eleven probes).

## What is left for the owner

- Fix the dangling-symlink finding of round 5 and run a sixth round, or accept
  the change on the record above.
- No kill switch exists for category A (round 3 asked for one); withdrawing it
  means reverting `permission_gate.ts`. Adding one is a new settings key.
- The hook bundle sits 106 B under its ceiling after this change.
