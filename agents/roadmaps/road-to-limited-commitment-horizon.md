---
complexity: lightweight
execution:
  mode: phase-checkpoints
depends:
  - road-to-candidate-moves-floor
relates:
  - slug: road-to-candidate-moves-floor
    relation: depends
    note: >
      Phases 1 and 2 here are independent of that roadmap — a horizon bounds
      how far a chosen form is executed regardless of how the form was chosen,
      and a run that had exactly one sensible form still executes it too far.
      Phase 3 is not independent: every step in it reads that roadmap's
      Phase-3 results file as its entry condition, so the dependency is on the
      measurement and not on the mechanism.
estate_offset_exempt: "Offsets nothing, and folding was considered first. Merging this into `road-to-candidate-moves-floor` was the obvious saving and was rejected on a reading of that roadmap's own shape: it ends in a keep-or-delete verdict on one obligation, and a second obligation inside it would make that verdict undecidable — a null on the candidates line would drag the horizon work down with it although the horizon is measured on different dimensions. Parking this in `later/` was the other option and fails its entry-condition test, because Phases 1 and 2 are workable today and only Phase 3 waits."
estate_growth_exempt: "Growth is one active roadmap whose first two phases close a defect no active roadmap, later roadmap or stub names: `notes-first-reasoning.md:52-54` binds a prediction to no candidate and offers `revisit-if` with nothing that reopens on it. Its third phase is `[~]` throughout and adds no executable work until a measurement lands, so the growth is two phases wide, not three."
---
# Road to limited commitment and the reopen contract

> **Source:** `agents/tmp.old/inbox-2026-09-v/` — the same five-artifact round.
> The horizon idea is the one contribution its second pass added that neither
> its first pass nor its consolidation had, and the round's own review calls it
> the best of the batch and too abstract to build as stated.

## Goal

Choosing a form stops meaning "execute the plan for it". A choice authorises
exactly the work the current evidence supports, the boundary where that work
ends is named mechanically rather than by judgement, and evidence that
contradicts the choice reopens it once instead of being absorbed into it.

## Context

The round's second pass named the failure one layer below premature choice: a
run picks a reasonable candidate and then executes twelve steps on it without
re-reading the position. Its own review agreed and named the defect in the
proposal — `next justified commitment` as written degrades to
`Next justified commitment: implement solution`, which is the starting point
with a label. The fix the review proposed is the one this roadmap takes: a
horizon ends at the next **evidence-producing boundary**, and that list is
enumerable rather than judged.

Two tree facts at HEAD 2c75232fe make the first two phases workable now:

- `src/rules/notes-first-reasoning.md:52-54` — `## Predictions` carries
  `prediction · confidence · result · lesson` and `## Decisions` carries
  `revisit-if`. Both exist; neither is bound to a chosen form, and nothing
  reads `revisit-if` back. A prediction that misses changes no plan.
- `src/agent-src/contexts/execution/autonomy-mechanics.md` § Retry-budget
  escalation ladder — the first failure escalates toward a retry of the same
  approach. Nothing routes it back to a form decision, so the second-best
  candidate is never reached by the mechanism that discovers the first one was
  wrong.

`src/skills/reasoning-orchestrator/SKILL.md:77` is the third fact and it is
why Phase 3 waits: `intent` states `one recommendation`, and the chain at
`:108` has no observation step after action. Rebuilding that chain means
re-running the eval that measured it, which is exactly the expensive-work-
before-the-proof ordering this round's self-critique flagged.

## Prerequisites

- `road-to-candidate-moves-floor` Phase 1 — the fifth rubric dimension and the
  published baseline. Phase 3 of this roadmap reads its Phase-3 verdict.
- `src/rules/notes-first-reasoning.md` — the notes file is the carrier. No new
  store: the round's parents proposed a per-task YAML under `agents/tmp/`, and
  that path is a user-only producer surface in this tree.

## Phase 1 — Define the horizon mechanically

> **Fixture-gated steps, 2026-09-07 — the prose for all of them has landed; the
> FIXTURES have not.** Steps 1.1, 1.2, 2.1, 2.2 and 2.4 each `verify:` against a
> *fixture* — "a fixture whose chosen form needs a call-site inventory produces
> a horizon that stops at the inventory", "three fixtures, one per class,
> produce three different horizon widths", and so on. Their SUBSTANCE is in
> `src/rules/notes-first-reasoning.md` as of this change: the enumerated
> boundary set, the reversibility table with three widths, the reopen-once rule,
> the cap, and the falsified-`killed-if` revival. **None of the five boxes is
> ticked, because prose is not a fixture** and ticking them on the prose alone
> is the silent-green failure this repository has recorded before.
>
> **What they need, precisely.** These are behavioural fixtures over agent
> reasoning, so the harness is the one at `tests/reasoning-layer-eval/` — but
> neither of its two existing layers fits as it stands. `trigger-fixtures.json`
> answers *did the right discipline fire*, which is not the question here
> (the question is *where did the run stop*), and the rubric layer scores whole
> transcripts on 0-3 dimensions rather than asserting a boundary. A horizon
> fixture needs a third shape: a prompt whose plan has a KNOWN nearest
> evidence-producing boundary, and an assertion that the run stopped at it.
> That is a corpus plus an assertion form, and it is the actual remaining work
> of Phases 1 and 2 — not a formality on top of the prose.
>
> **Why the three that ARE ticked could be.** 1.3, 1.4 and 2.3 verify against
> the TEXT, not against behaviour, and each was checked rather than assumed:
> 1.3's field list carries the chosen form in `## Predictions` and
> `next-commitment` in `## Decisions`, and the projection regenerates
> byte-identically (`condense.sh --changed` → "Every .md projection matches its
> source"); 1.4's `grep -rn 'minimum depth|three to five moves'` over
> `src/rules/`, `src/agent-src/contexts/` and `src/skills/` returns exactly one
> hit, which is the new ceiling sentence itself — so no artifact requires a
> minimum depth; 2.3's ladder now names the candidate-list check as stage 0 with
> the N=3 counting explicitly unchanged.

- [ ] **1.1 Name the boundary set instead of the judgement.**
      A commitment horizon ends at the next observation that produces evidence
      about the choice: a test result · a type or schema inspection · a
      compile · a runtime probe · a call-site inventory · a dry run · a browser
      observation · a dependency-contract read. The horizon is "the work up to
      the nearest of those", which is decidable from the plan; "the work the
      evidence supports" is not.
      verify: a fixture whose chosen form needs a call-site inventory produces
      a horizon that stops at the inventory, not at the implementation.
- [ ] **1.2 Scale the horizon by reversibility, not by task size.**
      A reversible local edit may take a whole implementation slice — stopping
      there costs more than it saves. A stateful or cross-layer action stops at
      the next boundary from 1.1. An irreversible or public-contract action
      stops *before* the irreversible step unless direct evidence already
      covers it.
      verify: three fixtures, one per class, produce three different horizon
      widths from the same candidate shape.
- [x] **1.3 Add the two fields to the notes, next to the prediction.**
      `## Decisions` in `src/rules/notes-first-reasoning.md` gains
      `next-commitment` (the boundary from 1.1) beside the existing
      `revisit-if`, and the chosen form is named in `## Predictions` so the
      prediction has a subject. No new section and no new file — the round's
      parents proposed both and this tree already carries the slots.
      verify: the rule's field list names the chosen candidate in
      `## Predictions` and the boundary in `## Decisions`, and the projection
      regenerates byte-identically.
- [x] **1.4 Keep the depth ladder as a ceiling, never a quota.**
      Looking three to five moves ahead is the maximum for a forcing,
      irreversible or externally observable line. A stateful or cross-layer
      line gets two to three. A quiet reversible line gets one, deliberately.
      The original framing of this round — always three to five, all variants
      — is 1024 leaves at four branches and depth five, and the round's own
      review scores that framing lower than the current tree.
      verify: the rule text states the ladder with the quiet case at one, and
      no artifact requires a minimum depth.

## Phase 2 — Reopen once, on contradiction, without looping

- [ ] **2.1 Reopen on a missed prediction, not on a schedule.**
      When an observation contradicts the prediction attached to the chosen
      form, the decision reopens before the next step — using the candidate
      list that already exists, not a fresh enumeration. A reopen driven by
      ritual rather than by contradicting evidence is the ceremony this
      roadmap is trying not to add.
      verify: a fixture whose first probe contradicts the rollout draws the
      second candidate and produces no second candidate list.
- [ ] **2.2 Cap it at one reopen per candidate.**
      An uncapped reopen is a loop with better manners, and this tree already
      recorded that decision. The second contradiction on the same candidate
      hands over to the existing retry-budget ladder rather than reopening
      again.
      verify: a fixture with two consecutive contradictions reopens once and
      then escalates through the existing ladder.
- [x] **2.3 Route the first failure back to the form, once.**
      `autonomy-mechanics.md`' ladder sends the first failure to a retry of the
      same approach. Add the prior step: if a candidate list exists for this
      work, the first failure reads it before the retry. If none exists, the
      ladder is unchanged — this adds a branch, it does not move the budget.
      verify: the ladder text names the candidate-list check before retry 1,
      and the N=3 counting is unchanged.
- [ ] **2.4 Revive a candidate whose rejection has been falsified.**
      A candidate killed by an assumption that later turns out false is not
      killed — it is un-evaluated. The `killed-if` condition is what makes this
      checkable, and it is the reason the field is worth carrying at all.
      verify: a fixture that falsifies a stated `killed-if` returns that
      candidate to the set rather than leaving it struck.

## Phase 3 — Everything that waits for a number

Every step here is deferred, and the entry condition is the same for all of
them: `road-to-candidate-moves-floor` Phase 3 published a keep verdict with a
dim-5 delta. A delete verdict closes this phase unbuilt, which is a legitimate
outcome and not a failure of this roadmap.

- [ ] **[~] 3.1 Rebuild the orchestrator chain.** <!-- deferred: entry condition is the floor roadmap's keep verdict -->
      Split link 2 so the requirement frame and the form commitment are
      separate links, and add an observation step after action. The measured
      gain of the current chain was published for the current chain, so
      changing it obliges re-running that eval — which is the cost this
      ordering exists to defer until the cheap obligation has proven itself.
- [ ] **[~] 3.2 Give the branch vocabulary one home.** <!-- deferred: same entry condition -->
      State, transition, candidate, axis, rollout, prune reason and stop
      condition, written once as a lookup context and referenced from the
      carriers that need it. Only worth its own file once more than two
      carriers reference it; before that it is a file with one reader.
- [ ] **[~] 3.3 Turn surviving branches into verification obligations.** <!-- deferred: same entry condition -->
      A branch that survived the discriminator is either covered by an existing
      test, gets a new one, gets a runtime probe, or is deliberately untested
      with the reason stated. Derive the outcome classes from types and code,
      never from imagination, where a source can answer.
- [ ] **[~] 3.4 Give debugging a cause frontier.** <!-- deferred: same entry condition -->
      `systematic-debugging` generates one hypothesis at a time. The same
      candidate discipline applies to causes rather than fixes, with the
      cheapest discriminating probe first and no patch until a cause survives.
- [ ] **[~] 3.5 Count what a hook would have blocked, and block nothing.** <!-- deferred: same entry condition, plus a capture bar this tree has not met -->
      Observation-only: how often a form-changing edit arrived with no prior
      candidate line, and how often a horizon was exceeded. The last
      trajectory-capture reading in this tree came in under its own bar, so a
      counter built on it reports a number nobody may act on until capture is
      re-measured.
- [ ] **[-] 3.6 A runtime search engine.** <!-- cancelled: the round's own parents kill it, and no measured ranking failure exists to justify it -->
      Beam search, best-first, MCTS, value functions, confidence floats per
      candidate. Cancelled rather than deferred: it answers a *ranking* failure,
      and no measurement in this tree shows ranking as the failing stage. If
      Phases 1–2 and the floor roadmap all land and a ranking failure is then
      measured, that is a new roadmap with its own evidence, not this step.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-07 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The horizon degrades to a label | product | `next justified commitment: implement solution` satisfies any field that asks for a horizon in prose. The round's own review names this as the most likely failure and it is invisible — the field is filled, the behaviour is unchanged | 1.1 replaces the judgement with an enumerated boundary set, so the field's legal values are a closed list and a horizon naming no boundary is a defect on its face | Phase 1 — Define the horizon mechanically |
| 2 | The floor becomes a stutter | product | A boundary at every observation turns one task into ten checkpoints, and routine development is supposed to run with almost no intervention. Over-narrow horizons cost more than premature ones | 1.2 gives a reversible local edit a whole slice deliberately; the narrow horizon is reserved for irreversible and cross-layer work; 1.4 keeps the depth ladder a ceiling | Phase 1 — Define the horizon mechanically |
| 3 | Reopen becomes a loop | implementation | Re-reading the position after every observation is the chess analogy taken literally, and taken literally it does not terminate. This tree already recorded that an uncapped reopen is the known loop shape under another name | 2.2 caps at one reopen per candidate and hands the second contradiction to the existing retry ladder; 2.3 adds a branch to that ladder without changing its budget | Phase 2 — Reopen once, on contradiction, without looping |
| 4 | Phase 3 is read as a plan | product | Five deferred steps and one cancelled step look like committed scope, and a later reader may execute them because they are written down. The round's self-critique made exactly this point about its own parent: good as a map, too large as an order | Every Phase-3 step carries `[~]` with its entry condition inline; 3.6 is `[-]` rather than `[~]`, so it carries no follow-up obligation; the phase states that a delete verdict closes it unbuilt | Phase 3 — Everything that waits for a number |
| 5 | The two fields drift from the prediction | implementation | `next-commitment` and `revisit-if` live in `## Decisions` while the prediction lives in `## Predictions`. Two sections, one subject — the binding is prose and nothing checks it | 1.3 names the chosen candidate in `## Predictions` so both sections point at the same identifier; 2.4 makes `killed-if` the checkable half, which is the field a falsification test can actually read | Phase 1 — Define the horizon mechanically |

## Acceptance Criteria

- [ ] AC-1 — The horizon is defined by an enumerated boundary set, and a
      horizon that names no boundary from that set is reportable as malformed.
- [ ] AC-2 — Three reversibility classes produce three different horizon
      widths from one candidate shape, with the reversible-local case wider
      than the irreversible case.
- [ ] AC-3 — `src/rules/notes-first-reasoning.md` binds the prediction to the
      chosen form and carries the next-commitment boundary, without adding a
      section or a store, and the projection regenerates byte-identically.
- [ ] AC-4 — A contradicted prediction reopens the decision from the existing
      candidate list exactly once, and the second contradiction escalates
      through the unchanged retry ladder.
- [ ] AC-5 — A falsified `killed-if` returns its candidate to the set.
- [ ] AC-6 — Every Phase-3 step is `[~]` or `[-]` and carries its entry
      condition or its cancellation reason inline, so no step in it is
      executable without the floor roadmap's published verdict.
