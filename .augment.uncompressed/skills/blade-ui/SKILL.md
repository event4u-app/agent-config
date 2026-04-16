---
name: blade-ui
description: "Use when creating or editing Blade views, components, partials, or view logic. Covers clean separation of concerns and reusable UI structure."
source: package
---

# blade-ui

## When to use

Use when creating or editing Blade views, components, partials, layouts, or forms.

Do NOT use when:
- API-only endpoints (use `api-endpoint` skill)
- Livewire components (use `livewire` skill)
- Flux UI components (use `flux` skill)

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
