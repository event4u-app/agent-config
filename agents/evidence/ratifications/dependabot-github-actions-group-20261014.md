---
proposed_by: dependabot[bot]/github-actions-group-across-1-directory-2026-10-13
implemented_by: claude-opus-5/worktree-agent-pr2318-2026-10-14
reviewed_by: council/anthropic+openai-2026-10-14-dependabot-action-pins
providers: [anthropic, openai]
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

- `actions/setup-node` — `8207627…` (v7.0.0) → `949feb2…` (v7.1.0)
- `actions/upload-artifact` — `043fb46…` (v7.0.1) → `cf430e0…` (v7.0.2)

One of the 32 files is a gated surface: `.github/workflows/consistency.yml` is
`WORKFLOW_PATH` in `src/scripts/check_kernel_edit_ratified.ts` — the workflow
that invokes the ratification gate. Three hunks land there: the `Set up Node`
step of the consistency job, and two `upload-artifact` steps (the
attribution-shape report, and the `if: failure()` consistency artifacts). The
gate classifies by path, so it fires on the file and cannot see that the edit is
a pin bump; that judgement is what this record carries.

Nothing else in the diff is gated. The gate's own ledger reads
`planned 32 · out_of_scope 32` for the non-artifact paths.

## Verdict: `confirmed-non-expanding`

No job name, step order, `if:` condition, `permissions:` block, trigger,
`paths:` filter, secret, token scope, concurrency group, required-check context,
ruleset or script invocation changes anywhere in the diff. The gate's function —
what it checks, when it runs, whether it can fail — is unchanged; only the
runtime environment its step executes in received a routine bump. `setup-node`
prepares the environment that runs the gate rather than deciding it, and both
`upload-artifact` steps run after the gate's verdict is already fixed.

Both new digests were resolved against the upstream repositories before the
review, and the command is recorded here so the next reader can repeat it rather
than trust this file:

```
gh api repos/actions/setup-node/git/ref/tags/v7.1.0
→ 949feb2413d6458794dcd2491c4babbbce0c15c1   (type: commit)
gh api repos/actions/upload-artifact/git/ref/tags/v7.0.2
→ cf430e030ddbb5b0abf93d22962f4752f3646cd9   (type: commit)
```

## How the review ran, stated as it happened

Two rounds through the CLI seats, `--invocation agent`, $0.0000 metered (both
seats subscription-authed; quota moved 4/50 → 6/50 on each).

1. **Round 1** — `anthropic` answered `confirmed-non-expanding`. The `openai`
   seat failed with `os_error: ENOBUFS`, a local spawn-buffer overflow rather
   than a provider outage, and the run closed `1/2 present — DEGRADED`. The
   failure was recorded in the gitignored probe file as `outcome: other`, which
   would have skipped the seat on every later run.
2. **Round 2** — the stale `openai` probe entry was cleared and the same
   question re-asked with `--rounds 1`. Both seats answered;
   `2/2 present, needed 1 — concluded`. Both returned
   `confirmed-non-expanding`, independently and on different grounds.

The seats did not merely concur. The `openai` seat volunteered the strongest
counter-argument on the record and then resolved it rather than waving it
through: *"a pinned-action update changes executable code running with the job's
existing token and filesystem access, therefore 'only `uses:` lines changed' is
not by itself sufficient evidence"*. What resolved it was the digest match
against the immutable upstream releases plus the narrow scope of their published
changes — `setup-node` v7.1.0 adds version-file support and validation/retry
behaviour, `upload-artifact` v7.0.2 improves HTTP 429 retry handling. It named
the one operational consequence it found and classified it rather than
suppressing it: artifact-upload retries make diagnostic artifacts more reliably
available, which changes retention reliability and not gate authority.

Both seats named what would have moved them to `refused`, and the two lists
agree: a digest that does not resolve to the stated upstream tag, a mutable tag
or a fork, any new or widened `permissions`, credentials, cache scope, artifact
paths or action inputs, a `continue-on-error` / conditional / ordering change,
or the ratification step moved behind a non-firing trigger. None is present.

## What this record does not establish

The reviewers read the pins and the upstream release notes; neither diffed the
upstream action source between the two versions. That is outside what a
`confirmed-non-expanding` classification claims, and the `anthropic` seat said
so in its own words. The claim here is that the diff moves no authority boundary
in **this** repository — not that the upstream releases were audited line by
line.

## Residue — not this artifact's to close

The `drift-check` job on this pull request is red for a reason that predates the
branch and is untouched by it: the live GitHub repository "About" description
still reads *"zero runtime daemon"* while `.github/about.yml` has read *"the
counts in these badges"* since #1744 merged. `sync_github_metadata --strict`
reports the delta on every run, and the same job has failed on every weekly
scheduled run on `main` since at least 2026-09-14. Closing it is a repository
settings write (the manually dispatched `sync-visibility.yml`), not a change to
any branch, and it is an owner action.
