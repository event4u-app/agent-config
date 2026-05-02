---
name: livewire
description: "Stack-implementation skill for Livewire — dispatched by `directives/ui/apply.py` (and `review.py` / `polish.py`) when the project's frontend stack is Livewire. Covers reactive state, events, lifecycle hooks, and component/view separation."
source: package
---

# livewire

## Positioning — dispatched, not standalone

`livewire` is the **apply-step executor** for the Livewire stack. It is
invoked by [`directives/ui/apply.py`](../../templates/scripts/work_engine/directives/ui/apply.py)
once the design brief is locked, and revisited by `review.py` /
`polish.py` during the design-review loop. It does **not** own the
flow, does **not** drive the audit, and does **not** lock the design.

| Concern | Owner |
|---|---|
| Audit + token inventory (mandatory pre-step) | [`existing-ui-audit`](../existing-ui-audit/SKILL.md) |
| Design brief (layout / states / microcopy) | [`directives/ui/design.py`](../../templates/scripts/work_engine/directives/ui/design.py) |
| Universal design heuristics | [`fe-design`](../fe-design/SKILL.md) |
| Static Blade partials inside the view | [`blade-ui`](../blade-ui/SKILL.md) |
| Flux primitives inside the view | [`flux`](../flux/SKILL.md) |

## When to use

Cite this skill when:

- `state.stack.frontend == "livewire"` and `directives/ui/apply.py` dispatches to this skill
- Editing or creating Livewire components — reactive state, forms, tables, real-time updates

Do NOT use when:

- Static Blade views with no interactivity (use `blade-ui` skill)
- Flux UI primitives (use `flux` skill — `livewire` composes Flux internally)
- Driving the full UI flow yourself — that is the `directives/ui/` orchestrator

## Procedure: Create a Livewire component

### Step 0: Inspect

1. Detect Livewire version — `composer.json` for `livewire/livewire`.
   - v3: `#[Layout]`, `#[Title]`, property attributes.
   - v2: `$layout`, `$listeners`, method-based hooks.
2. Check existing components — `app/Livewire/` or `app/Http/Livewire/`.
3. Check views — `resources/views/livewire/`.

### Step 1: Create component class

1. `declare(strict_types=1)`, `final` class.
2. Typed public properties for state — keep minimal.
3. `#[Locked]` for tamper-proof properties.
4. `#[Url]` for URL-synced properties.

### Step 2: Implement actions

1. Public methods callable from frontend.
2. Validate before processing: `$this->validate()`.
3. `$this->dispatch()` for cross-component communication (v3).

### Step 3: Create view

1. One root element (`<div>`).
2. `wire:key` on dynamic lists.
3. `wire:loading` for user feedback.
4. `wire:model.live` for real-time updates (v3 default is deferred).

### Step 4: Test

- `Livewire::test(ComponentClass::class)`
- `->set()`, `->call()`, `->assertSee()`, `->assertHasNoErrors()`

## Conventions

→ See guideline `php/livewire.md` for state management, forms, performance, Alpine.js, templates.

## Output format

1. Livewire component class with typed properties and actions
2. Blade view with wire: bindings and Flux components

### Review pass — a11y findings + preview envelope

When this skill is dispatched by `directives/ui/review.py` (test slot)
or `directives/ui/polish.py` (verify slot) — i.e. a review/polish run,
not the initial apply — it also emits:

- `state.ui_review.a11y` — `{violations: [{rule, selector, severity}, ...],
  severity_floor?, accepted_violations?}`. Use the same `(rule, selector)`
  shape as `state.ui_audit.a11y_baseline` so the engine's de-dup matches
  pre-existing entries on replay. Omit the envelope on apply passes; the
  engine's `_apply_a11y_gate` only fires when a baseline is present.
- `state.ui_review.preview` — `{render_ok: bool, screenshot_path?,
  dom_dump_path?, error?, skipped?}`. `render_ok: false` with `error`
  populated triggers the `preview_render_failed` halt; `render_ok: true`
  with `screenshot_path` threads the screenshot into the delivery
  report's `artifacts` list. Browser tooling (Playwright/Cypress/…) is
  a consumer-project dependency — this package does not ship one.

Polish dispatch: when the dispatcher skips `review` because a previous
review pass already returned `SUCCESS`, this skill MUST itself
synthesise the updated `state.ui_review.findings` (including any
remaining `a11y_violation` entries) so the engine's gate sees the
current state on the next polish round.

## Gotcha

- Public properties serialize between requests — don't put large objects in state.
- `wire:model` is deferred by default in v3 — use `wire:model.live` for real-time.
- `$this->redirect()` + `$this->dispatch()` in same method — only redirect executes.

## Do NOT

- Do NOT put heavy computation in `render()` — it runs on every update.
- Do NOT nest Livewire components deeply — keep the tree shallow.
- Do NOT expose sensitive data as public properties.

## Auto-trigger keywords

- Livewire
- reactive component
- wire:model
- lifecycle
- real-time UI
