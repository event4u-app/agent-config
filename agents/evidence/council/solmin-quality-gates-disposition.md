# Council decision — the quality-gates criterion of `road-to-solution-minimalism`

<!-- evidence-type: analysis -->

Session: 2026-08-21. Members: anthropic (claude-sonnet-4-5), openai
(codex-default). Quorum 2/2, threshold 1, status `concluded`. Rounds: 1 (a
decision request, deliberately not a debate). Actual cost $0.0213.

## Why this file exists

The autonomous drain run of 2026-08-20 routes every decision that would otherwise
go to the user to the AI council instead. `road-to-solution-minimalism` ended
that run with exactly one open item — an acceptance criterion the prior pass
declined to close — and closing it is a judgement about what evidence the
criterion demands. That is a user-reserved call under normal operation, so it
came here. This file is the record the roadmap's own closure cites.

Framework: [`drain-blocker-dispositions-a`](drain-blocker-dispositions-a.md) and
[`-b`](drain-blocker-dispositions-b.md) — five dispositions (A re-scope,
B transfer, C accept-null, D decide-now, E abandon) and four outcome states
(`satisfied`, `narrowed`, `transferred`, `abandoned`).

## What was NOT asked

Three things shipped in PR #1480 (merged 2026-08-20T20:33:44Z) and were declared
settled in the question header: the removal of the `phase3-harness-deltas-9-10`
blocker as a misclassification, the delta-9 split that closed Phase 3 *Repo* and
*Reproducibility* in the parent, and the transfer of the ~30 oracles and the
full-tier run to
[`stubs/road-to-solution-minimalism-full-tier-run.md`](../../roadmaps/stubs/road-to-solution-minimalism-full-tier-run.md).
The council was told to build on them, not re-decide them, and did.

## The question

Which disposition does this item take:

> - [ ] All quality gates pass — see `quality-tools`.

against three candidates — **1** decide-now / `satisfied`; **2** re-scope /
`narrowed` to the gate set that can actually be asserted; **3** park the parent
in `later/` behind a credential probe.

Six facts were supplied and each was verified in-tree or live before the ask, not
asserted: the criterion is declared not-benchmark-gated by **both** the parent
and the stub; the authority it delegates to names remote CI as *the* gate
(`src/skills/quality-tools/SKILL.md:31`); PR #1480 reported **43 SUCCESS, 0
failure, 2 conditional SKIPPED** and its merge commit `b593d8c0` reported **7/7
push-to-main runs success**; the local battery is green on today's trunk; the
file's only blocker already reads `Status: resolved`; and all three model
credentials are unset in this environment.

## Round 1 verdict — 1, `satisfied`. Both seats, convergent. (Superseded by Round 2.)

Both seats reached the same disposition independently (blind map: Response-A =
openai, Response-B = anthropic) and on the same primary ground — **the note's
stated obstacle was the literal absence of a pull request, and that sentence is
now false.** anthropic: *"PR #1480 exists, carried this roadmap's tree, and
passed 43/43 CI checks plus all 7 push-to-main workflow runs on the merge
commit."* Both then cite the criterion's own delegation: it says *see
`quality-tools`*, and that skill's Iron Law says remote CI is the authoritative
gate. That gate ran and reported zero failures.

Neither seat treated the benchmark as relevant, because both sides of the tree
say it is not: the stub explicitly declines to carry this criterion.

## The constraint the verdict carries — and it is binding, not advisory

The council did **not** accept the one-commit gap unconditionally. openai named
the condition and it is the load-bearing half of this decision:

> The hardest architectural pushback is treating CI from one tree as authority
> for another. I accept it here only because the delta is non-functional and the
> closing PR must independently pass; **any generated artifacts, configuration,
> dependencies, or executable code in that commit would invalidate disposition
> 1.**

So the closure is valid only for a bookkeeping-only diff. Read literally
("generated artifacts"), the constraint would also forbid the dashboard
regeneration that [`roadmap-progress-sync`](../../../src/rules/roadmap-progress-sync.md)
mandates in the same change as any checkbox flip — two obligations that cannot
both be honoured. The reading applied at that point was the one the seat's own
sentence gives as its reason: *"the delta is non-functional."*

**That reading was then tested and did not survive, which is why § Round 2 exists
below.** The closing diff turned out to contain `src/config/estate-count-budget.json`
— literally "configuration" — so rather than stretch the constraint a second time
by analogy, the scope question went back to the council. It came back as a
**split**, then a debate round converged on **disposition 2**. The paragraph
above is kept as written because it records what was believed when the first
closure was drafted, and the correction is more legible next to it than in place
of it.

anthropic required the same split in the closing note, and its second half is a
prediction worth keeping as a falsifier: *"The closing PR's bookkeeping diff gets
its own CI run; if that reveals an issue, the roadmap stays in `main` but
unarchived."*

## Closure text the council required

Both seats required the evidence to be stated as a **split** — the substantive
tree and the bookkeeping commit evidenced separately, never merged into one
claim. The wording that shipped at the criterion is derived from anthropic's
draft plus openai's split requirement.

## What this decision does not do

It does not make Phase 3 report. The full-tier run stays transferred with its
producer and probe, both halves of the probe still false (1 pinned task, no
report). A `satisfied` on the quality-gates criterion is a statement about the
gates, and the roadmap's § Outcome continues to say so next to the percentage.


## Round 2 — the constraint met the actual diff, and the disposition moved to 2

**Why there was a second round at all.** The closing diff could not avoid
`src/config/estate-count-budget.json`: archiving the roadmap made the measured
active estate 23 under a ceiling of 24, and `check_estate_count` **hard-fails** on
an un-walked tightening. So the only available diffs were one containing a
configuration edit, one that reds CI, or one that refuses an archival
[`roadmap-progress-sync`](../../../src/rules/roadmap-progress-sync.md) requires.
Round 1's condition excluded configuration by name. Deciding that collision by
analogy would have been the second unilateral stretch of someone else's
constraint, so it was asked instead.

**Round 2a — a 1–1 split, which is an escalation condition, not a verdict.**
anthropic chose 1 (*"gate bookkeeping that tracks measured state and only affects
the gate's own future enforcement is non-functional"*); openai chose 2 (*"the
ratchet changes CI acceptance policy and is therefore functional configuration;
treating it as bookkeeping would rewrite the explicit constraint after the
fact"*).

**Round 2b — a 3-round debate on the split, each seat given the other's argument
verbatim plus one synthesis candidate.** The synthesis offered was: the shared
worry was *"treating CI from one tree as authority for another"*, both seats
mitigated it with *"the closing PR must independently pass"*, and
`check_estate_count` runs in CI — so the config edit is covered by the closing
PR's **own** run rather than by inherited authority.

**Both seats converged on 2, and both refuted the synthesis on the same ground.**
openai: *"Validation answers whether an intended policy change satisfies its
checks; it cannot classify that change as non-functional."* anthropic, on the
same point: *"It does **not** prove 'no configuration changed.' It proves 'the
configuration change is correct.'"* Classification and validation are separate
questions, and only the second one CI can answer.

**The verdict, in each seat's own words.** anthropic: *"Select disposition 2. …
The closure is legitimate. Submit with ratchet walk, require full CI to pass
(including `check_estate_count` verifying the walk), merge only if all gates
pass. Record under disposition 2."* openai: *"choose 2; approve the atomic,
independently validated ratchet exception, but do not redefine a CI-policy change
as satisfying the original no-configuration condition."*

So: outcome state **`narrowed`**, and what narrowed is the *condition attached to
the verdict*, not the criterion. The criterion still closes on remote-CI evidence
exactly as Round 1 found; the closure is recorded as a **mitigated CI-policy
configuration change** rather than as a no-configuration diff.

### The classification test the next agent should use

anthropic's, stated to replace both earlier candidates — neither "bookkeeping vs
functional" nor "validated by its own CI → inside":

> Does this change which future branches CI accepts, which artifacts ship, or
> which runtime behavior executes? Yes + validated + safe → disposition 2
> (mitigated config change). Yes + not validated → refuse or escalate. No →
> disposition 1.

### The two claims the verdict was made conditional on — both verified in source

openai required that the gate *"derive the actual roadmap count independently and
verify the legal history transition"*, and noted the document only **asserted**
that. Read rather than assumed, at `src/scripts/check_estate_count.ts`:

1. **The count is derived, not read back.** `active_roadmaps` comes from
   `collect()` over the roadmap tree (`:268-272`), the same function the dashboard
   uses — not from the budget JSON. The gate cannot validate the baseline against
   itself.
2. **The raise half reads the baseline from the base ref**, described in the
   source as *"the one reading of the baseline this change cannot rewrite"*
   (`:400-401`), and a raise is legal only when the newest `baseline_history`
   entry carries a non-empty reason **and** records that metric at its new value
   (`:424-434`, `namesMetric = newest[metric] === after`).

### Atomic rollback — specified before merge, as required, and it is a plain revert

openai flagged that if history is append-only *"a plain commit revert may be
invalid"*. It is valid here, and this is read off the check above rather than
hoped for: an atomic revert of this PR restores the roadmap to `agents/roadmaps/`
(so the derived count returns to 24) **and** restores the budget file byte-for-byte
to the trunk version, whose newest `baseline_history` entry records
`active_roadmaps: 24` with a non-empty reason. That satisfies both halves of the
raise check, so the revert passes `check_estate_count` with the raise recorded as
reasoned. One honest imperfection the gate does not police: that entry's prose
describes a *different* branch's walk-down, so a reader of a reverted tree sees a
reason that does not name the revert.

**Non-atomic rollback is the unsafe one.** Reverting the archive without the
ratchet leaves measured 24 under a ceiling of 23 — growth, and a hard fail.
Reverting the ratchet without the archive leaves measured 23 under 24 — an
un-walked tightening, also a hard fail. Neither intermediate tree is valid, which
is exactly why both seats required the closure to be one unit.

### Kill-switch criteria (openai's list, recorded verbatim in substance)

Stop or revert if the gate fails to derive the count independently, accepts a
stale or generated mismatch, permits a ceiling **relaxation**, changes unrelated
CI behaviour, or can be bypassed through workflow/configuration edits in the same
PR. None of the five is true of this diff: the walk is monotonic downward, no
workflow file is touched, and the derivation is the `collect()` call above.

### Conditions this closure hands to the merge, and cannot itself discharge

Both seats made the closure contingent on the closing PR's own CI. This branch is
**not pushed**, so those conditions are open by construction and are stated as
handoff rather than claimed: full required CI must pass on the exact closing
commit, including `check_estate_count` verifying the walk, and the merge proceeds
only if branch protection confirms every required check passed. If it does not,
anthropic's own fallback applies — *"the roadmap stays in `main` but
unarchived"*.

### The architectural finding neither seat was asked for, kept because it is the useful part

Both seats independently pushed back on the *design*, not the closure. anthropic:
*"the current design **guarantees** every roadmap closure touches configuration.
That's a design choice, not an unavoidable truth"* — naming dynamic counting at
CI time, batched periodic updates, or an advisory baseline as alternatives, and
saying the call it would push hardest on is coupling ratchet updates atomically
to closures *"without first proving dynamic counting is infeasible"*. openai's
mirror: it would change its mind given *"a pre-existing, enforced rule narrowly
defining mechanically derived, monotonic ratchet transitions as closure
metadata"*.

That is a real proposal about `check_estate_count`, it is out of scope for a
roadmap closure, and it is recorded here rather than dropped: every future
archival will re-run this same argument until either the gate derives its ceiling
or a rule names this transition class.
