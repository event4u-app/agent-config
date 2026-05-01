---
name: blade-ui
description: "Stack-implementation skill for Laravel Blade — dispatched by `directives/ui/apply.py` (and `review.py` / `polish.py`) when the project's frontend stack is Blade. Covers views, components, partials, layouts, and view logic."
source: package
---

# blade-ui

## Positioning — dispatched, not standalone

`blade-ui` is the **apply-step executor** for the Blade stack. It is
invoked by [`directives/ui/apply.py`](../../templates/scripts/work_engine/directives/ui/apply.py)
once the design brief is locked, and revisited by `review.py` /
`polish.py` during the design-review loop. It does **not** own the
flow, does **not** drive the audit, and does **not** lock the design.

| Concern | Owner |
|---|---|
| Audit + token inventory (mandatory pre-step) | [`existing-ui-audit`](../existing-ui-audit/SKILL.md) |
| Design brief (layout / states / microcopy) | [`directives/ui/design.py`](../../templates/scripts/work_engine/directives/ui/design.py) |
| Universal design heuristics | [`fe-design`](../fe-design/SKILL.md) |
| Review + polish loop | [`directives/ui/review.py`](../../templates/scripts/work_engine/directives/ui/review.py) + [`polish.py`](../../templates/scripts/work_engine/directives/ui/polish.py) |

## When to use

Cite this skill when:

- `state.stack.frontend == "blade"` (or the project is clearly Blade-only without Livewire / Flux) and `directives/ui/apply.py` dispatches to this skill
- Editing or creating Blade views, components, partials, layouts, or forms

Do NOT use when:

- API-only endpoints (use `api-endpoint` skill)
- Livewire components (use `livewire` skill — it composes Blade views internally)
- Flux UI components (use `flux` skill)
- Driving the full UI flow yourself — that is the `directives/ui/` orchestrator

## Procedure: Create Blade view or component

### Step 0: Inspect

1. Confirm Blade is used — check `resources/views`, components, layouts.
2. Inspect existing UI patterns — layouts, partials, component naming, CSS conventions.
3. Check form handling style — old input, validation errors, session flashes, reusable field partials.
4. Inspect neighboring templates — match indentation, directives, slot usage, classes.
5. Determine data flow — what belongs in controller/view model vs. template.

### Step 1: Create the template

1. Use the project's existing layout system.
2. Keep template presentation-focused — no business logic, no DB queries.
3. Extract repeated sections into partials or components.

### Step 2: Handle forms (if applicable)

1. Follow project's form style for labels, inputs, validation messages.
2. Use CSRF protection correctly.
3. Render validation errors consistently.
4. Preserve user input with `old()` or project conventions.
5. Reuse existing field components — don't duplicate.

### Step 3: Validate

1. Check escaping — `{{ }}` by default, `{!! !!}` only when explicitly safe.
2. Check styling — Tailwind utility classes, not inline styles.
3. Check accessibility — labels for form fields, semantic HTML.

## Conventions

→ See guideline `php/blade-ui.md` for full conventions.

## Output format

1. Blade view or component file(s) following project conventions
2. Component class (if applicable) with typed props

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

- `@include` shares parent scope — components don't. Know the difference.
- Always use Tailwind utility classes — not inline styles.
- Don't put business logic in templates — use view composers or Livewire.

## Do NOT

- Do NOT use `{!! !!}` with user input — XSS risk.
- Do NOT put business logic in Blade templates — use Livewire or view composers.
- Do NOT use inline styles — use Tailwind utility classes.

## Auto-trigger keywords

- Blade template
- Blade component
- Laravel view
- partial
- view logic
