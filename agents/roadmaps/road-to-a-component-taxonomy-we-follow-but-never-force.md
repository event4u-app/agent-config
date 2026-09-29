---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "The one archivable candidate on this subject is already archived — `archive/road-to-component-granularity-vocabulary.md` settled this repository's OWN vocabulary and is closed; re-opening it to carry a consumer-project obligation would put a rule about other people's repositories inside a roadmap whose goal sentence is about this one. Parking this instead drops the only owner-authored demand in the source set, which is the outcome the ratchet is not trying to buy."
relates:
  - slug: road-to-component-granularity-vocabulary
    relation: extends
---
# Road to a component taxonomy we follow but never force

> **Source:** `agents/tmp.old/inbox-2026-09-ab/t05/` — one owner-authored turn
> inside a sixteen-review transcript, recorded verbatim in § Context. It is the
> only user-authored demand in the whole source set, and it is the fourth
> arrival of this subject.

## Goal

When a consumer project already organises its components under a declared
granularity taxonomy, this suite detects that and conforms to it for every
component it adds. When a project has none, the suite offers one and aims for
it unless the user declines. Neither case ever imposes a taxonomy on a project
that has chosen otherwise. Finished means: the UI-audit step records the
detected taxonomy as a state field, the component-authoring step reads it, and
the greenfield halt carries the offer as one of its numbered options.

## Context — the demand, and what the tree answers today

The owner's turn, translated and paraphrased so no quoted block is needed: not
forcing the taxonomy is correct, and holding to the project's own structures is
the standing rule — **but** where a project uses the taxonomy the suite should
follow it and implement it as well as it can, and for new projects the suite
should propose and aim for it unless the user says otherwise.

Three facts re-derived at current `main`:

1. **The non-forcing half is satisfied and should stay that way.**
   `src/skills/ui-component-architect/SKILL.md:157-183` uses the tier
   vocabulary only as a counter-measurement, showing that no export count or
   prop count assigns a tier — the reason the five-level taxonomy is not
   hard-coded. `archive/road-to-component-granularity-vocabulary.md` states the
   same as a closed goal.
2. **The follow-it-if-present half is absent.** `ui-component-architect`
   reads `DESIGN.md` § Owned components (`:61`) as an inventory; nothing reads a
   project's directory layout to infer a granularity taxonomy, and nothing
   records one for the authoring step to honour.
3. **The propose-it-for-greenfield half is absent.**
   `src/skills/existing-ui-audit/SKILL.md:258-281` has a greenfield halt with
   exactly three options — scaffold tokens + primitives, proceed bare, point at
   an external reference. None offers a granularity convention, and
   `greenfield_decision` has no value that could record one.

**Recurrence — fourth arrival, and the lock does not apply.** The subject
arrived in an earlier consumed round (transcript + two drafted roadmaps),
again in `agents/tmp.old/inbox-2026-09-y/` (five files),
and produced `archive/road-to-component-granularity-vocabulary.md`. That
record's goal sentence settles **this repository's own** component vocabulary
and explicitly refuses to hard-code a five-level taxonomy here. The owner's turn
is about **consumer projects** — a different mechanism, so the earlier
disposition is not a lock on this, and the non-forcing half it established is
preserved verbatim as a non-goal below.

## Non-goals

- Hard-coding a five-level taxonomy anywhere in this suite. The archived
  record's refusal stands unchanged.
- Imposing a taxonomy on a project that uses none, or overriding one that uses
  a different one.
- A tier cap, a prop budget keyed to a tier, or any threshold the archived
  measurement showed is not derivable.

## Phase 1 — Detect what the project already chose

- [ ] **1.1 Add a taxonomy-detection step to the UI audit.** Read the component
      directory layout and record a single state field naming the taxonomy the
      project evidences, or `none`. Detection is layout-and-naming only — a
      declared convention in the project's own docs outranks an inferred one.
      verify: running the audit against a fixture tree whose components sit in
      named granularity folders records that taxonomy; a flat fixture records
      `none`
- [ ] **1.2 Pin the false-positive direction.** A fixture whose folder names
      coincidentally collide with taxonomy words but whose layout does not
      evidence one must record `none`.
      verify: the collision fixture records `none`, and the test fails if the
      detector returns a taxonomy for it

## Phase 2 — Conform where a taxonomy exists

- [ ] **2.1 Make the component-authoring step read the detected field.** When
      the field names a taxonomy, a new component is placed and named inside it,
      and the step says which taxonomy it is conforming to.
      verify: with the field set, the authoring step's output names the taxonomy
      and the target directory; with the field `none`, its output is unchanged
      from today
- [ ] **2.2 Surface a conformance gap rather than silently diverging.** A
      component the step cannot place inside the detected taxonomy is reported
      with the reason, not placed elsewhere without a word.
      verify: a fixture component that fits no tier produces a named gap line

## Phase 3 — Offer it where none exists

- [ ] **3.1 Add the offer to the greenfield halt as a fourth option.** The halt
      at `existing-ui-audit` § 7 gains one numbered option adopting a
      granularity convention, and `greenfield_decision` gains the matching
      value. The existing recommendation line stays a single line naming one
      number, per the reply-shape rule.
      verify: the halt renders four options and exactly one recommendation line;
      `greenfield_decision` accepts the new value
- [ ] **3.2 Keep declining cheap and terminal.** A user who declines the offer
      has it recorded, and a re-run does not re-offer it.
      verify: with the decline recorded, a second run emits no halt for this
      question

## Acceptance criteria

- [ ] AC-1 — A project evidencing a granularity taxonomy has it recorded by the
      audit, and a component added afterwards is placed inside it.
- [ ] AC-2 — A project evidencing none has `none` recorded, and the authoring
      step behaves exactly as it does today. **This is the constraint, not a
      preference:** holding to the project's own structures is the owner's
      standing rule, and a change that makes the suite impose a taxonomy on such
      a project fails this criterion whatever else it achieves.
- [ ] AC-3 — The greenfield halt offers the convention and records a decline as
      terminal.
- [ ] AC-4 — No file in `src/` hard-codes a five-level taxonomy, and no tier
      carries a numeric cap.
- [ ] AC-5 — The false-positive fixture from 1.2 is green.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-09-29 | reviewer: agent -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Detection infers a taxonomy a project never chose, and the suite then enforces it | product | Step 1.1 infers a taxonomy from directory layout and naming alone. Granularity words are ordinary English — a project with folders named for its own domain can read as evidence of a convention it never adopted. The inferred field then feeds Phase 2, which places every new component inside it, so a single wrong inference becomes a standing imposition on a project that organises its components some other way. That is the exact failure the owner's standing rule forbids. | Step 1.2 pins the false-positive direction with its own fixture: a tree whose folder names collide with taxonomy words but whose layout evidences none must record `none`, and the test fails if the detector returns a taxonomy. Step 1.1 makes a declared convention in the project's own docs outrank an inferred one, so evidence beats inference wherever the project has said anything. | Phase 1 — Detect what the project already chose |
| 2 | The conformance step becomes the hard-coded taxonomy the archived record refused | implementation | Once Phase 2 must place a component inside a named tier, the shortest implementation is a compiled-in list of tier names with placement rules per tier. That is the five-level taxonomy this suite already refused to hard-code, arriving through the back door as an implementation detail rather than as a decision, and it would override the project's own tier names wherever they differ. | AC-4 forbids any hard-coded five-level set in `src/` and any per-tier numeric cap, so the compiled-in list fails acceptance rather than shipping quietly. Step 2.1 reads the detected field by name and conforms to whatever it holds, and Step 2.2 reports a component it cannot place as a named gap instead of forcing it into a tier the project does not have. | Phase 2 — Conform where a taxonomy exists |
| 3 | A fourth greenfield option turns one decision into a two-dimensional question | implementation | The halt at `existing-ui-audit` § 7 currently answers with one number across three options. Adding a granularity convention is a different axis from scaffold-versus-bare, so the natural shape is a second block or an option grid — which needs a structured reply such as `1a`, and that is the multi-question shape the reply-shape rule forbids. | Step 3.1 adds the convention as one more numbered option in the existing block rather than as a second axis, and its verify asserts the halt renders four options and exactly one recommendation line. A single number still answers it, which is the property the rule actually requires. | Phase 3 — Offer it where none exists |
| 4 | The offer is declined every time and the detection never fires, so the work buys nothing | product | Both halves are conditional on the consumer: the detection only pays off in projects that already use a taxonomy, and the offer only pays off in greenfield projects that accept it. If neither population exists among real consumers, five steps of machinery sit in the tree doing nothing and still cost maintenance on every audit run. | The work is cheap by construction — three of the five steps are fixtures and a state field, so the downside is bounded before it is spent. Step 3.2 records a decline as terminal so a universally-declined offer stops re-asking, and if the decline proves universal the offer is removed while the detection is kept, which is the half the owner's turn names as the standing rule. | Phase 3 — Offer it where none exists |
