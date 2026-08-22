---
estate_offset_exempt: "Authored by the 2026-08-22 inbox drain, which consumed 25 dropped artefacts carrying 53 pre-written roadmap drafts in one pass. It ships status: draft, so it is not active work and moves none of the three gated metrics; there is nothing yet to offset. The offset alternatives all cost more than this line: no active roadmap sits at zero open steps, so archiving buys nothing; parking these in later/ is what the estate register calls burial and would hide twenty verified defect sets behind a disposition nobody reviews; and terminating another session's roadmap would be a judgement about their work rather than mine. The blockers these drafts carry will charge this ratchet on the day the maintainer flips one to ready, which is the point at which an offset is a real decision. Charged as one reviewable line, per this gate's own instruction."
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
---
# Road to test independence and mutation evidence

> **Source:** `agents/tmp.old/test-hardeining.txt` — an external analysis
> dropped into the inbox on 2026-08-22, carrying two separate roadmap sketches.
> They are **merged into this one file** deliberately: they share Phase 0, the
> same grader and the same honest-null exit, so running them as two roadmaps
> would spend two estate slots on one experiment. Every `file:line` below was
> re-verified against this worktree; where the source's reference had drifted,
> the current line is written here.

## Goal

Two claims about this package's tests become measurable rather than assumed:
that a test suite written by the same context that wrote the implementation
inherits that context's blind spots, and that a test nobody has watched fail
constrains nothing. When this is finished, either both claims are supported by
a pre-registered measurement and the tree carries a mechanism that acts on
them — or both are recorded as measured nulls and the tree carries the standing
metric that would let a later run re-open the question with new evidence.

**The honest-null exit is written into this file now, before any measurement,
and is not negotiable afterwards.** Phase 3 ships either way, which is the
property that makes Phase 0 worth running: it converts a one-off archaeology
into a metric that keeps accruing.

## Context — what exists, what does not, and one recurrence worth naming

**Mutation testing is not a capability here.** No rig, no tool, no
configuration. Every mention in the tree is either an explicit disclaimer of
one — `src/skills/testing-anti-patterns/SKILL.md:185` says *"No mutation-testing
rig required: comment the control out, run that one spec, put it back"* — or an
ADR recording a hand-mutation of specific tests
(`docs/decisions/ADR-126-internet-reach-operator-tooling.md:127`,
`docs/decisions/ADR-202-anchor-scoring-as-thin-quality-instrument.md:209-212`).
`src/skills/verify-completion-evidence/` mentions it **zero** times.

**The extend point exists and must be extended, not replaced.**
`src/skills/testing-anti-patterns/SKILL.md:171-185` already carries a
hand-mutation gate: *"BEFORE trusting a negative test: Delete or invert the
control it claims to pin. Does it FAIL? RESTORE THE CONTROL IMMEDIATELY"*,
closing with *"A negative test nobody has ever watched fail is a claim, not
evidence."* A tool-assisted variant belongs beside that gate, sharing its
restore discipline. A second, competing gate would split the obligation.

**No orchestration mode separates test authorship.**
`src/skills/subagent-orchestration/SKILL.md` lists nine modes at `:157-217`;
none of them gives the tests to a different context than the implementation.
`test-writer`, `spec-test` and `test_authorship` return **0** hits across
`src/`. The natural second extend point is
`src/skills/subagent-orchestration/prompts/do-and-judge-two-stage.md`, which
already has a stage-0-shaped slot in front of its SPEC COMPLIANCE judge.

### The recurrence, and why it sharpens rather than repeats

This idea has arrived here once before, in a **weaker** form: a test-writer
agent dispatched **after** the implementer lands a diff. That form is exactly
what this source argues is worthless — a test author reading the finished
implementation is running in the same context that produced it, and yields the
same blind spots the tests were supposed to catch. The distinction is not
cosmetic. **Tests written from the spec, before the diff exists, are a
different mechanism from tests written from the diff**, and a measurement of
one says nothing about the other. Phase 0 measures the from-spec form. Any
result here that gets read back as evidence about the post-implementation form
is a misreading, and this paragraph exists so it can be caught.

## Phase 0 — falsify both claims before building anything

Thresholds are registered **before** the measurement runs. A threshold chosen
after seeing the numbers is a description, not a test.

- [ ] **0.1 Pre-register both thresholds and the null exit.** Write, before any
      measurement: the corpus, the two questions, the numeric threshold each
      must clear, and what happens at each of the three outcomes (pass / null /
      ambiguous). Ambiguous is a real outcome and must have a named route, not
      a re-run.
      verify: the pre-registration file exists under `agents/evidence/` and its
      committed date is strictly earlier than either measurement artefact's
      date — `git log --format=%aI -1 -- <pre-reg>` precedes
      `git log --format=%aI -1 -- <measurement>`.
- [ ] **0.2 Measure the independence claim on a frozen corpus.** Over past
      changes in this tree, does a test suite authored from the spec alone
      catch defects that the same-context suite missed? Grade with the existing
      grader — `judge-test-coverage` — never a new one.
      verify: the artefact reports a count against the 0.1 threshold and names
      the corpus by commit range; `ls src/skills/judge-test-coverage/` shows
      the grader was not forked.
- [ ] **0.3 Measure the mutation claim on the same corpus.** Of the negative
      tests in scope, how many survive their own control being deleted or
      inverted — i.e. how many are the claim the existing gate at
      `testing-anti-patterns/SKILL.md:171-185` warns about? Hand-probe is
      acceptable at this stage; the point is the number, not the rig.
      verify: the artefact reports a survivor count and the sample size, and
      every mutated control is restored — `git status --porcelain` is clean
      over the mutated paths after the run.
- [ ] **0.4 Route the outcome.** Pass on both → Phases 1–2 open. Null on either
      → the corresponding half of Phases 1–2 stays `[-]` and Phase 3 still
      ships. Ambiguous → the route named in 0.1, not a second measurement with
      a moved threshold.
      verify: the routing decision is recorded in this file at the phase it
      opens or closes, citing the artefact.

## Phase 1 — build only what Phase 0 supported

Gated by `blocker: spike-before-build`. Nothing in this phase may be touched
before 0.4 records a routing decision.

- [ ] **1.1 A spec-test-writer as stage 0 of the two-stage mode.** Not a new
      mode and not a new judge: a stage in front of the SPEC COMPLIANCE judge
      that already exists at
      `src/skills/subagent-orchestration/prompts/do-and-judge-two-stage.md:62-72`.
      It reads the acceptance criteria (`{{acceptance_criteria}}`, `:69`) and
      **not** the diff, so the tests it writes cannot be shaped by the
      implementation they will judge.
      verify: the stage-0 prompt contains no `{{diff}}` and no `{{envelope}}`
      placeholder — `grep -c '{{diff}}\|{{envelope}}'` over the new prompt block
      returns `0`.
- [ ] **1.2 A tool-assisted variant of the existing hand-probe.** Placed beside
      the gate at `testing-anti-patterns/SKILL.md:171-185`, sharing its restore
      discipline verbatim — the mutation is a probe, never a change, and a
      deleted guard left deleted is a shipped vulnerability produced by a
      test-quality check.
      verify: the variant references the existing gate rather than restating
      it; `wc -l < src/skills/testing-anti-patterns/SKILL.md` stays under `400`.
- [ ] **1.3 Do not add a per-change mutation run.** Explicitly out of scope —
      see *What this roadmap will not build*. Any mutation rig introduced here
      runs nightly, never per change.
      verify: no workflow triggered on `pull_request` invokes the rig —
      `grep -rn 'pull_request' .github/workflows/ | xargs -I{} true` and a
      targeted read of the added workflow confirm the schedule trigger.

## Phase 2 — wire it severity-conditioned

- [ ] **2.1 Condition the ceremony on the change, not on principle.** A
      spec-first test author costs a dispatch. Name the condition under which
      it runs — a security-sensitive surface, a public-API change, a migration —
      and state plainly that a trivial change does not get it.
      verify: the condition is written in the mode's own body and names at
      least one class that is explicitly excluded.
- [ ] **2.2 State the degraded path.** When dispatch is unavailable, say so and
      fall back to the hand-probe. Never present a same-context suite as a
      spec-first one.
      verify: the fallback sentence exists and names the hand-probe by its
      section; a fixture asserts the degraded outcome is labelled, not silent.

## Phase 3 — the standing metric, which ships either way

This is the phase that survives an honest null, and it is why the null is not a
wasted run: Phase 0 is one-off archaeology, and this converts its question into
something that keeps being answered.

- [ ] **3.1 Add a `test_authorship` field to the envelope.** Records whether
      the tests in a change were authored from the spec, from the diff, or
      unknown. `unknown` is a real value and the default — an absent field must
      not read as `from-spec`. Structural enum only; the field cannot hold
      free-form content.
      verify: `grep -rn 'test_authorship' src/` returns hits in the schema and
      the envelope; a test asserts the absent case resolves to `unknown` and
      was seen red before the change landed.
- [ ] **3.2 Report the distribution after an observation window.** Whatever it
      shows, including the result that everything is `unknown` — which would
      itself be the finding that the field is not reaching its producers.
      verify: the report exists under `agents/evidence/`, names the window, and
      states the count for each enum value.

## What this roadmap will not build

| Excluded | Why |
|---|---|
| A new judge | `judge-test-coverage` stays the only grader. A grader introduced alongside the mechanism it grades cannot measure it. |
| Per-change mutation CI | Cost per change against a signal that is at best weekly. Nightly only, and only if Phase 0 passes. |
| Adversarial test authorship from the diff | This is the weaker form the recurrence note above describes; measuring the from-spec form says nothing about it, and building it here would smuggle it in under the from-spec result. |
| A replacement for the hand-mutation gate | `testing-anti-patterns/SKILL.md:171-185` is the extend point. A second gate splits one obligation into two. |

## Blockers

### blocker: mutation-tool-availability

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 1.2; Phase 1.3
- **What to do:** pick exactly one — (a) name the mutation tool for this
  stack and confirm it runs here, since the source's stack line is unverified
  and no rig exists in the tree today, or (b) drop the tool-assisted variant
  and keep only the hand-probe the tree already ships, recording that as the
  decision rather than as an absence.
- **Resolved when:** the choice is recorded at Phase 1.2 with either the tool
  name and a run that exits, or the one-line reason the hand-probe is enough.
- **Recommendation:** (b). The hand-probe at
  `testing-anti-patterns/SKILL.md:171-185` already ships and already carries
  the restore discipline; a rig is only worth its maintenance if Phase 0.3
  shows a survivor count that hand-probing cannot keep up with.
- **If you do nothing:** Phase 1.2 and 1.3 stay authored and unstartable while
  Phase 0.3 still runs by hand, so the roadmap accumulates an unresolved
  tooling question that its own measurement may well answer as unnecessary.

### blocker: spike-before-build

- **Status:** open
- **Owner:** agent
- **Blocks:** Phase 1 in full; Phase 2 in full
- **What to do:** pick exactly one — (a) run Phase 0 to a recorded routing
  decision at 0.4 and open only the halves it supports, or (b) if Phase 0
  cannot be run, close Phases 1–2 as `[-]` and ship Phase 3 alone.
- **Resolved when:** 0.4 is `[x]` with its artefact cited, or Phases 1–2 are
  `[-]` with the reason recorded at each.
- **Recommendation:** (a). The spike is the cheap half and the whole point of
  the merge — running it first is what makes an honest null a completed
  roadmap rather than an abandoned one.
- **If you do nothing:** Phases 1 and 2 get built on the assumption the source
  was right, and a spec-test-writer ships with no measurement behind it. If
  the claim is false, that is a mechanism nobody can retire, because nothing
  recorded what it was supposed to improve.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The threshold is set after the numbers are seen | implementation | A threshold chosen once the measurement is in describes the result instead of testing it, and every conclusion downstream inherits that. | 0.1's verify requires the pre-registration commit to predate both measurement artefacts, which a retrofit cannot satisfy. | Phase 0 — falsify both claims before building anything |
| 2 | A mutated control is left deleted | implementation | Phase 0.3 deletes and inverts real guards. A restore that is forgotten ships a vulnerability produced by a test-quality check — the exact failure the existing gate warns about at `testing-anti-patterns/SKILL.md:176-178`. | 0.3's verify asserts a clean `git status --porcelain` over the mutated paths; 1.2 inherits the restore discipline verbatim. | Phase 0 — falsify both claims before building anything |
| 3 | The result is read back as evidence about the post-implementation form | product | The weaker form of this idea has arrived here before. A pass on the from-spec measurement would be a convenient justification for the diff-reading variant, which measures nothing. | The recurrence note in Context names the distinction; the exclusion table forbids the variant explicitly. | Phase 0 — falsify both claims before building anything |
| 4 | Phase 1 is started before Phase 0 finishes | implementation | The spec-test-writer is the interesting build and the spike is the boring one, so the ordering is under constant pressure. | `blocker: spike-before-build` is owned by the agent and blocks Phases 1 and 2 in full; its resolution requires 0.4 to be `[x]` with a cited artefact. | Phase 1 — build only what Phase 0 supported |
| 5 | The null arrives and Phase 3 is quietly dropped with it | product | A null makes the whole roadmap feel wasted, and the cheapest response is to close everything. That discards the one artefact that would let the question be re-opened with evidence. | The Goal and Phase 3's own preamble state that 3 ships either way; 0.4's null route explicitly keeps it open. | Phase 3 — the standing metric, which ships either way |

## Acceptance Criteria

- [ ] AC-1 — every phase that runs names a number and a threshold that was
      registered before the number existed. A phase with a result and no
      pre-registered threshold does not satisfy this.
- [ ] AC-2 — the honest-null exit is exercised or explicitly not reached, and
      in the null case Phases 1–2 are `[-]` with the artefact cited at each,
      never silently left open.
- [ ] AC-3 — no new judge exists in the diff; `judge-test-coverage` remains the
      sole grader. Verifiable as
      `git diff --name-only --diff-filter=A origin/main...HEAD -- src/skills/judge-*`
      being empty.
- [ ] AC-4 — the hand-mutation gate at `testing-anti-patterns/SKILL.md` was
      extended, not duplicated: the tree contains one mutation obligation, not
      two.
- [ ] AC-5 — `test_authorship` is present in the envelope with `unknown` as the
      default, and a report names its distribution over an observation window —
      whatever that distribution turns out to be.
- [ ] AC-6 — no mutation run is triggered per change; any rig that exists runs
      on a schedule.
