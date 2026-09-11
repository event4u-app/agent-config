---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
relates:
  - slug: road-to-a-declared-component-contract
    relation: disjoint
    note: >
      Same source set, opposite dependency direction. This one needs no declared
      component contract and no workshop lane; that one needs no runtime probe.
      Deliberately separated so this can ship while that waits on an owner call.
estate_growth_exempt: >-
  The UI review can assert appearance and nothing else. Verified 2026-09-11 against the current
  tree: `toHaveCSS`, `emulateMedia`, `userEvent.hover`, `composeStories` and `play: async` return
  zero hits across `src/`, `docs/` and `tests/`; the only `setViewportSize` asserts through
  `toHaveScreenshot`; and `src/skills/design-review/SKILL.md:58,105` make screenshot capture a
  mandatory review step rather than an emergency one. Playwright is already a devDependency at
  1.62.1, so the probe has a runner. Also grows open_blockers by two.
estate_offset_exempt: >-
  No active roadmap owns the UI review surface — the active set is release holds, loop instruments,
  loop governance, projection truth and recurrence counting, none of which touches it. The two
  nearest held objects, `agents/roadmaps/stubs/road-to-frontend-power-default-flip.md` and
  `agents/roadmaps/stubs/road-to-multi-host-screenshot-census.md`, are both blocked on owner
  decisions this roadmap's own blocker names; retiring either to buy the slot would dispose of the
  question rather than answer it.
---
# Road to behaviour evidence over pixels

> **Source:** `agents/tmp.old/inbox-2026-09-y/t4-ui-contract-frontend/` — three plan revisions, a
> two-member revision set and the originating transcript, analysed 2026-09-11. Claim verification
> at HEAD: 34 of 44 claims still true, 1 overtaken, 3 never true at drafting, 2 unverifiable
> third-system claims, 4 diverged on reproduction. Two steps below are tagged
> `corrected-from-reproduction`, and one of them is the run's highest-value finding: the source's
> own verify lines match strings the target file does not contain in the form they assume, so
> adopting them verbatim would report success without doing the work.

## Goal

The UI review can prove hover, focus, keyboard, breakpoint and JavaScript behaviour from runtime
evidence rather than from an image, on the one lane where every primitive already resolves —
without adding a skill, a command verb, a track slot or a rule.

A screenshot shows none of those things. That is the complaint the source states plainly, and it
is correct against this tree: the review checklist names six interaction states and a four-width
viewport matrix, and the only assertion available for any of them is a pixel comparison. The gap
is not that the states are unnamed; it is that nothing can test them.

## Phase 0 — The sensitivity fixture, before anything is changed

- [ ] **0.1 Build a reference and a deliberately divergent implementation** under a new fixture
      directory: one HTML/CSS/JS pair with four planted defects — a missing hover colour, a
      missing narrow-width media rule, a dead click handler, a missing element — plus one
      deviation marked as declared.
      verify: the fixture directory exists and each planted defect is named in a comment beside it,
      so a later reader can tell a defect from a bug in the fixture.
- [ ] **0.2 Pre-register the screenshot arm's honest null.** Record, before the probe exists, how
      many of the four a pixel comparison is expected to catch.
      verify: the number is written in the fixture's README before Phase 2 starts, so the
      comparison is a prediction rather than a retrofit.
- [ ] **0.3 Add a fifth variant that renames an element** without changing its styling.
      verify: the variant exists; it is the case the structure gate in Phase 2 must stop at.

## Phase 1 — Name the new verification primitives

- [ ] **1.1 Add `computed_style`, `interaction`, `viewport_matrix` and `media_emulation` to the
      verification-primitive contract**, each with its host-class row.
      verify: `docs/contracts/design-artifact-verification.md` carries one row per new primitive
      and the class that cannot run it is marked unavailable rather than silently absent.
- [ ] **1.2 Reuse the existing honest-degrade vocabulary.** A host that cannot run a primitive
      reports that it could not, never zero findings.
      verify: the contract's degrade section covers the four new primitives without introducing a
      second evidence vocabulary.

## Phase 2 — The probe

- [ ] **2.1 Write `src/scripts/ui_conformance_probe.ts`** as a Playwright consumer with `--target`
      and an optional `--reference`. Structure is gated before style: an unmatched element stops
      the comparison rather than producing style findings against the wrong node.
      verify: run against the Phase 0.3 rename variant and it stops at structure with zero style
      findings.
- [ ] **2.2 Emit `ui-conformance.json`** with deterministic per-dimension counters, the resolved
      host class, and a mandatory not-applicable row with its reason for every dimension the host
      could not exercise.
      verify: on a host without browser binaries the artefact carries not-applicable rows with
      reasons, and no dimension reads zero findings.
- [ ] **2.3 No scalar score anywhere in the output.** Counters per dimension, never a percentage
      or a fidelity number.
      verify: `grep -nE 'score|percent|%' src/scripts/ui_conformance_probe.ts` finds no emitted
      aggregate.
- [ ] **2.4 Pass the Phase 0 fixture.** Four of four planted defects found; zero findings raised
      for the declared deviation.
      verify: the fixture test asserts exactly that, and the pre-registered screenshot-arm number
      from 0.2 is recorded beside it.

## Phase 3 — Contract states in the story set

- [ ] **3.1 Extend the workshop story set** with `Hover`, `Focus`, `Active`, `Keyboard` and
      `ReducedMotion`, each asserting a computed style or a handler call rather than an image.
      verify: removing one hover rule from the fixture turns exactly the hover story red and
      nothing else.
- [ ] **3.2 Add responsive rows** asserting the layout property that changes at each declared
      breakpoint.
      verify: removing one media rule turns exactly the matching breakpoint row red.

## Phase 4 — Demote the screenshot, with a verify line that can fail

- [ ] **4.1 Rewrite the two mandatory screenshot steps** in the review skill so they read the probe
      artefact, and move the pixel comparison into a section explicitly marked appearance-only.
      verify: `grep -nE 'Take (a )?(baseline )?screenshots?' src/skills/design-review/SKILL.md`
      returns nothing. **`corrected-from-reproduction`** — the source's verify lines use the literal
      strings `Take screenshot` and `Take baseline screenshot`. Measured on the current file: the
      first matches one line and the second matches the other, so each under-covers by half and
      the first would have passed before any work was done. The regex above matches both lines
      (`:58`, `:105`) and is the only form that can fail correctly.
- [ ] **4.2 Apply the same correction to the viewport section** of the Playwright skill.
      verify: the section reads the probe artefact, and its own verify line is a regex over the
      real sentence shapes rather than a literal.

## Phase 5 — Mount it, in shadow only

- [ ] **5.1 Add the review skill to the review flow** and have the design-pass hook read
      `ui-conformance.json`, emitting a verdict without blocking.
      verify: `./scripts-run src/scripts/lint_flows` stays green, and a fixture run with a planted
      defect produces the verdict in the shadow log.
- [ ] **5.2 The block path stays unreachable.** This roadmap adds evidence, not enforcement.
      verify: the hook's block branch is unchanged in the diff, and a run without the lane present
      completes with no error.

## Phase 6 — Measure before promoting anything

- [ ] **6.1 Register the claim** that the probe catches behavioural drift, over the frozen Phase 0
      fixture, with its false-positive reading.
      verify: `./scripts-run src/scripts/check_claims` is green and the claim row names its
      denominator.
- [ ] **6.2 Record a null as a first-class outcome.** If the probe's false-positive rate is worse
      than the screenshot arm's miss rate, that is the finding.
      verify: the claim carries a verdict either way, and neither outcome is described as a failure
      of the roadmap.

## Blockers

### blocker: screenshot-mandate-reopens-a-completed-decision
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** Phase 4 only. Phases 0 through 3, 5 and 6 proceed without it — the probe can exist
  and be measured while the screenshot step stays mandatory.
- **What to do:** decide whether the mandatory screenshot step may be demoted before the probe has
  a measured false-positive rate. The step is the shipped output of a completed roadmap whose
  stated mission makes headless screenshots the only objective signal in the engine, so demoting
  it lowers a recorded verification floor. Read
  `agents/roadmaps/archive/road-to-visual-review-loop.md` for what that roadmap claimed, then the
  Phase 0.2 pre-registration for what replaces it.
- **Recommendation:** demote only after Phase 6 reports a rate against a bar set in Phase 0.2.
  The gap between the two is the window in which the review has neither signal, and pre-registering
  the bar is what keeps the measurement from being read backwards.
- **If you do nothing:** Phase 4 does not run, the probe ships alongside the screenshot rather than
  in place of it, and the review carries both. That is a usable outcome and not a failure.
- **Resolved when:** either Phase 6's measurement clears the pre-registered bar, or the owner
  records the swap as accepted without it.

### blocker: the-lane-this-probe-runs-in
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** nothing in this roadmap, and it is recorded because the absence is load-bearing.
  Verified 2026-09-11: a component workshop is detected nowhere in the TypeScript — the only
  occurrence across the CLI, scripts, server and engine trees is inside an archived-skill linter.
  So the probe has no isolation URL in this repository and Phase 2 runs against a file URL.
- **What to do:** decide whether lane detection is worth building at all, or whether a file URL is
  the permanent answer for this repository. Reproduce the absence with
  `grep -rn -i "storybook\|\.stories\." src/cli src/scripts src/agent-src src/server --include='*.ts'`
  — it returns one file, an archived-skill linter. Two options: (a) leave the file URL as the
  permanent answer here and let the sibling roadmap own lane detection for consumer projects;
  (b) build lane detection in this repository too. This blocker exists so a reader does not
  conclude the probe is broken when it is running exactly as designed.
- **Recommendation:** leave it. A file URL is sufficient for the fixture and for any consumer
  project that has no workshop, and building lane detection to serve a probe that does not need it
  is the speculative half of the sibling roadmap.
- **If you do nothing:** nothing changes. The probe runs against file URLs and the fixture proves
  it works.
- **Resolved when:** the sibling roadmap either lands a lane or records that none is needed.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-11 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A verify line that cannot fail | implementation | The source's own screenshot-demotion checks match strings the file does not contain in the asserted form, so the phase would report success untouched — measured, not hypothesised | Phase 4.1 replaces the literal with a regex over the real sentence shapes and pins the pre-fix match count, so the check is red before the work and green after | Phase 4 — Demote the screenshot, with a verify line that can fail |
| 2 | Computed-style comparison is noisy | implementation | Token indirection and font fallback make raw style diffs fire on differences nobody cares about | The compared property list is curated from the design-token set; an unset tolerance emits a not-applicable row with its reason rather than a pass | Phase 2 — The probe |
| 3 | The probe has no lane in this repository | implementation | With no workshop detected anywhere in the tree, there is no isolation URL and the probe could look broken | Phase 2 runs against a file URL in the fixture; lane detection is explicitly the sibling roadmap's subject and is named as a blocker rather than assumed | Phase 2 — The probe |
| 4 | The review grows two conformance concepts | product | The existing audit skill already carries a conforms/deviates/unknown verdict for reuse candidates, and a second one for built artefacts reads as duplication | The two are cross-linked with their subjects named — candidate reuse stays with the audit, built-artefact behaviour goes to the probe — and neither is merged into the other | Phase 5 — Mount it, in shadow only |
| 5 | Probe runtime lands in the foreground | implementation | A browser-backed pass over a changed set is slow enough to be skipped | Changed-set only, and the shadow mount in Phase 5 means a slow run degrades the verdict rather than the developer's turnaround | Phase 5 — Mount it, in shadow only |

## Acceptance Criteria

- [ ] AC-1 — A fixture exists with four planted behavioural defects and one declared deviation,
      and the screenshot arm's expected catch rate was written down before the probe existed.
- [ ] AC-2 — The probe finds four of four planted defects and raises nothing for the declared
      deviation.
- [ ] AC-3 — A renamed element stops the probe at structure with zero style findings.
- [ ] AC-4 — On a host that cannot run a dimension the artefact says so with a reason; no
      dimension ever reads zero findings because it did not run.
- [ ] AC-5 — The probe emits no scalar score and no coverage percentage.
- [ ] AC-6 — The regex over the real screenshot sentence shapes returns nothing in the review
      skill, and that regex matched two lines before the work.
- [ ] AC-7 — Removing one hover rule turns exactly one story red; removing one media rule turns
      exactly one breakpoint row red.
- [ ] AC-8 — The hook's block path is unchanged, and a run without the lane completes cleanly.
- [ ] AC-9 — The probe's claim carries a verdict measured over the frozen fixture, and a null
      verdict is recorded as an outcome rather than as a failure.
