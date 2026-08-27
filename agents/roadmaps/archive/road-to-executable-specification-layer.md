---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-27
relates: []
# relates: grepped every active, later and archived roadmap for `gherkin`,
# `acceptance test`, `behat`, `cucumber`, `executable spec` and `mutation`.
# Two hits, both consumed rather than related: the archived
# road-to-test-independence-and-mutation-evidence.md records the MEASURED
# refusal of a self-mutation rig, which Phase 3 respects rather than
# relitigates, and archive/road-to-evidence-gated-change.md owned test ORDERING
# (red-before-green) and completed on 2026-08-27 while this file was being
# authored — a different question from whether an executable behaviour
# contract exists at all, and now a landed one.
estate_growth_exempt: "Charges nothing at the current base — the change reads -1 active and +0 blockers, because two roadmaps flipped ready to draft and main's own blocker-heading repair (#1689) absorbed the added blocker. The claim is kept rather than deleted because the base moves under this branch (three merges during authoring, each shifting the floor) and a claim that is unnecessary at one base is required at the next; deleting it would mean re-deriving the argument. What it authorises if it fires: one blocker on this file, `phase-2-and-3-need-demand-not-only-a-stack`, which is a CORRECTION rather than growth — the council (2/2, 2026-08-27) rejected this file for shipping status:ready across three phases while its own blocker recommended Phase 1 only, so the blocker records a gate that was already true and undeclared. The gate has no field for that distinction. The original count claim stands unchanged on its measurement: `grep -rniIE 'gherkin|cucumber|behat|given.when.then' src/` returns exactly ONE hit across 299 skills, and that hit is a rubric line telling a reviewer acceptance criteria should be Given-When-Then — the suite grades the shape and teaches nobody to execute it. Companion: zero of 299 skills mention mutation testing while `grade_target_readiness.ts:183-189` grades consumer repos on exactly that dimension."
estate_offset_exempt: "NO OFFSET IS CLAIMED FOR THIS FILE. The first draft cited the same source-consolidation as the sibling roadmap, and the council (2/2, 2026-08-27) was right that one avoided expansion cannot independently offset two additions; the consolidation offset is claimed by road-to-runtime-governance-flip.md alone. This addition therefore rests on its growth claim only, and it is the weaker of the two — Phase 1 is earned by the measurement, Phases 2 and 3 are gated behind a demand blocker precisely because a measured absence is not a mandate to build."
---
# Road to an executable specification layer — the suite grades a capability it does not teach, on both axes

> **Source:** `agents/tmp.old/uncle-bob-swarm/` (2026-08-27) — a two-session
> agent swarm analysing this tree against an external acceptance-pipeline
> reference, plus the transcript. Drafted against `f2ed85e`, which **was**
> `origin/main` at authoring time; `d55d1f10` merged mid-authoring and every
> anchor cited below was re-verified against it. Sibling roadmap:
> `road-to-runtime-governance-flip.md` from the same source. **Second arrival:**
> the same external source was analysed on 2026-08-22
> (`agents/tmp.old/robert-c-martin/`) and that round is what produced
> `src/config/assurance-capability-registry.json`. See § Why this is the second
> time.

## Goal

An agent working in a consumer repo can be told, by this suite, when a change
needs an executable behaviour contract and when it does not. That is Phase 1 and
it is what the measurements below earn.

If and only if demand arrives (see the first blocker), the same agent can write
such a contract that runs on a runner the consumer **already had**, or on one the
consumer explicitly decided to adopt — the two branches are different and both
are named, because the first draft claimed no new framework and then proposed
one. Nothing here builds a parser or an intermediate representation.

The suite also stops carrying an unexplained asymmetry: it grades consumer repos
on mutation-test strength while teaching nothing about it. Whether that is closed
by adding the guidance or by explaining the dimension is the second blocker's
question — the Goal is that it is answered, not that the grader is withdrawn.

## The two measurements this exists for

Both reproduced at HEAD, both cheap to re-run:

| Measurement | Command | Result |
|---|---|---|
| Executable behaviour specification, taught | `grep -rniI 'gherkin\|cucumber\|behat\|given.when.then' src/` | **1 hit** — `src/skills/judge-artifact-completeness/rubrics/ticket-quality-score.json:21`, a rubric asking a *reviewer* to check that acceptance criteria are Given-When-Then shaped |
| Mutation testing, taught | `grep -rliI 'mutation test\|stryker\|infection\|mutmut' src/skills/` | **0 files** of 299 |
| Mutation testing, graded in consumers | `src/scripts/grade_target_readiness.ts:178-190` (at authoring time) | dimension `test-strength`, graded on `stryker.conf.*` / `infection.json` / `[tool.mutmut]` presence — **and, uncorrected until 2026-08-27, also on `fast-check` / `hypothesis` presence**, so the row understated what the number was mixing. **Superseded:** the dimension is now `advanced-testing-signals` and emits no grade. See § blocker `grading-a-dimension-nothing-teaches`. |
| Skill corpus size | `find src/skills -name SKILL.md \| wc -l` | 299 |

The asymmetry is the finding. The `test-strength` dimension is not a knockout,
which softens it — but the suite still hands a consumer a grade on evidence it
has no skill to help them produce, and produces none itself.

**Resolved 2026-08-27, and not the way this paragraph expected.** The council
did not close the asymmetry by adding the missing skill or by deleting the
measurement — it found the grade itself invalid. Config presence orders targets
by adoption; the dimension's label claimed effectiveness. Detection is kept and
reported as observations, the number is gone, and the asymmetry dissolves rather
than being closed: the suite no longer grades what it does not teach, while
still telling the consumer what it can see.

The registry already records the second half honestly. `mutation-sensitivity`
sits at `state: degraded` with the limitation written out — "detection only —
the grader reads stryker/infection/mutmut config presence and never runs a
mutation pass" — and names the manual substitute at
`src/skills/testing-anti-patterns/SKILL.md:185`, reproduced verbatim: "No
mutation-testing rig required: comment the control out, run that one spec, put
it back."

## Why this is the second time

`agents/tmp.old/robert-c-martin/` (2026-08-22) analysed the same external source
and produced five roadmaps. Two are archived as complete
(`road-to-agentic-engineering-assurance`,
`road-to-target-project-assurance-readiness`) and three sit in
`agents/roadmaps/stubs/` (`road-to-target-project-bootstrap-enforce`,
`road-to-legacy-target-onboarding-ratchet`,
`road-to-target-project-evidence-contract`).

So the earlier disposition was **not wrong** — it was executed, and
`src/config/assurance-capability-registry.json` (registered 2026-08-23) is its
output. What is new on this arrival is narrower than the source claims: the
*specification* layer, which the first round did not touch, and the mutation
adapter, which the first round explicitly refused. Recording that split is the
point of this section: the recurrence indicts nothing here, and treating it as
fresh would have rebuilt a registry that already exists.

## What this roadmap will NOT build

Carried from the source's own kill register, because each was killed on evidence
and re-proposing it later should cost an argument:

- **A canonical Acceptance IR, a restricted parser, or a generic adapter API.**
  Buildable only against real adapter demand, and the source's own consolidation
  loop moved them behind adoption gates. They stay blueprints.
- **The external toolchain.** Its pins resolve to "latest upstream", which is
  the supply-chain shape this repo's own spawn hardening closed.
- **Gherkin for every change.** The 2026 consensus warning is adopted as a rule
  rather than a caveat: business behaviour with an audience, never a click script.
- **Acceptance-green as a trust signal.** The source's strongest counter-evidence
  is its own reference's `negative-test-experiment`: eight different
  implementations passed the same acceptance suite, one of them with no unit
  specification at all. A green acceptance run is one input, never a verdict.
- **A universal minimum mutation score.** The registry states plainly that no
  such constant exists here and none may be added.

## Phase 1 — Decide when a specification is owed, before writing any

- [x] **1.1 Add the observable-behaviour test to the existing test-first
      surface.** The discriminator is whether a change alters behaviour someone
      outside the code can observe and would describe in their own words. It
      belongs alongside the suite's existing test-ordering guidance rather than
      in a new artefact — `archive/road-to-evidence-gated-change.md` landed the
      ordering, this owns the *whether*.
      verify: **discharged, with the verify string corrected.** `grep -c 'observable behavior' src/skills/test-case-discovery/SKILL.md` returns **2**, one of them inside the added section. The string was written `behaviour` here; `src/config/canonical-terms.yml:79-80` makes `behavior` canonical and `behaviour` a ratcheted variant (`lint_canonical_terms`, 995 violations against a baseline of 1007), so satisfying the literal would have added violations to a tightening gate to pass a verify. The intent — a named discriminator exists and is greppable — is met in the repository's own spelling. The added section `## Does this change owe an executable behavior contract?` names **four** cases answering no (refactor with no behavior change · internal invariant with no external vocabulary · pure boundary or error path with no business reading · a change whose only observer is another part of this system), against a floor of two.
- [x] **1.2 Write the anti-script rule into the same surface.** A specification
      step naming a selector, a timeout, or a keystroke is a defect in the
      specification, not a detail. This is the single highest-value line in the
      whole source set and costs one paragraph.
      verify: **discharged.** `grep -c 'click #' src/skills/test-case-discovery/SKILL.md` returns **1**, and it is the negative example — `When I click #apply-coupon` inside the **Wrong** block. The wrong-then-right pair is a cart/coupon behavior stated twice: once as five interface steps that break on a redesign and survive a moved discount rule, once as three sentences about money. The rule itself is a fenced Iron-Law block, and a portability test closes the section (could the step still be true if the product were a CLI, an API and a web page?).
- [x] **1.3 Reconcile the rubric that already asks for the shape.**
      `judge-artifact-completeness/rubrics/ticket-quality-score.json:21` grades
      acceptance criteria as Given-When-Then. Once 1.1 exists, that rubric line
      should point at it instead of asserting a convention the suite taught
      nowhere.
      verify: **discharged.** `ticket-quality-score.json` → `acceptance_criteria.criterion` now cites `src/skills/test-case-discovery/SKILL.md § Does this change owe an executable behavior contract?` and stops asserting Given-When-Then as the required form: the routing decision moved to the section, and the rubric grades independently-testable outcomes. `gap_signal` gained the anti-script case (`'When I click #submit'` scoring as a gap however well-formed its Given-When-Then), so 1.2 has a consumer inside the judge on the day it lands.

## Phase 2 — One native adapter, integrate before replacing

> **DESCOPED `[-]` 2026-08-27**, whole phase, on the blocker
> `which-stack-gets-the-first-adapter` resolving **(c)** — 2/2 convergent,
> both seats. Held in
> [`stubs/road-to-executable-specification-adapter.md`](../stubs/road-to-executable-specification-adapter.md)
> with its promotion condition. 2.1 was not formally blocked and is descoped
> anyway: both seats found its only named consumer to be the adapter (c)
> declined, and shipping a detector with no consumer is the speculative reuse
> the same verdict rejected.
>
> **Merge note, 2026-08-27.** A parallel session (#1691) corrected 2.1's text
> in the same window: the first draft said "never a second framework" and then
> named Behat alongside Pest, which is a second framework, and `playwright-bdd`
> is an added dependency too unless already installed. Its council (2/2) caught
> the contradiction. That correction is **kept below verbatim** and the descope
> disposition applies on top — a step being descoped is no reason to archive a
> version of it that is known to be wrong, and `preservation-guard` binds on the
> passage either way. The two changes agree on substance: neither ships an
> adapter now.

- [-] **2.1 Reuse an existing runner where one exists; otherwise make the
      adoption explicit.** The first draft said "never a second framework" and
      then named Behat alongside Pest, which is a second framework — the council
      (2/2) caught the contradiction, and `playwright-bdd` is an added dependency
      too unless it is already installed. The honest invariant has two branches:
      an existing Behat, Codeception-BDD or Cucumber setup **is** the runner and
      nothing is introduced beside it; absent one, adopting a runner is an
      explicit dependency decision the consumer makes, not a default this suite
      slips in.
      verify: the detection step returns a named existing runner or an explicit "none detected" across three fixtures, AND the none-detected branch emits an adoption decision rather than a recommendation.
- [-] **2.2 Ship exactly one adapter end to end.** One stack, one worked
      example, one runnable specification that fails before the implementation
      and passes after. Two adapters is where a generic API starts looking
      necessary, and the source's own loop moved that behind a gate.
      verify: the example specification is executed in CI and its recorded run shows the red-then-green transition, not only the green.
- [-] **2.3 Record which stacks are NOT covered.** A partial adapter set that
      does not say so reads as full coverage — the same failure the assurance
      registry avoids by carrying `unknown` states explicitly.
      verify: the adapter surface names every detected-but-unsupported stack, and the count matches the stack-detection skill's own list.

## Phase 3 — Sensitivity, on the unlock condition the registry already wrote

> **DESCOPED `[-]` 2026-08-27**, whole phase, on a second council round
> (2/2 convergent). The mechanism-match test was run first and returned
> **same mechanism**: a changed-surface adapter differs from the refused rig
> in *selection scope*, not in mechanism — both generate mutants and classify
> survivors and timeouts. The archived refusal in
> `archive/road-to-test-independence-and-mutation-evidence.md` is measured (10
> probes in minutes, 3 survivors, hand-probing kept up) and carries its own
> reopen condition — a survivor population too large to hand-probe — which
> **has not fired**. The registry's `revisit_if` describes what would lift a
> `degraded` state; it is not authorization to build past a later,
> evidence-backed refusal, and `mutation-sensitivity.revisit_if` now says so
> in the registry itself. 3.2 and 3.3 are independently blocked by (c). Held
> in [`stubs/road-to-executable-specification-adapter.md`](../stubs/road-to-executable-specification-adapter.md) § 3.

- [-] **3.1 Build the changed-surface mutation adapter, and only that.** The
      registry's `mutation-sensitivity.revisit_if` names the condition verbatim:
      "a mutation adapter ships that runs a changed-surface pass and reports
      survivors and timeouts separately". That sentence is the specification.
      Nothing here relitigates the archived refusal of a whole-tree rig — the
      refusal was measured, and this is the path the measurement left open.
      verify: the adapter reports survivors and timeouts as separate counts on a changed-surface pass over a seeded fixture, and the archived refusal roadmap is cited in the adapter's own header rather than contradicted.
- [-] **3.2 Mutate the specification's own example values.** A behaviour
      contract wired to nothing passes forever. Altering the example values in a
      specification must break the run; if it does not, the specification is
      decorative. This is the cheaper half of the source's acceptance-mutation
      idea and does not need the IR.
      verify: a test alters one example value in the Phase 2.2 specification and asserts the run turns red.
- [-] **3.3 Flip the registry states on evidence, never on completion.** After
      3.1 and 3.2, `mutation-sensitivity` may move off `degraded` for the
      dimensions the adapter actually covers. `e2e-test` stays `unknown` until
      its own probe ships with presence *and* absence fixtures — the registry
      says so, and a state flipped because a sibling phase closed is the
      dishonesty the two-axis model exists to prevent.
      verify: each changed state in `src/config/assurance-capability-registry.json` has an `evidence` field naming a command or test that a reader can run, and `e2e-test` is unchanged.

## Blockers

### blocker: phase-2-and-3-need-demand-not-only-a-stack

- **Status:** open
- **Owner:** maintainer
- **Blocks:** all of Phase 2 and all of Phase 3. Phase 1 lands regardless.
- **What to do:** pick exactly one — (a) require a named consumer request
  before Phase 2 starts: a stack, a change that needed an executable contract,
  and what went wrong without one; (b) start Phase 2 on the maintainer's own
  judgement of which stack matters most, accepting that the adapter is built
  against a hypothesis; or (c) move Phases 2 and 3 into
  `stubs/road-to-runtime-orchestration-substrate.md` and reduce this file to the
  Phase 1 increment.
- **Resolved when:** the choice is recorded here, and for (a) the first
  qualifying request is quoted in this roadmap with its stack and failure case.
- **Recommendation:** (a). The council (2/2, 2026-08-27) rejected the first
  draft on exactly this point and the objection holds: the two measurements
  establish that this suite *teaches* nothing about executable specification or
  mutation testing, which earns Phase 1 — documentation — and does not establish
  that anyone needs an adapter. (c) is cleaner but throws away a scoped design
  that is cheap to keep; (a) keeps it and refuses to build it on a guess.
- **If you do nothing:** Phase 1 lands and the suite gains the routing decision
  it currently lacks, which is the increment the measurement actually bought.
  That is the expected outcome, not a stalled one.

### blocker: which-stack-gets-the-first-adapter

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** Phase 2 steps 2.2 and 2.3, and only once the demand blocker above
  is resolved in favour of building. Phase 1 lands regardless — the
  observable-behaviour test and the anti-script rule are stack-neutral prose —
  and Phase 3.2 only needs whichever specification 2.2 produced.
- **What to do:** pick exactly one — (a) TypeScript via `playwright-bdd`, which
  reuses the Playwright foundation this suite already teaches and therefore adds
  no new runner, but whose value lands on UI flows where this suite's design
  gates already do the most work; (b) Laravel via Behat, which is where the
  suite's PHP depth is greatest and where a business-language contract has the
  clearest audience, but which introduces a runner alongside Pest and needs the
  unit/acceptance boundary stated; or (c) neither first — write Phase 1 only,
  ship it, and let the first real consumer request pick the stack.
- **Resolved when:** the choice is recorded in this roadmap and, for (a) or (b),
  the adapter's own header states which layer it does *not* replace.
- **Recommendation:** (c), then (b). Phase 1 is the part with an argument behind
  it — one measured hit in 299 skills — and it is stack-neutral, so shipping it
  alone is a complete increment. Choosing an adapter before anyone has asked for
  one is how the source set reached 21 phases: (b) is the better guess when a
  request arrives, because the PHP depth is real and the Pest boundary is a
  sentence rather than a design.
- **If you do nothing:** Phase 1 still lands and the suite gains the routing
  decision it currently lacks. That is a real outcome and the recommended one —
  this blocker does not stall the roadmap, it only bounds Phase 2.
- **Resolution — (c), 2026-08-27.** AI council, 2 seats (anthropic + openai),
  **2/2 convergent**, round 1. Substituting for maintainer sign-off under the
  drain mandate; recorded here because a verdict with no record is a silent
  drop. Both seats: ship the stack-neutral Phase 1, let a real consumer request
  pick the stack, and both named (b) Laravel/Behat as the better guess when a
  request arrives — the PHP depth is real and the Pest boundary is a sentence
  rather than a design. One seat raised the only argument against: the rubric
  line at `ticket-quality-score.json` is itself weak evidence that the pattern
  matters, so *implicit* demand may already exist; it resolved the point by
  making that demand the trigger rather than the warrant — "if it generates
  consumer questions about how to *write* these, that's the trigger for (b),
  not waiting for an explicit adapter request". The other seat explicitly
  declined to adopt a request-count trigger, on the grounds that demand
  intensity, maintenance cost and fit are the axes, not arithmetic. Steps 2.2
  and 2.3 are `[-]`; **2.1 is `[-]` too** — not formally blocked, but both seats
  found its only named consumer to be the adapter (c) declined, and both called
  shipping it speculative reuse. All three are held in
  `stubs/road-to-executable-specification-adapter.md` § 2 with the adapter's own
  header obligation carried forward.
- **Revisit-if:** a consumer names a stack **and** a concrete
  executable-specification workflow, or recurring production-validation findings
  show a stack-specific gap that stack-neutral prose cannot close.

### blocker: grading-a-dimension-nothing-teaches

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** nothing. Recorded here because Phase 3 makes it decidable, and a
  finding with no home is a finding that gets lost.
- **What to do:** pick exactly one — (a) leave `grade_target_readiness.ts:183-189`
  as it is, on the grounds that a non-knockout dimension reporting a real
  property of the consumer's repo is legitimate even when this suite teaches
  nothing about it; (b) withdraw the `test-strength` dimension until a skill
  exists, which removes a true reading to avoid an awkward one; or (c) keep it
  and add the missing skill, which is the largest option and the only one that
  removes the asymmetry rather than hiding it.
- **Resolved when:** the answer is recorded, and for (c) a skill exists that a
  consumer can follow to produce the evidence the dimension grades.
- **Recommendation:** (a) until Phase 3.1 lands, then reconsider (c). The
  dimension reads config presence, which is a fact about the consumer's repo
  and true regardless of what this suite teaches; withdrawing it under (b)
  would delete a correct measurement. Once 3.1 exists there is an adapter to
  point a skill at, and (c) stops being speculative.
- **If you do nothing:** the suite keeps grading consumers on a dimension it
  cannot help with. Non-knockout, so nobody fails on it — which is exactly why
  this can sit open without blocking, and also why it would otherwise never get
  looked at.
- **Resolution — neither (a) nor (b) as written: unscore and rename, 2026-08-27.**
  AI council, 2 seats. Round 1 **split** — one seat for (a) with a label fix,
  one for (b); round 2 put the split back and both seats **converged on
  unscoring**. The decisive move was that round 1's (a) seat had already
  conceded the (b) seat's factual point, that config presence is not a reliable
  strength measure. Round 2's argument: a dormant `stryker.conf` and an unused
  `fast-check` dependency both scored, while a rigorous conventional suite with
  neither scored 0 — so the number ordered targets by **adoption** and was read
  as **effectiveness**. Renaming alone would have kept the invalid inference
  behind a better word.

  Shipped, at `src/scripts/grade_target_readiness.ts`: `test-strength` →
  `advanced-testing-signals`; `grade: null`; a new `observations: string[]`
  carrying `mutation-testing-config-detected`,
  `property-testing-library-detected` and
  `mutation-testing-ci-enforcement-detected` independently; and a
  `notDetectable` scoped to **test effectiveness** rather than to the dimension
  — the config *is* detectable, what it implies is not — emitted whether or not
  any observation fires. Three epistemic states are held apart on purpose:
  signal observed, no signal observed, effectiveness not evaluable. An empty
  `observations` array is the second; no `neither-detected` string is ever
  emitted, because that would re-create the verdict the unscore removed. Both
  seats specified this shape independently and it is asserted by
  `tests/scripts/grade_target_readiness.test.ts` § *advanced-testing-signals is
  observed, never graded* (8 specs). Detection is fully preserved; nothing about
  the consumer's repository stopped being reported. The dimension was and stays
  non-knockout, so `grade: null` cannot bind the level — asserted.

  Note the roadmap's own measurement table understated the dimension: it named
  only the mutation probe, while the code also detects **property-based**
  testing (`fast-check`, `hypothesis`), which round 1 did not discuss. Corrected
  in the table above.

  **Three defects in this implementation were found by an independent cross-model
  review after it was written, and all three are fixed here rather than noted.**
  Neither reviewing seat wrote the code or the review prompt's expectations; the
  scope was the whole non-doc delta, split mechanically by file group because it
  exceeded the transport ceiling.

  1. **`mutation-testing-ci-enforcement-detected` overclaimed.** Both seats:
     static matching over a workflow file proves a mutation tool is *referenced*,
     not that the step is enabled, blocking, reached on the required branches, or
     ever executed. One seat argued the `notDetectable` disclaimer covers it; the
     other answered that a consumer is entitled to read a token's name. Renamed
     to `mutation-testing-ci-reference-detected`. The probe is unchanged — only
     the claim it makes.
  2. **The level test was deletion-insensitive.** It asserted
     `grade(full).level > 0`, which stays green if the dimension is removed
     outright, so it proved nothing about the mechanism its own comment claimed.
     Rewritten to assert the relationship: the dimension exists, is `null`, is
     not a knockout, and the level equals an independently-computed minimum over
     knockouts only. Sabotage: deleting the dimension now turns **8** red;
     folding non-knockouts into the level turns **4** red.
  3. **`evidence` and `observations` were two representations of one fact.** The
     ternary reported only the mutation signal when both fired — which the
     `python` fixture does — so the string and the array disagreed about the same
     target. `evidence` is now derived from `observations`. **The first version of
     this fix had no spec behind it and the sabotage passed**, which is the same
     defect class the review had just named; two specs were added and the
     sabotage now turns **2** red.

  One seat also noted the id rename is a breaking contract change for any caller
  doing id lookup. Checked rather than assumed: `grep -rn "test-strength"` over
  the tree returns the two registry `projection` fields and the one test, all
  updated here, and no other consumer.

  One seat proposed numeric reopen thresholds (">20 survivors", ">2hrs"); the
  other rejected them as unsupported by any record here, and they are **not**
  adopted — recorded so a later reader does not inherit an invented cutoff.
- **Revisit-if:** the grader gains **outcome** evidence — survivor and timeout
  counts from a real mutation run, or executed property-test results — together
  with a scoring rule validated against the readiness decision rather than
  assumed from presence.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-27 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The specification layer grows into the infrastructure it was scoped away from | implementation | An IR, a parser and a generic adapter API each look necessary the moment a second stack appears, and the source set already drafted all three. | § What this roadmap will NOT build names them as blueprints, and 2.2 caps the phase at exactly one adapter so the second never arrives inside this roadmap. | Phase 2 — One native adapter, integrate before replacing |
| 2 | A registry state is flipped because a phase closed | product | The assurance registry is only useful while its states track evidence. Closing Phase 3 and flipping `e2e-test` alongside `mutation-sensitivity` would make the whole registry decorative. | 3.3's verify requires an `evidence` field per changed state and explicitly pins `e2e-test` as unchanged. | Phase 3 — Sensitivity, on the unlock condition the registry already wrote |
| 3 | The archived mutation refusal is relitigated | implementation | The obvious reading of "build a mutation adapter" is "build the rig that was refused". The refusal was measured, and re-running it costs the same effort a second time. | 3.1 is scoped to the registry's own `revisit_if` sentence and its verify requires the archived refusal to be cited in the adapter header. | Phase 3 — Sensitivity, on the unlock condition the registry already wrote |
| 4 | The specification becomes a click script | product | The failure mode is not that agents write no specifications — it is that they write selector-and-timeout steps and call the result a behaviour contract. | 1.2 ships the anti-script rule with a wrong-then-right pair in the same phase as the routing decision, so the rule arrives before the first specification does. | Phase 1 — Decide when a specification is owed, before writing any |
| 5 | Phase 1 ships and nothing consumes it | implementation | A routing decision nobody reaches is prose. With the blocker recommending (c), Phase 2 may never start, leaving 1.1 as the whole deliverable. | 1.3 wires the existing rubric to the new section, so the routing decision has a consumer inside the suite on the day it lands, independent of any adapter. | Phase 1 — Decide when a specification is owed, before writing any |

## Acceptance Criteria

**AC-1 and AC-2 are the closure set.** They are what the two measurements bought
and they are stack-neutral. AC-3 to AC-6 belong to Phases 2 and 3 and were
**conditional on the demand blocker resolving in favour of building**. It did
not: the blocker resolved **(c)**, so they close `[-]` with that blocker as the
reason and the roadmap is complete on AC-1 and AC-2. Writing them as
unconditional was the contradiction a parallel council named — a roadmap whose
own blocker recommends shipping Phase 1 alone cannot also require adapter work to
close.

- [x] AC-1 — A single named section in the suite answers "does this change owe an executable behaviour contract?", contains at least two cases answering no, and carries the anti-script rule with a worked wrong-then-right pair.
- [x] AC-2 — `judge-artifact-completeness/rubrics/ticket-quality-score.json:21` no longer asserts a Given-When-Then convention the suite defines nowhere; it references the section from AC-1.
- [-] AC-3 — *(conditional — condition not met)* For one stack, an executable specification runs on a runner the consumer already had or explicitly adopted, and its recorded CI run shows red before the implementation and green after — the green alone does not satisfy this.
- [-] AC-4 — *(conditional — condition not met)* The detected stacks partition exactly into covered and uncovered — `covered ∪ uncovered = detected`, the two sets disjoint — and `uncovered` is non-empty. The first draft required the uncovered count to equal the whole detection list, which with one adapter shipped is arithmetically impossible; a parallel council (2/2) caught it, and that correction is kept here rather than archiving the impossible version.
- [-] AC-5 — *(conditional — condition not met)* Altering one example value in that specification turns the run red, asserted by a test rather than by a claim.
- [-] AC-6 — *(conditional — condition not met)* A changed-surface mutation pass reports survivors and timeouts as separate counts, cites the archived refusal in its header, and every assurance-registry state changed in this roadmap carries an `evidence` field naming a runnable command — with `e2e-test` unchanged.

**Why each of the four is `[-]` rather than open**: AC-3/AC-4 depend on the
adapter and detection that blocker `which-stack-gets-the-first-adapter` → (c)
declined; AC-5 on the specification AC-3 would have produced; AC-6 on the
mutation rig held by a measured refusal whose reopen condition has not fired. All
four are carried verbatim into
`stubs/road-to-executable-specification-adapter.md` § 4 so promoting the stub
restores them rather than re-deriving them.

**No registry `state` was flipped by this roadmap** — the property AC-6 exists to
protect holds even though AC-6 itself is descoped. `mutation-sensitivity` stays
`degraded` and `e2e-test` stays `unknown`; what changed in
`src/config/assurance-capability-registry.json` is the `projection` rename on two
entries, one added `limitations` line recording the unscore, and a `revisit_if`
qualified so it can no longer be read as authorization. Each is a description of
what the grader now emits, verifiable by running it — never a state improved
because a phase closed.
