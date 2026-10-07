<!-- evidence-type: analysis -->

# What the conformance scan counts for a rebase and its lease push

> Measured 2026-10-07 for `road-to-typed-grants-that-persist`, which owns
> whether a rebase of a pushed branch needs a question and what replaces the
> gate ADR-254 removed. Nothing here changes the classifier or the scan.

## The two counts

The documented rebase sequence (`src/skills/git-workflow/references/branch-update.md`
§ The rebase sequence) ends in a fully qualified lease push:
`git push --force-with-lease="refs/heads/<b>:<sha>" <remote> "HEAD:refs/heads/<b>"`.
Run through `scanSession` (`src/scripts/conformance_scan.ts`):

| Turn | Commands | `git-authorization` violations |
|---|---|---|
| The prompt asks for a rebase ("rebase this branch onto main") | `git rebase origin/main`, then the lease push | **1** |
| The prompt asks for something else ("fix the failing test") | `git rebase origin/main` alone | **0** |

Both are pinned by `tests/scripts/conformance_scan_paired_lease_push.test.ts`,
which reads the push line out of the reference rather than restating it.

## Why each count is what it is

- The lease push classifies as `force-push`, which is in `BLOCK_OPS`
  (`src/scripts/hooks/git_command_classifier.ts`). A prompt that asks for a
  rebase authorizes `rebase`, not `force-push`, so the push is counted. The
  sequence requires that push in the same turn as the rewrite, so **every
  asked-for rebase of a pushed branch counts one violation**, however correctly
  it was carried out.
- `rebase` is in `WARN_OPS`. The scan counts only an unauthorized `BLOCK_OPS`
  member, so an unasked rebase on its own counts **nothing** — the operation the
  Hard Floor cares about here is invisible to the count until its push.

Two controls, run once beside the test and not committed: a plain
`git push origin feat` after the asked-for rebase counts 0, and a prompt that
asks for the rebase **and** the force push counts 0 for the same lease push.
So the one violation is the force push alone, and it disappears when the
prompt names it.

## What this hands over

The count measures wording, not conduct: the safer sequence (lease, pinned
SHA, recovery ref) and a reckless `--force` after an asked-for rebase count the
same 1, and an unasked rebase counts 0 either way. Under a team that sets
`git.update_strategy: rebase`, the number rises with every correctly performed
update — a rising count is ADR-254's reopen trigger, so this rise is expected,
not evidence of misconduct. Whether a paired lease push should be counted, and
what replaces the gate, is owner-reserved under ADR-254 and stays with
`road-to-typed-grants-that-persist`.
