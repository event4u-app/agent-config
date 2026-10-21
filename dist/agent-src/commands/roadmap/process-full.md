---
model_tier: medium
name: roadmap-process-full
pack: product-basic
visibility: internal
cluster: roadmap
sub: process-full
skills: [agent-docs-writing, ai-council, roadmap-management]
description: Autonomously process every open step across every phase of a roadmap until the file is fully closed. Largest execution scope of the /roadmap cluster — runs continuously across phase boundaries.
argument-hint: "[roadmap] [--all] [--merge] [--worktree]"
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /roadmap:process-full

Whole-roadmap execution scope of the [`/roadmap`](../roadmap.md)
cluster. Same canonical loop as
[`/roadmap:process-phase`](process-phase.md), but does **not** stop at
phase boundaries — continues until every step is closed (or a halt
condition fires).

**This invocation IS the grant** (ADR-237). It authorises every
machine-executable, repository-scoped action needed to deliver the finished
PR — branches, chunked commits, pushing that branch, opening and updating the
PR, reversible repository/branch settings, CI runs and re-runs, merge-base
updates and conflict resolution, and any tool / CLI / API / model / council the
work needs within the spend ceiling. **The final PR is the interaction
boundary: report once, at the end.**

## Instructions

Run the canonical loop in
[`contexts/execution/roadmap-process-loop`](../../contexts/execution/roadmap-process-loop.md)
with the **scope delta below**.

**Claim before the first edit, every mode:** `agent-config sessions:claim <slug>`.
`REFUSED` stops the run for this roadmap and names who holds it — never
`--force` to get past a live peer. A lane brief already carries its lane claim
(§ Lanes), so a lane does not claim again.

## Scope delta

- **Execution mode:** read `execution.mode` from frontmatter. Under
  `autonomous` / `phase-checkpoints` the loop's § 3 pre-scan derives
  the run-start **execution contract**
  ([`roadmap-execution-contract`](../../contexts/execution/roadmap-execution-contract.md));
  ONE acceptance activates all run grants (feature branch, chunked
  commits, push to that branch only, PR-open, batched artifact
  drafting, council auto-enable) — no further asks until a safety
  floor. `mode: autonomous` is the flagship pairing for this wrapper:
  full working set + contract = uninterrupted run to the defined end
  state.
- **Working set:** every open step across every phase, in document
  order. Phase-internal annotations like `(deferred)` / `(optional)` /
  "gated on Phase N" do not narrow the working set.
- **Stop after:** the entire roadmap reaches `count_open == 0` and the PR is
  open (`complete`), or every remaining open step is **externally impossible**
  for the agent (`blocked` — narrowed by ADR-237 § 4 to genuine external
  impossibility), or a halt condition fires (Hard-Floor EXCLUDED-list action,
  security-sensitive, scope-out-of-roadmap, test/quality red past N=3).
- **Always start.** `blocked-preflight` was **removed by ADR-237**: a run no
  longer refuses because its open steps look human-gated. Repository-local
  prerequisites are remediation work — do them. The § 3c test now asks whether
  an action is *technically possible for the agent*, not who conventionally
  performs it.
- **Phase boundary handling:** at every phase boundary, run the
  per-phase quality pipeline when `quality_cadence: per_phase` (or
  `per_step`) AND `quality.local_auto_run: true` — under the default
  (`false` / missing) the pipeline never runs locally; remote CI is
  the gate. On red → stop, surface, do **not** silently roll into
  the next phase. Under `mode: phase-checkpoints`, additionally emit
  a compact status LINE at every boundary — but under `process-full`
  this is a NON-BLOCKING status, NOT a stop-and-wait: the run continues
  to the next phase immediately. `phase-checkpoints` narrows to a
  stop-and-wait only under `/roadmap:process-phase`, never here (a
  process-full invocation overrides the mode's boundary-wait). Under
  `autonomous`, boundaries are silent (quality pipeline aside).
- **Final archival:** when the roadmap is fully closed, run the
  archival check from
  [`roadmap-process-loop § 6`](../../contexts/execution/roadmap-process-loop.md#6-final-report-and-archival).

## The three flags

### `--all` — the estate, one roadmap at a time

`--all` changes **cardinality, not lifecycle**: the same single-roadmap loop,
iterated over the whole active estate. It is a flag rather than a
`/roadmap:process-all` command because
[`command-clusters`](../../docs/contracts/command-clusters.md) says
sibling variants become a flag, and a drain is a count of the thing this
command already does.

1. **Recompute the inventory live.** Never from memory, never from the
   dashboard count — the same live-screen rule
   [`/roadmap:next` § 1](../next/command.md) already carries. The corpus is the
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

### Delivery — every run, flag or not

On outcome `complete`, open the PR as today, then run
`/pr:merge <N> --no-merge` on it: sync the
base in, resolve conflicts by that command's four enumerated classes, drive the
required checks green on the pushed head. **This is unconditional** — a bare
`/roadmap:process-full` delivers a mergeable PR, not merely an open one, and
waiting on that remote CI is part of the run per the Iron Law below. With an
owner auto-merge instruction the call is `/pr:merge <N> --merge` instead, which
merges through that command's danger gate — § Merging below.

### The six required layers, in order, each with the command that runs it

`road-to-adversarial-verification-and-long-runs` 3.1. Correctness is owned by the
forge and CI, not by an owner reading a diff — so the layers are named, ordered,
and each one carries the command that produces its verdict. A layer with no
command is a claim; a layer with one is a check.

| # | Layer | Command that runs it |
|---|---|---|
| 1 | A targeted local RED, then GREEN | the test runner filtered to the failing name — `npm run test:ts -- <file>`, never the suite |
| 2 | Quality scoped to the changed surface | the type-checker and linter over the diff — `npm run typecheck`, the linter on changed files |
| 3 | Per-phase fast CI | `roadmap.quality_cadence: per_phase` (Phase 0.2) at each phase boundary |
| 4 | The final full required CI | `npm exec --no -- agent-config ci:settle <PR> --timeout-min 28`, run as a BACKGROUND job — its LAST OUTPUT LINE is the verdict |
| 5 | Forge branch protection | `agent-config doctor --json` → `forge_protection` (Phase 3.2), read from the forge |
| 6 | Final-head verification | `ci_settle`'s verdict line names the head; it must be the head that was pushed last |

**Layer 1 before layer 2 before layer 3, and the order is the substance.** Each
layer is cheaper and narrower than the one after it, so running them out of order
spends the expensive verdict on a failure the cheap one would have named. A run
that reaches layer 4 with layer 1 unrun has not saved a step; it has moved the
same failure to where it costs a CI cycle.

```
CI REJECTS: A SKIPPED OR DISABLED REQUIRED CHECK · UNRESOLVED GENERATED DRIFT ·
POLICY-PROJECTION DRIFT · A STALE-HEAD MERGE · A CONFLICT RESOLUTION THAT WAS
NOT REVALIDATED.
CI NEVER REQUIRES A HUMAN APPROVAL MERELY BECAUSE A CHANGE IS LARGE.
```

That last line is not a courtesy. Size is the one property of a diff that
correlates with nothing a reviewer can check mechanically, and gating on it is
how *ask the owner* re-enters through a door marked prudence — which is the loop
ADR-268 § 0 is trying to end. Gate on the five conditions above, which are
falsifiable, and never on how big the change looks.

**A disabled required check cannot reach delivery-ready**, and that is the
condition to test rather than assert: a PR whose required context is skipped has
a green rollup and an unenforced gate, so a delivery-ready test that reads only
the rollup passes exactly when it should fail.

### `--merge` — merging, on the owner's word only (ADR-282)

```
THIS COMMAND MERGES ONLY ON AN EXPLICIT OWNER AUTO-MERGE INSTRUCTION:
`--merge`, OR THE OWNER'S OWN WORDS IN THE SESSION THAT RUNS THE WORK.
WITHOUT ONE, THE RUN ENDS AT MERGEABLE-AND-OPEN, AND SAYS SO.
A `needs-council` PR MERGES ONLY ON TWO CONVERGENT CLEARING SEATS;
DANGEROUS, SPLIT, DEGRADED OR UNAVAILABLE → THE OWNER DECIDES.
A `needs-owner` PR IS NEVER SENT FOR CLEARANCE — THE OWNER DECIDES.
```

The owner settled the half of
[ADR-239](../../../../../docs/decisions/ADR-239-drain-command-surface-and-merge-authority.md)
§ Disposition that ADR-266 left open:
[ADR-282](../../../../../docs/decisions/ADR-282-auto-merge-authority-with-a-council-danger-gate.md).
An explicit auto-merge instruction is the this-turn confirmation
[`non-destructive-by-default`](../../../../rules/non-destructive-by-default.md)
requires for the production-branch merge of a **routine** PR. Delivery runs
`/pr:merge <N> --merge`, whose § 9a danger gate (`classify_merge_risk`) decides:
`routine` → squash-merge bound to the observed head; `needs-council` → a neutral
council review, merge only when both seats say *not dangerous, owner review
unnecessary*, otherwise hand the PR back with the seats' reasons; `needs-owner`
(the gated surface, the reviewer's trust chain, or an owner-reserved ADR) →
no council, hand it back
with its triggers. § 9a runs the base revision's classifier, never the head's.

ADR-268 § 3's object-bound `prod_merge` grant stays a separate, unchanged path.
A standing autonomy directive or momentum is **neither**. Deploy, release and
every other Hard-Floor action keep their own confirmation.

**Mergeability is per-PR against a recorded base, never a queue property.**
When every PR in the estate touches the same generated files — in this
repository `agents/roadmaps-progress.md` and the archive index — making PR *n*
mergeable against base
SHA `M` says nothing about its state once PR *n−1* advances the base to `M1`.
Report "mergeable against base `<SHA>`", never "the queue is mergeable".

### Ceremony depth — the row each ceremony here reads

`src/config/step-depth-table.json` holds one depth per change class
(`classify_change_risk`, raise-only). Its `mode` is `shadow`: every ceremony
below runs at full depth, and `step_receipt` records what the class's row
would have skipped. Lowering depth is the owner's call, never this run's.

| Ceremony in this run | Table row |
|---|---|
| completion review before the PR | `review` |
| council on an open question (loop § 5 step 4) | `council` |
| evidence artefacts and the PR body | `evidence` |
| context refresh / re-validation of the plan (loop § 5e) | `revalidation` |

### `--worktree` — isolate the workspace

Route workspace creation through [`/worktree:create`](../../../engineering-base/worktree/create/command.md)
in full, including its
[§ 4b seeding allow/deny list](../../../../skills/using-git-worktrees/SKILL.md#4b-seed-the-worktree--allow--deny-list),
which is the authority on what may be copied and what must never be — not
restated here, because a second copy of a safety list is a copy that can
drift. Under `--all` the worktree is created
once and re-branched per roadmap; `/worktree:cleanup` runs at end of run.

## Iron Law — Full is Full

```
/roadmap:process-full IS LAW: IT PROCESSES EVERY OPEN STEP IN THE FILE,
TO COMPLETION, ACROSS EVERY PHASE. ONLY THE FIVE HALT CONDITIONS STOP IT.
PHASE-INTERNAL "(DEFERRED)" / "(OPTIONAL)" / "GATED ON PHASE X" NOTES DO
NOT NARROW THE WORKING SET. A PHASE BOUNDARY IS NOT A STOP.
UNDER `--all`, A ROADMAP BOUNDARY IS NOT A STOP EITHER — BUT A HARD-FLOOR OR
SECURITY-SENSITIVE HALT ENDS THE WHOLE RUN, NOT JUST THE ROADMAP. THE TABLE
UNDER THE HALT CONDITIONS IS THE ONLY STATEMENT OF WHICH ENDS WHICH.
WAITING ON REMOTE CI FOR THE DELIVERY LOOP IS PART OF THE RUN. "CI IS
RUNNING" IS NOT A BOUNDARY, NOT A HALT, AND NOT A REPORT — THE RUN ENDS
AT A MERGEABLE PR, NEVER AT AN OFFER TO GO CHECK ON ONE.
ONE ROADMAP, ONE PR: NO PUSH, PR OR MERGE OF A ROADMAP BEFORE ITS LAST STEP
IS DONE. LOCAL COMMITS IN LOGICAL CHUNKS STAY; DELIVERY FIXES AFTER THE PR
OPENS ARE PUSHED TO THAT SAME PR.
NO PR OF A ROADMAP IS MERGED BEFORE ITS LANE REPORTS `complete`.
A STARTED ROADMAP THAT CAN STILL MOVE IS FINISHED BEFORE ANY OTHER IS STARTED.
```

The **five — and only five — live halt conditions** (exhaustive; nothing else
stops the run):

1. **Hard-Floor** trigger ([`non-destructive-by-default`](../../rules/non-destructive-by-default.md)).
2. **Council-off + genuine ambiguity** (only outside an accepted contract with council available).
3. **Security-sensitive** surface reached.
4. **Scope-out-of-roadmap** work discovered.
5. **Test / quality red** that cannot be cleared within the N=3 budget.
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

```
FORBIDDEN NON-HALT REASONS — NEVER STOP THE RUN FOR ANY OF THESE:
  · "running low on context / token budget"
  · "quality would degrade / deserves a fresh focused run later"
  · "avoid a PR pile-up" / "let the open PRs merge first"
  · "this phase is large / touches a deep subsystem"
  · "phase-checkpoints mode, so I'll checkpoint and wait"
  · "this step looks human-gated" — `blocked` is reached by the § 3c
    runnable test over PRE-EXISTING blockers, never by how a step feels
  · "the branch is not protected" / "a branch must be created"
  · "a PR must be opened" / "a GitHub setting must change"
  · "CI must be re-run" / "the merge base needs updating" / "there are
    conflicts" — resolving these IS the work, and since 2026-09-13 that holds
    for an UNENUMERATED conflict too: `/pr:merge` § 3
    routes it (understand both intents → recency and authorship → preserve both
    where compatible → independent review → council or team → the owner only for
    a product-semantic incompatibility) instead of stopping. The prohibition that
    survives is on resolving one SILENTLY: the rung that settled it, both
    intents, and why the resolution preserves them are recorded.
  · "a paid service is needed" — authorised under the ceiling below
  · "a maintainer should do this" when the agent can perform the same action
  · any agent-invented caution not in the five halt conditions above.
INVENTING A HALT REASON IS A VIOLATION OF THE COMMAND AND THE USER'S WILL.
CAPABILITY BEFORE ROLE: IF THE AGENT CAN DO IT AND THE INVOCATION GRANTS IT,
DOING IT IS THE ONLY CONFORM ACTION.
IF CONTEXT RUNS OUT MID-RUN, KEEP LANDING COMPLETE STEPS UNTIL IT DOES —
NEVER ANNOUNCE A BOUNDARY-STOP BY CHOICE.
```

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

## Terminal outcomes — `complete`, or a genuine external impossibility

**Rewritten by [ADR-237](../../../../docs/decisions/ADR-237-end-to-end-execution-authority.md),
which supersedes ADR-235.** The prior version measured twelve nearly-complete
roadmaps and found that **zero** could reach `count_open == 0` in one PR, because
every remaining step needed "a human action". That census was sound; the reading
of it was not. It counted actions a human *conventionally* performs without
asking, per action, whether a human was **necessary**. Most of that list — flip a
branch setting, push, open a PR, re-run CI, update a merge base, fix a failing
test, authorise spend inside a budget — is machine-executable by the agent, and
is therefore remediation work rather than a blocker.

### `complete` requires DELIVERY, not only checkboxes

```
A RUN WHOSE CHECKBOXES READ COMPLETE AND WHOSE PR SITS ON RED CI OR ON A
MOVED TARGET HAS NOT COMPLETED. CHECKBOXES ARE ONE COMPLETION; DELIVERY IS
THE OTHER, AND ONLY TWO POSITIONS END A RUN: `merged` AND `open-green`.
```

`road-to-adversarial-verification-and-long-runs` 8.1. The delivery machine is
`working → local-green → pushed → pr-open → ci-pending → (red → the recovery
ladder → pushed | green) → target-sync-check → (moved → sync → tests → pushed |
current) → delivery-ready → (grant → merged | no grant → open-green)`.

`run_continuation_hook` read the position the run RECORDED — it did not probe
the forge, because a `gh` call on the stop path is the cost the premise rung
already declined — and any position that was not an ending kept the run engaged
at zero open steps. **That concern was withdrawn on its own pre-registered kill
date (`road-to-what-was-built-and-never-ran` Phase 4), so nothing re-engages a
run automatically any more.** Its termination ladder, `_lib/continuation_ladder.ts`,
was removed on 2026-10-14 by owner decision; what it encoded survives here as
the shape a successor inherits, not as a mechanism in the tree. Two bounds held a
delivery hold, and one was deliberately lifted: the iteration and wall-clock caps
still ended it, while the **stall** rung was skipped, because during delivery the
open-step count it measures cannot move and a metric that cannot move is not a
stall signal.

```
NO CODE HOLDS A RUN ON ITS DELIVERY POSITION. THE MACHINE ABOVE IS THE
CONTRACT THE RUN CARRIES ITSELF, NOT BEHAVIOR YOU WILL OBSERVE.
```

Said in a fence because the surrounding prose reads as a description of live
behavior and an independent review of the change that introduced it read it
exactly that way. The run that owes a delivery ending checks it itself before it
reports `complete`; nothing in the tree reads a recorded position any more.

**`open-green` is a success, not a shortfall.** A run with no merge grant is not
supposed to merge; what it owes is an open PR whose CI is green **on the head CI
actually observed**, and a report that says so.

### The PR body is one page for the owner's review

8.2. The end-of-run PR body carries these six, each as its own named section:

1. **Delivery target reached** — `merged` or `open-green`, and the head SHA CI observed.
2. **Decisions taken, and by whom** — agent, council, team or owner, per decision.
3. **Open owner-owned residue** — what is left that only the owner can settle, or *none*.
4. **Scope delta** — what the run added to or dropped from the roadmap's stated scope.
5. **Spend** — actual against the authorised ceiling.
6. **Fix-loop epochs** — how many strategies were opened, and what ended each.

Six sections because each answers a different question the owner would otherwise
have to ask, and a run that omits one has moved that question back into the
conversation this roadmap exists to end.

| Outcome | When | Success? | terminal state |
|---|---|---|---|
| `complete` | `count_open == 0`, the PR is open, and delivery reached an ending | yes — archival check runs | `success` |
| `blocked` | every remaining open step is **externally impossible** for the agent | **no** — partial progress, labelled as such | `blocked`, or `approval-required` where the work is finished and waiting on a human |
| a halt | one of the five conditions fired | **no** — the halt is reported | `exhausted` when a declared budget ran out; `stagnated` when the same failure signature repeated with budget left |

**The closing report names the terminal state by word**, from
[`terminal-states`](../../contexts/execution/terminal-states.md).
The reason is the failure that vocabulary exists to stop: a run that stopped at
its iteration cap and one that finished both leave the roadmap looking the same,
because the checkbox glyphs cannot express `exhausted`, `stagnated` or
`approval-required` — they collapse into `[ ]` and `[~]`. Three of the six states
are therefore invisible in the dashboard and visible only in the report, which is
why the report has to say the word.

`exhausted` and `stagnated` are **never** reported as `complete`, whatever
partial progress exists, and they are kept apart on purpose: `exhausted` says the
budget may have been too small and raising it is a legitimate response;
`stagnated` says more of the same will not help and raising it is the wrong one.

`blocked-preflight` no longer exists. A run always starts.

**What counts as externally impossible** — the whole list:

- a required credential does not exist and the agent cannot create it;
- a purchase beyond the delegated budget (see § Spend below);
- physical access to hardware;
- another person or organisation must act;
- a wait that is factually mandatory and cannot be simulated or verified.

**What does NOT** — every one of these is work:

an unprotected branch · a branch to create · a PR to open · a repository or
branch setting the agent can change · a workflow to start · CI to re-run · a
merge base to update · conflicts · failing tests · local configuration · a paid
call under the ceiling · "this could be risky" · "a maintainer should do this".

```
`blocked` IS NEVER REPORTED AS COMPLETION. count_open STAYS > 0.
NEVER FLIP A BOX TO [~] TO REACH IT — THAT LAUNDERS OPEN WORK THROUGH A GLYPH.
A PR OPENED ON A BLOCKED RUN SAYS PARTIAL PROGRESS IN ITS FIRST LINE.
BEFORE REPORTING blocked, ASK PER STEP: CAN I DO THIS AT ALL?
ONE STEP THE AGENT COULD HAVE EXECUTED REJECTS THE CLAIM.
```

**It is a terminal outcome, not a halt, and the separation still matters.** The
Iron Law above and its forbidden list keep their full authority over mid-run
stopping: an agent that may not stop for "this phase is large" may equally not
stop for "this step looks human-gated" — and under ADR-237 that phrase is no
longer even a candidate, because the test is capability, not convention.

## Final-PR-only — the UX invariant

```
THE RUN REPORTS ONCE, AT THE END. THE FINAL PR IS THE INTERACTION BOUNDARY.
INTERNAL REMEDIATION IS WORK, NEVER A USER MESSAGE.
NEVER INTERRUPT THE OWNER MID-RUN FOR A DECISION THE INVOCATION ALREADY DELEGATED.
```

A missing setting, a CI re-run, a protection flag, a rebase, a council call: do
them, and say so in the PR body if it matters. The only mid-run interruptions
that remain legitimate are a spend-ceiling crossing and an EXCLUDED-list action
(production trunk, deploy, prod data/infra, an irreversible external action
beyond the PR). One carve-out from "do them": a rebase of a branch that is
already pushed rewrites published history, and still needs the user's answer
this turn per `git-history-discipline` § When rewrite is allowed — the
invocation does not give it, and neither does `git.update_strategy: rebase`,
which picks the operation and never authorises it. Without that answer the
branch is left behind and the PR body says so.

Report shape:

```
PR #<n>
<url>

Roadmap fully implemented. CI <passed>/<total>.
```

or, in the genuine exception:

```
Unable to produce the final PR.
Hard external blocker: <specific reason>
Attempted: <what was tried>
```

## Spend — whatever ceiling was configured, and none when none was

```
READ THE CONFIGURED cost.budgets WINDOWS (daily · weekly · monthly).
spend_so_far + reasonably_expected_remaining  WITHIN EVERY CONFIGURED WINDOW
    → RUN IT, ASK NOTHING
WOULD CROSS A CONFIGURED WINDOW → PAUSE AND REPORT BEFORE CROSSING.
NO WINDOW CONFIGURED → NONE APPLIES. RUN IT, ASK NOTHING.
COST UNKNOWN → CONSERVATIVE ESTIMATE. UNCERTAINTY IS NOT A REASON TO ASK.
SERVICE-ENFORCED LIMITS MAKE A CROSSING IMPOSSIBLE → AUTHORISED.
EXISTING SUBSCRIPTION → MARGINAL COST $0, NOT COUNTED.
NEVER SPLIT SPEND ACROSS SERVICES, SUBAGENTS, COUNCIL ROUNDS OR CALLS
TO KEEP EACH ITEM UNDER A CEILING. A CEILING IS CUMULATIVE, PER RUN.
```

**Who carries this, stated plainly: the model, not a gate.** Nothing on a
roadmap run reads a cumulative spend figure and compares it with anything —
ADR-237 said so of its own ceiling ("Nothing mechanical checks any of this")
and that has not changed. The optional `cost.enforcement: hard-stop` preflight
is a separate, deliberately-invoked control and is not called from a run. So
this block is an obligation the model carries, and a reader should not take it
for an enforced limit.

What used to sit here was a flat per-run USD constant that nobody configured.
ADR-279 replaced it with the windows a person actually set, which is the only
kind of ceiling this package now applies; that record names the old figure, and
this file deliberately does not, so no reader mistakes a historical number for
a live threshold. Set `cost.budgets.daily` / `weekly` / `monthly` to get one.

The transport is not a governance boundary: a council invocation is the same
authorised action whether it runs through the `council` CLI or a direct API call.
There is deliberately **no allowlist** of blessed services — the general rule
(machine-executable · in scope · under the ceiling) already contains every case,
and an allowlist would rot.

## Iron Law — Real-time dashboard

```
EVERY DONE STEP FLIPS [ ] → [x] BEFORE THE LOOP MOVES TO THE NEXT STEP.
DASHBOARD REGENERATES IN THE SAME REPLY THAT FLIPPED THE BOX.
NO BATCH FLIP AT THE ARCHIVE COMMIT. NO "I'LL DO IT AT THE END."
```

`/roadmap:process-full` is the worst offender for batching because it
runs continuously across many steps. Flipping all 13 boxes in the
single archive commit defeats the dashboard's purpose — the user
loses progress visibility for the entire run. Per Iron Law 2 of
[`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md): the
flip + regen pair is atomic with the step's work, executed inside
[`roadmap-process-loop § 5`](../../contexts/execution/roadmap-process-loop.md#5-step-loop)
step 5.

## Rules

- **No silent acceleration past a halt.** Every halt condition stops
  the run; the user resumes on the next turn.
- **No silent stop at an authoring annotation.** Encountering
  "gated on Phase N", "deferred", "optional", or any equivalent
  phase-internal annotation is **not** a halt condition. Continue.
- **No silent batch flip.** Each step's checkbox flips in the same
  reply that lands its work — never deferred to the archive commit.
- **Phase quality pipeline runs at every phase boundary** when cadence
  is `per_phase` or `per_step`. `end_of_roadmap` skips per-phase and
  runs only at the final archival check.
- **No mid-run approval requests.** The invocation delegated them. Only a
  spend-ceiling crossing or an EXCLUDED-list action reaches the owner.
- **No `Class: 3` on an agent-executable action.** Capability before role
  (ADR-237 § 2). A blocker labelled human-only that the agent could have run is
  a defect in the roadmap, and the run fixes the label rather than obeying it.
- All other rules from
  [`process-phase § Rules`](process-phase.md#rules) apply unchanged.

## See also

- [`/roadmap`](../roadmap.md) — cluster orchestrator
- [`/roadmap:process-step`](process-step.md) — single-step variant
- [`/roadmap:process-phase`](process-phase.md) — default scope, single phase
- [`roadmap-process-loop`](../../contexts/execution/roadmap-process-loop.md) — canonical mechanics
- [`ADR-237`](../../../../docs/decisions/ADR-237-end-to-end-execution-authority.md) — the end-to-end delegation contract this command implements
- [`ADR-235`](../../../../docs/decisions/ADR-235-process-full-blocked-terminal-outcome.md) — superseded; kept for the census and the `[~]`-prohibition argument
