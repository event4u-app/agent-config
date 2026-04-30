---
name: blade-ui
description: "Stack-implementation skill for Laravel Blade — dispatched by `directives/ui/apply.py` (and `review.py` / `polish.py`) when the project's frontend stack is Blade. Covers views, components, partials, layouts, and view logic."
source: package
---

# blade-ui

## Positioning — dispatched, not standalone

`blade-ui` is the **apply-step executor** for the Blade stack. Invoked by [`directives/ui/apply.py`](../../templates/scripts/work_engine/directives/ui/apply.py) once the design brief is locked, and revisited by `review.py` / `polish.py` during the design-review loop. Does **not** own the flow, drive the audit, or lock the design.

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
- Livewire components (use `livewire` skill — composes Blade views internally)
- Flux UI components (use `flux` skill)
- Driving the full UI flow yourself — that is the `directives/ui/` orchestrator

## Procedure: Create Blade view or component

### Step 0: Inspect

1. Confirm Blade is used — check `resources/views`, components, layouts.
2. Inspect existing UI patterns — layouts, partials, component naming, CSS conventions.
3. Check form handling style — old input, validation errors, session flashes, reusable field partials.
4. Inspect neighboring templates — match indentation, directives, slot usage, classes.
5. Determine data flow — controller/view model vs. template.

### Step 1: Create the template

1. Use project's existing layout system.
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
