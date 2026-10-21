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

**`--all`, lanes, gated residue** — read [`process-full-all`](../../contexts/execution/process-full-all.md#--all--the-estate-one-roadmap-at-a-time).

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

**Six layers** — read [`process-full-delivery`](../../contexts/execution/process-full-delivery.md#the-six-required-layers-in-order-each-with-the-command-that-runs-it).

```
CI REJECTS: A SKIPPED OR DISABLED REQUIRED CHECK · UNRESOLVED GENERATED DRIFT ·
POLICY-PROJECTION DRIFT · A STALE-HEAD MERGE · A CONFLICT RESOLUTION THAT WAS
NOT REVALIDATED.
CI NEVER REQUIRES A HUMAN APPROVAL MERELY BECAUSE A CHANGE IS LARGE.
```

### `--merge` — merging, on the owner's word only (ADR-282)

```
THIS COMMAND MERGES ONLY ON AN EXPLICIT OWNER AUTO-MERGE INSTRUCTION:
`--merge`, OR THE OWNER'S OWN WORDS IN THE SESSION THAT RUNS THE WORK.
WITHOUT ONE, THE RUN ENDS AT MERGEABLE-AND-OPEN, AND SAYS SO.
A `needs-council` PR MERGES ONLY ON TWO CONVERGENT CLEARING SEATS;
DANGEROUS, SPLIT, DEGRADED OR UNAVAILABLE → THE OWNER DECIDES.
A `needs-owner` PR IS NEVER SENT FOR CLEARANCE — THE OWNER DECIDES.
```

**`--merge`** — read [`process-full-delivery`](../../contexts/execution/process-full-delivery.md#--merge--merging-on-the-owners-word-only-adr-282).

### Ceremony depth — the row each ceremony here reads

`src/config/step-depth-table.json` holds one depth per change class
(`classify_change_risk`, raise-only). Its `mode` is `shadow`: every ceremony
below runs at full depth, and `step_receipt` records what the class's row
would have skipped. Lowering depth is the owner's call, never this run's.

| Ceremony in this run | Table row |
|---|---|
| completion review before the PR | `review` |
| council on an open question (loop § 5 step 4) | `council` |
| evidence artifacts and the PR body | `evidence` |
| context refresh / re-validation of the plan (loop § 5e) | `revalidation` |

**`--worktree`** — read [`process-full-all`](../../contexts/execution/process-full-all.md#--worktree--isolate-the-workspace).

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

**Halt 6, `--all` halts** — read [`process-full-all`](../../contexts/execution/process-full-all.md#full-is-full--halt-detail).

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

## Terminal outcomes — `complete`, or a genuine external impossibility

**Delivery, PR body, outcomes** — read [`process-full-delivery`](../../contexts/execution/process-full-delivery.md#terminal-outcomes--complete-or-a-genuine-external-impossibility).

```
`blocked` IS NEVER REPORTED AS COMPLETION. count_open STAYS > 0.
NEVER FLIP A BOX TO [~] TO REACH IT — THAT LAUNDERS OPEN WORK THROUGH A GLYPH.
A PR OPENED ON A BLOCKED RUN SAYS PARTIAL PROGRESS IN ITS FIRST LINE.
BEFORE REPORTING blocked, ASK PER STEP: CAN I DO THIS AT ALL?
ONE STEP THE AGENT COULD HAVE EXECUTED REJECTS THE CLAIM.
```

### `complete` requires DELIVERY, not only checkboxes

```
A RUN WHOSE CHECKBOXES READ COMPLETE AND WHOSE PR SITS ON RED CI OR ON A
MOVED TARGET HAS NOT COMPLETED. CHECKBOXES ARE ONE COMPLETION; DELIVERY IS
THE OTHER, AND ONLY TWO POSITIONS END A RUN: `merged` AND `open-green`.
```

```
NO CODE HOLDS A RUN ON ITS DELIVERY POSITION. THE MACHINE ABOVE IS THE
CONTRACT THE RUN CARRIES ITSELF, NOT BEHAVIOR YOU WILL OBSERVE.
```

## Final-PR-only — the UX invariant

```
THE RUN REPORTS ONCE, AT THE END. THE FINAL PR IS THE INTERACTION BOUNDARY.
INTERNAL REMEDIATION IS WORK, NEVER A USER MESSAGE.
NEVER INTERRUPT THE OWNER MID-RUN FOR A DECISION THE INVOCATION ALREADY DELEGATED.
```

**Report shape** — read [`process-full-delivery`](../../contexts/execution/process-full-delivery.md#final-pr-only--the-ux-invariant).

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

**Spend** — read [`process-full-delivery`](../../contexts/execution/process-full-delivery.md#spend--whatever-ceiling-was-configured-and-none-when-none-was).

## Iron Law — Real-time dashboard

```
EVERY DONE STEP FLIPS [ ] → [x] BEFORE THE LOOP MOVES TO THE NEXT STEP.
DASHBOARD REGENERATES IN THE SAME REPLY THAT FLIPPED THE BOX.
NO BATCH FLIP AT THE ARCHIVE COMMIT. NO "I'LL DO IT AT THE END."
```

**Rationale** — read [`process-full-delivery`](../../contexts/execution/process-full-delivery.md#real-time-dashboard).

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
