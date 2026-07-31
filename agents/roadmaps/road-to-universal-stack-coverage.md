---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-ui-track-integrity
---

# Road to universal stack coverage — an honest refusal is not coverage

> Successor to `road-to-ui-track-integrity` under one maxim: **the package is
> global.** No fix may privilege a named consumer stack; the mechanism has to
> carry Laravel-without-Flux as well as Next-without-shadcn, Svelte, Astro, or a
> monorepo. And the house discipline against speculative scale still binds:
> **no sixteen new stack skills.** The route is composition — one real generic
> executor, plus overlays, plus the 16-stack corpus that already exists — not
> enumeration.
>
> Source: review round 3 on the frontend sweep. Its diagnosis is reframed below
> because the tree moved under it (#1074 merged 2026-07-31); its *solution
> shape* survives that intact and is the reason this roadmap exists.

## What the predecessor already shipped (verified on `main`, do not re-plan)

The review's B9/B10 framing — "`plain` is the fallback for every non-exact match,
so most of the real frontend world lands in a lane with no implementation
discipline" — described the tree **before** #1074. Measured on `origin/main`:

- `KNOWN_STACKS` carries **eight** labels, not four: `blade-livewire-flux`,
  `blade-livewire`, `filament`, `react-shadcn`, `react`, `vue`, `plain`,
  `unknown`. Livewire-without-Flux, React-without-Radix and Filament each have
  their own lane and no longer fall through.
- `plain` was split from `unknown`. `plain` now means "no frontend markers";
  `unknown` means "a framework we recognise and do not model", and `apply` /
  `review` / `polish` **refuse** on it — no directive verb, a named halt.
- Monorepos (root manifest absent, a manifest under `packages|apps|services|
  libs/*`) resolve to `unknown` and therefore refuse, rather than silently
  becoming `plain`.
- `laravel` and `react` already carry `suggests: [frontend-design]`.
- The "lint that every dispatch target resolves" acceptance criterion already
  exists as `lint-ui-stack-bundles` — see the correction below, because its
  shape matters.

**So the silent-fallback defect is closed.** What is left is a different and
narrower claim, and it is the one worth acting on.

## The defect, restated for the tree as it is

**An honest refusal is not coverage.** A Svelte, Astro, Angular, Nuxt or Inertia
project now gets a clear "this package does not model your framework" instead of
silent Tailwind-only output. That is strictly better and it is still a dead end
for the consumer — while `src/skills/design-intelligence/data/stacks/` already
holds **16 stack corpora** (`angular`, `astro`, `svelte`, `nuxtjs`, `nuxt-ui`,
`react`, `nextjs`, `vue`, `react-native`, `flutter`, `html-tailwind`, `shadcn`,
`laravel`, `swiftui`, `jetpack-compose`, `threejs`) reachable through the
`--stack` axis (`design-intelligence/SKILL.md:244`). The knowledge to serve those
projects is in the tree; only the wiring that would deliver it is missing.

**And the flat label is the wrong shape for the wiring.** A frontend stack has
independent axes — view layer, reactivity layer, component library, CSS — and one
label forces all-or-nothing matches. `livewire ∧ flux` was never the bug; it was
the symptom of collapsing three axes into one enum value. Eight labels is a
better enum, not a different shape: every new combination still needs a new
label, which is the enumeration this package refuses to sign up for.

This is the follow-up the predecessor gated. Its gate read: *"Phase 2 lands and
the lane matrix still shows a real stack with no honest home — i.e. the enum
demonstrably cannot be extended cheaply."* The gate is **met, for a reason the
gate did not anticipate**: the enum extended cheaply enough (three lanes in one
commit), but extension produces refusals rather than coverage, and a corpus that
would make coverage cheap was already sitting unused. Recorded rather than
glossed, because the gate's own wording would otherwise read as unmet.

## Correction to one acceptance criterion (load-bearing)

The review asks for a CI lint that *"every `STACK_DIRECTIVES` target reference
must resolve to an existing artefact"*. **Taken literally that reintroduces the
option a council already rejected on measured evidence.** `ui-apply-<stack>` is
a directive **verb**, not a skill path: of the engine's 11 literal verbs only 2
(`existing-ui-audit`, `refine-prompt`) name a real skill; the other 9
(`run-tests`, `create-plan`, `apply-plan`, …) resolve to nothing by design.
Requiring the 12 UI verbs to resolve means authoring 12 skill files and making
these lanes the engine's only exception.

The property the review actually wants is already shipped, one level down:
`lint-ui-stack-bundles` asserts that every **bundle member** resolves to a real
skill, and that a `pack_agnostic` lane names only stack-neutral skills. This
roadmap extends that check to the composed shape rather than restating it
against verbs. Rationale:
[`frontend-fidelity-cut § Amendment`](../settings/contexts/frontend-fidelity-cut.md).

## Zielbild

`state.stack` becomes multi-axis; dispatch **composes** a base executor with
stack overlays instead of selecting a monolithic lane; the corpus supplies
idiomatic knowledge for every stack that has a CSV, with an honest degrade where
none exists; and `plain` becomes a real executor carrying the stack-independent
contract. No stack meets zero guidance; modelled stacks meet more.

## Phase 0 — Fixtures and baseline (before any behaviour change)

- [x] Detection-matrix fixtures, one per shape.
      <!-- done: 6 new rows in LANE_MATRIX (blade-alpine, next-tailwind, nuxt, astro, angular, htmx) on top of the 8 the predecessor left. They assert CURRENT behaviour — the multi-axis result is what Phase 1 introduces, so the table's diff is the evidence -->
- [x] `mixed-repo` and multi-root `monorepo` pass criterion is **halt with a
      question**, never a silent pick.
      <!-- done as a recorded defect: `daf-lane-mixed-repo` asserts that react+vue in one manifest currently resolves to `react` SILENTLY. Multi-root monorepo already halts (predecessor shipped `unknown` for it), so only the mixed-manifest case is open. Criterion accepted: guessing is the worse property for a global package -->
- [x] Apply fixtures per new shape.
      <!-- done as rubric eval fixtures (daf-generic-apply-coverage, daf-generic-apply-degrade) — they judge whether the corpus was actually cited, which no unit test can assert. Both are RED at baseline and stay red until Phase 2; that is the intended shape, not a gap -->
- [x] Extend `ui_lane_matrix.test.ts` rather than starting a second matrix.
      <!-- done — 47 assertions green. One matrix stays the single before/after record for this surface -->
- [x] Baseline against `main` documented; honest-null path retained.
      <!-- done: table below, measured against origin/main @ a40d5a54a -->

### Measured baseline (2026-07-31, `origin/main` @ a40d5a54a)

Every row measured, not inferred. The `corpus?` column is the load-bearing one:
it separates a **knowledge** gap from a **wiring** gap.

| Shape | Detected | Outcome today | corpus in tree? |
|---|---|---|---|
| Laravel + Alpine + Tailwind | `plain` | generic pair, no Blade guidance | `laravel.csv` |
| Next + Tailwind | `react` | React lane; Next idiom lost | `nextjs.csv` |
| Nuxt + Vue | `vue` | Vue lane; Nuxt idiom lost | `nuxtjs.csv`, `nuxt-ui.csv` |
| Svelte | `unknown` | **refused** | `svelte.csv` |
| Astro | `unknown` | **refused** | `astro.csv` |
| Angular | `unknown` | **refused** | `angular.csv` |
| htmx | `plain` | generic pair, no htmx signal | none |
| react **and** vue | `react` | **silent pick, no halt** | both |

Two findings the review did not name:

- **Nuxt never reaches the unmodelled check.** `nuxt` is in
  `_UNMODELLED_MARKERS`, but `_has_vue` matches first because Vue is a Nuxt
  dependency — so it is labelled by its dependency, not by its framework. A
  priority-order artefact of the flat label, and the clearest single argument
  for axes over an enum: no ordering of one list can express "Nuxt implies Vue
  but is not Vue".
- **Next collapses the same way** into `react`, with `nextjs.csv` sitting unused.

Three of eight shapes are refused while their corpus exists; two more are
mislabelled by a dependency; one picks silently. In no case is the knowledge
missing.

**Exit:** matrix + baseline committed; the target detection results are the
reviewed contract. ✅

## Phase 1 — Detection v2: axes instead of one label

- [ ] Extend `StackResult` with `{ view, reactivity, component_lib, css }`
      alongside the existing fields. Keep the flat `frontend` label as a
      **derived compatibility field** so the golden recipes,
      `STACK_DIRECTIVES` readers and the `== KNOWN_STACKS` invariant keep
      working. Removing it is a separate breaking change, explicitly not this
      roadmap.
- [ ] Signal table per axis from manifests plus marker files
      (`components.json`, `svelte.config.*`, `@nuxt/*`, `alpinejs`,
      `htmx.org`, a `<flux:` grep, …). First-match logic applies **per axis**,
      never across the whole stack — that collapse is the original defect.
- [ ] Monorepo: read `workspaces` plus scan `apps/*` / `packages/*`. One
      frontend root → detect against it. Several → halt with numbered options
      (`ask-when-uncertain`), cache the answer per root.
- [ ] Ambiguity (react **and** vue in one manifest) halts instead of guessing a
      priority order.
- [ ] Extend the cache key to the marker files in the signal table, not just
      `composer.json` / `package.json`. This closes the detection-scoped part of
      the audit-staleness finding the predecessor documented but did not fix.

**Exit:** detection-matrix fixtures green; the derived `frontend` label is
byte-stable for all eight existing labels (golden replay proves it).

## Phase 2 — `ui-apply-generic`: the default lane becomes real

- [ ] New executor skill carrying the stack-independent implementation
      discipline that currently lives only in the framework lanes:
      brief/artifact verbatim contract, token discipline, a11y floor, verify
      step with honest degrade, asset discipline.
- [ ] Mandatory step: corpus query with the detected axis values
      (`--stack <detected>`). Where no CSV domain exists, emit the honest
      degrade sentence ("no stack corpus for X — proceeding on the generic
      contract") rather than silently skipping it.
- [ ] **No framework prose in the skill.** The knowledge lives in the corpus;
      the skill carries contract plus wiring. That is what keeps one skill
      serving Svelte, Astro, Angular and everything future at once — and what
      keeps it reviewable by a single maintainer.
- [ ] Make it the `plain` bundle member and the fallback, and confirm
      `lint-ui-stack-bundles` still passes — the new skill must ship in a
      stack-neutral pack, or the fallback breaks for the consumers it exists
      to serve.
- [ ] Decide `unknown`'s disposition explicitly: it either keeps refusing, or
      routes to the generic lane with the framework named as unmodelled. Do not
      leave both readings live. State the reason.

**Exit:** apply fixtures for `svelte`, `react-plain`, `blade-alpine` green
through the generic lane.

## Phase 3 — Overlay dispatch: composition instead of lane choice

- [ ] Turn the bundle map into a composition: base `ui-apply-generic` plus
      overlays derived from the axes — `reactivity: livewire` → `livewire`
      (with **or** without Flux), `component_lib: flux` → `flux` on top,
      `view: blade` → `blade-ui`, `component_lib: shadcn` → `react-shadcn-ui`,
      `css: tailwind` → cite `tailwind-engineer`.
- [ ] The two full-match lanes must fall out of composition as a special case.
      Golden replay is the regression witness: identical dispatch result,
      byte-for-byte, or the composition is wrong.
- [ ] Extend `lint-ui-stack-bundles` to the composed shape — every overlay a
      set of axis values can produce must resolve, and a composition reachable
      without a framework pack must stay pack-neutral. This is the review's
      acceptance criterion in the form that does not require twelve skill
      files.
- [ ] Vue stays overlay-free: generic plus `--stack vue` plus optional
      `nuxt-ui` corpus. A Vue overlay skill needs demonstrated consumer demand
      (watch note + reopen trigger), not a gap in a table.

**Exit:** all apply fixtures green; dispatch for the eight existing labels
byte-identical to `main`.

## Non-goals (decided, with reasons)

- **No per-framework executor enumeration** — no svelte/angular/astro/flutter
  executor skill. The corpus covers knowledge; a skill appears only on
  demonstrated demand. Otherwise this is precisely the speculative scale the
  parent forbids.
- **No removal of the flat label** in this roadmap. It is load-bearing for
  goldens and the `== KNOWN_STACKS` invariant; dropping it is its own reviewed
  breaking change.
- **No content-heuristic framework detection** beyond the signal table — no
  "looks like React" guessing. Ambiguity halts and asks.
- **Not the tier question.** That is
  `road-to-ui-track-integrity-followup`, blocked on a harness. Note the overlap
  though: this roadmap's apply fixtures are a candidate half of that harness.

## Acceptance criteria

- [ ] No detection result dispatches to a composition whose members do not
      resolve — enforced by the extended `lint-ui-stack-bundles`, so an executor
      vacuum cannot form silently again. (The original vacuum survived two
      releases unnoticed; that is the property being fixed, not the count.)
- [ ] Livewire-without-Flux demonstrably receives Livewire guidance and **no**
      Flux guidance.
- [ ] A stack with a corpus but no overlay (svelte, astro, angular) receives the
      generic contract plus its corpus rows, and says which it used.
- [ ] A stack with neither receives the generic contract plus the honest degrade
      sentence.
- [ ] Monorepo and mixed-repo fixtures end in halt-with-question, never a silent
      label.
- [ ] Dispatch for the eight existing labels is byte-identical to `main`
      (golden replay).
- [ ] Benchmark or published honest-null from Phase 0.
