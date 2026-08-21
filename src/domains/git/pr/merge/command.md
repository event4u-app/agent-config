---
model_tier: medium
name: git-pr-merge
disable-model-invocation: true
argument-hint: "[all|<pr-number>] [--no-merge]"
pack: git
intent: "Prepare an open PR to mergeable — sync, resolve conflicts semantically, drive CI green — and merge it when the invocation says so"
routes_to: [git-workflow, github-ci]
replaces: []
visibility: advanced
cluster: git-pr-merge
skills: [git-workflow, github-ci, ai-council]
description: Prepare one open PR to mergeable and merge it, or drain the whole open-PR queue with `all`
suggestion:
  eligible: false
  rationale: "Merging is irreversible and gated on the user's own word in the invocation — a suggested merge would manufacture the authorization the Hard Floor requires the user to give."
workspaces:
  - agent-config-maintainer
packs:
  - git
---

# /git-pr-merge

Prepare an open pull request until it is genuinely mergeable — its base merged
in, its conflicts resolved by class rather than by taste, its required checks
green on the head that will actually be merged — and then merge it, if and only
if the invocation authorised that.

**The invocation is the authorization, and nothing else is.** `pr-merge` is a
`BLOCK_OPS` member in `block_unauthorized_git.ts` because it is irreversible.
This command consumes the authorization the user's own prompt text already
wrote to the per-session ledger on `UserPromptSubmit`; it introduces no second
authorization store, and it never writes one. When that window closes the run
stops and reports (§ 7) — the window never grows.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|

*(none, deliberately.)* `all` changes **cardinality**, not lifecycle, so it is
an argument rather than a second command — the locked registry's rule that
"sibling variants become a flag, never a second command"
([`command-clusters`](../../../../docs/contracts/command-clusters.md)) applied
to this cluster. A future sub belongs here only if it has a materially
different lifecycle, not a different count.

## Dispatch

| Invocation | Behaviour |
|---|---|
| `/pr:merge <N>` | Prepare and merge exactly PR N. |
| `/pr:merge` | Auto-select ONE PR: green first, then infrastructure/tooling before content, then smallest diff (`changedFiles`, then additions+deletions), tiebreak ascending number. |
| `/pr:merge all` | Drain the open-PR list under § 6's cutoff. |
| `… --no-merge` | Run the whole preparation and stop before merging. Consumes no merge authorization. This is the entry point [`/roadmap:process-full`](../../../product-basic/roadmap/process-full/command.md) delegates to for its delivery loop. |

**Bare invocation** (`/pr:merge` with no argument) is a **documented default
flow**, not a menu: it runs the auto-selection in row 2 and says which PR it
picked and why, before touching it. A menu would be the wrong shape here —
selection is deterministic from the queue-order rule in § 1, so asking the user
to pick would hand back a decision the command can compute. When the open-PR
list is empty there is nothing to select and the command reports that and
stops.

## 1. Snapshot the target — an immutable manifest

Compute the queue ONCE at invocation and record it as a manifest of
`(PR number, head SHA)` pairs:

```bash
gh pr list --state open --limit 100 \
  --json number,title,headRefName,headRefOid,additions,deletions,changedFiles,mergeable,updatedAt
```

The manifest is the authorization's target set and is **never silently
refreshed**. Before every merge, re-read the PR and refuse when either field
moved: the number prevents branch substitution, the head SHA prevents a
force-push swapping the content after the user authorised it. A PR that
appeared after the snapshot is not in scope for this run — § 6 says what
happens to it.

## 2. Sync with the base

```bash
git fetch origin
gh pr checkout <N>
git merge origin/<base> --no-edit
```

Merge the base **into** the branch. Never rebase a branch that is already
pushed ([`git-history-discipline`](../../../../rules/git-history-discipline.md)).

## 3. Resolve conflicts by class, never by taste

Conflicts between queued PRs are expected, not exceptional: in this repository
every roadmap PR touches `agents/roadmaps-progress.md` and
`src/config/estate-count-budget.json`, so each merge re-conflicts every
remaining PR. Resolve semantically, by these enumerated classes:

| Class | Files | Resolution |
|---|---|---|
| Roadmap files | `agents/roadmaps/**` | Union of completions. Never un-check a box either side checked; never resurrect a roadmap either side archived or parked. |
| Generated artefacts | progress dashboard, estate-count budget, catalogs, census, any file whose header says auto-generated | Never hand-merge. Take either side, then **regenerate** with the repo's own task and commit the regenerated output. |
| Archive move vs. edit | a file one side moved to `archive/` | The archived end-state wins. Re-apply the edit at the new path if it still matters; otherwise drop it and record the drop in the summary. |
| Evidence files | `agents/evidence/**` | Append-only. Keep both sides. |

```
A CONFLICT OUTSIDE THESE FOUR CLASSES HALTS THE RUN.
IT IS NOT RESOLVED BY JUDGEMENT AND NOT ESCALATED TO A WARNING.
```

The classes exist so a merge resolution is reproducible by a second reader. An
unenumerated conflict is a case nobody has decided yet, and deciding it silently
inside a drain loop is how work disappears.

## 4. Superseded check — before any CI is spent

If the effective diff against the base is empty after syncing, the PR's content
already landed elsewhere. Distinguish genuinely empty from generated-artefact
churn that regeneration on the base would produce anyway — the latter is not
emptiness.

```bash
git diff origin/<base>...HEAD --stat
```

Empty ⇒ close it with `Superseded: landed via <PRs>` and record it. **Never
merge an empty PR to make the queue count fall.**

## 5. Drive CI green — bounded

Push, then wait for the verdict on the pushed head. Green means **the required
checks succeeded for the exact head SHA that will be merged** — never a local
run, never an earlier commit ([`/git-pr-create` § 4d](../create/command.md)).

- **Root-cause fixes only**, inside the PR's own scope.
- **One rerun for a known flake class** (`gh run rerun <id> --failed`) before
  red counts as real.
- **Six fix iterations per PR per pass.** Exhaustion posts a diagnosis comment
  and moves the PR to the end of the queue once; a second exhaustion is
  terminal.

```
THESE ARE HALTS, NOT OPTIONS OF LAST RESORT:
DEPENDENCY CHANGES · WORKFLOW CHANGES · DELETING OR SKIPPING A TEST ·
LOOSENING A THRESHOLD · WEAKENING A GATE · AN EXPECTED-FAIL MARKER ·
A BRANCH-PROTECTION CHANGE.
"DRIVE CI GREEN" AUTHORIZES DIAGNOSIS AND REPAIR, NEVER REMOVING THE CHECK
THAT WOULD HAVE CAUGHT THE PROBLEM.
```

## 6. `all` — the queue, and the cutoff that ends it

Process the manifest in order. After each merge the base has moved, so the next
PR is re-synced against the NEW base — that is the loop, and it is why
pre-greening several PRs ahead of their merges is wasted work.

**Cutoff.** When the manifest is exhausted, recompute the open-PR list
**exactly once**. PRs that appeared during the run are drained as ONE final
straggler batch. After that batch the run ends unconditionally; anything
arriving during or after it is recorded as `arrived-after-cutoff` and is not
processed.

```
THE CUTOFF IS THE TERMINATION PROOF.
WITHOUT IT, "THE QUEUE MUST SHRINK" DOES NOT TERMINATE AGAINST A SECOND
SESSION THAT KEEPS OPENING PRs — THE RECOMPUTE JUST REFILLS IT.
BOUND: INITIAL MANIFEST + ONE BATCH, WHATEVER ELSE IS HAPPENING IN THE REPO.
```

**Window-aware scheduling.** A green, waiting PR is spent authorization window,
because the next merge re-conflicts it. When the projected remaining work
exceeds the remaining window, stop entering CI-fix loops and merge everything
already green first. Pre-greening several PRs ahead of their merge is forbidden
under window pressure.

## 7. Expiry is a reported state, never a stall

```
WHEN THE AUTHORIZATION WINDOW CLOSES WITH WORK LEFT, THE RUN STOPS CLEANLY
AND REPORTS. IT NEVER RETRIES THE GUARD, AND IT NEVER EDITS THE GUARD,
ITS SOURCE, OR ITS BUNDLES — READ-ONLY VERIFICATION ONLY.
```

Write the summary as-is with a `window-expired` disposition per unprocessed PR
and name the exact re-authorization needed. Widening `LEDGER_MAX_AGE_MS` is
forbidden practice: on 2026-08-21 it was patched to six hours for a drain run
and the widening reached the trunk.

## 8. Kill switches, and what happens after a merge

Stop **before** the next merge on any of:

- target number or head SHA differs from the manifest;
- the base advanced by an actor other than this run;
- a review was dismissed, or the required-check set changed;
- a conflict outside the four enumerated classes;
- guard or hook-bundle verification failed;
- the first unexplained CI-repair failure.

```
A COMPLETED MERGE IS THE COMMIT POINT.
NEVER AUTO-REVERT AN EARLIER MERGE AS "ROLLBACK" — AFTER FIVE MERGES THERE IS
NO ROLLBACK, ONLY COMPENSATION, AND COMPENSATION IS A SEPARATELY AUTHORIZED
HUMAN DECISION. STOP, EMIT THE MERGE SHAs AND THE REASON, HAND OVER.
```

## 9. Merge, and the summary

```bash
gh pr merge <N> --<detected-method> --delete-branch
```

Use the method the repository already uses; never invent one mid-queue. Never
force-merge past a failing required check, never admin-bypass.

On queue empty or terminal-only, `all` writes
`agents/evidence/pr-drain-run-summary.md`: one row per PR with queue position,
conflict classes hit, CI iterations used, disposition, and any edits dropped in
conflict resolution. The disposition set is closed:

`merged <sha>` · `superseded-closed` · `blocked-external` · `twice-exhausted` ·
`window-expired` · `arrived-after-cutoff`

## Rules

- **Never merge without the invocation's word.** `--no-merge` and an absent
  merge argument both stop at mergeable-and-open.
- **Never widen, patch, or rebuild-around the git guard.** Verification of the
  authorization window is read-only.
- **Never rebase a pushed branch**; the base is merged in.
- **Never hand-merge a generated artefact**; regenerate it.
- **Never resolve a conflict outside the four classes**; halt instead.
- **Never call CI green off a local run**; re-verify on the pushed head.
- **Never auto-revert a completed merge.**
- **Mergeability is per-PR against a recorded base SHA**, never a property of
  the queue: making PR *n* mergeable against base `M` says nothing about its
  state once PR *n−1* advances the base.

## See also

- [`/git-pr-create`](../create/command.md) — opens the PR this command finishes.
- [`/roadmap:process-full`](../../../product-basic/roadmap/process-full/command.md) — delegates here for its delivery loop.
- [`git-history-discipline`](../../../../rules/git-history-discipline.md) — never rewrite pushed history.
- [`non-destructive-by-default`](../../../../rules/non-destructive-by-default.md) — the Hard Floor a merge sits under.
