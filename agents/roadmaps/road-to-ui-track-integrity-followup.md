---
complexity: contained
status: ready
parent_roadmap: road-to-ui-track-integrity
---

# Road to UI-track integrity — follow-up: two measurements, one missing harness

> Carries forward every question the UI-track work could not answer, because
> they all wait on the same thing: **no harness in the tree scores generated
> UI.** Two distinct measurements are parked here. Both findings are verified;
> neither fix is, and one funded harness session answers both.

## Context

This roadmap collects the items deferred from
[`agents/roadmaps/archive/road-to-ui-track-integrity.md`](archive/road-to-ui-track-integrity.md).
See the parent's Phase 5 for the original rationale, and
[`frontend-fidelity-cut`](../settings/contexts/frontend-fidelity-cut.md) for the
council's refusal to treat the flip as a free one-line change.

**The verified finding** (`origin/main`, 2026-07-31): every builder that writes
UI runs on the middle tier — `fe-design`, `blade-ui`, `react-shadcn-ui`, `flux`,
`livewire`, `tailwind-engineer` are all `model_tier: medium` — while the two
skills that *grade* their output, `design-review` and `existing-ui-audit`, are
`high`. Per `ADR-035-model-capability-tiers.md` § Decision 3 that resolves to
sonnet for the builders and opus for the reviewers on Claude Code. In a domain
where generation quality dominates and `POLISH_CEILING = 2` caps the repair
loop, the stronger model is spending its capability on judging work the weaker
one produced.

The inversion is real but **not total**, and that is part of why it must be
measured rather than argued: `accessibility-auditor` is a `medium` reviewer and
`ui-component-architect` a `high` builder, so a blanket flip would flatten a
distinction that may well be deliberate.

> **UNBLOCKED 2026-08-01.** The harness is being built — as `bench:ui`, the
> maintainer-side diff machinery in `road-to-provided-artifact-honesty` Phase 4,
> fed by that roadmap's own port fixtures. Both measurements below ride on it.
> This is the "if such a harness lands for another reason, this roadmap unblocks
> for free" clause being taken up, not worked around.
>
> **The 2026-06-28 lock was never engaged by this path.** The maintainer offered
> to lift it; the lift turned out to be unnecessary. The lock forbids the package
> *shipping* a Playwright runtime — `@playwright/test` is already a
> **devDependency**, and `files[]` ships neither `tests/` nor `internal/`, so a
> bench beside `bench:ab` distributes nothing. The consumer-side verify stage,
> which would need a browser at the consumer, stays gated and unchanged. Recorded
> because a lock that did not need reopening must not be logged as reopened.
>
> **Judge-free by construction.** Scoring is a diff-distance against
> `design.html` as ground truth, from four deterministic components with
> pre-registered weights — perceptual screenshot diff per breakpoint (SSIM /
> pixelmatch **with a threshold**, never raw pixels, which would measure font
> antialiasing), DOM-structure comparison, token-mapping score, Playwright
> interaction checklist. No model in the scoring path. An LLM judge would import
> variance and **circularity** — Opus grading Opus — into the very measurement
> that decides Opus vs Sonnet.

## Prerequisites

- [ ] Read `AGENTS.md` and the parent's archive entry.
- [ ] `road-to-provided-artifact-honesty` Phase 0 (port fixtures) and Phase 4
      (`bench:ui`) have landed. Both measurements below consume them; neither
      needs a fixture set or a scorer of its own.
- [ ] The four component weights and the Measurement-B tolerance are fixed and
      written down **before** the first scored run.
- [ ] **The fixture set is committed and SHA-pinned** before Measurement A
      starts, with the pin recorded beside the weights. Pre-registering the
      scoring while leaving the *inputs* editable would contaminate both
      measurements exactly as a post-hoc threshold does. Any fixture added later
      forms a new set, scored separately — never a revision of the pinned one.
- [ ] **The render environment is pinned and the fixtures render
      deterministically** — browser version from the `@playwright/test`
      devDependency recorded with the run, fonts embedded in the fixtures rather
      than hotlinked, animations disabled at capture. A `fonts.googleapis.com`
      import inside a fixture would make the SSIM score a function of the CI
      runner's network and font fallback, i.e. the harness would measure the
      runner. The self-hosted route needed for this already shipped with the
      webfont-delivery work.
- [ ] Confirm the cost asymmetry still holds of the pipeline: builders run first,
      run longest, and re-run up to `POLISH_CEILING` times, so raising them is the
      expensive direction. If the pipeline shape changed, re-derive it before
      spending anything.

**Historical note — why this was blocked, and what closed it.** Neither existing
harness answers "is this frontend better": `bench:ab` measures surface presence
(whether a rule or skill fires), and `bench-quality-run` judges rule compliance
("stayed in scope", "ran the audit first"). The missing third thing was named as
"UI-generation prompts, a rendering step, and a visual/structural rubric" — and
the rubric half was the trap. The port case dissolves it: `design.html` **is** the
expected output modulo stack translation, so the third thing is a diff, not a
judgement.

## Phase 1: Two measurements against the same harness

Same fixtures, same rubric, **two separate runs**. They are different questions
and must not be collapsed — collapsing them is how the second gets rediscovered
a release later.

### Measurement A — tier: `medium` vs `high` at the same lane

Holds the lane constant, varies the model tier.

- [ ] Run the **port fixtures** with builders at `medium` and at `high`, lane
      held constant. Score = diff-distance to ground truth. Put the delta in
      diff-distance against the delta in cost.
      <!-- carried from road-to-ui-track-integrity Phase 5; reformulated 2026-08-01 as a fidelity task so it needs no rubric -->
- [ ] Run the two outliers as their own arms — `accessibility-auditor` (medium
      reviewer) and `ui-component-architect` (high builder) — so a flip cannot
      silently erase a distinction that may be deliberate.
      <!-- carried from road-to-ui-track-integrity Phase 5; separate arms rather than a note, since the harness makes that nearly free -->

**The verified finding.** Every skill that writes UI is `model_tier: medium` —
`fe-design`, `blade-ui`, `react-shadcn-ui`, `flux`, `livewire`,
`tailwind-engineer` — while the two that *grade* their output, `design-review`
and `existing-ui-audit`, are `high`. Per `ADR-035` § Decision 3 that is sonnet
building and opus judging, in a domain where generation quality dominates and
`POLISH_CEILING = 2` caps the repair loop. Real but **not total**: see the two
outliers above, which is why a blanket flip is the wrong move.

### Measurement B — lane: generic vs framework at the same tier

Holds the model tier constant, varies the lane. Introduced by
`road-to-universal-stack-coverage` Phase 0, whose benchmark criterion could not
be met for exactly the same reason.

- [ ] Run the same fixtures on the two stacks where **both** lanes exist, tier
      held constant: once with the legacy full-match bundle, once with the
      generic lane forced. Thanks to the composition landed in
      `road-to-universal-stack-coverage`, that is a switch rather than a rebuild.
      Score = the same diff-distance.
      <!-- carried from road-to-universal-stack-coverage acceptance criteria -->
- [ ] Report per stack whether the corpus query actually changed the output, not
      only that it ran. A query whose rows never alter a decision is grounding
      theatre and should be measurable as such.
- [ ] Publish both results either way.
      <!-- covers A and B; a null on one is not a null on the other -->

### Pre-registered null paths (written before the run, on purpose)

Both are stated in advance so a null cannot be reinterpreted as a
disappointment after the numbers land.

- **A null:** the `high` lift does not clear the cost difference → the tiers stay
  as they are and the null is published. Builders run first, longest, and up to
  `POLISH_CEILING` times, so the cost side is the expensive one by construction.
- **B null — and it is not a failure.** If the generic lane lands within a
  **tolerance fixed before the run** of the framework lane, that is a strong
  positive result, not a shortfall: it would mean the floor carries, and overlays
  then justify themselves only on their specialist subject rather than by
  default. Naming this in advance is what keeps it from being read as the generic
  lane "losing".
- Fix the B tolerance and the four component weights **before the first scored
  run**. A threshold chosen after seeing the distribution is not a threshold.

**The verified finding.** The detection half of universal stack coverage is fully
measured — the Phase-0 and Phase-1 tables in that roadmap. What is unmeasured is
whether the generic lane's *output* is good: it composes, dispatches and queries
the corpus, and nothing establishes that the result matches what a
framework-specific executor would produce.

**Why these are one roadmap and not two.** The blocker is word-for-word
identical, so a second blocked follow-up would be roadmap multiplication with no
information gain. What must stay visible is that they are two questions, which is
why they are separate sub-sections with their own findings rather than a merged
step list.

## Non-goals

- **Do not build a UI-quality harness just to answer this.** That was the
  parent's reason for deferring rather than proceeding: a new benchmark
  subsystem to settle one frontmatter question is the speculative scale the
  parent's own design constraints forbid. If such a harness lands for another
  reason, this roadmap unblocks for free.
- **No tier change on argument.** The finding is not in doubt; only its remedy
  is. Flipping without the measurement is precisely what the parent's Phase 5
  existed to prevent.

## Acceptance Criteria

- [ ] **A:** the tier allocation for UI builders and reviewers is backed by a
      published measurement — including an honest-null if that is what the run
      shows.
- [ ] **A:** the two outliers are explicitly ruled in or out rather than left
      unexplained.
- [ ] **B:** the generic lane's output is compared against a framework lane at a
      fixed tier, and the corpus query's effect on the output is reported —
      not merely that it ran.
- [ ] Both measurements are run from **one** harness session; neither is
      answered by argument.
- [ ] All quality gates pass — see `quality-tools`.
