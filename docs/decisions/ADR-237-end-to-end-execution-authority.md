---
adr: 237
status: accepted
date: 2026-08-20
decision: end-to-end-execution-authority
supersedes: ADR-235
superseded_by: —
phase: —
type: structural
review_trigger: >-
  Reopen on any of four observations, none of them a calendar. First — a run
  crosses the USD 25 ceiling without asking, or asks below it, since the first is
  the ceiling failing and the second is the uncertainty-is-not-a-reason clause
  failing. Second — an agent reports a repository-local prerequisite (a branch, a
  push, a PR, a setting, a CI re-run, a merge base, a failing test) as a blocker,
  since that is the exact class this record moves out of the blocker set. Third —
  the owner is interrupted mid-run for anything other than a ceiling crossing or
  a genuine external impossibility, since final-PR-only is the UX invariant this
  record exists to establish. Fourth — a `Class: 3` label is authored on an action
  the agent could have executed itself, since capability-before-role is the
  substantive change to the taxonomy and a mislabel silently restores the old
  behaviour.
---

# ADR-237 — `/roadmap:process-full` is an end-to-end delegation: the final PR is the interaction boundary

## Status

**Accepted** · 2026-08-20. **Supersedes [ADR-235](ADR-235-process-full-blocked-terminal-outcome.md)**,
which gave `process-full` a `blocked` terminal outcome and a `blocked-preflight`
refusal. Not a refutation of its reasoning — a change to the operating model its
reasoning was correct *about*. See § What ADR-235 got right.

## Context

ADR-235 solved a real contradiction. `process-full` promised to work every open
step to completion; measured 2026-08-19 across the twelve most nearly complete
roadmaps, **zero** could reach `count_open == 0` in one PR, because every
remaining step needed "a human action". The command could therefore be neither
obeyed nor honestly declined, and ADR-235 gave the decline a legal name.

The operator's decision, 2026-08-20, in their own framing: **when a
`process-full` run happens, the only thing they want to see is the final PR.**
Branch creation, pushing, PR opening, repository and branch settings, CI runs,
paid tool and council invocations are implementation details of the run — not
reasons to hand the work back. Branch protection is explicitly not treated as a
critical gate here. Paid services are permitted, with a spend ceiling instead of
a per-action question.

That reframes what ADR-235 measured. Its census counted "human actions", but it
did not ask, per action, **whether a human was actually necessary or merely
conventional.** Re-read against the operator's model, most of that list is
machine-executable by the agent: flipping a branch setting, pushing, opening a
PR, re-running CI, updating a merge base, fixing a failing test, authorising
spend inside a delegated budget. What remains genuinely external is a much
shorter list.

So the defect is not that `blocked` exists. It is that **`blocked` was reachable
from things the agent can do**, which turns an honest terminal outcome into a
comfortable one — the failure ADR-235's own forbidden-reasons list was built to
prevent, arriving through the door that record opened.

## Decision

Four changes. The fourth is what keeps the first three from being re-closed
elsewhere.

### 1. The invocation is the grant

`/roadmap:process-full <roadmap>` means:

> You have the authority to perform every machine-executable, repository-scoped
> action required to implement this roadmap as far as technically possible and
> deliver the finished PR.

Concretely pre-authorised for the run, without a further ask: creating and
switching branches · committing in chunks · pushing that branch · opening,
updating and re-titling the PR · changing repository or branch settings the
agent can change and that are reversible · starting, re-running and fixing CI ·
updating the merge base and resolving conflicts · installing project-local
dependencies · invoking any tool, CLI, API, model, council or external service
the work needs, inside the spend ceiling below.

**This satisfies the Hard Floor rather than bypassing it.**
[`non-destructive-by-default`](../../src/rules/non-destructive-by-default.md)
requires explicit user confirmation *on this turn* and excludes a *standing
autonomy directive*. A `process-full` invocation is neither a previous turn nor a
standing directive: it is a single, explicit, this-turn delegation naming one
concrete deliverable, which is exactly the shape the Hard Floor asks for. The
confirmation is the invocation.

**What the grant does NOT cover, and no invocation extends it:** merging to a
production trunk · deploying or releasing · production data, secrets rotation,
IAM, DNS · bulk deletion outside the roadmap's own scope · any irreversible
external action (send, publish, post, purchase, submit) beyond the PR itself.
Those keep their own this-turn confirmation.

### 2. Capability before role

```
CAN the agent technically do it?  →  YES
Is the authority already implied by the invocation?  →  YES
                    ↓
                  RUN IT
```

A blocker is legitimate only when the action is **technically impossible for the
agent** or **explicitly outside the delegated authority**. "A maintainer should
click this" is not a blocker when the agent can perform the same action through
git, `gh`, an API, or a CLI. "This might be risky" is not a blocker. The role of
the person who conventionally does a thing is not a property of the thing.

The blocker class taxonomy is amended accordingly: `Class: 3` (human-only) means
*a human is the content of this gate*, never *a human usually does this*.
Authoring `3` on an agent-executable action is a defect, and the review trigger
above names it.

### 3. Spend: USD 25 per run, pre-authorised, cumulative

```
cost_so_far + reasonably_expected_remaining  ≤  $25   → authorised, no ask
cost_so_far + reasonably_expected_remaining  >  $25   → owner approval BEFORE crossing
cost cannot be determined exactly                      → conservative estimate; ASK NOTHING
service enforces limits making >$25 impossible         → authorised
marginal cost of an existing subscription = $0          → not counted against the ceiling
```

Four properties are load-bearing:

- **Per run, cumulatively** — not per action. Twenty $20 actions is $400, not
  twenty authorised decisions. Splitting spend across services, subagents,
  council rounds or API calls to keep each item under the ceiling is a violation
  of this record, not a reading of it.
- **Uncertainty is not a reason to ask.** "Cost unknown → better ask" is the
  behaviour this clause exists to remove. Estimate conservatively and proceed.
- **The transport is not a governance boundary.** A council invocation is a
  council invocation whether it runs through the `council` CLI or the agent calls
  the API directly. No allowlist of blessed services — an allowlist rots, and the
  general rule already contains every case.
- **Marginal, not notional.** A flat-rate subscription already paid contributes
  $0. Only variable cost this run causes counts.

### 4. `blocked` narrows to genuine external impossibility

`blocked-preflight` is **removed**: a run no longer refuses to start because its
open steps look human-gated. `blocked` survives only for what the agent cannot
do at all:

- a required credential does not exist and the agent cannot create it;
- a purchase outside the delegated budget;
- physical access to hardware;
- another person or organisation must act;
- a wait that is factually mandatory and cannot be simulated or verified.

Not blockers: an unprotected branch · a branch that must be created · a PR that
must be opened · a repository setting the agent can change · a workflow to start
· CI to re-run · a merge base to update · conflicts · failing tests · local
configuration · "this could be risky" · "a maintainer should do this".

**Final-PR-only is a UX invariant, not a style preference.** Internal remediation
— a missing setting, a CI re-run, a protection flag, a rebase — is work, not a
user message. The run reports once, at the end:

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

Not five intermediate stops.

## Consequences

**What this buys.** The command means what it says. A delegation that previously
terminated against its own governance now terminates against reality, and the
owner's attention is spent once, on the artefact, instead of on a sequence of
micro-approvals they had already implicitly granted by invoking the run.

**What it costs.** The safety margin ADR-235 bought is genuinely reduced: an
agent with push, PR, settings and spend authority can do more damage per run than
one that stopped at every gate. Three things bound it — the excluded list in § 1
(production trunk, deploy, prod data, irreversible external actions) keeps its
own confirmation; the spend ceiling is a hard number rather than a judgement; and
a PR is by construction reviewable before it merges. The reviewable-PR property
is what makes the rest tolerable, and it is why merging stays outside the grant.

**The abuse vector moved rather than disappeared.** ADR-235's vector was an agent
inventing a Class-3 blocker to stop early; the defence was the pre-dating
condition. This record's vector is the opposite: an agent that keeps going past
the point where it should have asked — crossing the ceiling, or touching an
excluded action under cover of "the roadmap needed it". The defences are the
excluded list being enumerated rather than characterised, the ceiling being
cumulative rather than per-action, and the review trigger naming an
uninterrupted run that crossed $25 as a reportable defect.

**Enforcement, stated honestly.** Nothing mechanical checks any of this.
No gate reads a run's cumulative spend, no gate can tell a legitimate remediation
from an over-reach, and no validator inspects a chat report for a fabricated
external blocker. `lint_roadmap_blockers` validates blocker *shape* and cannot
see whether a `Class: 3` label is honest. So the grant, the ceiling and the
narrowed blocker set are all **model-carried** — the same boundary
`active-remediation`, `ui-audit-gate` and ADR-235 itself state for their own
obligations. What is deterministic remains deterministic: the PR is a real
artefact, its diff is reviewable, and a commit's arrival is checkable from git.

**What ADR-235 got right, and what is kept.** Its census was sound and its core
insight — that a command with no legal ending is a command that can be neither
obeyed nor declined — is why this record exists rather than simply deleting
`blocked`. Three of its properties survive unchanged: `blocked` is **never**
reported as completion; `count_open` stays above zero when work remains; and a
blocked step is **never** laundered to `[~]` to reach a clean count. Its
`[~]`-prohibition argument was correct and is untouched.

**One imprecision inherited and now resolved.** ADR-235 recorded that the class
taxonomy has no row for "waiting on time" or "waiting on another roadmap", so
both were authored as `3` and mislabelled as human-only. Under § 4 a wait is a
blocker only when it is *factually mandatory and unverifiable*; a soak window a
run can simply outlast, or a cross-roadmap dependency the run can satisfy itself,
is remediation. The taxonomy still lacks the row; the mislabel now has a stated
test instead of a default.

## Alternatives

**Patch ADR-235 in place.** Rejected. The change is to the operating model its
decision rests on, not to a clause within it — three of its four numbered
decisions invert. A patched record would read as if `blocked-preflight` were
merely narrowed, when it is gone.

**Keep `blocked-preflight`, narrow `blocked` only.** Rejected: the refusal fires
*before* any work, on exactly the reading of "human-gated" this record rejects,
so it is the half that contradicts the operator's model most directly.

**Enumerate the permitted paid services (council, specific APIs).** Rejected on
the operator's own reasoning: an allowlist rots, and the general rule —
machine-executable, in scope, under the ceiling — already contains every case
without naming any.

**A per-action spend ceiling instead of per-run.** Rejected: it is trivially
gamed by splitting, and the split is invisible in any single decision.

## References

- [ADR-235](ADR-235-process-full-blocked-terminal-outcome.md) — superseded by this record.
- [`/roadmap:process-full`](../../src/domains/product-basic/roadmap/process-full/command.md) — the command whose contract this defines.
- [`roadmap-process-loop`](../../src/agent-src/contexts/execution/roadmap-process-loop.md) — § 3c and § Terminal outcomes carry the mechanics.
- [`templates/roadmaps.md`](../../src/agent-src/templates/roadmaps.md) — the blocker class taxonomy amended by § 2.
- [`non-destructive-by-default`](../../src/rules/non-destructive-by-default.md) — the Hard Floor § 1 satisfies rather than bypasses, and whose excluded list stays intact.
- [`scope-control`](../../src/rules/scope-control.md), [`commit-policy`](../../src/rules/commit-policy.md) — the permission gates a `process-full` invocation pre-clears for its own run.
