<!-- evidence-type: analysis -->
# A finished, tested branch sat off-trunk for seven days, and a closed checkbox says it did not

**Measured 2026-08-27** for `road-to-database-erd-landing` step 3.1. This is a
finding about a **mechanism**, not about the branch: the branch was fine, the
work was complete, and the record that was supposed to catch it reported success.

## What happened

`feat/schema-erd-diff` carries **5,456 insertions across 33 files** — a schema IR
with a validator and a byte-stable canonicaliser, four adapters (DDL, Prisma,
tbls, Laravel), a differ, a rename scanner, two renderers, a CLI entry point, a
skill with evals, five fixtures and **134 test cases**. Its five commits are
dated **2026-08-20**. It was never pushed to `origin`.

It was found on 2026-08-26 by an inbox drop whose defect register listed "no ERD
capability" as defect D3 — a claim **true of `origin/main` and false of the
repository**. Three of that drop's four proposals contained a phase to build the
same capability from scratch. None of the sources could see the branch.

## What the closeout step asked for, and what it got

`agents/roadmaps/archive/road-to-session-closeout.md:596-599`, marked `[x]`:

> **7.2 Land or discard the rescue set, one change per worktree.**
> Four unrelated pieces of work; a combined change would be unreviewable.
> *verify: none appears in a fresh dirty-worktree scan, and each has a merged
> change or a recorded disposal.*

The verify has two clauses joined by **and**. For this branch:

| Clause | State |
|---|---|
| "none appears in a fresh dirty-worktree scan" | **satisfied** — the worktree `.claude/worktrees/schema-erd-diff` is clean; every commit is committed |
| "each has a merged change or a recorded disposal" | **not satisfied** — nothing merged, and no disposal recorded anywhere in the tree |

The checkbox was flipped anyway.

## Why the checkbox could be flipped

Not carelessness — the two clauses measure different things and only one of them
is observable from the step's own vantage point.

**"Clean worktree" is checkable and was checked.** A dirty-worktree scan is a
command; it answers in seconds and it answered yes.

**"A merged change or a recorded disposal" is not checkable from the same
place.** "Merged" is a fact about `origin`, which the step does not query;
"recorded disposal" is a fact about a record that does not exist yet, and the
absence of a record is indistinguishable from the absence of a need for one. So
the observable clause passed, the unobservable clause was assumed, and the
conjunction reported the value of the half that could be measured.

This is the same shape as a gate that scans an empty corpus and exits 0. The
step did not lie; it reported on what it could see, and what it could see was
the easier half.

## The seven-day gap, and the recurrence underneath it

The same requirement had arrived once before, on **2026-08-19**, as
`agents/tmp.old/erd-erp/` — a Revision-2 proposal with its own `file:line`
provenance. It was consumed from the inbox and implemented on this branch the
next day. Then the landing step closed without landing it, and on **2026-08-26**
the requirement arrived a third time, from two independent sources, both
proposing to build it.

Under `recurring-criticism`'s three outcomes, this is the **third**: the
disposition was right, it was recorded, and the record did not reach anything
that acts. The decision to build was correct. The decision to land was made. The
artifact that recorded the landing did not cause it.

## Why "just add a probe" is not obviously the fix

The analysis found the branch by scanning every local ref for commits absent from
`origin/main` and ranking by database-relevant file count. Re-run today:

```
local branches: 1146, with unmerged commits: 193
```

**193 branches carry commits `origin/main` does not have.** A naive "unlanded
work" probe reports 193 candidates, of which — on this evidence — one mattered.
That is a 0.5% signal rate, and a report nobody reads is worse than no report,
because its existence is an argument that the class is covered.

The discriminator that actually found this branch was not "has unmerged commits".
It was **"has unmerged commits AND its own roadmap is archived as fully
closed"** — a branch that believes it is finished. That is a much narrower
predicate and it is mechanically checkable: the branch's tree contains a roadmap
under `agents/roadmaps/archive/` whose `count_open` is 0. Whether it is narrow
*enough* is not established by one instance, which is why step 3.2 permits
recording the reason against a probe rather than requiring one.

## What this does NOT establish

- **Nothing about the other 192 branches.** They were counted, not read. This
  document does not claim any of them holds finished work, and the 0.5% figure is
  one instance over a population, not a measured rate.
- **Nothing about whether 7.2 was wrong to close overall.** Three other pieces of
  rescued work went through the same step; only this one was checked here.
- **No fix is proposed for the conjunction problem.** A verify whose clauses have
  different observability is a general authoring hazard, and one instance is not
  the evidence for a rule about it.
