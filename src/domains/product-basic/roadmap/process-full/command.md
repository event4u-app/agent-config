---
model_tier: medium
name: roadmap-process-full
pack: product-basic
visibility: internal
cluster: roadmap
sub: process-full
skills: [agent-docs-writing, ai-council, roadmap-management]
description: Autonomously process every open step across every phase of a roadmap until the file is fully closed. Largest execution scope of the /roadmap cluster — runs continuously across phase boundaries.
argument-hint: "[roadmap]"
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

## Iron Law — Full is Full

```
/roadmap:process-full IS LAW: IT PROCESSES EVERY OPEN STEP IN THE FILE,
TO COMPLETION, ACROSS EVERY PHASE. ONLY THE FIVE HALT CONDITIONS STOP IT.
PHASE-INTERNAL "(DEFERRED)" / "(OPTIONAL)" / "GATED ON PHASE X" NOTES DO
NOT NARROW THE WORKING SET. A PHASE BOUNDARY IS NOT A STOP.
```

The **five — and only five — halt conditions** (exhaustive; nothing else
stops the run):

1. **Hard-Floor** trigger ([`non-destructive-by-default`](../../rules/non-destructive-by-default.md)).
2. **Council-off + genuine ambiguity** (only outside an accepted contract with council available).
3. **Security-sensitive** surface reached.
4. **Scope-out-of-roadmap** work discovered.
5. **Test / quality red** that cannot be cleared within the N=3 budget.

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
  · "CI must be re-run" / "the merge base needs updating" / "there are conflicts"
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
