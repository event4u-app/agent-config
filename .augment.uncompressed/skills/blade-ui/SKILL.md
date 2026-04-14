---
name: blade-ui
description: "Use when creating or editing Blade views, components, partials, or view logic. Covers clean separation of concerns and reusable UI structure."
source: package
---

# blade-ui

## When to use

Use this skill for Laravel Blade-based UI work, especially when working with:

- Blade views
- Blade components
- Layouts
- Partials
- Forms
- View composition
- Server-rendered UI
- Tailwind-based Blade templates
- Validation and session feedback rendering

This skill extends `coder` and `laravel`.

Do NOT use when:
- API-only endpoints (use `api-endpoint` skill)
- Livewire components (use `livewire` skill)

## Before writing code

1. **Read the base skills first** — apply `coder` and `laravel`.
2. **Confirm Blade is used** — inspect `resources/views`, components, layouts, and frontend tooling.
3. **Inspect UI patterns** — check existing layouts, partials, component naming, and CSS conventions.
4. **Check form handling style** — old input, validation errors, session flashes, custom components, and reusable field partials.
5. **Inspect neighboring templates** — match indentation, directives, slot usage, classes, and structure.
6. **Understand the data flow** — determine what belongs in the controller/view model and what belongs in the template.

## Core principles

- Blade templates should focus on presentation.
- Keep business logic out of views.
- Prefer reusable components/partials when repetition exists.
- Match the existing UI structure and component conventions.
- Keep templates readable and predictable.

## View structure rules

- Use the project's existing layout system.
- Keep templates organized into clear sections.
- Extract repeated sections into partials or components.
- Prefer semantic HTML where possible.
- Avoid deeply nested conditional markup when a partial/component would make it clearer.

## Blade logic rules

- Use Blade directives for simple presentation logic.
- Keep conditionals small and view-focused.
- Do not perform business calculations or database access in templates.
- Do not place heavy data transformations in Blade.
- Move non-trivial formatting or preparation into:
    - controllers
    - view models
    - presenters
    - components
      depending on project style

## Component rules

- Use Blade components when the project already uses them for reusable UI pieces.
- Keep component APIs clean and explicit.
- Choose clear names for props and slots.
- Do not create a component for something used only once unless it improves clarity significantly.
- Keep components presentation-oriented.

## Partial rules

- Use partials for repeated markup fragments when a full component is unnecessary.
- Name partials clearly according to project conventions.
- Avoid partial hierarchies that make the UI hard to trace.

## Form rules

- Follow the project's form style for:
    - labels
    - inputs
    - validation messages
    - old values
    - session feedback
- Use CSRF protection correctly.
- Render validation errors consistently.
- Preserve user input using project conventions.
- Do not duplicate field patterns if reusable components/partials already exist.

## Validation and feedback rendering

- Display validation errors clearly and consistently.
- Show success/error flash messages according to project conventions.
- Keep feedback near the relevant UI when possible.
- Do not invent a second feedback pattern if one already exists.

## Escaping and output safety

- Escape output by default.
- Use raw output only when intentionally safe and already sanitized.
- Be careful with rich content, HTML snippets, and user-generated content.
- Do not introduce XSS risks by bypassing escaping casually.

## Styling rules

- Reuse the existing CSS/Tailwind conventions.
- Do not introduce a new styling approach in one template.
- Keep class usage consistent with neighboring templates.
- If the project uses design-system components, follow them instead of custom markup.

## Accessibility rules

- Use labels for form fields.
- Prefer semantic elements and accessible structure.
- Add ARIA usage only where it meaningfully improves accessibility.
- Ensure interactive elements are actually interactive and understandable.

## What NOT to do

- Do not place business logic in Blade templates.
- Do not query the database from views.
- Do not duplicate repeated markup when a component/partial exists.
- Do not bypass escaping without a clear reason.
- Do not mix unrelated presentation patterns in the same area.
- Do not create complex templates that hide the actual UI structure.

## Output expectations

When generating Blade UI code:

- keep templates presentation-focused
- use layouts, partials, and components consistently
- render forms and validation cleanly
- escape output safely
- match the existing styling and template conventions
- keep the markup readable and maintainable

## Gotcha

- Don't put business logic in Blade templates — use view composers or Livewire components.
- `@include` is not the same as a component — includes share the parent scope, components don't.
- The model tends to use inline styles instead of Tailwind classes — always use utility classes.

## Do NOT

- Do NOT echo unescaped user data — use {{ }} not {!! !!} unless explicitly safe.
- Do NOT inline large blocks of CSS or JS — use asset files.

## Auto-trigger keywords

- Blade template
- Blade component
- Laravel view
- partial
- view logic
