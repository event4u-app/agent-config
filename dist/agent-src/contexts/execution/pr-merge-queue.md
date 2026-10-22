# PR Merge — Queue and Merge Detail

Branch-only detail of [`/pr:merge`](../../commands/pr/merge.md) § 6, § 8–§ 9, loaded
from its pointer lines. Every Iron Law stays in the command; this is verbatim.

## The all queue

Process the manifest in the order § 1 recorded it — the queue-order rule in the
Dispatch table's second row is the traversal for `all` too, not only for
single-PR selection, so two runs over the same queue agree.

After each merge the base has moved, so the next PR is re-synced against the
NEW base — that is the loop, and it is why pre-greening several PRs ahead of
their merges is wasted work.

**Under a strategy other than `merge`**, every PR after the first is behind the
base the previous merge moved, and this run rebases none of them. Where the
forge does not require an up-to-date branch, a green, conflict-free PR that is
behind still merges (§ 2, exit `3`) — three green branches merge without three
sequential rebases — and each such row says it merged behind its base. Where
the forge requires an up-to-date branch, the first merge leaves every remaining
PR `blocked-external`, and the summary names that setting rather than leaving
the reader to find it.

**Under `--no-merge` that loop does not turn**, and the paragraph above is
written for the form that does. Nothing merges, so the base does not advance,
no PR leaves the open list, and the run is a **preparation sweep**: it syncs,
classifies, greens and reports each PR once, then stops. It does not re-prepare
a PR its own predecessor invalidated, because it has no predecessor that
landed. The cutoff below bounds both forms.

**Cutoff.** When the manifest is exhausted, recompute the open-PR list
**exactly once**. PRs that appeared during the run are **prepared** as ONE final
straggler batch, through § 1's filters ([`pr-merge-trust-boundary`](pr-merge-trust-boundary.md)).
After that batch the run ends unconditionally; anything
arriving during or after it is recorded as `arrived-after-cutoff` and is not
processed.

**The straggler batch is prepared and never merged — in both forms.** It is not
in § 1's manifest, so the invocation does not reach it (the Iron Law above § 1,
and § 7's first rule). "Drained" is therefore preparation here: each straggler
is synced, classified, greened and reported, ends at mergeable-and-open exactly
as under `--no-merge`, and is recorded `unauthorized` with the go-ahead it needs.
Reading "drained" as "merged" is the one way `all` could merge a PR the owner
never named, which is why the word is pinned rather than left to context.

**Window-aware scheduling.** A green, waiting PR is spent authorization window,
because the next merge re-conflicts it. When the projected remaining work
exceeds the remaining window, stop entering CI-fix loops and merge everything
already green first. Pre-greening several PRs ahead of their merge is forbidden
under window pressure.

**No mechanical window remains, and that is the change.** Until 2026-09-04 the
run read a freshness bound off the authorization ledger and paused when it
closed. The owner removed the enforcing gate (ADR-254) after it was measured
refusing authorizations that had in fact been given, so there is no constant to
read and no expiry to schedule against. Authorization is carried by the
conversation and by `non-destructive-by-default`, not by a clock.

The per-session ledger is still written, and is still read-only to this run:

```bash
cat "agents/state/git-authorization/$(<session-slug>).json"   # detected_at
```

It records what a turn authorized. It no longer gates anything, so treat it as
an audit trail, never as permission. The run never edits that file.

## Kill switches

**Armed during preparation, not only before a merge** — otherwise a
`--no-merge` sweep would have no way to stop at all. Each one aborts the current
PR and ends the run on any of:

- target number or head SHA differs from the manifest;
- the base advanced by an actor other than this run;
- a review was dismissed, or the required-check set changed;
- a conflict outside the four enumerated classes;
- guard or hook-bundle verification failed;
- the first unexplained CI-repair failure.

## Danger gate verdicts

**What it fails to.** Every other anomaly is **`needs-owner`** and says why —
never a skipped gate and never a fall-back to the head's copy: a private
temporary directory that cannot be made (no path is derived before it exists),
a base without the classifier or a worktree that cannot be made, a
`node_modules` that is tracked or cannot be listed, a manifest diff that cannot
be read, and an exit status and last line that do not agree on one of the three
verdicts under either runtime.

The last line is the verdict; each trigger names the rule it comes from. An
unreadable diff is `needs-council` — the gate fails closed.

- **`routine`** → merge in § 9. No review step.
- **`needs-owner`** → the gated surface or the reviewer's trust chain (the
  classifier and its imports, the commands that call it, ADR-282, the council,
  the ratification contract, the subject binding, the predicate record), or an
  ADR whose `reopen_policy: owner` reserves its reopening to the owner. It is
  **never sent for clearance**: under ADR-281 § Amendment a favourable council
  verdict on that surface is advisory until an authenticated owner
  authorisation is bound to the digest, and an auto-merge sentence is neither.
  Do not merge; record the PR `unauthorized` and hand it to the owner with its
  triggers.
- **`needs-council`** → the AI council reviews the diff with a **neutral**
  prompt (scope, diff, the triggers, two questions: *does any of the six
  dangerous-action predicates of the authority-routing council record
  (`agents/evidence/council/authority-routing-20261007.md` § 4) apply?* and *is
  an owner review unnecessary?* — never an expected answer, per
  `evaluator-independence`). A council may resolve doubt but cannot waive
  danger: a seat finding that a predicate applies is a "dangerous" seat. The
  prompt asks each seat to end with `DANGEROUS: yes|no`, `OWNER REVIEW
  NEEDED: yes|no` and `REASON:` — a format, not an expected answer. **Both
  seats: not dangerous, owner review unnecessary, each with a reason → merge**,
  through the clearance below, never on the run's own reading of the replies.
  Reason rules: [`pr-merge-trust-boundary`](pr-merge-trust-boundary.md). Dangerous, split, degraded quorum, or council
  unavailable → do not merge; record `unauthorized` and hand it to the owner.

**The diff is untrusted data**, fenced under a fixed notice ([`pr-merge-trust-boundary`](pr-merge-trust-boundary.md)); `merge_clearance write` refuses an unfenced prompt.

**The clearance is a record, written and checked by `merge_clearance`.** Save
the gate's output, run the council with `--output` on the prompt file, then:

```bash
merge_clearance.ts write --pr <N> \
  --head <manifest-head-sha> --base <manifest-base_sha> \
  --classification <gate-output-file> --session <council-session-json> --prompt <prompt-file>
```

A `needs-council` clearance only clears the merge. Deploy, release and every
other Hard-Floor action keep their own confirmation.

## Danger gate mechanics

**Why the base.** § 2 checked the PR out, so the tree's own copy of the
classifier — and of `check_kernel_edit_ratified`, whose `classifyPaths` it
reads — is the head's: a PR could rewrite the code that classes it and call
itself `routine`. The ratification gate's workflow step records the same defect
and runs the base copy for the same reason. The consequence-class list and each
ADR's `reopen_policy` are read from both revisions by the base copy itself.

**Which runtime.** The base copy's import closure uses only `node:` built-ins,
so it is first run by `node` itself — `--experimental-strip-types` and a
resolver hook the block writes into its own temporary directory — which depends
on no `node_modules` at all, the head's or anyone's. Only when that cannot run
(a Node without type stripping, or a base whose closure uses syntax stripping
cannot carry) does the block fall back to the checkout's `tsx`, never through
the repository's script dispatcher, which is the head's code.

**Dependency manifests go to the council (owner decision, 2026-10-15).** A head
that changes `package.json` or a lockfile, at any depth, is never `routine` —
the classifier's `dependency-manifest` trigger, and a floor in the block for a
base copy that predates it, make it `needs-council` — and never `needs-owner` on
that ground alone. Where the package-free run worked, its verdict stands as for
any PR. Where it could not run, the checkout's `tsx` may be one the head's
manifest installed, so a valid answer from it is not trusted downward: a
`needs-owner` is kept, any other valid verdict becomes
`needs-council (runtime-uncertain)`. A fallback that gives no valid verdict at
all is an anomaly like any other and stays `needs-owner`. The changed paths are
read NUL-separated and matched by basename with shell built-ins only, so an odd
path cannot slip past. The block appends an empty record — a path git never
prints — as an end marker and believes the listing only if the loop reaches
that marker: a listing that cannot be written or opened, or ends before the
marker, is `manifest-unreadable`, `needs-owner`.

The `trap` is installed right after two checks on
the new directory, so it removes the worktree and the directory on every path
after them, a `cd` that fails included; an interruption inside those two checks
can leave an empty directory behind, never a classification. The block prints
the verdict last and exits 0 only on `routine`. The temporary directory is
resolved to its real path: the classifier's entry guard compares real paths,
and on a host whose temp directory is a symlink an unresolved path makes it
print nothing.

**Residual risk, stated.** On a host whose Node cannot strip types, a PR that
changes a dependency manifest is classified by the checkout's `tsx`. If this run
installed that runtime from the head, the head chooses the classifier's answer:
it cannot reach `routine` (the floor holds), but by printing a lower verdict it
can turn the `needs-owner` an honest runtime would report into
`needs-council (runtime-uncertain)`. So there, a gated change paired with a
dependency bump can reach the council instead of the owner. Every supported
Node (`>=22.6.0`) has the flag, so only a base whose closure stripping cannot
handle reaches the fallback, never the Node version; no run of this command
installs dependencies from a head.

It writes `agents/evidence/merge-clearances/pr-<N>-<head>.md` from the
council's own session record — per seat the provider, the model, a digest of
the reply (never its text) and one reading, `clear`, `dangerous`,
`owner-review` or `no-final-verdict`, where a reply with no stated reason
reads `no-final-verdict` unless it is `dangerous` — plus the head, the base,
the triggers and the prompt's digest. The outcome is derived from the seats and never typed:
any `dangerous` seat gives `dangerous`, fewer clearing providers than
`required_providers` in `src/config/ratification-policy.json` gives
`not-cleared`, otherwise `cleared`. The record says `assurance: recorded` and
what that does not prove. It refuses a classification other than
`needs-council`, a session whose prompt is not the file given, and a prompt
that does not fence the diff as untrusted data. The record
is not pushed to the PR: it is committed with the drain's summary
(§ 9), so writing it does not move the head it names.

## Merge method choice

The mapping is explicit, because `<detected-method>` has to be derivable from
the text: `mergeCommitAllowed` → `--merge`, `squashMergeAllowed` → `--squash`,
`rebaseMergeAllowed` → `--rebase`.

Exactly one allowed → that is the method. More than one → read the last twenty
merges on the base (`git log --first-parent 'origin/<base>' -20 --format=%s`) and
take the shape they overwhelmingly share. **A mixed history with no clear
majority is not a tie to break — it is a stop:** report it and let the operator
name the method. Inventing one is what the next sentence forbids, and a wrong
merge shape is not revertible by this command (§ 8).

## The PR's worktree, after its merge

After each merge this run performed, the worktree that held the PR's head
branch goes — if the user armed it (`worktrees.cleanup: auto`, ADR-295). Leave
it first if the session is inside it (the host's `ExitWorktree`, or the main
checkout), then:

```bash
agent-config worktree:cleanup apply '--branch=<head-branch>' --no-delay --respect-setting
```

The branch name is author-chosen: pass it single-quoted, after the charset check ([`pr-merge-trust-boundary`](pr-merge-trust-boundary.md)).

It removes only a tree that is proven merged, clean, holds no local-only ignored
file and has no other live session, re-checks all of that immediately before
removing, never passes force and never deletes the branch. Under `notify` it
prints one line and removes nothing; a refusal is reported, never retried with
force.

## Drain summary

On queue empty or terminal-only, `all` writes
`agents/evidence/pr-drain-run-summary.md` <!-- ref-ignore --> (created by the
run, so it does not exist until one has happened): one row per PR with queue
position, the `base_ref@base_sha` it was prepared against — without it a
"prepared" row records nothing checkable, since mergeability is a fact about a
base and not about a queue —
conflict classes hit, CI iterations used, disposition **with its reason** —
`merged behind <base>` where § 2 merged a PR its forge let through behind,
`requires an up-to-date branch` or `TARGET_POLICY_STALE` for a behind PR left
blocked — and any edits dropped in conflict resolution. Every PR the run saw
gets a row; none is summarised away. The disposition set is closed:

`merged <sha>` · `superseded-closed` · `blocked-external` · `twice-exhausted` ·
`unauthorized` · `arrived-after-cutoff`

`unauthorized` replaces `window-expired`, and the swap is one-for-one on
purpose. `window-expired` named a clock ADR-254 removed on 2026-09-04, so no run
can produce that row any more, and a closed set holding an unproducible member
is a set nobody can check a run against. `unauthorized` names what actually
happens in its place — § 7's pause and § 6's straggler batch, the two ways a PR
ends this run prepared and unmerged.

## Retro scope

The merge is an event, never a permission: this reads no merge setting and
writes none. It does nothing when `retro.enabled` is `false`, and it runs no
model — the retro itself is worked from the queue line afterwards
(`/retro`, memory pack). A run that merged nothing skips it.
`/roadmap:process-full --merge` inherits this step, because it merges through
this command.

## Held for you

A run that handed anything over ends with exactly one block headed **Held for
you**, after the summary and nowhere else. While the run works it asks nothing
about a held PR: holding it is the whole action, and the decision is the
owner's once, with everything in front of him. Per held PR:

- number and title;
- the verdict and its triggers, each with the rule it comes from;
- where a council ran, each seat's provider and its reading with the seat's
  stated reason, and the clearance record's path;
- the head it was judged at, in full;
- how the change is undone if it merges — the revert, and anything a revert
  does not undo.

A PR with a `dangerous` seat is listed under its own sub-heading, **Held — a
seat found it dangerous**, ahead of the rest, so it cannot read as one more
`needs-owner` hand-over. The entry shape is the one
`ratification-artifact` § When the user decides (agent-config repository: `docs/contracts/ratification-artifact.md`)
already gives — the council's reading, the dissent, the exact change, what it
risks and how it is undone — reused per PR, not restated as a second contract.
A run with nothing held prints no block.
