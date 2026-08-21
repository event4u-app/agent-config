---
model_tier: medium
name: git-pr-merge
disable-model-invocation: true
argument-hint: "[all|<pr-number>] [--no-merge]"
pack: git
intent: "Prepare an open PR to mergeable — sync the base in, resolve conflicts semantically, drive required checks green — merging itself is gated and inert"
routes_to: [git-workflow, github-ci]
replaces: []
visibility: advanced
cluster: git-pr-merge
skills: [git-workflow, github-ci]
description: Prepare one open PR to mergeable, or the whole open-PR queue with `all` — merging is specified but gated, so today every invocation stops at mergeable-and-open
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

```
THE MERGE STEP (§ 9) IS SPECIFIED AND NOT YET ACTIVE. `--no-merge` IS THE
OPERATIVE PATH TODAY, AND A BARE INVOCATION BEHAVES AS IF IT CARRIED IT.
ACTIVATION NEEDS THE OWNER DECISION IN THE `merge-authority` BLOCKER OF
`road-to-drain-commands` — NEVER A COMMAND EDIT, AND NEVER A GUARD EDIT.
```

**The invocation is the authorization, and nothing else is.** `pr-merge` is a
`BLOCK_OPS` member in `block_unauthorized_git.ts` because it is irreversible.
This command would consume the authorization the user's own prompt text already
wrote to the per-session ledger on `UserPromptSubmit`; it introduces no second
authorization store, and it never writes one. When that window closes the run
stops and reports (§ 7) — the window never grows.

Why it ships inert rather than not at all: everything before § 9 — the target
manifest, the four conflict classes, the superseded check, the bounded CI
repair, the cutoff — is the expensive, error-prone half, it is what the live
runs actually proved, and none of it merges anything. `--no-merge` delivers all
of it today.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|

*(none, deliberately.)* `all` changes **cardinality**, not lifecycle, so it is
an argument rather than a second command — the locked registry's rule that
"sibling variants become a flag, never a second command"
([`command-clusters`](../../../../../docs/contracts/command-clusters.md)) applied
to this cluster. A future sub belongs here only if it has a materially
different lifecycle, not a different count.

## Dispatch

Every row below **prepares** — the merge step is gated (see the banner above),
so today every row ends at mergeable-and-open. The column says what each row
selects, not that it merges.

| Invocation | Selects | Prepares | Merges |
|---|---|---|---|
| `/pr:merge <N>` | exactly PR N | yes | only once the gate opens |
| `/pr:merge` | ONE PR: green first, then infrastructure/tooling before content, then smallest diff (`changedFiles`, then additions+deletions), tiebreak ascending number | yes | only once the gate opens |
| `/pr:merge all` | the whole open-PR list, under § 6's cutoff | yes | only once the gate opens |
| `… --no-merge` | as above | yes | **never**, explicitly. This is the form [`/roadmap:process-full`](../../../product-basic/roadmap/process-full/command.md) calls for its delivery loop. |

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
  --json number,title,headRefName,headRefOid,baseRefName,additions,deletions,changedFiles,mergeable,updatedAt
gh api repos/:owner/:repo/git/ref/heads/<baseRefName> --jq .object.sha   # per distinct base
```

`baseRefName` and the base SHA are part of the record, not incidental: § 2 and
§ 4 both consume `<base>`, and § 8's kill switch "the base advanced by an actor
other than this run" is undetectable without a base SHA to compare against.

`--limit 100` caps the manifest. A queue above 100 open PRs is drained
**partially**, and the run must say so rather than reporting completion — the
§ 6 bound reads "initial manifest + one batch", and the manifest is what the
cap truncated.

The manifest is the authorization's target set and is **never silently
refreshed by a third party's push**. It is, by design, advanced by *this run's
own* commits — § 2 merges the base in and § 5 pushes, so a prepared PR's head
is never the snapshot head, and a naive "refuse when the SHA moved" check would
fire on every PR the run touches.

So the record carries **two** SHAs per PR and they mean different things:

| Field | Set at | Meaning |
|---|---|---|
| `pr_number` | snapshot | Immutable. A change is branch substitution — refuse. |
| `observed_head` | snapshot, then **updated by this run after each of its own pushes** | The head this run last produced. |
| `base_ref` + `base_sha` | snapshot | The base the PR was prepared against; § 8's "base advanced by another actor" compares against it. |

Before every merge, re-read the PR and refuse when the live head is **neither**
the snapshot head **nor** the head this run last pushed. That is the
force-push-after-authorization case, and it is the only one the check exists
for. A PR that appeared after the snapshot is not in scope for this run — § 6
says what happens to it.

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
| Generated artefacts | `agents/roadmaps-progress.md` · `src/config/estate-count-budget.json` · `docs/catalog.md` · `docs/command-flows.md` · `agents/index.md` · any file whose first three lines say generated / do-not-edit | Never hand-merge. Take either side, then **regenerate** with the repo's own task and commit the regenerated output. |
| Archive move vs. edit | `agents/roadmaps/{archive,later,skipped}/**` — one side renamed or deleted, the other edited | The archived end-state wins. Re-apply the edit at the new path if it still matters; otherwise drop it and record the drop in the summary. |
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

The probe is **not** a bare diff: taken literally, a bare diff closes every
roadmap PR in this repository, because after a base sync and a regenerate the
only remaining hunks are exactly the generated-artefact churn § 3 tells you to
regenerate. Exclude those paths before deciding:

```bash
git diff origin/<base>...HEAD --stat -- . \
  ':(exclude)agents/roadmaps-progress.md' \
  ':(exclude)src/config/estate-count-budget.json' \
  ':(exclude)docs/catalog.md' ':(exclude)agents/index.md'
```

Empty **after that exclusion** ⇒ superseded. **Never merge an empty PR to make
the queue count fall — and never close one on a bare diff.**

```
CLOSING SOMEONE ELSE'S PR IS AN IRREVERSIBLE EXTERNAL ACTION AND IS NOT
GUARDED: `pr-close` IS NOT A `GitOp` AT ALL — NOT IN `BLOCK_OPS`, NOT EVEN
IN `WARN_OPS`. NOTHING WILL STOP IT, WHICH IS WHY THIS COMMAND MUST.

THE RUN NEVER CLOSES A PR ON ITS OWN HEURISTIC. IT STOPS AND ASKS, NAMING
THE EXACT OBJECT: THE PR NUMBER, ITS TITLE, ITS AUTHOR, AND THE PRs THE
CONTENT LANDED VIA. ONE CONFIRMATION PER PR, THIS TURN, PER
non-destructive-by-default. NEVER A BATCH APPROVAL FOR "THE SUPERSEDED ONES".
IT CANNOT NAME WHERE THE CONTENT LANDED → DO NOT EVEN ASK; LEAVE THE PR OPEN
AND RECORD IT AS `blocked-external`.
```

The asymmetry is deliberate and worth stating, because it looks inconsistent:
merging is gated on an owner *decision* recorded once in a blocker, while
closing is gated on a *per-object* confirmation every time. Merging this run's
own PR is an action the run's whole design is about; closing a PR someone else
opened is not, it destroys their work in progress, and no guard in this tree
sees it happen. The cheaper gate goes on the action nothing else watches.

## 5. Drive CI green — bounded

Push, then wait for the verdict on the pushed head. Green means **the required
checks succeeded for the exact head SHA that will be merged** — never a local
run, never an earlier commit ([`/git-pr-create` § 4d](../create/command.md)).

- **Root-cause fixes only**, inside the PR's own scope.
- **One rerun for a known flake class** (`gh run rerun <id> --failed`) before
  red counts as real.
- **N=3 per validation target, six touches per PR per pass — two different
  units, and the smaller one binds first.** The always-loaded
  [`autonomous-execution`](../../../../rules/autonomous-execution.md) cap is
  three consecutive failed attempts on ONE target (a named failing test, a lint
  rule id, one CI job) and it is not lifted here. The six is a per-PR ceiling
  across *distinct* targets: a PR whose CI peels one failure to reveal a
  different one may be worked six times, never one target four times. Hitting
  N=3 on a single target ends the PR's pass immediately, whatever the six says.
  Exhaustion of either posts a diagnosis comment and moves the PR to the end of
  the queue once; a second exhaustion is terminal.

```
THESE ARE HALTS, NOT OPTIONS OF LAST RESORT:
DEPENDENCY CHANGES · WORKFLOW CHANGES · DELETING OR SKIPPING A TEST ·
LOOSENING A THRESHOLD · WEAKENING A GATE · AN EXPECTED-FAIL MARKER ·
A BRANCH-PROTECTION CHANGE.
"DRIVE CI GREEN" AUTHORIZES DIAGNOSIS AND REPAIR, NEVER REMOVING THE CHECK
THAT WOULD HAVE CAUGHT THE PROBLEM.
```

## 6. `all` — the queue, and the cutoff that ends it

Process the manifest in the order § 1 recorded it — the queue-order rule in the
Dispatch table's second row is the traversal for `all` too, not only for
single-PR selection, so two runs over the same queue agree.

After each merge the base has moved, so the next PR is re-synced against the
NEW base — that is the loop, and it is why pre-greening several PRs ahead of
their merges is wasted work.

**While the merge step is gated, that loop does not turn**, and the section
below is written for when it does. Nothing merges, so the base does not
advance, no PR leaves the open list, and an `all` run is a **preparation
sweep**: it syncs, classifies, greens and reports each PR once, then stops. It
does not re-prepare a PR its own predecessor invalidated, because it has no
predecessor that landed. The cutoff below still bounds it; the window below
still cannot close it, for the reason § 7 gives.

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

**The signal, named — otherwise neither this rule nor § 7 is actionable.** The
window is the per-session authorization ledger's own freshness bound. Read it,
never write it:

```bash
cat "agents/state/git-authorization/$(<session-slug>).json"   # detected_at
```

Remaining window = `detected_at + LEDGER_MAX_AGE_MS − now`. Take the constant
from the guard source **only after** `check_hook_bundle_content` says the
source and the executing bundle agree — reading the source alone is the
2026-08-21 failure re-expressed as an instruction, since the bundle is what
enforces the value and a source edit without a rebuild is silently inert. Under
pressure means
the remaining window is shorter than one CI cycle on this repository. The read
is the whole interaction: the run never edits that file, the constant, or the
built bundle.

## 7. Expiry is a reported state, never a stall

```
WHEN THE AUTHORIZATION WINDOW CLOSES WITH WORK LEFT, THE RUN STOPS CLEANLY
AND REPORTS. IT NEVER RETRIES THE GUARD, AND IT NEVER EDITS THE GUARD,
ITS SOURCE, OR ITS BUNDLES — READ-ONLY VERIFICATION ONLY.
```

**Unreachable while the merge step is gated**, and stated rather than left for
a reader to discover: with nothing merging, the run performs no `BLOCK_OPS`
operation (`push` and `commit` are `WARN_OPS`), so the window governs nothing
it does. This section is the contract for when the gate opens.

Write the summary as-is with a `window-expired` disposition per unprocessed PR
and name the exact re-authorization needed. Widening `LEDGER_MAX_AGE_MS` is
forbidden practice: on 2026-08-21 it was patched to six hours for a drain run
and the widening reached the trunk.

## 8. Kill switches, and what happens after a merge

**Armed during preparation, not only before a merge** — otherwise every switch
below is unreachable while the merge step is gated, and a preparation sweep has
no way to stop at all. Each one aborts the current PR and ends the run on any
of:

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

Detect the method once, at invocation, and reuse it for the whole queue:

```bash
gh repo view --json mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed
```

The mapping is explicit, because `<detected-method>` has to be derivable from
the text: `mergeCommitAllowed` → `--merge`, `squashMergeAllowed` → `--squash`,
`rebaseMergeAllowed` → `--rebase`.

Exactly one allowed → that is the method. More than one → read the last twenty
merges on the base (`git log --first-parent origin/<base> -20 --format=%s`) and
take the shape they overwhelmingly share. **A mixed history with no clear
majority is not a tie to break — it is a stop:** report it and let the operator
name the method. Inventing one is what the next sentence forbids, and a wrong
merge shape is not revertible by this command (§ 8). Never force-merge past a
failing required check, never admin-bypass.

On queue empty or terminal-only, `all` writes
`agents/evidence/pr-drain-run-summary.md` <!-- ref-ignore --> (created by the
run, so it does not exist until one has happened): one row per PR with queue
position, the `base_ref@base_sha` it was prepared against — without it a
"prepared" row records nothing checkable, since mergeability is a fact about a
base and not about a queue —
conflict classes hit, CI iterations used, disposition, and any edits dropped in
conflict resolution. The disposition set is closed:

`merged <sha>` · `superseded-closed` · `blocked-external` · `twice-exhausted` ·
`window-expired` · `arrived-after-cutoff`

## Rules

- **Never merge while the gate is closed.** Until the `merge-authority`
  blocker resolves, every invocation stops at mergeable-and-open, `--no-merge`
  or not. Once it opens, `--no-merge` is still the explicit way to say stop.
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
