<!-- evidence-type: analysis -->

# Which tracked file carries a team's git convention?

> Council record for `road-to-a-git-convention-that-reaches-every-checkout`
> step 2.2. Run 2026-10-07. Verdict: option (i), a `git:` section in a tracked
> repository-root file of its own, `.git-convention.yml`. Written down as
> ADR-283.

## Attendance, honestly

This is **two single-seat readings, not a convergence.** Each run was marked
DEGRADED and concluded on a quorum of 1 of 2.

| Run | Transport | Seat that answered | Seat that failed, and why |
|---|---|---|---|
| 1 | CLI, subscription, billed $0.00 | `anthropic/claude-sonnet-4-5` | `openai/codex-default` — `os_error: ENOBUFS` |
| 2 | API | `openai/gpt-4o` | `anthropic/claude-sonnet-4-5` — HTTP 400, API credit balance too low |

The two answering seats are from two providers and answered independently of
each other — neither saw the other's answer — so the agreement below is
agreement between two independent readings. It is not a two-seat peer review,
and nothing here should be cited as one. Both runs used the same question
bundle, which stated three constraints: the carrier is a tracked file at the
repository root; `update_strategy` is read from it at the resolved target commit
only; the three keys, their template block, schemas and contract rows stay where
they are.

## The three options

- **(i)** a `git:` section in a tracked file of its own.
- **(ii)** a section in `.branch-convergence.yml`, which reopens that file's
  2026-09-03 deferral.
- **(iii)** `.agent-project-settings.yml`, the committed team file — labelled
  legacy, read for `modules:` only, bootstrapped by copy.

## Verdict — both seats chose (i)

**`anthropic/claude-sonnet-4-5` (run 1).** Its decisive argument was semantic,
not procedural: putting commit-message rules into a file named for branch
convergence is a naming mismatch a reader a year later would not expect, and
using (ii) honestly would mean renaming that file and migrating its existing
key, which is larger than this change. It rejected (iii) outright — building on
a file labelled legacy, outside the class-C fence and read for one section only
is debt by choice. It disagreed with one argument for (i): the 2026-09-03
deferral concerned globs, inheritance and a repository-wide fallback inside the
convergence policy, not a freeze of the file's scope, so it does not by itself
forbid (ii). It named the cost of (i) honestly — one more root file, one more
reader — and judged semantic clarity worth it. It also considered and rejected a
fourth option, a machine-readable section inside `AGENTS.md`, as worse than any
named option.

**`openai/gpt-4o` (run 2).** Chose (i) for separation of concerns, accepted the
added-file cost as manageable with documentation, and proposed no change to the
carrier itself. Its fourth-option suggestion (a generated consolidated view) was
not adopted: nothing in this change needs one.

## Revisit if

- three or more tracked, SHA-pinned team policies exist — then consolidate them
  into one repository-policy file rather than adding another root file;
- a future council explicitly broadens `.branch-convergence.yml`'s charter.

## What the council did not decide

The authority rows per key — which layer decides, whether the local layer
participates, what a branch-local change is, what `malformed` does — were not
put to the council. They follow from the stated constraints and from the
owner's decision D8 of the roadmap (the committed carrier overrides every
developer layer for `git.commit_format` and `git.branch_pattern`) and are
recorded in ADR-283 as such.

The raw responses of both runs are gitignored runtime artefacts and are not
committed; the substance of each seat's answer is reproduced above.
