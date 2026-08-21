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

## Verdict — 1, `satisfied`. Both seats, convergent.

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
both be honoured. The reading applied is the one the seat's own sentence gives as
its reason: *"the delta is non-functional."* A roadmap dashboard is a rendering of
roadmap state and cannot change shipped behaviour, so it is inside the constraint;
`src/`, a dependency, or executable code would be outside it. The distinction is
recorded here rather than resolved silently, because the alternative was to pick
one of the two obligations and not say which.

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
