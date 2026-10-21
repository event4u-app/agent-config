# /roadmap:process-full — Branches

Branch-only body of the [`/roadmap:process-full`](../../commands/roadmap/process-full.md)
command. Each section is loaded from the command's pointer line only when the
run takes that branch — `--all` and its lanes, gated residue, the six-layer
detail, `--merge`, `--worktree`, the halt detail, terminal outcomes and the PR
body, the final report shape, spend, and the dashboard rationale. The Iron Laws
stay in the command; this file carries the moved explanatory text verbatim.

### `--all` — the estate, one roadmap at a time

`--all` changes **cardinality, not lifecycle**: the same single-roadmap loop,
iterated over the whole active estate. It is a flag rather than a
`/roadmap:process-all` command because
[`command-clusters`](../../docs/contracts/command-clusters.md) says
sibling variants become a flag, and a drain is a count of the thing this
command already does.

1. **Recompute the inventory live.** Never from memory, never from the
   dashboard count — the same live-screen rule
   [`/roadmap:next` § 1](../../commands/roadmap/next.md) already carries. The corpus is the
   non-draft roadmaps directly under `agents/roadmaps/`; `later/`, `skipped/`,
   `archive/` and `stubs/` are out of scope.
2. **Order the queue — finish before start.** Run
   `./scripts-run src/scripts/roadmap_drain_queue` (`--json` for the record) and
   take its order; never build the queue in prose. It answers *can this started
   roadmap still move?*, not *how far along is it?*:
   `resume` (a dead session's claimed roadmap — continue in its worktree) →
   `continue` (started, at least one runnable open step, fewest runnable first)
   → `start` (unstarted, dispatchable **only** when no `resume` / `continue`
   entry is left) → `decide` (no runnable step: never dispatched, its blockers go
   to § Gated residue) → `claimed` (a live peer session holds it: skipped).

   Percent-done was the old key and it was the defect: it put the gated tails of
   nearly-finished roadmaps on top, the orchestrator screened them as blocked,
   and the unstarted bucket won. Over 50 sessions read on 2026-10-19, roadmaps
   under 25 % received 86 progress commits and those at 75 % or more received 12;
   24 were started and none finished. `/roadmap:next` § 3's Goodhart warning
   still holds — under a total drain the order decides only what finishes first,
   never what gets done.

   **An owner's quantity word widens how many roadmaps are FINISHED, never how
   many are STARTED.** "As many roadmaps as possible" reads as "as many to
   completion", in queue order.
3. **Claim, then loop.** Per roadmap: `agent-config sessions:claim <slug>`
   first, so a later session's queue lists it as `claimed` and takes the next
   started roadmap instead of this one or a new one; branch from the updated
   default, run this command's normal single-roadmap loop, deliver per
   § Delivery, `sessions:claim --release <slug>`, then re-run the queue against
   the default **as it stands at that moment** — re-fetched, never assumed. One
   roadmap = one branch = one PR, the existing invariant iterated, not a new one.

   **A refused claim is a stop for that roadmap, never a `--force`.** Every
   claim takes a per-slug lock in the git common dir, which a session in any
   worktree sees the moment it is written and which refuses a second live
   holder. `REFUSED` means a peer is building it: take the next queue entry.
   The single-roadmap path claims the same way before its first edit, so a
   plain `/roadmap:process-full <slug>` in a second session refuses instead of
   duplicating — the #2533 / #2534 failure, two sessions, one roadmap, ten
   conflicting files.

### Lanes — at most two, each on the canonical brief

A lane is a subagent that drains ONE roadmap. **At most two lanes run at once**
(the cap recorded 2026-08-20); an owner's "max N" above two is reported in the
run's first line and not obeyed — one run on record started fourteen, saturated
CI and lost every lane to the spend limit together. A lane holds its roadmap
until it reports `complete` or a halt; it never receives a second roadmap, and
no lane is dispatched onto a `start` entry while a `continue` entry has no lane.

**Each lane is claimed for itself, before it spawns:**
`agent-config sessions:claim <slug> --lane --worktree <lane worktree>`. One
session holds one lock per lane, so the second lane no longer overwrites the
first lane's claim, and the queue lists every lane's roadmap as `claimed`.

**A lane that dies keeps its work.** A spend limit, a rate limit or a watchdog
stops the lane, not its worktree: the commits and the uncommitted edits stay on
disk. Before re-dispatching, read the queue — the lane's entry carries
`salvage: N commit(s) ahead, M uncommitted file(s)` — and send a FRESH lane
into the SAME worktree with the same brief; a resumed agent loses its isolated
worktree, a fresh one does not. The same holds when the orchestrator session
itself dies: its lane locks expire with its register record and the next
session's queue lists each roadmap as `resume` in the lane's worktree.

**The orchestrator sends this brief, filling only the two parameters, and adds
nothing that changes its finish line:**

```text
Run /roadmap:process-full on <roadmap path>, in the worktree <absolute path>.
Your finish line is count_open == 0 for this roadmap and exactly ONE pull request.
Commit locally in logical chunks. Push and open the PR only after the last step
is done — no intermediate push, PR or merge; delivery fixes go to that same PR.
Do not flip checkboxes. For every step you finish, return the step id and its
evidence (the command you ran and its result). The orchestrator verifies and flips.
If a step needs a council or owner decision, do not stop and do not leave it with
a reason: return it as `gated: <step> — <blocker id> — <the question>` and keep
working the other steps. The orchestrator decides it and resumes you.
Never cut finished work out of the diff to avoid a gate; a gated part waits for
its decision inside this branch.
If the worktree already holds commits or uncommitted edits for this roadmap, a
previous lane was stopped: continue from them, never start over.
Report, every time: steps finished, steps gated, classifier_refusals (a list,
empty when none).
```

Forbidden in a brief or in any addendum to it: an "open, green PR" as the finish
line; a sanctioned partial PR; a phase or step-range scope; "remove the part that
needs ratification"; "do not ask the owner". Each of these was in the improvised
briefs of the 2026-10-01..19 drains, and 17 of 207 drain lanes (8 %) reached
`count_open == 0` under them.

### Gated residue — decided in the run, not left in a report

The queue classifies every open step as runnable, council, owner or time
(`roadmap_drain_queue`, from `blocked-by` markers, blocker `Class` / `Owner` /
`Status`, and a dated wait). What it cannot run, the orchestrator settles before
the roadmap is dispatched again:

1. **Owner questions are asked once, at run start.** The queue's
   `owner_questions` become ONE numbered block, one decision per number, before
   any lane spawns. Each answer is recorded at its step. An unanswered step keeps
   its roadmap in `decide` — it never licenses starting an unstarted roadmap in
   its place.
2. **Council questions run in the run.** A lane's `gated:` return or a
   `council_questions` entry goes to the council by the orchestrator, and the
   verdict goes back to the SAME lane via its message channel. Ending the lane and
   dispatching a fresh one later is how one roadmap received nine lanes in eight
   sessions behind an unchanged blocker.
3. **A `decide` roadmap is never re-dispatched until its blocker changed** —
   the queue reads `Status:` live, so a resolved blocker turns the step runnable
   and nothing else does.
4. **A roadmap whose only open steps are time-gated is closed by carrying them**
   into a named `-carried` follow-up in the same change (the council-routed
   disposition of `roadmap-progress-sync` Iron Law 3), then archived. Never `[~]`
   or `[-]` to reach zero.

### The orchestrator closes the boxes

A lane does not flip its own checkboxes: it returns each finished step with its
evidence, and the orchestrator verifies the return (per `delegation-policy`
item 4) and makes the bookkeeping commit on the lane's branch. A lane approving
its own work is one of the actions the host classifier refused as
"Self-Approval" among the 24 classifier stops in those drains; an orchestrator
verifying a return is the review the classifier was asking for.

**What `--all` can and cannot promise, stated plainly because the honest
version is weaker than the obvious one.** Nothing in the run
merges, so the default does not advance because of this run, and every PR after
the first is mergeable *against the base recorded when it was prepared* rather
than against the base after its predecessors land. In a repository where every
roadmap PR touches the same generated files, that means an `--all` hand-off is
**one immediately-mergeable PR plus N−1 prepared ones**, each needing a
re-sync at merge time. That is still the expensive half — conflicts classified,
CI green once, superseded PRs closed — but it is not "N mergeable PRs", and the
run reports it in those words.

**A blocked roadmap never stalls the estate queue.** Inside a roadmap the five
halt conditions and the terminal outcomes keep full authority. Between
roadmaps, the § Halt-conditions table below is the single statement of what
ends the roadmap and what ends the loop — including the two halts that are
safety floors and therefore end the run. A `blocked` roadmap is recorded and
the loop continues to the next one.

### `--worktree` — isolate the workspace

Route workspace creation through [`/worktree:create`](../../commands/worktree/create.md)
in full, including its
[§ 4b seeding allow/deny list](../../skills/using-git-worktrees/SKILL.md#4b-seed-the-worktree--allow--deny-list),
which is the authority on what may be copied and what must never be — not
restated here, because a second copy of a safety list is a copy that can
drift. Under `--all` the worktree is created
once and re-branched per roadmap; `/worktree:cleanup` runs at end of run.

## Full is Full — halt detail

6. **RETIRED 2026-09-13** by `road-to-adversarial-verification-and-long-runs`
   5.2. This read *a merge conflict outside the four enumerated classes of
   `/pr:merge` § 3*. That section now ROUTES
   an unenumerated conflict — understand both intents, inspect recency and
   authorship, preserve both where compatible, independent review, council or
   team, and the owner **only** for a product-semantic incompatibility — so
   there is no longer a conflict class whose arrival ends a run. Numbered rather
   than renumbered: the list is cited by index from several places, and silently
   shifting five conditions up one is how a citation comes to name a different
   halt. **Five live halt conditions, not six.**

   What did NOT change: an unenumerated conflict may still never be resolved
   silently. The ladder's own record — which rung settled it, both intents, why
   the resolution preserves them — is the replacement for the stop, and the
   reason the stop could be removed at all.

**Under `--all`, which of these end the roadmap and which end the loop.** Two
of the five are safety floors and they end the **whole run**, not the current
roadmap:

| Halt | Under `--all` |
|---|---|
| 1. Hard-Floor trigger | **Ends the run.** Stop and obtain this-turn confirmation. [`non-destructive-by-default`](../../rules/non-destructive-by-default.md) states that no roadmap authorization lifts the floor, and "record it and take the next roadmap" is exactly the roadmap-as-authorization bypass it names. |
| 3. Security-sensitive surface | **Ends the run**, same reasoning. |
| 2. Council-off + genuine ambiguity | Ends the roadmap; the loop records it and continues. |
| 4. Scope-out-of-roadmap work | Ends the roadmap; the loop records it and continues. |
| 5. Test / quality red past N=3 | Ends the roadmap; the loop records it and continues. |
| ~~6. Unenumerated merge conflict in delivery~~ | **RETIRED** — `/pr:merge` § 3 routes it instead of stopping. |

**And the conditions that end the loop without ending a roadmap:**
estate-queue exhaustion (always), a
`/pr:merge` § 8 kill switch (always — that
section arms its checks during **preparation**, not only before a merge, which
is what keeps them reachable while the merge step is gated), and
authorization-window expiry — which is **unreachable in this command**,
because it never performs a `BLOCK_OPS` operation for the window to govern. Three conditions, one of them currently inert, and this
table is the only place the set is stated.

Nothing here widens a run without `--all`: it still has exactly the five live
conditions above, all of them ending the run because there is no loop to
continue.

Phase-internal `(deferred)` / `(optional)` / `gated on Phase N` tags are
authoring annotations, not execution gates. `/roadmap:process-full`
ignores them by construction. If the user wants narrower execution they
invoke `/roadmap:process-phase` (scope = single phase) or
`/roadmap:process-step` (scope = single step) instead.

Time-boxed plate / horizon framing is opt-in via
`roadmap.horizon_weeks` in `.agent-settings.yml` (default `0` =
forbidden, per template rule 16 in `templates/roadmaps.md`). If a
roadmap carries such phrasing — whether by legacy or by an opt-in
setting — treat it as ordinary prose during execution, never as a
gate. Phase ordering and explicit dependency gates govern the loop.
