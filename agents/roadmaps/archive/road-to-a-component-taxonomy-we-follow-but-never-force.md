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

- [x] **1.1 Add a taxonomy-detection step to the UI audit.** Read the component
      directory layout and record a single state field naming the taxonomy the
      project evidences, or `none`. Detection is layout-and-naming only — a
      declared convention in the project's own docs outranks an inferred one.
      verify: running the audit against a fixture tree whose components sit in
      named granularity folders records that taxonomy; a flat fixture records
      `none`

      **Evidence.** `work_engine/taxonomy/detect.ts` +
      `existing-ui-audit` § 1b; two recorded keys, `component_taxonomy` and
      `component_root`, validated in `state.ts`.

      ```
      $ npx vitest run tests/scripts/work_engine/taxonomy_detect.test.ts
       ✓ Phase 1.1 > a tree whose components sit in named granularity folders
         records that taxonomy          -> atoms/molecules/organisms, inferred
       ✓ Phase 1.1 > a flat tree records `none`
       ✓ Phase 1.1 > a root with no component directory at all records `none`
         and does not throw
       ✓ Phase 1.1 > a non-existent root degrades to `none` rather than raising
       ✓ Phase 1.1 > a declared convention in the project docs outranks an
         inferred one                   -> primitives/patterns/features, declared
       ✓ Phase 1.1 > a declared tier that does not exist on disk is dropped
       ✓ Phase 1.1 > a backticked name in prose is a mention, not a declaration
       ✓ Phase 1.1 > every result carries evidence naming what was read
      ```

      The `declared` fixture is the load-bearing one: inference alone FAILS on
      it (two lexicon names in four buckets, below the majority floor), and
      `features` is in no lexicon. Only the project's own declaration produces
      a taxonomy there, and it produces the project's own three names — which
      is what "follow it, never force it" has to mean in practice.
- [x] **1.2 Pin the false-positive direction.** A fixture whose folder names
      coincidentally collide with taxonomy words but whose layout does not
      evidence one must record `none`.
      verify: the collision fixture records `none`, and the test fails if the
      detector returns a taxonomy for it

      **Evidence — and a finding the verify line as written would have missed.**
      The `collision` fixture (`checkout` / `billing` / `molecules`) does record
      `none`, but a sabotage probe showed it pins the two refusal floors only
      *together* and neither one alone:

      ```
      probe A: MIN_TIERS 2 -> 1        -> collision STILL records `none`
                                          (1 hit / 3 buckets = 0.33 < majority)
      probe B: TIER_MAJORITY 0.6 -> 0.3 -> collision STILL records `none`
                                          (1 hit < the 2-tier floor)
      ```

      Each floor masked the other, so the mitigation the risk register names
      for its highest-ranked risk had no test that could fail. Two fixtures
      were added, each built so that exactly one floor stands between the tree
      and a wrong taxonomy:

      - `single-tier` — one bucket, one lexicon hit. Majority share is 1.0, so
        only `MIN_TIERS` refuses it.
      - `domain-heavy` — `atoms` + `molecules` among `checkout` / `billing` /
        `shipping`. Two hits clears `MIN_TIERS` outright, so only the 0.4 share
        refuses it.

      Re-run of both probes against the new fixtures. **Corrected after an
      independent review:** the line below originally read "each fails exactly
      the test for its own floor, and nothing else", which its own printed
      output contradicts — both probes show TWO failures, and the second is a
      constants-only assertion that fails under either probe because it asserts
      the constant that was changed. That test is now detector-driven (see
      § Review round), so the isolation claim holds for the fixture tests and
      the shared test is honestly shared:

      ```
      probe A (MIN_TIERS 2 -> 1):
        x Phase 1.2 > one lexicon hit is never enough, whatever the bucket count
        x Phase 1.2 > a lone tier-shaped bucket records `none`
                      - the MIN_TIERS floor alone
        Tests  2 failed | 15 passed (17)

      probe B (TIER_MAJORITY 0.6 -> 0.3):
        x Phase 1.2 > one lexicon hit is never enough, whatever the bucket count
        x Phase 1.2 > a tier-shaped minority among domain folders records `none`
                      - the majority floor alone
        Tests  2 failed | 15 passed (17)

      restored from copy:  Tests  17 passed (17)
      ```

## Phase 2 — Conform where a taxonomy exists

- [x] **2.1 Make the component-authoring step read the detected field.** When
      the field names a taxonomy, a new component is placed and named inside it,
      and the step says which taxonomy it is conforming to.
      verify: with the field set, the authoring step's output names the taxonomy
      and the target directory; with the field `none`, its output is unchanged
      from today

      **Evidence.** `work_engine/taxonomy/place.ts` reads the recorded tier
      list *by name*; `apply.ts` emits the conformance lines;
      `ui-component-architect` carries the authoring instruction.

      ```
      $ npx vitest run tests/scripts/work_engine/taxonomy_place.test.ts
       ✓ Phase 2.1 > places a component inside the tier the project itself names
       ✓ Phase 2.1 > matches a tier hint across singular/plural and case
       ✓ Phase 2.1 > conforms to a taxonomy whose tier names are in no lexicon
       ✓ Phase 2.1 > the apply step names the taxonomy and the target directory
       ✓ AC-2 > `none` yields no tier, no directory and no gap
       ✓ AC-2 > `none` emits no conformance lines at all
       ✓ AC-2 > the apply output is byte-identical with `none` and with the
                field absent
       ✓ AC-2 > an unset audit slot changes nothing either
      ```

      **A second masking finding, in this diff's own code.** `apply.ts`
      re-checked `taxonomy === NO_TAXONOMY` although `read_tiers` in `place.ts`
      already owns that invariant. With both present, either could be deleted
      and every AC-2 test still passed:

      ```
      probe D: apply.ts drops its `none` check   -> Tests 12 passed (12)
      probe E: read_tiers drops its `none` check -> 2 failed, but the
               apply-level byte-identical test STILL passed
      ```

      AC-2 is the roadmap's stated constraint, not a preference, so a duplicate
      guard that hides a regression in the real one is the wrong shape. The
      duplicate was removed and the invariant left with a single owner, which
      `place.ts`'s own contract already claimed. The probe now reaches every
      AC-2 test:

      ```
      probe F: the sole AC-2 guard removed
        x AC-2 > `none` yields no tier, no directory and no gap
        x AC-2 > `none` emits no conformance lines at all
        x AC-2 > the apply output is byte-identical with `none` and with the
                 field absent
        Tests  3 failed | 9 passed (12)

      restored from copy:  Tests  12 passed (12)
      ```
- [x] **2.2 Surface a conformance gap rather than silently diverging.** A
      component the step cannot place inside the detected taxonomy is reported
      with the reason, not placed elsewhere without a word.
      verify: a fixture component that fits no tier produces a named gap line

      **Evidence.**

      ```
       ✓ Phase 2.2 > a component whose tier is not in the taxonomy is reported
                     with the reason
       ✓ Phase 2.2 > a component carrying no tier at all is a gap, never a guess
       ✓ Phase 2.2 > a gap is never placed somewhere else instead
       ✓ Phase 2.2 > the gap surfaces in the apply output as its own line
      ```

      Sabotage — make an unmatched tier fall back to the first tier, which is
      the shortest way to "place everything" and is exactly the silent
      divergence this step forbids:

      ```
      probe C: `tiers.find(...) ?? tiers[0]`
        x Phase 2.2 > a component whose tier is not in the taxonomy is reported
                      with the reason
        x Phase 2.2 > a gap is never placed somewhere else instead
        x Phase 2.2 > the gap surfaces in the apply output as its own line
        Tests  3 failed | 9 passed (12)

      restored from copy:  Tests  12 passed (12)
      ```

## Phase 3 — Offer it where none exists

- [x] **3.1 Add the offer to the greenfield halt as a fourth option.** The halt
      at `existing-ui-audit` § 7 gains one numbered option adopting a
      granularity convention, and `greenfield_decision` gains the matching
      value. The existing recommendation line stays a single line naming one
      number, per the reply-shape rule.
      verify: the halt renders four options and exactly one recommendation line;
      `greenfield_decision` accepts the new value

      **Evidence.** The option lives in `directives/ui/audit.ts` and in
      `existing-ui-audit` § 7; the value lives in a single exported
      `GREENFIELD_DECISIONS` list that both the schema and the halt read, so an
      offered option and an accepted value cannot drift apart.

      ```
      $ npx vitest run tests/scripts/work_engine/taxonomy_greenfield.test.ts
       ✓ Phase 3.1 > renders exactly four numbered options
       ✓ Phase 3.1 > the fourth option is the granularity convention
       ✓ Phase 3.1 > carries exactly one recommendation line, naming one number
       ✓ Phase 3.1 > the recommendation still names option 1, unchanged
       ✓ Phase 3.1 > `greenfield_decision` accepts the new value
       ✓ Phase 3.1 > the three pre-existing values keep working
       ✓ Phase 3.1 > an unknown value is still rejected
       ✓ Phase 3.1 > picking it puts the run on the scaffold path rather than a
                     dead end
      ```

      Three sabotage probes, one per failure mode this step can have:

      ```
      probe G: option 4 removed from the halt
        x renders exactly four numbered options
        x the fourth option is the granularity convention

      probe H: `granularity_convention` removed from GREENFIELD_DECISIONS
        x `greenfield_decision` accepts the new value

      probe I: the scaffold gate stops accepting `granularity_convention`
        x picking it puts the run on the scaffold path rather than a dead end

      restored from copy:  Tests  11 passed (11)
      ```

      Probe I is the one worth naming: without it, option 4 would render, be
      accepted by the schema, and then scaffold nothing at all.
- [x] **3.2 Keep declining cheap and terminal.** A user who declines the offer
      has it recorded, and a re-run does not re-offer it.
      verify: with the decline recorded, a second run emits no halt for this
      question

      **Evidence.** A recorded `greenfield_decision` makes the halt a no-op, so
      declining costs one number once. Accepting is equally terminal, and a
      project that already has components is never offered it at all.

      ```
       ✓ Phase 3.2 > a recorded decline ends the question; a second run emits
                     no halt          (checked for bare / external_reference /
                                       scaffold, first run and re-run)
       ✓ Phase 3.2 > accepting is equally terminal
       ✓ Phase 3.2 > a non-greenfield project is never offered the convention
                     at all
      ```

## Acceptance criteria

- [x] AC-1 — A project evidencing a granularity taxonomy has it recorded by the
      audit, and a component added afterwards is placed inside it.
- [x] AC-2 — A project evidencing none has `none` recorded, and the authoring
      step behaves exactly as it does today. **This is the constraint, not a
      preference:** holding to the project's own structures is the owner's
      standing rule, and a change that makes the suite impose a taxonomy on such
      a project fails this criterion whatever else it achieves.
- [x] AC-3 — The greenfield halt offers the convention and records a decline as
      terminal.
- [x] AC-4 — No file in `src/` hard-codes a five-level taxonomy, and no tier
      carries a numeric cap.
- [x] AC-5 — The false-positive fixture from 1.2 is green.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-09-29 | reviewer: agent -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Detection infers a taxonomy a project never chose, and the suite then enforces it | product | Step 1.1 infers a taxonomy from directory layout and naming alone. Granularity words are ordinary English — a project with folders named for its own domain can read as evidence of a convention it never adopted. The inferred field then feeds Phase 2, which places every new component inside it, so a single wrong inference becomes a standing imposition on a project that organises its components some other way. That is the exact failure the owner's standing rule forbids. | Step 1.2 pins the false-positive direction with its own fixture: a tree whose folder names collide with taxonomy words but whose layout evidences none must record `none`, and the test fails if the detector returns a taxonomy. Step 1.1 makes a declared convention in the project's own docs outrank an inferred one, so evidence beats inference wherever the project has said anything. | Phase 1 — Detect what the project already chose |
| 2 | The conformance step becomes the hard-coded taxonomy the archived record refused | implementation | Once Phase 2 must place a component inside a named tier, the shortest implementation is a compiled-in list of tier names with placement rules per tier. That is the five-level taxonomy this suite already refused to hard-code, arriving through the back door as an implementation detail rather than as a decision, and it would override the project's own tier names wherever they differ. | AC-4 forbids any hard-coded five-level set in `src/` and any per-tier numeric cap, so the compiled-in list fails acceptance rather than shipping quietly. Step 2.1 reads the detected field by name and conforms to whatever it holds, and Step 2.2 reports a component it cannot place as a named gap instead of forcing it into a tier the project does not have. | Phase 2 — Conform where a taxonomy exists |
| 3 | A fourth greenfield option turns one decision into a two-dimensional question | implementation | The halt at `existing-ui-audit` § 7 currently answers with one number across three options. Adding a granularity convention is a different axis from scaffold-versus-bare, so the natural shape is a second block or an option grid — which needs a structured reply such as `1a`, and that is the multi-question shape the reply-shape rule forbids. | Step 3.1 adds the convention as one more numbered option in the existing block rather than as a second axis, and its verify asserts the halt renders four options and exactly one recommendation line. A single number still answers it, which is the property the rule actually requires. | Phase 3 — Offer it where none exists |
| 4 | The offer is declined every time and the detection never fires, so the work buys nothing | product | Both halves are conditional on the consumer: the detection only pays off in projects that already use a taxonomy, and the offer only pays off in greenfield projects that accept it. If neither population exists among real consumers, five steps of machinery sit in the tree doing nothing and still cost maintenance on every audit run. | The work is cheap by construction — three of the five steps are fixtures and a state field, so the downside is bounded before it is spent. Step 3.2 records a decline as terminal so a universally-declined offer stops re-asking, and if the decline proves universal the offer is removed while the detection is kept, which is the half the owner's turn names as the standing rule. | Phase 3 — Offer it where none exists |

## Closing evidence

**The roadmap's own citations reproduce.** All three were re-checked against
`origin/main` before any step was built, with the measurement unit stated: line
numbers in the file as `git show origin/main:<path>` renders it.

| Citation | Reproduces | What is there |
|---|---|---|
| `ui-component-architect/SKILL.md:157-183` | yes | the counter-measurement table and the "the tier itself is not computable" finding |
| `ui-component-architect/SKILL.md:61` | yes | "Read `DESIGN.md` § Owned components first" |
| `existing-ui-audit/SKILL.md:258-281` | yes | the greenfield halt, with exactly three options |

No figure had to be discarded and nothing was carried forward unverified.

**Final run.**

```
$ npx vitest run tests/scripts/work_engine/taxonomy_{detect,place,greenfield}.test.ts
 ✓ tests/scripts/work_engine/taxonomy_detect.test.ts     (17 tests)
 ✓ tests/scripts/work_engine/taxonomy_greenfield.test.ts (11 tests)
 ✓ tests/scripts/work_engine/taxonomy_place.test.ts      (12 tests)
 Test Files  3 passed (3)
      Tests  40 passed (40)
```

**AC-4, restated as a check rather than a claim.** A test walks the modules
under `work_engine/taxonomy/` — narrower than AC-4's "no file in `src/`", and
the test says so — and fails on a per-tier cap written as an object entry, an
array-valued entry or a named constant. The recorded taxonomy is the project's
own tier list: three tiers in the tiered fixture, three in the declared one,
and the declared one's names appear in no lexicon at all.

**One AC-4 grounding was false and is withdrawn.** This section previously said
the lexicon "is a `Set` — unordered by construction, so it cannot encode a level
sequence", and the test asserted `instanceof Set` on that basis. A JavaScript
`Set` iterates in INSERTION order, and the lexicon's first five entries were one
vocabulary's five levels in their own sequence — so the claim was false and the
test could not have caught it. The lexicon is now held alphabetically, which is
checkable and is a level sequence in no vocabulary, and the test asserts that
instead. Iteration order is still never read for a decision.

## Review round — an independent review of the finished branch

A `general-purpose` subagent reviewed the diff against `origin/main` with a
neutral prompt (scope and questions stated; no expected verdict). It returned
seventeen findings. What follows is what each one cost and what was done.

### The blocker: two golden transcripts, and why the evidence above missed them

`_halt_greenfield` gained a fourth question line, and two locked Golden
Transcript baselines pin that halt at seven:

```
FAIL tests/golden/golden_replay.test.ts        > GT-U9  drifted (1 diff)
FAIL tests/golden/golden_replay.shard1.test.ts > GT-U10 drifted (1 diff)
     [halt.questions] halt[cycle-02].questions: len 7 -> 8
```

**The verify lines were satisfied and the branch was still red**, because every
run recorded above named only the three new taxonomy files. A step's verify line
bounds what it must prove, not what its change can break — and a halt line is
exactly the kind of surface a frozen transcript watches. Re-captured with
`tests/golden/capture.ts --scenarios GT-U9,GT-U10`; the diff is the one option
line and the checksums, nothing else.

```
$ npx vitest run tests/golden/ tests/scripts/work_engine/
 Test Files  98 passed (98)
      Tests  924 passed (924)
```

### The rank-1 risk was firing, at a ratio no fixture covered

The register's rank-1 risk is an inferred taxonomy a project never chose. The
three refusal fixtures sat at 1-of-3, 1-of-1 and 2-of-5. The review probed
**2-of-3** — `components/{layout, pages, forms}`, an entirely ordinary kind
split — and got:

```
{"taxonomy":"layout/pages","source":"inferred"}
```

Every `forms` component would then have been a conformance gap on a project
with no taxonomy. `layout`, `page`, `block`, `element`, `part` and `cell` are
ordinary folder names as well as granularity words, so the share floor was the
only thing standing there and 0.6 let 0.67 through. It is 0.7 now, pinned by a
`kind-split` fixture.

The mirror failure came with it: `COMPONENT_SUFFIXES` includes `.ts`, so
`hooks/`, `utils/` and `types/` counted as buckets and dragged a genuine
`atoms/molecules/organisms` tree to 3-of-6 and `none`. Three ordinary siblings
were enough to hide a real taxonomy. Support folders are excluded from the
denominator, never from the matches, pinned by a `with-support` fixture. Raising
the floor alone would have made that half worse, which is why both moved
together.

### Two holes in AC-2, the criterion this roadmap calls the constraint

- **`'None'` defeated it.** The field is written by an agent, so a case variant
  is reachable, and an exact sentinel comparison read it as a one-element tier
  list: a project with no taxonomy got a "conforming to `None`" banner and a gap
  line per component. Compared case-insensitively now.
- **A missing `component_root` was guessed.** `|| DEFAULT_COMPONENT_ROOT` handed
  a project rooted at `app/components` a `src/components/` path with no gap and
  no warning — the same failure as placing into a tier the project does not
  have, at the other end of the path. It reports a named gap now, and the banner
  says "an unrecorded component root" rather than asserting one.

### Three assertions that proved less than they said

- The `MIN_TIERS` / `TIER_MAJORITY` test asserted the two constants and never
  called the detector; deleting both floors from the comparison passed it. It
  drives the detector now, and probe M below fails it.
- The `instanceof Set` assertion is withdrawn (above).
- The Phase 3.2 "re-run" called `auditRun` twice on the same state, which
  mutates nothing the halt reads — the same assertion twice. The re-run property
  is now proved against a state rebuilt from the serialised decision.

### The documented command was a no-op

`existing-ui-audit` § 1b tells the agent to RUN `detect.ts`. It had no entry
block, so `npx tsx .../detect.ts` exited 0 and printed nothing — an agent
following the instruction literally got silence and then invented the two state
keys. It has a `main` printing JSON for `--root`, with tests that it prints the
detected taxonomy and exits 0 on `none` as well.

### Also fixed

`ui_design.components[].tier` had no producer contract (documented in `state.ts`
and instructed in `ui-component-architect`); `GRANULARITY_CONVENTION` was a bare
literal in four places and is now owned by `state.ts` and imported by both gates,
so a rename cannot silently leave option 4 scaffolding nothing; a duplicate
`MIN_TIERS` guard in `_declared_tiers`' caller — the same masking shape this
branch removed from `apply.ts` — is gone; a bolded declaration item
(`- **\`atoms\`** — ...`) was dropped by the regex and is read now; the AC-4 cap
check covers array-valued and named-constant shapes; and four doc claims that
contradicted the code (a misplaced JSDoc, a stale "three documented choices", a
halt message omitting the fourth value, "stdlib-free" on a module importing one
that reads `node:fs`) are corrected.

### Probes for the new tests

Each shown red by breaking exactly what it guards, then restored from a copy.

```
probe J  share floor 0.7 -> 0.6            x an ordinary kind split is not a taxonomy, at 2 of 3
probe K  support folders counted again     x support folders do not suppress a taxonomy that is really there
probe L  bolded-name regex reverted        x a bolded declaration list item is still a declaration
probe M  both floors deleted               x collision / one-hit / kind-split / single-tier / domain-heavy  (5 failed)
probe N  lexicon order disturbed           x the lexicon is held alphabetically
probe O  sentinel compared case-sensitively x case variant is still no taxonomy (2 failed)
probe P  missing root guessed again        x no recorded root is a gap (2 failed)

restored from copy:  detect 23 passed · place 16 passed · greenfield 11 passed
```

Probe M is the one worth naming: under the old constants-only assertion it would
have failed one test; it now fails five, which is what the floors were always
supposed to be guarding.

### Findings not acted on

- **AC-4's check is narrower than AC-4's wording** (modules under `taxonomy/`,
  not all of `src/`). Widened in shape but not in scope, and the test now says
  so in a comment rather than leaving the reader to infer it.
- **The inferred tier order is alphabetical, not the project's.** Documented on
  the field rather than changed: no filesystem fact states a level sequence, and
  nothing downstream reads the order.
- **`estate_offset_exempt` on this roadmap argues for parking the work.** That is
  authoring-time frontmatter from the intake round, left as the record of what
  was decided then.
