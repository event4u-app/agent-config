---
proposed_by: dependabot[bot]/github-actions-group-across-1-directory-2026-10-13
implemented_by: claude-opus-5/worktree-agent-pr2318-2026-10-14
reviewed_by: council/anthropic+openai-2026-10-14-dependabot-action-pins-round2
providers: [anthropic, openai]
subject: 373d80debf54e017e9efae3cfdc5ad5c509d892a6ab466e1d3a0b2356cbae949
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — the github-actions group bump on PR #2318

## What was reviewed

One Dependabot commit on branch
`dependabot/github_actions/github-actions-c1c2f9c309` — "chore(deps): bump the
github-actions group across 1 directory with 2 updates". +73 / -73 across 32
workflow files under `.github/workflows/`. Every changed line is a `uses:` pin.

Two action pins move, everywhere they appear:

- `actions/setup-node` v7.0.0 → v7.1.0
  (`820762786026740c76f36085b0efc47a31fe5020` → `949feb2413d6458794dcd2491c4babbbce0c15c1`)
- `actions/upload-artifact` v7.0.1 → v7.0.2
  (`043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` → `cf430e030ddbb5b0abf93d22962f4752f3646cd9`)

The review was required because one of those 32 files is
`.github/workflows/consistency.yml`, which `check_kernel_edit_ratified` treats
as part of the ratification mechanism itself (`WORKFLOW_PATH`). Inside that
file three lines change — one `setup-node` pin and two `upload-artifact` pins.
No step, `if:` condition, `permissions:` block, `env:`, job, trigger or `run:`
body changes, and no gate invocation is added, removed or reordered.

## Why this record replaces an earlier one

A first round on this same bump returned `confirmed-non-expanding` from both
seats, but carried no `subject:` digest. Between that round and this one, `main`
merged PR #2325, which rebuilt the ratification mechanism underneath the branch
— `check_kernel_edit_ratified.ts` +206 lines, `ratification_artifact.ts` +65,
`consistency.yml` reformatted across 62 lines. Binding the old record to the new
digest would have named content its reviewers never saw, which is the exact
laundering the digest exists to prevent. The review was therefore run again on
the current state rather than rebound. Both seats were told the earlier verdict
and asked to reach their own; both called the re-run correct.

## How the split was resolved

Round 2 of the re-run was not a repetition. Round 1 split — one seat
`confirmed-non-expanding`, one seat `non-convergent` — and the dissenting seat
named one gap precisely: the SHAs were asserted, not verified, so nothing
established that the pinned commits are the tags claimed or that the upstream
delta is inert. The gap was closed against GitHub's API before round 2, and the
evidence was put to both seats:

- `repos/actions/setup-node/git/ref/tags/v7.1.0` resolves to
  `949feb2413d6458794dcd2491c4babbbce0c15c1`, a commit — the SHA in the diff.
- `repos/actions/upload-artifact/git/ref/tags/v7.0.2` resolves to
  `cf430e030ddbb5b0abf93d22962f4752f3646cd9`, a commit — the SHA in the diff.
- `setup-node` v7.0.0→v7.1.0 is 22 commits over 31 files. The only change to the
  action's declared interface is one input *description* string, adding
  `mise.toml` to the examples for `node-version-file`. No input added or
  removed, no default changed, `runs:` untouched.
- `upload-artifact` v7.0.1→v7.0.2 is 4 commits over 7 files — three licence
  manifests, `package.json`, `package-lock.json` and the two rebuilt `dist/`
  bundles. `action.yml` is not in the changed set.

On that evidence both seats returned `confirmed-non-expanding`.

## What this record does NOT claim

Behavioural equivalence of the rebuilt `dist/` bundles was not established, and
was not claimed to either seat. Reading minified build output is not something
any reviewer of an action bump here does, and the seats were asked to say
plainly whether their verdict required it. Neither said it did; the dissenting
seat of round 1 stated the conditions that would flip it instead — evidence that
the new bundles alter the workspace or the gate's inputs, mask a gate failure,
change uploaded evidence consumed as authoritative, obtain different credentials
or permissions, or execute the new `mise.toml` path in this workflow. None of
those is present in the diff, and none is asserted to be absent from the
bundles by inspection.

The verdict is `confirmed-non-expanding`, not `ratified`, and the distinction is
the point: no authority moved. The vocabulary exists so that a mechanical
dependency refresh is not made to wear the label of an approved authority
expansion.
