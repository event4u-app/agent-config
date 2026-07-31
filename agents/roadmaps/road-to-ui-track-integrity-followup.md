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

> **Blocked until a harness exists that scores generated UI** (or one run is
> deliberately funded as a one-off). Execution starts when that condition
> clears — see Prerequisites for why neither existing harness qualifies.
>
> **Candidate harness — `road-to-provided-artifact-honesty`, in two halves that
> are NOT equally available.** Its Phase 0 fixture `daf-port-baseline` supplies
> the half this roadmap lacks as *scheduled* work: a standalone `design.html`
> plus a port prompt, i.e. a real UI-generation task with pass criteria. The
> other half — rendering both outputs and diffing them — is a **gated
> follow-up** there ("Playwright screenshot/DOM diff against the artifact as
> ground truth"), behind the 2026-06-28 lock plus the no-new-binary-dependency
> constraint. A conditional chain, not a queue: Phase 0 landing is not
> sufficient, and nothing here argues for reopening that lock.
>
> That cross-reference now counts **twice over**: if the port roadmap unblocks,
> it unblocks *both* measurements below at once.
>
> **If it ever does unblock, prefer diff-distance over a quality rubric.** Same
> port prompt, score = distance from the provided artifact. Objective, and needs
> **no LLM judge** — the port case is the one place a ground truth already
> exists, so both questions can be answered by measuring against it rather than
> asking a model which output it prefers.

## Prerequisites

- [ ] Read `AGENTS.md` and the parent's archive entry.
- [ ] Confirm the blocker still holds. Neither existing harness answers "is this
      frontend better":
      - `bench:ab` (`internal/bench/corpora/ab-track{a,b}.yaml`) measures
        **surface presence** — whether a rule or skill fires at all.
      - `bench-quality-run` (`token-quality-golden.yaml`, 110 tasks) judges
        **rule compliance** — "stayed in scope", "ran the audit before creating
        a component" — not the quality of what was emitted.
      A tier benchmark needs a third thing: UI-generation prompts, a rendering
      step, and a visual/structural rubric.
- [ ] Confirm the cost asymmetry is still true of the pipeline: builders run
      first, run longest, and re-run up to `POLISH_CEILING` times, so raising
      them is the expensive direction. If the pipeline shape changed, re-derive
      this before spending anything.

## Phase 1: Two measurements against the same harness

Same fixtures, same rubric, **two separate runs**. They are different questions
and must not be collapsed — collapsing them is how the second gets rediscovered
a release later.

### Measurement A — tier: `medium` vs `high` at the same lane

Holds the lane constant, varies the model tier.

- [ ] Run the lane fixtures with the current allocation (builders `medium` /
      reviewers `high`) and with builders raised, scoring output quality **and**
      per-run cost.
      <!-- carried from road-to-ui-track-integrity Phase 5 -->
- [ ] Include the two outliers in the read — `accessibility-auditor` (medium
      reviewer) and `ui-component-architect` (high builder) — so a flip cannot
      silently erase a deliberate distinction.
      <!-- carried from road-to-ui-track-integrity Phase 5 -->

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

- [ ] Run the apply fixtures through the generic lane (`ui-apply-generic` plus
      its corpus query) and through a framework lane, at one fixed tier, scoring
      output quality.
      <!-- carried from road-to-universal-stack-coverage acceptance criteria -->
- [ ] Report per stack whether the corpus query actually changed the output, not
      only that it ran. A query whose rows never alter a decision is grounding
      theatre and should be measurable as such.
- [ ] Publish both results either way. If neither lift clears its cost, record
      the honest-null and change nothing.
      <!-- covers A and B; a null on one is not a null on the other -->

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
