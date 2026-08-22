---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
---

# Road to UI-track integrity — the lanes the dispatcher names do not exist

> Every finding below is verified in-tree (four adversarial verification passes,
> 2026-07-31) and cited to `path:line`. This roadmap covers the defects that
> degrade **every** frontend the package touches, with or without a provided
> design artifact. The artifact-port case is a separate, narrower roadmap
> (`road-to-provided-artifact-honesty`); webfont delivery is a third
> (`road-to-webfont-delivery-ownership`).
>
> Source: `agents/tmp.old/frontend-fix.txt` (external analysis, re-verified).
> Council cut + standing constraints:
> [`frontend-fidelity-cut`](../settings/contexts/frontend-fidelity-cut.md).

## Goal

Make the UI track's dispatch honest and its validation real: a detected stack
resolves to a skill that exists, an unresolvable stack fails loudly instead of
silently degrading, and the two placeholder gates actually inspect the shapes
that carry placeholders. Then measure whether the model-tier allocation is
backwards — rather than assert it.

The failure this closes: the package can run the full eight-step UI machine,
emit three human sign-offs, and dispatch to a skill name that has no file behind
it — and nothing anywhere reports that this happened.

## Context (verified in-tree 2026-07-31, do not relitigate)

- **Zero of four dispatch targets exist as skills.** `apply.ts:23-31` maps
  stacks to `ui-apply-blade-livewire-flux | ui-apply-react-shadcn | ui-apply-vue
  | ui-apply-plain`; `review.ts:21-29` and `polish.ts:32-40` do the same for
  `ui-design-review-*` / `ui-polish-*`. **No `SKILL.md` exists for any of these
  names.** `agent_directive()` (`delivery_state.ts:198-205`) is pure string
  formatting — no registry lookup, so a directive naming nothing emits silently.
- **Two lanes survive only via a doc table.** `docs/contracts/ui-track-flow.md:107-111`
  redirects each directive to a *bundle of real skills*: `blade-livewire-flux →
  flux + livewire + blade-ui`, `react-shadcn → react-shadcn-ui`. But `vue →
  ui-apply-vue` points at itself, and `plain → blade-ui` points at a
  **laravel-pack** skill (`src/skills/blade-ui/SKILL.md`, `packs: [laravel]`) —
  which a non-Laravel consumer has not installed. `plain` is also
  `DEFAULT_DIRECTIVE`, the fallback for every unknown stack.
- **A prior roadmap recorded this gap as closed when it was not.**
  `agents/roadmaps/archive/road-to-frontend-design-intelligence.md:415` — *"This
  **closes the Vue gap** (we have a `ui-apply-vue` placeholder but no
  knowledge)"* — with a done-note whose evidence is a corpus smoke test
  (`--stack vue …`), i.e. the CSV search domain, not an executor. The executor
  gap was never closed.
- **Detection sends real stacks into that fallback.** `detect.ts:188-190`
  requires `livewire/livewire` **AND** `livewire/flux`; Laravel+Livewire without
  Flux → `plain`. `detect.ts:193-206`: React without Radix/shadcn/`components.json`
  → `plain`. Root manifests only (`detect.ts:105-107`), so monorepos → `plain`.
  Detection degrades rather than raising (`detect.ts:26-31`).
- **The maintainer's own repos land in the broken lanes.** Measured 2026-07-31
  across `~/projects/galawork`: `galawork-web` and `galawork-web2` are
  React + Radix + Tailwind (`react-shadcn`, the one healthy lane);
  `galawork-stats` is **Filament**; **no repo uses `livewire/flux`**.
  `grep -rli filament src/` → **0 files**. Filament is a first-class Laravel
  frontend stack the taxonomy does not model at all, and it is the maintainer's
  own stack — it detects as `plain`.
- **Both placeholder walkers skip arrays.** `design.ts:169-192` (`_walk_microcopy`)
  and `apply.ts:118-137` (`_walk_rendered`) recurse only when `_isDict(value)`,
  and `_isDict` explicitly excludes arrays (`design.ts:74-76`, `apply.ts:55-57`).
  `{ nav_items: ["Home", "TODO: Link"] }` passes **both** gates.
  `ui-track-flow.md:96-97` advertises these two layers as defense-in-depth; they
  share the identical hole, so there is none. `_count_microcopy`
  (`design.ts:315-325`) has it too, so the count in the sign-off the human
  confirms is also wrong.
- **The audit cache is prose that no code implements.**
  `existing-ui-audit/SKILL.md:34,246` prescribes caching by
  `composer.json`/`package.json` mtime. No code does: grep finds no `mtime` /
  `statSync` in the UI directives. What the code does is weaker —
  `audit.ts:122-125` returns SUCCESS unconditionally once `audit_path` is set, so
  the audit **never** re-runs for the life of a state-file. Apply appends new
  components (`apply.ts:186-204`) without touching a manifest, so neither the
  documented key nor the implemented sentinel would ever invalidate.
- **The five-state gate is bypassable by type shape.** `design.ts:141-158` runs
  the `REQUIRED_STATE_KEYS` loop only `if (key === 'states' && _isDict(value))`,
  and `state.ts:637-655` does not type `states` at all — so `states: "n/a"` or
  `states: ["empty"]` skips all five checks. Only truthiness is checked when it
  does run, so `"n/a"` passes; the gate does not literally force fabricated UI,
  but it does not enforce anything either.
- **Builders run on the weaker model.** `fe-design`, `blade-ui`,
  `react-shadcn-ui`, `flux`, `livewire`, `tailwind-engineer` are
  `model_tier: medium`; `design-review` and `existing-ui-audit` are `high`.
  `docs/decisions/ADR-035-model-capability-tiers.md:44-47` maps
  `high → opus, medium → sonnet` on Claude Code. Not uniform:
  `accessibility-auditor` is a medium reviewer, `ui-component-architect` a high
  builder.
- **The design layer does not ship with the stacks that need it.**
  `src/config/discovery/packs.yml:60-68` (`laravel`) and `:96-104` (`react`)
  carry no `suggests` at all and no edge to `frontend-design`; the only edge is
  `frontend-design → suggests → [react, nextjs]` (`:116-124`) — backwards, and
  `suggests` is advisory/never-auto-installed (`packs.yml:15`). A `laravel`- or
  `react`-only consumer therefore gets the stack executors and (via
  `engineering-base`) `fe-design` / `design-review` / `existing-ui-audit`, but
  **not** design-intelligence, tokens, typography, iconography, nor the
  `design-fidelity` rule. Meanwhile `fe-design/SKILL.md:59-63` hard-requires
  design-intelligence ("run its corpus query first") across that boundary.
- **Two contracts misstate the eval baseline.** `design-artifact-lifecycle.md:96`
  and `design-artifact-verification.md:147` both say *nine* fixtures;
  `tests/design-artifacts/eval-fixtures.md` carries **16**. And
  `daf-redesign-trigger` declares its stage as "branch selection" while appearing
  zero times in the lifecycle contract — 7 of 16 ids are absent from it, so the
  fixture↔contract binding the house method leans on is partly fictional.
- **Doc drift on the halt budget.** `ui-track-flow.md:50` still documents the old
  slot map and `:206-215` a "two user halts" budget; `ui/index.ts:60-71` wires
  `memory → app_spec` and `plan → scaffold`, giving three sign-offs plus four
  delegation halts before the first file is written.

## Design constraints

- **Measurement gates behaviour change.** Every dispatch fix below is a guess
  until a baseline says which stacks currently produce usable output. Phase 0 is
  blocking, and an honest-null on any lane is a publishable result.
- **Removal over addition.** The dispatch indirection is unpaid-for abstraction:
  the package has renamed a skill zero times. Delete it rather than create four
  delegation-only skills.
- **No silent degradation.** A stack the package cannot serve must say so. The
  present failure mode — detect `plain`, dispatch a name with no file, continue —
  is worse than an error.
- **Lane taxonomy stays an enum for now.** Capability-based dispatch is the
  better long-run model (see the gated follow-up); rewriting detection before a
  single fixture covers a non-modelled stack is a cathedral on an unmeasured
  foundation.

## Phase 0 — Baseline: what actually works today (blocking)

- [x] Fixture `daf-lane-react-shadcn`: a React + Radix + Tailwind project runs
      audit → apply → review. Assert the **dispatched directive name** and that a
      backing skill resolves. This is the one lane expected to pass; it is the
      control.
      <!-- done: tests/scripts/work_engine/ui_lane_matrix.test.ts — detects react-shadcn as expected, but the dispatch target has NO SKILL.md; the "control" lane is also broken -->
- [x] Fixture `daf-lane-livewire-no-flux`: Laravel + `livewire/livewire`, no
      `livewire/flux`. Assert the detected stack and the dispatched directive.
      Expected today: `plain` → `ui-apply-plain` → no skill. Records the defect.
      <!-- done: confirmed `plain` -->
- [x] Fixture `daf-lane-filament`: a Filament project (mirrors `galawork-stats`).
      Same assertions. Expected today: `plain`.
      <!-- done: confirmed `plain` -->
- [x] Fixture `daf-lane-vue` and `daf-lane-static-html`: same assertions for the
      two lanes with no backing executor.
      <!-- done: vue detects `vue`, static-html detects `plain`; neither dispatch target resolves. Added daf-lane-react-no-radix in the same pass (React alone → plain) -->
- [x] Fixture `daf-lane-monorepo`: manifests below the root. Assert detection
      result; expected `plain`.
      <!-- done: confirmed `plain` -->
- [x] Fixture `daf-placeholder-in-array`: `{ nav_items: ["Home", "TODO: Link"] }`
      through both the microcopy gate and the rendered-output gate. Expected
      today: passes both (the bug). Also assert `_count_microcopy` under-counts.
      <!-- done: both gates return SUCCESS on a placeholder inside an array; the count assertion moved to Phase 3 where the fix lands (a wrong count is only observable against a corrected walker) -->
- [x] Fixture `daf-states-type-bypass`: brief with `states: "n/a"`. Expected
      today: passes the five-state gate untouched.
      <!-- done: confirmed SUCCESS -->
- [x] Run all Phase-0 fixtures against the current tree and **write the baseline
      table into the roadmap** (lane → detected stack → dispatched directive →
      skill resolves? → output usable?). This table is the before-measurement
      every later phase is scored against.
      <!-- done: 20/20 assertions green — every defect expectation confirmed; table below -->
- [x] Record which lanes produce *usable* output despite a missing directive
      (the agent may recover on its own). A lane that works anyway changes the
      fix for that lane from "route it" to "delete it".
      <!-- done: deterministically decidable from the redirect table, recorded in the Recovery column + eval fixture daf-lane-recovery for the rubric half -->

### Measured baseline (2026-07-31, `origin/main` @ c1c25a5d4)

Source: `tests/scripts/work_engine/ui_lane_matrix.test.ts` — 20/20 assertions
green, i.e. **every** defect expectation below is confirmed, not inferred.

| Lane fixture | Manifest signal | Detected | Apply directive | Skill resolves? | Recovery possible? |
|---|---|---|---|---|---|
| `daf-lane-react-shadcn` | `react` + `@radix-ui/*` | `react-shadcn` | `ui-apply-react-shadcn` | **no** | yes — redirect names `react-shadcn-ui` |
| `daf-lane-react-no-radix` | `react` alone | `plain` | `ui-apply-plain` | **no** | no — redirect names a `laravel`-pack skill |
| `daf-lane-livewire-no-flux` | `livewire/livewire` | `plain` | `ui-apply-plain` | **no** | no — same |
| `daf-lane-filament` | `filament/filament` | `plain` | `ui-apply-plain` | **no** | no — same |
| `daf-lane-vue` | `vue` | `vue` | `ui-apply-vue` | **no** | no — redirect self-loops |
| `daf-lane-static-html` | `tailwindcss` only | `plain` | `ui-apply-plain` | **no** | no — same |
| `daf-lane-monorepo` | manifests below root | `plain` | `ui-apply-plain` | **no** | no — same |

Aggregate: **12 of 12** directive names across the three dispatch tables
(`apply`, `review`, `polish`) have no backing `SKILL.md`. Only one of seven lanes
has an honest recovery path.

Validation gates, same run:

| Gate fixture | Input | Baseline outcome |
|---|---|---|
| `daf-placeholder-in-array` (brief lock) | `microcopy.nav_items: ["Home", "TODO: Link"]` | `success` — placeholder locked in |
| `daf-placeholder-in-array` (rendered gate) | `rendered["nav.tsx"]: [..., "<a>TODO: Link</a>"]` | `success` — placeholder written |
| `daf-states-type-bypass` | `states: "n/a"` | `success` — five-state loop skipped |

**Exit:** baseline table committed to the roadmap; each later phase has a
named before-value to beat.

## Phase 1 — Dispatch honesty (the 95 % fix)

> **Approach revised mid-phase on new evidence — the fix is NOT "delete the
> indirection".** Implementation surfaced that `ui-stack-extension.md:25-35`
> *mandates* the 12 names as real skill files (a design never implemented),
> while `ui-track-flow.md:107-111` documents them as a redirect to other
> skills — and that the vocabulary plus the unknown-→-`plain` fallback are
> pinned by existing tests and goldens. The decisive measurement: of the
> engine's 11 literal directive verbs only **2** name a real skill
> (`existing-ui-audit`, `refine-prompt`); 9 resolve to nothing. Directive verbs
> are agent-interpreted verbs, not skill paths, so `ui-apply-*` is the norm and
> authoring 12 skill files would make these lanes the engine's only exception.
> Council re-ran on this evidence and adopted the bundle model. Rationale:
> [`frontend-fidelity-cut § Amendment`](../settings/contexts/frontend-fidelity-cut.md).

- [x] Keep the directive verbs (a tested public contract) and move the
      verb→skill-bundle mapping out of prose into code. Fix the two broken rows
      in the same change: `vue` (pointed at the verb itself, naming no skill) and
      `plain → blade-ui` (a `packs: [laravel]` skill in the universal fallback).
      <!-- done: new src/agent-src/templates/scripts/work_engine/directives/ui/stack_bundles.ts — STACK_BUNDLES keyed by lane with build/review/pack_agnostic; both broken rows now the stack-neutral pair -->
- [x] Choose the `plain` target from evidence, not taste — a pack-agnostic
      builder. If none qualified, `plain` becomes a loud refusal instead of a
      silent route.
      <!-- done: ui-component-architect + tailwind-engineer — both packs: [engineering-base] (ship in every install) and both self-describe as stack-neutral. No loud refusal needed for plain; it has an honest floor -->
- [x] Make an unresolvable dispatch **fail loudly**.
      <!-- done, but re-scoped: a runtime filesystem probe is wrong here — the work_engine runs in the CONSUMER, where src/skills/ does not exist and the installed pack set is unknown. Split instead: (a) build-time — task lint-ui-stack-bundles fails when a bundle member does not resolve OR when a pack_agnostic lane names a framework-pack-only skill; (b) run-time — the dispatch halt now renders the bundle into its body (bundle_line), so the agent cannot resolve a verb by guessing, and a lane with no framework-specific executor says so verbatim -->
- [x] Update the redirect table in `docs/contracts/ui-track-flow.md` — it is now
      documentation of `STACK_BUNDLES`, not a second source of truth.
      <!-- done: table fixed + marked as derived; the two broken rows and the reason they were broken are recorded inline -->
- [x] Delete the contradicting mandate and the false CI claim from
      `ui-stack-extension.md`.
      <!-- done: artefact rows no longer tell maintainers to author 12 skills (Step 3 is now "add a STACK_BUNDLES row"); Step 5's "task lint-skills enforces tested_against on ui-apply-*" claim removed — tested_against appears in 0 scripts and 0 skills, and the glob it named matches nothing, so it would have passed vacuously -->
- [x] Phase-0 lane fixtures re-run.
      <!-- done: ui_lane_matrix 25 tests green; the "12/12 unresolved" row is re-framed from defect-record to pinned architectural fact, and four new assertions cover bundle resolution, the pack-agnostic fallback, and the halt naming its bundle. Full work_engine suite: 632/632 across 82 files, no regression -->
- [x] Prove the new gate actually fails on the defect it exists for.
      <!-- done, and it did not at first: the linter shipped GREEN against a mutated `plain → blade-ui` tree. Two parser bugs — the block-list branch dropped nothing off the matched line, and `\s*` in the `packs:` regex swallowed the newline so every block-list skill parsed as "no packs". Fixed; now exits 1 with the precise finding on the mutation and 0 on the reverted tree -->

**Exit:** every dispatch path names a bundle that resolves, and the fallback lane
cannot depend on a pack the consumer may not have. ✅

## Phase 2 — Detection: stop sending real stacks into the fallback

- [x] Split the blade lane's `&&`: Livewire-with-Flux and Livewire-without-Flux
      are different capability sets and must not collapse into `plain`. Route the
      Flux-less case to the Livewire/Blade builders.
      <!-- done: new `blade-livewire` lane → build: [livewire, blade-ui] -->
- [x] Same for React without Radix/shadcn — React alone is a served stack, not an
      unknown one.
      <!-- done: new `react` lane → build: [react-shadcn-ui] (the React component idiom applies; the shadcn-specific parts simply do not) -->
- [x] Add Filament detection (`filament/filament`).
      <!-- done: new `filament` lane, ordered BEFORE bare Livewire because Filament pulls Livewire in transitively — otherwise the project would be labelled by its dependency, not by the framework the developer works in. Bundle: [livewire, blade-ui]; a Filament-specific skill stays gated on evidence that those produce unusable output -->
- [x] Monorepo: pick a side; do not leave the silent default.
      <!-- done: detection keeps root-manifests-only (documented, intentional) but now distinguishes wrong-scope from plain — no root manifest AND a manifest under packages|apps|services|libs/* → `unknown` → refusal. A repo with no manifest ANYWHERE stays `plain`, because that is greenfield and the scaffold path depends on it (asserted) -->
- [x] Split `plain` into `plain` vs `unknown` — the council's precondition for
      failing loudly without punishing real plain projects.
      <!-- done: `plain` now means "no frontend markers"; `unknown` means "a framework we recognise but do not model" (svelte, @angular/core, nuxt, astro, solid-js, qwik, inertia). Dispatch intercepts `unknown` in apply/review/polish and returns a refusal with no directive verb — there is nothing honest to delegate to -->
- [x] `daf-lane-*` fixtures flip from "records the defect" to "asserts the fix".
      <!-- done: 3 rows moved (livewire-no-flux plain→blade-livewire, filament plain→filament, react-no-radix plain→react), 3 rows added (unmodelled-svelte, unmodelled-inertia, greenfield-stays-plain), monorepo plain→unknown. Also corrected 3 pre-existing detection tests that pinned the old fall-through as correct -->

**Exit:** no project in the matrix reaches `plain` by accident; `plain` means
"genuinely plain", not "we failed to recognise you". ✅

## Phase 3 — The validation gates that do not validate

- [x] Fix the array hole in all three walkers. Arrays are traversed; strings
      inside them are scanned against `PLACEHOLDER_PATTERNS`.
      <!-- done: array elements addressed `key[i]` so the halt names the element, not just the list -->
- [x] Extract the shared walker once rather than patching the same bug in three
      places, and settle the "defense-in-depth" claim honestly.
      <!-- done: one `placeholder_paths` exported from design; apply imports it. Claim dropped from the contract and replaced with what is actually true — the same rule applied to two different INPUTS (brief vs rendered output), which is what catches drift between sign-off and render. Two byte-identical copies were never two layers that could fail independently -->
- [x] Type `states` in the state schema so the five-state loop cannot be skipped
      by passing a string or a list.
      <!-- done: state.ts `_validate_ui_design` rejects a non-object, non-null `states` at the schema boundary; the design gate's own guard now reports all five keys instead of skipping when the shape is wrong. Two layers, and this pair genuinely is independent (schema vs gate) -->
- [x] Decide the five-state gate's scope and state the reason.
      <!-- done: keep all five keys required, and extend the placeholder check to cover `states` (it previously covered `microcopy` only, so `states.error: "TBD"` passed a truthiness-only check). NOT gated on page type: an explicit `n/a` is a legitimate declaration that a surface has no such state — the opposite of inventing filler — so the author states the answer rather than the engine guessing which states a surface ought to have. Both branches are pinned by tests -->
- [x] Replace the phantom audit cache.
      <!-- done: prose deleted, real behaviour documented. The documented mtime key was also the WRONG key — apply adds components without touching a manifest, so it would never have invalidated on the change that matters. What the engine does: audit runs once per state-file and never refreshes. The bounded gap (a run reusing one state-file across several component additions) is now stated, with the instruction to re-read the component directories rather than trust a stale inventory -->
- [x] `daf-placeholder-in-array` and `daf-states-type-bypass` flip to green.
      <!-- done, plus two new assertions for the Step-4 decision: a placeholder inside a required state is rejected, and an explicit `n/a` state still passes. 642 tests green across 82 files -->

**Exit:** every gate the contract claims exists either exists or is no longer
claimed. ✅

## Phase 4 — Pack topology: the design layer ships with the stacks that need it

- [x] Give `laravel` and `react` a real edge to `frontend-design`, weighing
      install weight against the broken hard reference.
      <!-- done, but NEITHER wholesale option: promoting the corpus into engineering-base inflates every install (a backend-only consumer pays for a design corpus), and `requires` forces the design layer on a Laravel API-only project. Instead the two halves are fixed precisely — see the next two steps — plus a `suggests: [frontend-design]` edge on both packs so the wizard OFFERS the companion. That fixes the backwards-pointing edge without adding weight; `suggests` is advisory by design and that is the correct strength here -->
- [x] `design-fidelity` (the rule) must reach a consumer who installed only
      `laravel` or only `react`.
      <!-- done: `packs: [engineering-base, frontend-design]`. The rule is framework-neutral discipline — honour a provided design, never swap fonts/controls/layout unconfirmed — with no corpus dependency, so gating it behind the design pack was miscategorisation, not a weight decision. It is tier-2a (trigger-loaded), so the base-pack listing costs nothing until it fires -->
- [x] Fix the hard reference itself: `fe-design` (engineering-base) instructed
      "run the corpus query first" with no branch for the corpus being absent.
      <!-- done: added an explicit not-installed branch — fall back to the heuristics AND say so in the result ("no corpus grounding"). Names the distinction that was missing: a corpus that answered "nothing here" is an evidence gap; a corpus that is not installed is not, and must never be recorded as one -->
- [x] Add an install-shape fixture.
      <!-- done: tests/scripts/pack_reach_design_layer.test.ts — computes the transitive `requires` closure per pack and asserts what a laravel-only / react-only install can actually reach. Mutation-proved: reverting the rule's packs list to the pre-fix value fails 2 of 9, and the fixed tree passes 9/9. It also asserts the corpus gap ON PURPOSE (optional weight) so the honest-degrade wording is what carries the load, not silent grounding -->

**Exit:** no shipped skill hard-references an artifact its own install shape can
omit — and where an artifact is genuinely optional, the skill says so instead of
assuming it. ✅

## Phase 5 — Model tier: measure the inversion before flipping it

- [~] Benchmark, not argument: run the lane fixtures with the current allocation
      (builders medium / reviewers high) and with builders raised, scoring output
      quality **and** per-run cost.
      <!-- deferred: BLOCKED ON MISSING INFRASTRUCTURE, not a null result — the two are different and must not be conflated. Neither existing harness can score generated UI: `bench:ab` (internal/bench/corpora/ab-track{a,b}.yaml) measures SURFACE PRESENCE — whether a rule/skill fires — and `bench-quality-run` (token-quality-golden.yaml, 110 tasks) judges RULE COMPLIANCE ("stayed in scope", "ran the audit before creating a component"), not whether the emitted frontend is good. A tier benchmark needs a third thing: UI-generation prompts, a rendering step, and a visual/structural rubric. That is a new subsystem, and building it to answer one frontmatter question is the speculative scale this roadmap's own design constraints forbid -->
- [~] Include the two outliers in the read (`accessibility-auditor` medium
      reviewer, `ui-component-architect` high builder).
      <!-- deferred with the step above — and note what it implies: the inversion is real but NOT total, so a blanket flip would flatten a distinction that may well be deliberate. That is a second reason not to act on argument alone -->
- [~] Publish the result either way.
      <!-- deferred: nothing measured, so nothing to publish. What IS decided and acted on: the tiers stay UNCHANGED, including both outliers. The cost half needs no benchmark to read — builders run first, run longest, and re-run up to POLISH_CEILING times, so raising them is unambiguously the expensive direction; the quality half is unmeasurable today. Changing allocation on that basis would be exactly the unevidenced flip this phase exists to prevent. Revisit condition: a harness that scores generated UI exists (or one run is funded deliberately as a one-off) -->

**Exit:** the tier allocation is evidence-backed, whichever way it lands.
**Actual:** deferred — the measurement is blocked on a harness that does not
exist, and the tiers are therefore left alone. The finding stands; the fix does
not, and pretending otherwise would be the failure this roadmap documents
elsewhere.

## Phase 6 — Contract truth-up

- [x] Fix the fixture-count claim in the two contracts.
      <!-- done, and the finding as written was OVERSTATED — recording that rather than quietly fixing something else. Both contracts say "the nine fixtures the stages + branches gate on" / "the nine cases this phase seeds", which is accurate: the branch table does cite exactly nine. The misleading part is that neither said the file carries more, so a reader budgeting coverage from either one under-counts. Both now say so and point at which surface gates the rest -->
- [x] Bind or unbind the orphaned fixture ids.
      <!-- done — this WAS a real falsehood, and it lived in the fixtures file, not the contracts: `eval-fixtures.md` asserted "Phase 1 references these ids from its lifecycle branches" without qualification, which reads as all of them while 7 were uncited there. Replaced with the actual gating map (design-fidelity-mechanics for asset/verify discipline, the targeted-edit discipline for daf-redesign-trigger, ui_lane_matrix.test.ts for the lane family) -->
- [x] Fix the stale slot map and the halt budget in `ui-track-flow.md`.
      <!-- done: slot map `audit → ⊘ → design → ⊘ → …` corrected to name app_spec and scaffold (index.ts wires them into the memory and plan slots). The "two user halts" figure is correct for a normal `ui` run — those two slots are no-ops off the greenfield path — so it stays, with the greenfield budget (three sign-offs) stated explicitly and app-spec-confirm plus the scaffold halts added to the additional-halts list they were missing from -->
- [x] Add a check that fails when a fixture id is claimed-but-uncited.
      <!-- done: lint-eval-fixture-citations, wired into ci + ci-strict. It earned its place immediately — on first run it caught `daf-lane-recovery`, an id added in THIS roadmap's Phase 0 and cited by nothing. Now 26/26 cited -->

**Exit:** the contracts describe the machine that exists. ✅

## Gated follow-ups (not open work — do not start these)

- **Capability-based dispatch** replacing the four-stack enum
  (`{component_library, styling, reactivity}` tuple → builder). Both council
  members judged the enum the deeper defect and the rewrite premature.
  **Gate:** Phase 2 lands and the lane matrix still shows a real stack with no
  honest home — i.e. the enum demonstrably cannot be extended cheaply.
- **A Filament executor skill.** **Gate:** `daf-lane-filament` shows the Blade
  builders produce unusable output for Filament. Absent that, Filament is a
  detection arm, not a new skill.
- **A Vue executor skill.** **Gate:** `daf-lane-vue` shows the generic builder
  fails for Vue. Note the prior false closure — do not mark a Vue gap closed on
  corpus-search evidence again.

## Non-goals (decided, with reasons)

- **Not the artifact-port path.** Separate roadmap; different blast radius,
  different files, and it is bounded by a standing council lock.
- **Not webfont delivery.** Separate roadmap; corpus data, not the state machine.
- **No new binary or runtime dependency.** Standing constraint from the
  2026-06-28 lock.
- **No rewrite of the UI state machine.** Both council members raised the
  question and both declined to act on it without the Phase-0 matrix. The matrix
  either exonerates the machine or becomes the evidence for reopening it.

## Acceptance criteria

- The Phase-0 baseline table exists and every later phase cites a before-value
  from it.
- No dispatch path can name a skill that does not exist; unsupported stacks
  produce a loud, named refusal.
- No project in the lane matrix reaches `plain` by misdetection.
- A placeholder inside an array is rejected by the microcopy gate and by the
  rendered-output gate, and counted correctly in the sign-off summary.
- Installing `laravel` alone, or `react` alone, leaves no hard reference from a
  shipped skill unresolved.
- ~~The tier question is answered by a published benchmark, including an
  honest-null.~~ — **carried to the follow-up**, unmet here. The measurement is
  blocked on a harness that does not exist; the tiers are unchanged.
- No contract in the design surface states a fixture count, halt budget, slot
  map, or cache mechanism that the tree contradicts.

<!-- Deferred items migrated to agents/roadmaps/archive/road-to-ui-track-integrity-followup.md on 2026-07-31 -->
<!-- Resolution: option 2 (follow-up, ready + blocked). The three [~] lines in
     Phase 5 stay visible above so the trail stays grep-able; the follow-up
     carries the executable copy. Blocker recorded there: no harness scores
     generated UI. -->

