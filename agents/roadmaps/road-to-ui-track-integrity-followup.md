---
complexity: lightweight
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

- [x] Read `AGENTS.md` and the parent's archive entry.
- [x] `road-to-provided-artifact-honesty` Phase 0 (port fixtures) and Phase 4
      (`bench:ui`) have landed. Both measurements below consume them; neither
      needs a fixture set or a scorer of its own.
      <!-- verified 2026-08-05: archive/road-to-provided-artifact-honesty.md has 0 open steps; internal/bench/ui/{run.ts,bench.config.json,fixtures.lock.json,README.md} + tests/design-artifacts/fixtures/{design,port-faithful,port-regenerated}.html all present -->
      <!-- SCOPE CORRECTION, same date: "landed" covers the SCORER only. bench:ui scores a committed candidate list; nothing in the tree PRODUCES a candidate. See the generation-gap blocker below — the measurements are not runnable on this prerequisite alone. -->
      <!-- SUPERSEDED BRANCH: an unmerged `docs/ui-track-integrity-followup` (84fa47fd8, 2026-07-31) added a "candidate harness is behind the 2026-06-28 lock" note. The 2026-08-01 UNBLOCKED note above supersedes it, and its second half (prefer diff-distance over a rubric) is what bench:ui already implements. Recorded so the orphan is not re-merged as if it were news. -->
- [x] The four component weights and the Measurement-B tolerance are fixed and
      written down **before** the first scored run.
      <!-- done 2026-08-05 in internal/bench/corpora/ui-track-integrity-PREREG.md: weights quoted from bench.config.json (frozen, unchanged); Measurement A arms + N + endpoints + decision rule registered; the interaction-contract fix registered. -->
      <!-- FALSIFIED-AND-WITHDRAWN, same date, recorded because it is the more useful half: the council's proposed interactions weight-degradation rule was implemented and then measured BEFORE publication. Its discriminator ("a score under 0.50 means renamed hooks, not absent behaviour") is falsified by the committed port-regenerated control, which scores 0.25 with pure selector-resolution failures while genuinely lacking the behaviour. Applying the rule would have granted that control +0.0514 and eroded the instrument's registered separation 0.4634 -> 0.4120 — above the 0.25 floor, so no committed test would have caught it. The instrument is left untouched; the port prompt states the interaction contract instead. -->
      <!-- AMENDMENT, recorded as one: the "Measurement-B tolerance" is NOT a single pre-registered number. Council 2026-08-05 (anthropic/claude-sonnet-4-5 + openai/gpt-4o, convergent, both members rejecting the point-tolerance framing) — a point tolerance derived before any generated pair exists is arithmetic on two anchors from a different measurement context (the 0.4634 separation is faithful-vs-regenerated WITHIN one lane, and carries no information about cross-lane separation). Registered instead: a distribution-based decision rule with per-component decomposition. Measurement B is separately blocked (see the blocker below), so nothing is scored against it yet either way. -->
- [x] **The fixture set is committed and SHA-pinned** before Measurement A
      starts, with the pin recorded beside the weights. Pre-registering the
      scoring while leaving the *inputs* editable would contaminate both
      measurements exactly as a post-hoc threshold does. Any fixture added later
      forms a new set, scored separately — never a revision of the pinned one.
      <!-- done 2026-08-05: all three fixture SHA-256 values are recorded beside the weights in internal/bench/corpora/ui-track-integrity-PREREG.md § Fixture pin, enforced by internal/bench/ui/fixtures.lock.json (mismatch refuses the run, it does not warn). -->
- [x] **The render environment is pinned and the fixtures render
      deterministically** — browser version from the `@playwright/test`
      devDependency recorded with the run, fonts embedded in the fixtures rather
      than hotlinked, animations disabled at capture. A `fonts.googleapis.com`
      import inside a fixture would make the SSIM score a function of the CI
      runner's network and font fallback, i.e. the harness would measure the
      runner. The self-hosted route needed for this already shipped with the
      webfont-delivery work.
      <!-- verified 2026-08-05: run.ts pins deviceScaleFactor 1, reducedMotion 'reduce', screenshot animations 'disabled', and records `chromium ${browser.version()}` + platform + node into every report (@playwright/test ^1.62.1, devDependency). All three fixtures carry ZERO network references (the single grep hit in design.html is the comment stating the invariant). Epoch on the first scored run: chromium 148.0.7778.96 / darwin-arm64 / v25.9.0. -->
      <!-- KNOWN LIMIT, restated here because it constrains BOTH measurements: the fixtures use generic font families, so absolute `pixel` scores compare only WITHIN one platform+browser epoch. Every arm of a measurement must therefore run on one host, in one session — which is what the "one harness session" acceptance criterion already demands for an unrelated reason. -->
- [x] Confirm the cost asymmetry still holds of the pipeline: builders run first,
      run longest, and re-run up to `POLISH_CEILING` times, so raising them is the
      expensive direction. If the pipeline shape changed, re-derive it before
      spending anything.
      <!-- re-derived 2026-08-05, shape UNCHANGED: directives/ui/index.ts maps implement→apply (builder), test→review, verify→polish; so the builder runs BEFORE both graders. polish.ts re-dispatches the per-stack `ui-polish-<stack>` builder directive, POLISH_CEILING = 2 (effective 3 with the one-round extension). Builder invocations per run: 1 + up to 3; grader invocations: 1. Raising the builder tier is the expensive direction — confirmed. -->

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

  > **Scope ruling, 2026-08-05 — the generation half is IN scope; this non-goal
  > is not violated by it.** Council (anthropic/claude-sonnet-4-5 +
  > openai/gpt-4o, convergent): what this non-goal forbids is the *judgement*
  > half — a UI-**quality** harness, a rubric, a model in the scoring path. That
  > half was not built and will not be: `bench:ui` scores a diff-distance
  > against a ground truth with no model in the scoring path. What is missing is
  > a per-arm **generation** step, which is an increment on the landed scorer
  > reusing the existing `bench_ab_clone` / `bench_ab_task_runner` machinery,
  > not a new subsystem.
  >
  > The council attached one condition, and it is met here: name the customers,
  > so "customer-driven" is checkable rather than asserted. The generation half
  > serves the same three the scorer serves — **(1)** this roadmap's two
  > measurements, **(2)** `road-to-provided-artifact-honesty`'s port-fidelity
  > question, which today scores committed static fixtures and needs generated
  > candidates to extend beyond them, and **(3)** the standing regression watch
  > on every future change to the UI skills, which cannot fire on hand-authored
  > fixtures at all. A generation step with three customers is not a subsystem
  > built to settle one frontmatter question.
  >
  > **Correction, same day, after checking the tree rather than the argument.**
  > The ruling's *premise* — "an increment on the landed scorer reusing the
  > existing `bench_ab_clone` / `bench_ab_task_runner` machinery" — is **false**.
  > That machinery cannot express the one variable Measurement A varies. See the
  > `measurement-a-no-per-arm-builder-tier` blocker below for the evidence. The
  > ruling's *conclusion* still holds in principle (a generation step is not the
  > forbidden judgement half), but with the reuse premise gone it is no longer an
  > increment, and building it here is the benchmark subsystem the Non-goal
  > forbids. Measurement A therefore stays open behind a named blocker rather
  > than being unblocked by a build this roadmap is not allowed to make.
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

## Blockers

### blocker: measurement-a-no-per-arm-builder-tier

- **Status:** open
- **Owner:** maintainer (scope decision) / any roadmap that needs a UI-generation
  runner for its own reason
- **Blocks:** Measurement A (both steps) and the two A acceptance criteria. It
  does **not** block the pre-registration, which is committed and complete.
- **What to do:**
  Measurement A varies exactly one thing — the model tier the **builder skill**
  runs on — and nothing in the tree can set it per arm. Verified 2026-08-05,
  against the tree rather than against the argument:
  - `bench:ui` (`internal/bench/ui/run.ts`) scores `config.candidates`, a list of
    **committed static files**. Its whole CLI surface is `--json` and
    `--update-lock`: no arm, no tier, no model call, nothing that produces a
    candidate.
  - The tier → native `model:` rewrite happens **only** in
    `install.ts::finalize_claude_model_tiers`, and only on a consumer install
    whose `model.auto_switch` is `auto`. This checkout has **zero** entries under
    `.claude/skills/` and no projected skill pins a `model:` at all, so a session
    `--model` flag sets the whole session, never one skill.
  - The machinery the scope ruling assumed could be reused does not carry the
    variable: `bench_ab_clone` copies the maintainer's `.claude/` surface
    verbatim — no `auto_switch` handling, no per-skill tier rewrite — and
    `bench_ab_task_runner` scores **transcripts**, not written UI artifacts.
  So a faithful arm needs a materialised consumer-shaped install with
  `auto_switch: auto`, a per-arm rewrite of the target skill's tier, an
  artifact-extraction step, and — before any of it can be trusted — a validation
  that the port task actually dispatches the UI builder skill. That is a
  generation subsystem, which is what this roadmap's own Non-goal forbids
  building here, and its arm isolation is itself unvalidated.
  The two outlier arms make it sharper: `accessibility-auditor` at medium and
  `ui-component-architect` at high are **per-skill** tier facts. No session-level
  `--model` can express them, so they cannot be measured without exactly the
  per-skill control that is missing.
- **Recommendation:** hold, and do **not** build the runner here. The owner line
  already names the exit — "any roadmap that needs a UI-generation runner for
  its own reason" — and building it inside this roadmap is what its own Non-goal
  forbids. The alternative that keeps surfacing is weakening Measurement A to
  something the current harness can run (a session-level `--model` instead of
  per-skill tiers); that is rejected on the evidence above, because the two
  outlier arms are per-skill tier facts no session flag can express, so the
  weakened measurement would answer a different question under the same name.
- **If you do nothing:** nothing degrades — the pre-registration is committed
  and complete, and holding is the intended state. The cost is bounded and
  specific: Measurement A and its two acceptance criteria stay open, so this
  roadmap cannot archive, and every future sweep pays to re-read the same
  blocker to reach the same conclusion.
- **Resolved when:** a UI-generation runner with per-skill tier control exists —
  landed for its own reason, with its arm isolation validated (the port task
  demonstrably dispatches the builder skill, and the tier demonstrably reaches
  it) — at which point Measurement A runs against the committed pre-registration
  unchanged, in the controls' epoch.

### blocker: measurement-b-no-renderable-lane-pair

- **Status:** open
- **Owner:** maintainer (host capability) / any roadmap that lands a
  host-renderable framework lane or a generic-lane override for its own reason
- **Blocks:** Measurement B (both steps) and the two B acceptance criteria.
  Measurement A is **not** blocked by it — a null on one is not a null on the
  other, which is why they were authored as separate sub-sections.
- **What to do:**
  Measurement B needs two stacks where **both** lanes exist. Framework bundles
  are `blade-livewire-flux`, `blade-livewire`, `filament` (PHP/Blade) and
  `react-shadcn`, `react`; the generic-routing lanes (`vue`, `plain`, `unknown`)
  have no framework lane to be compared against. Today **no** pair satisfies all
  three of: both lanes defined · both host-renderable · framework lane needs no
  build step that has not been built. Concretely — no `php`/`composer` on the
  host (a human install), the scorer captures `file://` HTML so a React
  candidate needs a build/serve step that does not exist, and `GENERIC_LANES` is
  derived from detected stack state with no supported override.
  Docker **is** available on the host and is deliberately not used: one arm in a
  container and one on the host makes the 0.40-weighted `pixel` component a
  cross-epoch comparison — 40 % of the weighted score would be noise — and both
  in a container voids the existing calibration anchors. Council 2026-08-05
  (anthropic/claude-sonnet-4-5 + openai/gpt-4o, convergent) rejected that path
  and chose the named blocker over a re-scope that changes a pre-registered
  input.
- **Recommendation:** hold, and if either exit is taken, take the **supported
  generic-lane override** rather than the React build/serve step. The override
  is a bounded change to how `GENERIC_LANES` is derived; a build/serve step is a
  new subsystem in the scorer's capture path, and the scorer captures `file://`
  HTML today. Docker stays rejected on the council's reasoning above, not
  re-opened: one arm containerised and one on the host makes the 0.40-weighted
  `pixel` component a cross-epoch comparison, and containerising both voids the
  calibration anchors.
- **If you do nothing:** nothing degrades — as with Measurement A, holding is
  the intended state and the pre-registration stays intact. The cost is that
  Measurement B and its two acceptance criteria stay open, so the roadmap
  cannot archive, and the pairing question gets re-derived from scratch by
  whoever screens it next.
- **Resolved when:** either a host-renderable framework lane exists (a
  build/serve step for the React lane, landed for its own reason) **or** a
  supported generic-lane override exists — at which point the re-scope is
  recorded as a dated amendment in
  `internal/bench/corpora/ui-track-integrity-PREREG.md` and Measurement B
  becomes executable.
