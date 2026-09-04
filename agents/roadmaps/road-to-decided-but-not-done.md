---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates: []
# relates: manual sweep over agents/roadmaps/**/*.md on 2026-09-04 for
# `.agent-memory`, `attest_artifact`, `ADR-220` and `Carried to the` — none of
# the three items below is owned by an open roadmap or stub. ADR-094 and ADR-220
# are the records; neither has a receiver for its residue.
estate_growth_exempt: "Adds one active roadmap against a floor of 1. Its three items are the cheapest work in this change and the only ones an external reviewer named a closure test — a live tested read path into a file nothing writes, a primitive with zero importers at its fourth consecutive audit, and a promise with no receiver. Folding them into any of the three sibling roadmaps would hide small confirmed residue under a parser fix, a ledger, or a sweep. Parking them is what produced the fourth audit."
---
# Road to decided but not done

> **Source:** `agents/tmp.old/inbox-2026-09-e/` — an external multi-model review
> round on release 14.16.0. One reviewer made the first item a test of the whole
> system: *"Ein Findings-/Roadmap-System, das ein solches triviales bestätigtes
> Residuum nicht entfernt, hat ein Priorisierungsproblem."* Each item below was
> re-checked against `main@56aa348b3`.

## Goal

Three pieces of code and one promise that outlived the decisions that were
supposed to settle them each reach a terminal state: removed, wired, or annotated
with the reason they stay.

## Phase 1 — A read path into a file nothing writes

`docs/decisions/ADR-094-agent-memory-layer-removal.md` removed the agent-memory
layer. `src/scripts/_cli/explain_last/memory.ts:40` still resolves
`.agent-memory/hits.jsonl` as a live source, described in its own docblock
(`:14-17`) as *"optional sidecar produced by the memory-MCP integration"*.

A grep over the whole tree for anything that **writes** that path returns exactly
one hit, and it is a test fixture creating it so the reader can be exercised
(`tests/scripts/_cli/explain_last_build_trace.test.ts:82-91`). There is no
producer. The reader is live, tested, and reachable from `explain_last`.

- [ ] **1.1 Remove the sidecar branch, or name its producer.** If a producer
      exists outside this tree, the docblock says which package and how a
      consumer gets it, and the branch stays. If none does — which is what the
      grep shows — the branch, its constant, and the fixture that keeps it green
      go together.
      verify: `grep -rn '\.agent-memory' src/ tests/` returns nothing, or every
      remaining hit names a real producer; `explain_last` still resolves the
      `memory` slot from `state.memory[]` and its tests pass.
- [ ] **1.2 Do not widen it into a dead-code sweep.** This is one path with a
      recorded decision behind it. Other unreferenced code in the tree is
      pre-existing debt and stays, per
      [`minimal-safe-diff`](../../src/rules/minimal-safe-diff.md) § Own-orphan
      cleanup.
      verify: the diff touches `explain_last/memory.ts`, its test and its
      fixture, and nothing else.

## Phase 2 — A primitive with zero importers, fourth audit

`src/scripts/attest_artifact.ts` (created 2026-08-26, `34dae8d2c`) is imported by
nothing except its own test — verified by grep over `src/`, `tests/`, `docs/`,
`scripts/`. ADR-220's `review_trigger` names two reopen conditions: a concretely
proposed transcript-scanning consumer with a named reader and decision, or a
first skill adopting `attest` in production with the line observed in a
transcript. **Neither has fired.**

An external audit series has carried this as its only open defect for four
consecutive rounds, and three consecutive inbox dispositions do not mention it.

- [ ] **2.1 Annotate the state, with the census beside it.** The ADR gains one
      paragraph recording that the primitive exists, that its two reopen
      conditions are unfired, and the importer count with the command that
      produced it. An unannotated zero-importer primitive is indistinguishable
      from an oversight; an annotated one is a decision.
      verify: the ADR names the importer count, the date and the command, and
      `git log -1 --format=%ad -- src/scripts/attest_artifact.ts` matches the
      build date it states.
- [ ] **2.2 Route wire-versus-remove, do not decide it here.** Removing a
      primitive an accepted ADR specifies is a change to that record;
      [`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md) sends
      it to the council, not to this file and not to the maintainer first. This
      step opens that route and records the outcome.
      verify: either a council round is recorded with its verdict, or the ADR
      states that the primitive stays unwired until a trigger fires, with the
      revisit condition restated.
- [ ] **2.3 Correct the audit's unverified sub-claim.** The external series
      also asserts an unannotated contradiction between a *2026-08-25 ruling* and
      the 2026-08-26 build. A sweep over the archived parent roadmap and ADR-220
      found no such ruling; the claim is **unverifiable from this tree** rather
      than refuted. Record that, so the fifth audit meets an answer.
      verify: the annotation from 2.1 states what was searched and that the
      ruling was not found, naming the files searched.

## Phase 3 — A promise with no receiver

Two artefacts record a limitation as *"Carried to the follow-up"* /
*"Carried to the receiver"* — `tests/scripts/fixtures/git_auth_negation_corpus.ts:109-119`
and `agents/roadmaps/archive/road-to-binding-findings.md:278-282`. A sweep over
`agents/roadmaps/**` finds no receiver for either.

- [ ] **3.1 Resolve these two.** `road-to-one-negation-vocabulary` Phase 3 owns
      the same promise from the corpus side; this step confirms the archived
      roadmap's restatement resolves to the same place or to a recorded decline.
      verify: both sites point at a named receiver or carry the acceptance, and
      neither says "carried" without one.
- [ ] **3.2 Count the rest, and stop there.** Grep the tracked tree for the
      carried-to shape and report how many such promises exist and which resolve.
      The output is a count and a list — resolving all of them is not this
      roadmap's scope and would be the sweep Phase 1.2 refuses.
      verify: the census names the total and the unresolved subset; a zero is a
      real answer and is reported as one.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-04 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The sidecar has an out-of-tree producer nobody grepped for | implementation | The docblock names a "memory-MCP integration", and a grep over this repo cannot see a consumer's MCP server; deleting a reader something external feeds would break it silently | 1.1 makes naming the producer an equal outcome to removal, so the branch survives on evidence rather than on the absence of a grep hit | Phase 1 — A read path into a file nothing writes |
| 2 | Phase 2 is executed as a removal | product | The cheapest reading of "zero importers" is `git rm`, and the primitive is specified by an accepted ADR whose trigger has not fired — removal is a change to that record, not cleanup | 2.2 routes it to the council per the revisit gate and forbids deciding it in this file; 2.1's annotation is the deliverable either way | Phase 2 — A primitive with zero importers |
| 3 | The carried-to census turns into a resolution sweep | product | Finding N dangling promises invites closing all of them, which is scope creep against artefacts other roadmaps may own | 3.2 caps the output at a count and a list, and names resolving-all as out of scope | Phase 3 — A promise with no receiver |

## Acceptance Criteria

- [ ] AC-1 — No live code path reads `.agent-memory/hits.jsonl`, or the docblock
      names the producer that writes it.
- [ ] AC-2 — ADR-220 records the importer count, its date, the command that
      produced it, and the unfired state of both reopen conditions.
- [ ] AC-3 — Wire-versus-remove for `attest_artifact.ts` has a recorded outcome
      from the revisit route, not a decision taken in this roadmap.
- [ ] AC-4 — The 2026-08-25-ruling sub-claim is recorded as searched-and-not-found,
      naming the files searched.
- [ ] AC-5 — Both `Carried to the` sites resolve to a receiver or an acceptance,
      and a census reports how many such promises exist and which are unresolved.
