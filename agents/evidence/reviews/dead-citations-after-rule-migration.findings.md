# Completion review — dead citations after the rule-body migration

**Skipped:** no code surface for this completion — the diff is three skill bodies, one command file, one comment line in a shipped YAML example and the ledger README, plus their generated projections, and the gate itself measures zero code paths of eleven changed files, scope accfafd12f071276ddf7b1fd2816907565786407b1078a05fec7c4c0528e9d22, declared 2026-08-10

## Why a skip rather than a review

The change re-homes three prose sections that the rule-body migration dropped
and re-aims the citations that pointed at them. It ships no executable surface:
no script, no hook, no config, no test, and no frontmatter field.
`check_completion_review` classifies the diff as zero code paths of eleven
changed files, which is the condition this declaration covers.

What replaces a code review here is the verification that produced the content,
all of it re-runnable:

- **Both halves of every claim were measured, not inherited.** The ledger names
  three dangling citations; each was confirmed twice — the citing line exists
  (`fix/ci/command.md:70`, `update-form-request-messages/command.md:132`, and
  three files for the role vocabulary), and the cited content is absent
  (`grep artisan src/skills/docker/SKILL.md` returned one unrelated line;
  `dot-notation` returned zero in `skill:laravel`; the seven-role table returned
  zero tree-wide).
- **The ledger's own source pointer was wrong and is not followed blindly.**
  `source_commit: d4fe80e1c` is the migration commit, which already carries the
  stubs; the pre-migration bodies are in its parent. Recovered from
  `d4fe80e1c^`, which `git log -S 'Tooling Detection'` independently confirms as
  the last commit holding the heading.
- **The ledger rows were deliberately left alone.** Flipping `dropped` to
  `carried` would assert the migration did something it did not do. The gate
  agrees in its own words — it asserts a dropped row names no target and
  explicitly does not assert that a heading should have been carried — so
  nothing here is a lint workaround.
- **Two internal references inside `skill:review-routing` were already dead**
  before this change and are repaired by the same edit: step 3 falls through
  "to the generic-role fallback" and validation check 1 requires a role to be
  "in the common vocabulary". Both now name a table in the same file.
- `task preflight` is green, including `lint_regression` (no regressions),
  `skill_linter --changed` (4 pass / 0 warn / 0 fail) and the kernel-rule bundle
  check (no kernel rule touched).

## Scope this does NOT cover

The ledger records 15 dropped sections; this change repairs the three that left
a live citation. The other twelve remain recorded losses with no dangling
pointer — among them the four copy-pasteable in-container tool invocations and
the blind-spot-reduction rationale. They are out of scope on purpose: no reader
is currently sent to them.

## Standing caveat

A skip declaration is a statement about the diff's surface, not a claim that the
prose is correct. Every claim above names the command or file that decides it,
so a later reader can refute a row without trusting this artefact.
