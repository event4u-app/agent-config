# Roadmap-Process Loop — Branches (set)

Branch-only body of [`roadmap-process-loop`](roadmap-process-loop.md), moved
out verbatim so the core stays a single read. Each section below is loaded
from the pointer line the core carries at the moved section's place, and only
when a run reaches that branch; the Iron-Law fences stay in the core.

### Ask before park — a user decision is put to the user, then parked

`terminal-states.md` defines `blocked` to include "a decision only the user can
make", and the marker below used to be written with no ask in between — so the
decision ended up filed, correctly labelled, in a file nobody is watching. The
ordering is the fix, not the label.

- **Interactive host** — put the question, one at a time, per
  [`ask-when-uncertain`](../../rules/ask-when-uncertain.md). An answer ends the
  block and nothing is parked.
- **The user declines to decide** — park with `| asked: yes`. The question WAS
  put; the decline is why the step stays blocked.
- **The ask times out** — the run ends `approval-required` (a state
  `terminal-states.md` already defines), carrying the unanswered question
  verbatim and its conservative option named as **not adopted**. Asked-and-
  unanswered is not could-not-ask, so the marker still records `asked: yes`.
- **Non-interactive context** (CI, a pipe, a hook, a headless run) — park with
  `| asked: no — <reason>`. The reason is required: without it a later reader
  cannot tell a declined decision from one that was never offered.

The decision itself is `src/scripts/_lib/blocked_by_marker.ts` (`decideAsk`),
so the ordering is testable rather than only described; `lint_roadmap_blockers`
fails a user-decision annotation carrying no `asked:` field, and one saying
`asked: no` with no reason.

**A step this screen judges externally impossible carries a `blocked-by:` marker
on its own line.** The obligation is unchanged; its reason has CHANGED, and the
change is recorded rather than smoothed over. It used to be a runtime one:
`run-continuation`, the stop-slot concern that re-engaged an autonomous run,
decided open-vs-blocked from the inline
`<!-- blocked-by: <id> [| asked: yes|no — <reason>] -->` marker and never parsed
`## Blockers`, so a missing marker made an impossible step read as open work and
re-engaged the agent into it every stop fire until the stall rung fired. That
concern was withdrawn on its own pre-registered kill date
(`road-to-what-was-built-and-never-ran` Phase 4), so **no mechanism now changes
its behavior on this marker.** What survives is `lint_roadmap_blockers`, which
validates every marker — its id must resolve to a declared blocker, and an
`asked: no` must carry a reason — and the reader of the roadmap, for whom an
impossible step that looks open is the same lie it always was. The paragraph
below describes what the withdrawn mechanism did, kept because a successor would
inherit the same problem:
a stall manufacturing one. **The residual is real and is not papered over:**
nothing enforces the pairing, so a `## Blockers` entry authored without its
marker is caught by review or not at all.

**The gaming vector inverted, and both directions are now named.** Under ADR-235
the vector was an agent writing itself a Class-3 blocker to stop early; the
defence was that a qualifying blocker must **pre-date the run**, checkable from
git. That defence is kept for the narrow blocker set that remains. ADR-237 adds
the opposite vector — an agent that keeps going past a spend ceiling or into an
EXCLUDED action under cover of "the roadmap needed it" — and its defences are
step 3 above being an enumerated list rather than a characterisation, and the
ceiling being cumulative per run rather than per action.

**One imprecision, inherited and now given a test.** The class taxonomy has no
row for *"waiting on time"* or *"waiting on another roadmap"*; both are authored
as `3` today because an absent `Class:` already means `3`. Under step 4 a wait is
a blocker only when it is factually mandatory and unverifiable — a soak window a
run can simply outlast, or a cross-roadmap dependency the run can satisfy itself,
is work. The taxonomy still lacks the row; the mislabel now has a stated test
instead of a default.

### 3d. Set contract — one contract over an enumerated set

A **set contract** is the ordinary contract screen rendered over a closed,
ordered list of roadmaps instead of one. It grants
[`autonomy-mechanics § Task-scope`](autonomy-mechanics.md)'s **set-scoped**
shape, whose four conditions (enumerated before Accept · closed · ordered with
independence declared · one Accept) are the authorization contract — this
section is only the loop's side of it.

**What the screen must print, per member.** Roadmap path, derived branch name,
open-step count, artifact count from the pre-scan, and its dependency edges.
One decision sheet spans the whole set: a question that applies to several
members appears once, and its answer applies to all of them.

**Dependency edges come from two sources, unioned.**

| Source | Shape | Trust |
|---|---|---|
| Declared | `depends:` in the dependent roadmap's frontmatter — a list of roadmap slugs | authoritative; a declared edge is never overridden by the heuristic |
| Inferred | **file overlap**: the intersection of the owned-path sets the two pre-scans derived | advisory; an inferred edge orders the members and marks them non-parallelizable, and is printed as inferred so the user can see why |

The union feeds exactly two decisions and nothing else: **ordering** (a
dependent member runs after its parent) and **parallelizability** (only members
with no edge between them and disjoint owned paths are lane candidates). An
inferred edge is deliberately allowed to be wrong in the conservative
direction — a false edge costs serial execution, a missed edge costs a
collision, so overlap resolves toward *serial*.

#### Auto-continuity — the next member needs no new contact

Under an accepted set contract, when a member closes **green** the loop pulls
the next member whose dependencies are all satisfied and starts it without a
new contact. Green means: its own final report ran, its quality cadence passed,
and no halt class fired. Anything else is not green and does not continue —
see failure isolation below.

The default stays **this one only**: auto-continuity applies to
`/roadmap:next` and to any wrapper reaching this section **only when the set
option was chosen on the sheet**. A single-roadmap invocation is never widened
into a set because more roadmaps happened to be open, which is condition 4 of
the set-scoped shape read from the loop's side.

#### Failure isolation — a regression halts its own member, not the set

A quality regression, a failed verify probe, or a halt class firing inside one
member terminates **that member** and leaves the rest of the set running:

1. Record the member's outcome as halted, with the halt class and the evidence.
2. Skip every member that declares a dependency on it — transitively. A
   dependent member of a halted parent is *blocked*, not failed, and is
   reported as such.
3. Continue with the next independent member.
4. Report every member's outcome in one final report at the end of the set.

Two carve-outs, and they are the reason this is isolation rather than
tolerance. A **Hard-Floor** stop and a **locked decision class** stop the whole
set, not one member: both are about the user's authority rather than about the
member's code, and continuing past them under a set contract would be exactly
the "several authorizations from one Accept" failure the enumeration guards
against. Likewise the **N=3 validation budget** is per validation target and is
not reset by moving to the next member.

#### Parallel lanes — shipped under the canonical brief

Lanes are **shipped**, on the owner's decision of 2026-10-19. They were staged
behind ten clean serial set runs; that gate was overtaken in practice — 285 lane
runs happened outside it between 2026-10-01 and 10-19, under briefs each
orchestrator improvised, and 17 of 207 drain lanes reached `count_open == 0`.
What ships is not those runs but the contract that replaces them: the canonical
brief in `/roadmap:process-full` § Lanes, the finish-first order of
`roadmap_drain_queue`, and the cap below. (The AI council was asked; only one
seat could answer, it favoured keeping lanes staged, and without convergence the
decision went to the owner.)

**Provisional, and on a dated re-decision.** A later two-seat round read the
change as inside `road-to-agent-throughput-recovery` AC-3, which held lane
changes until that roadmap's Phase 2 verdict. The owner's decision stands as a
recorded exception to that hold (D10 there), not a lifting of it: step 2.3 of
that roadmap compares two-lane against one-lane drains on cost, rate-limit
pauses, conflicts, follow-up fixes and roadmaps archived, and a negative or
split result goes back to the council. Until then the cap stays at two and is
never raised. The shape:

- **Cap: two lanes** in the first iteration — a recorded decision
  (`decision 2026-08-20`, AI council 2/2 on the `autonomy-defaults-sheet`
  fork), chosen over the configured `subagents.max_parallel` because a
  collision at two lanes is diagnosable and one at N is not. Reversible: the
  cap is one number in the set contract, and raising it after the first ten
  clean parallel runs is strictly cheaper than recovering from a lost branch.
- **Candidate test:** no dependency edge in either direction, and disjoint
  owned paths.
- **Isolation:** the existing worktree scope lock
  ([`worktree-lifecycle`](../../skills/worktree-lifecycle/SKILL.md)).
- **Coordination:** session-register roadmap claims (`sessions:claim`), read by
  `roadmap_drain_queue`, so two sessions never take the same roadmap.
- **Delivery:** one branch and one PR per lane, opened only when its roadmap's
  last step is done.
- **Immediate removal:** a single scope-lock collision with data loss.
- **Refusal report:** every lane report carries the fixed field
  `classifier_refusals` (an empty list when none) — a report without it is
  malformed, never "clean". At drain end the orchestrator batches every lane's
  field into ONE envelope (§ Host-classifier refusals).

## 4. Resolve cadences — read once, cache for the run

**Dashboard regen cadence** — fixed, not a setting (the
`roadmap.dashboard_regen_cadence` key was retired on 2026-10-09 with its
default as the behavior): `./agent-config roadmap:progress` runs every
5th closed step, at every phase boundary and at reply end.

`process-step` always regens at step end. Any file-shape touch (rename / phase add / archive — Iron Law 1
of [`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md))
forces an immediate regen regardless of cadence. The checkbox flip
itself is **never** batchable — only the subprocess.

### Context refresh — a comparison, not a third cadence key

There is **no `roadmap.context_refresh_cadence` setting**, deliberately. The
refresh trigger is derived:

```bash
agent-config roadmap:context --fingerprint   # cheap: one rev-parse + one gh call
```

At every phase boundary (and at run end), take the fingerprint and compare it
with the one § 1's probe returned. **Differs → re-probe in full** and apply the
reaction table in § 5e. **Same → nothing moved; continue without paying for a
probe.** Cache the new value as the run's baseline either way.

The fingerprint covers `origin/main` **and the head SHA of every open PR**. The
second half is the case a `main`-only trigger misses: a peer pushing to their own
PR branch mid-run can add a file that now overlaps this run's owned paths while
`origin/main` has not moved at all.

Why a comparison and not a knob: `docs/contracts/settings-classes.md` classifies
a fixed-beat flag as `derivable` — "the mechanism itself can decide, from the
situation, better than a flag can" — behind a ratchet whose count may only fall.
A cadence enum was implemented, refused by `lint_settings_classes`, and replaced
by this; the full reasoning, the options rejected, and what the substitution costs
are in `agents/evidence/analysis/situational-awareness-cadence-key-decision.md`.
Turning the refresh off is a one-line revert of this subsection, which is the same
reversibility a `cadence: off` value would have bought.
