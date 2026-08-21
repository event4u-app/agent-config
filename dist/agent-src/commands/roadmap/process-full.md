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
[`command-clusters`](../../../../../docs/contracts/command-clusters.md) says
sibling variants become a flag, and a drain is a count of the thing this
command already does.

1. **Recompute the inventory live.** Never from memory, never from the
   dashboard count — the same live-screen rule
   [`/roadmap:next` § 1](../next/command.md) already carries. The corpus is the
   non-draft roadmaps directly under `agents/roadmaps/`; `later/`, `skipped/`,
   `archive/` and `stubs/` are out of scope.
2. **Order the queue.** Roadmaps at or above 10 % checkbox progress first, in
   **descending** progress — nearly-done first, because they convert soonest.
   Roadmaps below 10 % are appended after, ascending by declared `complexity:`
   tier (lightweight → bounded → structural), tiebreak ascending total
   checkbox count. Both buckets need a **total** order or two runs over the
   same estate disagree: within the first, ties on progress break by ascending
   total checkbox count and then by ascending filename; within the second, by
   ascending filename after the checkbox count.
3. **Loop.** Per roadmap: branch from the updated default, run this command's
   normal single-roadmap loop, deliver per § Delivery, then take the next
   roadmap against the default **as it stands at that moment** — re-fetched,
   never assumed. One roadmap = one branch = one PR, the existing invariant
   iterated, not a new one.

**What `--all` can and cannot promise while `--merge` is gated, stated plainly
because the honest version is weaker than the obvious one.** Nothing in the run
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
[`/pr:merge <N> --no-merge`](../../../git/pr/merge/command.md) on it: sync the
base in, resolve conflicts by that command's four enumerated classes, drive the
required checks green on the pushed head. **This is unconditional** — a bare
`/roadmap:process-full` delivers a mergeable PR, not merely an open one, and
waiting on that remote CI is part of the run per the Iron Law below. It is
stated here rather than under `--merge` because a reader who never passes the
flag still gets it.

### `--merge` — NOT YET ACTIVE: merging is owner-gated

```
`--merge` IS SPECIFIED HERE AND IS NOT ACTIVE. THE RUN STOPS AT
MERGEABLE-AND-OPEN WHETHER OR NOT THE FLAG IS PASSED, AND SAYS SO.
ACTIVATING IT NEEDS THE OWNER DECISION RECORDED IN THE `merge-authority`
BLOCKER OF `road-to-drain-commands` — NOT A COMMAND EDIT.
```

Why it is specified but inert: the canonical loop states "**merge is out of
scope in every mode — always conversational**"
([`roadmap-process-loop § 6`](../../contexts/execution/roadmap-process-loop.md#6-final-report-and-archival)),
and ADR-237 § 4 excludes merging from the invocation grant with the words "no
invocation extends it". A command cannot reinterpret either from below. Three
independent reviews reached the same verdict: the AI council (Q1, 2026-08-21),
the committed `road-to-gate-preauth-authorization` stub, and the runtime guard
that refused the contract edit when this roadmap first attempted it.

When the blocker resolves, `--merge` merges via
[`/pr:merge`](../../../git/pr/merge/command.md)'s merge step, under its
immutable target manifest, its head-SHA check, and its kill-switch list. Until
then the flag is accepted, reported as inert, and changes nothing.

```
AND WHEN IT DOES ACTIVATE: ON OUTCOME `blocked`, `--merge` IS IGNORED.
AN INVARIANT, NOT A DEFAULT — A PARTIAL-PROGRESS PR SAYS SO IN ITS FIRST
LINE (ADR-237) AND IS NEVER AUTO-MERGED, HOWEVER THE RUN WAS INVOKED.
```

**Mergeability is per-PR against a recorded base, never a queue property.**
When every PR in the estate touches the same generated files — in this
repository `agents/roadmaps-progress.md` and
`src/config/estate-count-budget.json` — making PR *n* mergeable against base
SHA `M` says nothing about its state once PR *n−1* advances the base to `M1`.
Report "mergeable against base `<SHA>`", never "the queue is mergeable".

**The design the blocker decides on, stated so the decision is concrete.** The
flag would authorise the merge without *storing* an authorization: it consumes
the per-session ledger entry the user's own prompt text already wrote on
`UserPromptSubmit` — a signal the agent cannot forge — and creates no grant
store. When that window closes with work left, the run stops and reports per
[`/pr:merge` § 7](../../../git/pr/merge/command.md). Widening
`LEDGER_MAX_AGE_MS` is forbidden practice either way.

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
```

The **five — and only five — halt conditions** (exhaustive; nothing else
stops the run):

1. **Hard-Floor** trigger ([`non-destructive-by-default`](../../rules/non-destructive-by-default.md)).
2. **Council-off + genuine ambiguity** (only outside an accepted contract with council available).
3. **Security-sensitive** surface reached.
4. **Scope-out-of-roadmap** work discovered.
5. **Test / quality red** that cannot be cleared within the N=3 budget.

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

**And the conditions that end the loop without ending a roadmap:**
estate-queue exhaustion (always), a
[`/pr:merge` § 8](../../../git/pr/merge/command.md) kill switch (always), and
authorization-window expiry — which is **unreachable while `--merge` is
gated**, because the run then performs no `BLOCK_OPS` operation for the
window to govern. Three conditions, one of them currently inert, and this
table is the only place the set is stated.

Nothing here widens a run without `--all`: it still has exactly the five
above, all of them ending the run because there is no loop to continue.

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
    conflicts" — resolving these IS the work. The one exception, and it is a
    kill switch rather than a halt reason: a conflict **outside** the four
    enumerated classes of [`/pr:merge` § 3](../../../git/pr/merge/command.md)
    stops the delivery loop, because that is a case nobody has decided yet and
    deciding it silently is how work disappears. An enumerated conflict is
    never a stop.
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

| Outcome | When | Success? |
|---|---|---|
| `complete` | `count_open == 0` and the PR is open | yes — archival check runs |
| `blocked` | every remaining open step is **externally impossible** for the agent | **no** — partial progress, labelled as such |
| a halt | one of the five conditions fired | **no** — the halt is reported |

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
beyond the PR).

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

## Spend — USD 25 per run, pre-authorised

```
cost_so_far + reasonably_expected_remaining  ≤  $25  → RUN IT, ASK NOTHING
cost_so_far + reasonably_expected_remaining  >  $25  → OWNER APPROVAL BEFORE CROSSING
COST UNKNOWN → CONSERVATIVE ESTIMATE. UNCERTAINTY IS NOT A REASON TO ASK.
SERVICE-ENFORCED LIMITS MAKE >$25 IMPOSSIBLE → AUTHORISED.
EXISTING SUBSCRIPTION → MARGINAL COST $0, NOT COUNTED.
NEVER SPLIT SPEND ACROSS SERVICES, SUBAGENTS, COUNCIL ROUNDS OR CALLS
TO KEEP EACH ITEM UNDER THE CEILING. THE CEILING IS CUMULATIVE, PER RUN.
```

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
