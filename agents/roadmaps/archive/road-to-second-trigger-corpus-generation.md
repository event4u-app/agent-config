---
complexity: structural
status: ready
parent_roadmap: road-to-the-tenth-arrival
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-the-tenth-arrival
    relation: extends
    note: >
      Receiver of that roadmap's AC-3, carried on 2026-09-05 by an AI-council
      round (2/2, convergent) after its unmet conjunct was reproduced as
      unsatisfiable at `src/skills/*/evals/triggers.json`. That roadmap owns the
      finding; this one owns the corpus generation that would close it.
estate_growth_exempt: "Adds one open blocker against a floor of 29. The blocker was found while executing road-to-the-tenth-arrival AC-3 and is the reason that AC could not close: the frozen corpus artefact reserves the partition question for new files to a Phase 5 decision of an archived roadmap, so the venue is vacant, and both council seats routed the prior question -- whether a second generation is worth building at all, given measured activation of zero -- to the owner. The reason belongs next to the blocker, which is the case check_estate_count's own docstring names for this exemption. Active roadmap count is unchanged: this file is one in, road-to-the-tenth-arrival is archived in the same change as one out."
---
# Road to a second trigger-corpus generation

> **Source:** `road-to-the-tenth-arrival` AC-3, carried here on 2026-09-05.
> The evidence — the n=1 reproduction, the three pins it moves, the council
> round and its conditions — is
> `agents/evidence/analysis/tenth-arrival-ac3-disposition-2026-09-05.md`. The
> 14 corpus files authored and reverted in that roadmap's step 2.2 are preserved
> verbatim in `agents/evidence/analysis/trigger-corpus-wave2-deferred-2026-09-04.md`
> and are this roadmap's input, not work to redo.

## Goal

The trigger corpus can grow without silently invalidating a published
measurement, because growth lands in an explicitly versioned second generation
whose identity, partition rule and provenance are its own — and the question
that comes first, whether a corpus no host reads is worth growing at all, has
been answered on the record rather than assumed by starting.

## The carried obligation, stated exactly

`road-to-the-tenth-arrival` AC-3 had three conjuncts. Two closed there. This is
the third, verbatim:

> expanded with a positive and a near-miss fixture per addition

It did not close because one file added at `src/skills/*/evals/triggers.json`
turns three published reproduce-from-tree pins red — the set hash in
`agents/evidence/analysis/trigger-corpus-holdout-2026-08-30.md`, the corpus and
train sizes in `tests/scripts/routing_signal_measurement.test.ts`, and
`precision_at_k` in `tests/scripts/delivery_set_compatibility.test.ts` — while
every corpus-local gate stays green and `check_routing_coverage` reports the
addition as progress.

Not blocked because it is impossible. Both council seats said generation 2 is
technically feasible; the frozen record permits a change and forbids only a
silent one. It is carried because the work is a governed harness change, not a
step.

## Blockers

### blocker: b-second-generation-worth-building

- **Status:** resolved — W-NO; do not build a second trigger-corpus generation.
  Cancel the unstarted Generation-2 steps and archive this roadmap with
  cancellations (2026-09-05; author: AI council).
- **Owner:** maintainer
- **Blocks:** 1.1, and every phase after it
- **Class:** 3
- **What to do:** Decide whether a second trigger-corpus generation should exist
  at all. The inputs are on the record and no new measurement is needed to take
  the decision: `report_skill_activation` reads 0 Skill invocations and 0 of 299
  distinct skills over 30 sessions and 11,049 assistant turns
  (`docs/CLAIMS.md § skill-activation-census-zero`), and `evals/triggers.json` is
  read by three gates and by no host at routing time. A yes commits the phases
  below; a no closes this roadmap and retires AC-3 with the reason stated.
- **Resolved when:** the decision is recorded — an ADR, or a line in this
  blocker naming the decision, its date and its author — and this blocker's
  Status reads `resolved`.
- **Recommendation:** Decide before Phase 2, not after. The generation-2 design
  costs a migration across 15 scripts and 10 test files; taking that cost to
  raise a numerator whose relationship to host behaviour is unspecified is the
  failure mode the openai seat named explicitly on 2026-09-05.
- **If you do nothing:** the corpus stays at 100 of 299, the three pins stay
  reproducible, and nothing breaks. The cost of waiting is that the finding
  arrives an eleventh time and meets this file — which is a state, not a
  restatement, and is the outcome the parent roadmap was written to produce.


- **Decision (2026-09-05; author: AI council, 2 rounds, quorum 2/2 concluded,
  `anthropic/claude-sonnet-4-5` + `openai/codex-default`, $0.00, both seats
  subscription-authed):** **W-NO.** A second trigger-corpus generation will not
  be built. The existing corpus stays at **100/299** as a reproducible
  generation-1 evaluation fixture; **coverage expansion is frozen, while
  corrections that preserve fixture membership and published-pin
  reproducibility remain permitted**. AC-3's third conjunct is retired because
  no host reads this corpus at routing time, the activation census found 0
  Skill invocations across 30 sessions and 11,049 assistant turns
  (`docs/CLAIMS.md § skill-activation-census-zero`), and no recorded
  measurement connects increased corpus coverage to improved host behaviour.
  The migration across 15 scripts and 10 test files is therefore not justified.

  Both seats named the same overridden counter-argument and it is kept on the
  record rather than dropped: a versioned generation **would** decouple corpus
  additions from the published holdout hashes and make future growth safe and
  reproducible. That is a real architectural benefit. It was overridden because
  it has no present value until corpus expansion itself serves a demonstrated
  host-level purpose — safe expansion infrastructure is only worth building
  once expansion has a justified purpose.

  The decision is about **infrastructure for systematic expansion**, not corpus
  immutability. Bug fixes to the existing 100 entries, corrections to an entry
  shown to be wrong, and a one-off addition justified by a specific gate need
  all remain permitted.

  This blocker was routed to the council rather than to the maintainer under
  the maintainer's written delegation for this run: *"Anything that would
  normally end in 'ask the user' … is instead put to the AI Council. The
  council's recorded decision substitutes for user sign-off and is documented
  as such."* The blocker's own entry stated that no new measurement was needed
  to take the decision, and none was taken. The full decision record, its
  evidence table, its overridden counter-argument and its non-claims live in
  `agents/evidence/analysis/second-generation-w-no-2026-09-05.md`.

- **Revisit-if:** a production host begins consuming this corpus at routing
  time (verified by session logs or a host-capability probe); **or** a
  controlled host-level evaluation shows that broader coverage materially
  improves correct skill invocation or task completion at an acceptable
  false-positive rate, **and** generation-1 pinning is what prevents that
  validated expansion. A single Skill invocation is explicitly **not** enough —
  one seat proposed `>0` and the other refuted it as too weak, since a lone
  invocation could be accidental or manually prompted; sustained evidence
  across measurement windows is the bar. Before reopening, the missing
  instrument is host-level measurement of whether routing benefits from trigger
  patterns at all; that absent causal link is why generation 2 was not built.

## Phase 1 — Answer the prior question on the record

- [x] **1.1 Record the worth-building decision.** <!-- blocked-by: b-second-generation-worth-building -->
      Nothing below is worth designing until this is answered, and answering it
      by starting the design is how it goes unanswered.
      verify: `b-second-generation-worth-building` reads `Status: resolved` and
      names the decision, its date and its author; if the decision is no, this
      roadmap carries no open steps.
      DONE — the decision is recorded in `b-second-generation-worth-building`: W-NO,
      2026-09-05, author AI council (2 rounds, quorum 2/2 concluded, $0.00). It was
      routed to the council rather than to the maintainer under this run's written
      delegation of owner-required decisions. The verify clause's conditional is
      satisfied in its NO branch: the decision is no, and this roadmap carries no
      open steps.

## Phase 2 — Generation identity

- [-] **2.1 Define what a corpus generation is.** A generation needs a name, a
      membership rule, a location that cannot be confused with generation 1, and
      an immutable identity once frozen. Generation 1 is defined only by the
      files that happened to exist on 2026-08-30; the concept does not exist in
      code.
      verify: a committed contract states the generation vocabulary, and
      generation 1 is describable in it without any edit to
      `agents/evidence/analysis/trigger-corpus-holdout-2026-08-30.md`.
      CANCELLED — W-NO (2026-09-05, AI council 2/2, quorum concluded). Not attempted, not
      completed. What changed: the worth-building question this step presupposed was
      answered NO, so the generation-2 identity work it belongs to is not built. See
      `b-second-generation-worth-building` for the decision, its overridden
      counter-argument and its revisit-if.
- [-] **2.2 Give generation 2 its own partition provenance.** Its own rule, its
      own set hash, its own freeze record. The generation-1 rule
      (`sha256(<skill-directory-name>)[0] < 51`) may be reused, adopted
      explicitly, or replaced — never inherited by silence, which is the exact
      compromise the frozen artefact names.
      verify: the generation-2 record publishes a reproduce command, and running
      it reproduces the published hash; `trigger_corpus_holdout_pin.test.ts`
      stays green with generation 1 byte-unchanged.
      CANCELLED — W-NO (2026-09-05, AI council 2/2, quorum concluded). Not attempted, not
      completed. What changed: the worth-building question this step presupposed was
      answered NO, so the generation-2 identity work it belongs to is not built. See
      `b-second-generation-worth-building` for the decision, its overridden
      counter-argument and its revisit-if.

## Phase 3 — Coverage semantics across generations

- [-] **3.1 Decide what `check_routing_coverage` counts.** Its declared
      measurement is `src/skills/*/evals/triggers.json over src/skills/*/SKILL.md`
      (`src/config/routing-coverage-seed.json`, `owner: maintainer`). A
      generation living elsewhere is invisible to it; a generation living at the
      same path moves the pins. Both are decisions, and one of them changes a
      maintainer-owned ratchet's meaning.
      verify: the seed's `measurement` string and its `history` describe the
      post-change semantics, the seed is not lowered, and
      `check_routing_coverage.test.ts` asserts seed == live measurement in both
      directions as it does today.
      CANCELLED — W-NO (2026-09-05, AI council 2/2, quorum concluded). Not attempted, not
      completed. What changed: the worth-building question this step presupposed was
      answered NO, so the generation-2 identity work it belongs to is not built. See
      `b-second-generation-worth-building` for the decision, its overridden
      counter-argument and its revisit-if.
- [-] **3.2 Publish coverage after the change, including if it did not move.**
      The parent roadmap's step 2.3 established that a null here is the finding
      rather than a failed step, and that the two surfaces — the eval corpus and
      what a host reads at routing time — are not the same population.
      verify: a ledger row states the reading with its instrument, and says which
      surface it describes.
      CANCELLED — W-NO (2026-09-05, AI council 2/2, quorum concluded). Not attempted, not
      completed. What changed: the worth-building question this step presupposed was
      answered NO, so the generation-2 identity work it belongs to is not built. See
      `b-second-generation-worth-building` for the decision, its overridden
      counter-argument and its revisit-if.

## Phase 4 — The carried conjunct

- [-] **4.1 Land the preserved wave into generation 2.** The 14 files in
      `agents/evidence/analysis/trigger-corpus-wave2-deferred-2026-09-04.md` were
      authored to the full discipline — at least three positives, at least two
      near-misses, one declared German positive, a declared case class per query
      — and were reverted for the pin collision, not for their content. Re-derive
      the selection rule before reusing it rather than trusting a nine-day-old
      list.
      verify: `lint_skill_trigger_corpus` holds over generation 2, every addition
      carries both a positive and a near-miss, and a one-word widening of any
      new trigger fails its near-miss row.
      CANCELLED — W-NO (2026-09-05, AI council 2/2, quorum concluded). Not attempted, not
      completed. What changed: the worth-building question this step presupposed was
      answered NO, so the generation-2 identity work it belongs to is not built. See
      `b-second-generation-worth-building` for the decision, its overridden
      counter-argument and its revisit-if.
- [-] **4.2 Republish every measurement the growth moved.** The corpus and train
      sizes, the verdict record, and `precision_at_k` all describe a corpus that
      has changed. A pin left describing the old set is the failure the parent
      roadmap's step 2.2 caught.
      verify: `routing_signal_measurement.test.ts` and
      `delivery_set_compatibility.test.ts` are green over the post-change tree,
      and each republished number names the generation it describes.
      CANCELLED — W-NO (2026-09-05, AI council 2/2, quorum concluded). Not attempted, not
      completed. What changed: the worth-building question this step presupposed was
      answered NO, so the generation-2 identity work it belongs to is not built. See
      `b-second-generation-worth-building` for the decision, its overridden
      counter-argument and its revisit-if.

## Phase 5 — Migration and the completion gate

- [-] **5.1 Inventory every reader.** 15 scripts and 10 test files read
      `evals/triggers.json` on `acf134119`. Each either becomes
      generation-aware or is stated as deliberately generation-1-only.
      verify: the inventory is committed, every entry has a disposition, and a
      grep for the literal path finds no reader the inventory does not name.
      CANCELLED — W-NO (2026-09-05, AI council 2/2, quorum concluded). Not attempted, not
      completed. What changed: the worth-building question this step presupposed was
      answered NO, so the generation-2 identity work it belongs to is not built. See
      `b-second-generation-worth-building` for the decision, its overridden
      counter-argument and its revisit-if.
- [-] **5.2 Make the end state reproducible by one command.** A roadmap that
      ends in a design leaves the eleventh arrival a document to read rather
      than a state to check.
      verify: one named command reproduces the generation-2 identity, its
      coverage reading and its pin set from the tree, and exits non-zero when any
      of the three has drifted.
      CANCELLED — W-NO (2026-09-05, AI council 2/2, quorum concluded). Not attempted, not
      completed. What changed: the worth-building question this step presupposed was
      answered NO, so the generation-2 identity work it belongs to is not built. See
      `b-second-generation-worth-building` for the decision, its overridden
      counter-argument and its revisit-if.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-05 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The design is built before the worth-building question is answered | product | Phase 2 onwards is a migration across 25 files; starting it answers the prior question by momentum, and the answer it gives is the one nobody chose | Phase 1 is a single step gated by an owner blocker, and its verify closes the roadmap on a no rather than continuing | Phase 1 — Answer the prior question on the record |
| 2 | Generation 2 silently inherits generation 1's partition rule | implementation | Reusing the name-hash without adopting it explicitly is exactly what the frozen artefact calls the compromise it exists to prevent, and it would decide each new skill's bucket by its own name with nobody having chosen that | 2.2 requires the rule to be stated and its hash reproduced, and forbids generation 1 from being edited to accommodate it | Phase 2 — Generation identity |
| 3 | The coverage ratchet is quietly redefined to make the number rise | implementation | Changing `check_routing_coverage`'s declared measurement is the cheapest way to make growth appear, and it is a maintainer-owned ratchet | 3.1 requires the seed's own `measurement` and `history` to carry the new semantics and forbids lowering it | Phase 3 — Coverage semantics across generations |
| 4 | Growth lands and the old pins are left describing the old set | implementation | The parent roadmap's 2.2 caught exactly this: corpus-local gates go green while three published records stop reproducing | 4.2 requires both measurement suites green over the post-change tree, with each republished number naming its generation | Phase 4 — The carried conjunct |
| 5 | The roadmap ends in a design rather than a checkable state | implementation | Every prior arrival of this finding ended in prose, which is why it arrived ten times | 5.2 requires one command that reproduces the end state and reds on drift | Phase 5 — Migration and the completion gate |

## Acceptance Criteria

- [x] AC-1 — The worth-building decision is recorded with its date and author,
      and `b-second-generation-worth-building` is resolved. A no is a complete
      answer and closes this roadmap.
- [-] AC-2 — A second corpus generation exists with its own name, membership
      rule, partition provenance and reproducible set hash, and
      `agents/evidence/analysis/trigger-corpus-holdout-2026-08-30.md` and its pin
      are byte-unchanged.
      CANCELLED — W-NO (2026-09-05, AI council 2/2). Not met, not attempted, and not
      claimed. The worth-building question this criterion presupposed was answered NO;
      see `b-second-generation-worth-building` and
      `agents/evidence/analysis/second-generation-w-no-2026-09-05.md`.
- [-] AC-3 — **Carried verbatim from `road-to-the-tenth-arrival` AC-3, third
      conjunct.** The corpus is expanded with a positive and a near-miss fixture
      per addition, the near-miss rows fail on a one-word widening, and coverage
      after the expansion is published including if it did not move.
      CANCELLED — W-NO (2026-09-05, AI council 2/2). Not met, not attempted, and not
      claimed. The worth-building question this criterion presupposed was answered NO;
      see `b-second-generation-worth-building` and
      `agents/evidence/analysis/second-generation-w-no-2026-09-05.md`.
- [-] AC-4 — Every reader of `evals/triggers.json` is either generation-aware or
      recorded as deliberately generation-1-only, and one named command
      reproduces the end state and exits non-zero on drift.
      CANCELLED — W-NO (2026-09-05, AI council 2/2). Not met, not attempted, and not
      claimed. The worth-building question this criterion presupposed was answered NO;
      see `b-second-generation-worth-building` and
      `agents/evidence/analysis/second-generation-w-no-2026-09-05.md`.
