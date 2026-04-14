---
name: blade-ui
description: "Use when creating or editing Blade views, components, partials, or view logic. Covers clean separation of concerns and reusable UI structure."
source: package
---

# blade-ui

## When to use

Blade views, components, layouts, partials, forms, view composition, Tailwind templates. Extends `coder`, `laravel`. NOT for: API-only (`api-endpoint`), Livewire (`livewire`).

## Before: base skills, confirm Blade, inspect UI patterns, form handling, neighboring templates, data flow.

## Principles: presentation only, no business logic, reusable components/partials, match conventions.

## Views: existing layout, organized sections, extract repeated parts, semantic HTML. Logic: directives for simple cases, no DB/business in templates. Components: clean APIs, explicit props/slots, reuse existing. Partials: repeated fragments, clear naming.

## Forms: follow project style (labels, inputs, errors, old values, CSRF), reuse field components. Feedback: errors below field, flash messages per convention.

## Escaping: `{{ }}` by default, `{!! !!}` only when safe. Styling: match existing CSS/Tailwind. A11y: labels, semantic HTML, ARIA where helpful.

## Gotcha: `@include` shares parent scope (components don't), Tailwind not inline styles, view composers for complex data.

## Do NOT: business logic in templates, DB in views, unescaped user data, inline CSS/JS blocks, duplicate markup, introduce new styling approach.
