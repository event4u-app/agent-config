---
complexity: contained
status: ready
parent_roadmap: road-to-ui-track-integrity
---

# Road to UI-track integrity — follow-up: is the model-tier allocation backwards?

> Carries forward the one question `road-to-ui-track-integrity` could not
> answer: builders run on the weaker model while reviewers run on the stronger
> one. The finding is verified; the fix is not, because nothing in the tree can
> measure it.

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
> constraint. So this is a conditional chain, not a queue: Phase 0 landing is
> not sufficient, and nothing here argues for reopening that lock.
>
> **If it ever does unblock, prefer diff-distance over a quality rubric.** Same
> port prompt, builders once at `medium` and once at `high`, score = distance
> from the provided artifact. That is objective and needs **no LLM judge**,
> which is strictly better than the "visual/structural rubric" this roadmap's
> Prerequisites describe — a ground truth already exists in the port case, so
> the tier question can be answered by measuring against it rather than by
> asking a model which output it prefers. Recorded here because the insight
> changes what the harness has to be, and would otherwise be re-derived.

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

## Phase 1: Measure the allocation

- [ ] Run the lane fixtures with the current allocation (builders `medium` /
      reviewers `high`) and with builders raised, scoring output quality **and**
      per-run cost.
      <!-- carried from parent Phase 5 -->
- [ ] Include the two outliers in the read — `accessibility-auditor` (medium
      reviewer) and `ui-component-architect` (high builder) — so a flip cannot
      silently erase a deliberate distinction.
      <!-- carried from parent Phase 5 -->
- [ ] Publish the result either way. If quality lift does not clear the cost
      delta, record the honest-null and leave the tiers alone.
      <!-- carried from parent Phase 5 -->

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

- [ ] The tier allocation for UI builders and reviewers is backed by a published
      measurement — including an honest-null if that is what the run shows.
- [ ] The two outliers are explicitly ruled in or out rather than left
      unexplained.
- [ ] All quality gates pass — see `quality-tools`.
