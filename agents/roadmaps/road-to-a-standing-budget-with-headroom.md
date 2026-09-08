---
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
---
# Road to a standing budget with headroom

> **Source:** the PR-drain run of 2026-09-08
> (`agents/evidence/pr-drain-run-summary.md`, that run's section). The finding
> is not an opinion about the budget — it is the third occurrence of one
> collision, and the first two were closed by work that the third cannot repeat.

## Goal

`src/config/preamble-payload-budget.json` stops being a control whose only two
exits are a forbidden action or the deletion of an obligation. Concretely: a PR
that adds a justified standing-rule Iron Law can go green without raising a
ceiling the file says may never rise, and without a maintainer having to decide
it case by case — or, if that is the intended cost, the file says so in those
words and the "may never move UP" sentence goes, because it is currently
contradicted by its own history twice over.

## The finding, as measured

The grace ceiling is, by `ci_delivery.why_a_grace_ceiling`, *"set AT the
measurement so growth beyond today reds immediately while today's tree
passes"*. That makes it sit exactly on HEAD — 138,490 is `main`'s own
measurement — so **any** standing growth in **any** PR reds. The same block
says *"It may never move UP."*

`grace_ceiling_history` records it moving up twice regardless: 138,212 → 138,273
on 2026-09-02 and 138,273 → 138,490 on 2026-09-08, each with a detailed
justification. So the practised resolution is the one the file forbids.

Three occurrences of the identical collision:

| When | PR | Growth | How it was closed |
|---|---|---|---|
| 2026-08-29 | #1707 | +770 tok in `source-confidentiality` | migrated prose to a new guideline; reached −350 |
| 2026-09-08 | #1920 | +298 tok in `external-code-graph-interop` | migrated prose to a skill body; reached −4 |
| 2026-09-08 | #1921 | +786 tok in `notes-first-reasoning` | migrated to −608 of it; **117 tok remain and cannot migrate** |

The third is the one that matters. What remains in #1921 is two fenced Iron Law
blocks — the rule is +478 chars over `main` and the blocks are ~480 — and
`preservation-guard` forbids condensing a fenced Iron Law further. Migration was
the escape hatch for the first two cases and it does not exist for an Iron Law.

## Phase 1 — Decide what the budget is for

- [ ] **1.1 Put the contradiction to the owner as one question.** The file's
      `owner` is `maintainer` and the question is not an engineering one: either
      the ceiling may rise on a recorded justification (in which case the "may
      never move UP" sentence is wrong and goes), or it may not (in which case
      the file must say that a standing-rule Iron Law addition is not available
      without a compensating reduction elsewhere, which is a real product
      constraint and belongs stated).
      verify: the decision is recorded in the file's `ci_delivery` block or in
      an ADR the block cites, and the sentence that survives matches the
      practice recorded in `grace_ceiling_history`.

- [ ] **1.2 If the answer is that it may rise: give the raise a shape.** Today
      a raise is an ad-hoc edit justified in prose. Name what a raise must
      carry — the measured delta, the migration attempt and its result, and why
      the residual is irreducible — so the next one is a filled-in form rather
      than an argument.
      verify: the two recorded raises satisfy the shape retroactively, or the
      shape is wrong.

- [ ] **1.3 If the answer is that it may not: give the ceiling headroom.**
      A ceiling pinned to HEAD reds on the first token and teaches readers to
      route around it. Whatever the mechanism — a stated band, a per-PR
      allowance, a scheduled re-measure — the property to buy is that a PR
      adding one justified Iron Law is not automatically red.
      verify: a fixture PR adding ~120 standing tokens passes
      `check_preamble_payload_budget` without any config edit in its own diff.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-08 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Headroom becomes drift | implementation | Giving the ceiling slack is how a budget stops measuring anything; the 28.4 % gap to the design ceiling already exists and this would widen the tolerated part of it | 1.3 asks for a bounded property (one Iron Law's worth), not a percentage, and the design ceiling of 107,646 stays the destination | Phase 1 — Decide what the budget is for |
| 2 | The question is answered by an agent | process | The whole finding is that only a maintainer may resolve it, and a run under an autonomous mandate is exactly the actor that would resolve it anyway | 1.1 is a decision step with no implementation attached, and the PR-drain run that found this did not raise the ceiling — that refusal is the evidence the step is respected | Phase 1 — Decide what the budget is for |
