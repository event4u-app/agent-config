# Blade UI Guidelines

> Blade template conventions — views, components, partials, forms, escaping, styling.

**Related Skills:** `blade-ui`, `livewire`, `flux`
**Related Guidelines:** [controllers.md](controllers.md)

## View Structure

- Use the project's existing layout system.
- Organize templates into clear sections.
- Extract repeated sections into partials or components.
- Prefer semantic HTML.
- Avoid deeply nested conditionals — use a partial/component instead.

## Blade Logic

- Use Blade directives for **simple presentation logic** only.
- Keep conditionals small and view-focused.
- No business calculations or database access in templates.
- No heavy data transformations in Blade.
- Move non-trivial formatting to controllers, view models, presenters, or components.

## Components

- Use Blade components for reusable UI pieces (when project already uses them).
- Keep component APIs clean and explicit — clear prop/slot names.
- Don't create a component for something used only once (unless it significantly improves clarity).

## Partials

- Use partials for repeated markup fragments when a full component is unnecessary.
- Name partials clearly per project conventions.
- Avoid deep partial hierarchies that make UI hard to trace.

## Forms

- Follow the project's form style for labels, inputs, validation messages, old values, session feedback.
- Use CSRF protection correctly.
- Render validation errors consistently.
- Preserve user input using project conventions.
- Reuse existing field components/partials — don't duplicate.

## Validation and Feedback

- Display validation errors clearly and consistently.
- Show success/error flash messages per project conventions.
- Keep feedback near the relevant UI.
- Don't invent a second feedback pattern if one already exists.

## Escaping and Output Safety

- Escape output by default — use `{{ }}`.
- Use `{!! !!}` only when intentionally safe and already sanitized.
- Be careful with rich content, HTML snippets, and user-generated content.

## Styling

- Reuse existing CSS/Tailwind conventions.
- Don't introduce a new styling approach in one template.
- Match class usage with neighboring templates.
- If the project uses design-system components, follow them.
- Always use utility classes — not inline styles.

## Accessibility

- Use labels for form fields.
- Prefer semantic elements.
- Add ARIA only where it meaningfully improves accessibility.

## Do NOT

- Place business logic in Blade templates.
- Query the database from views.
- Echo unescaped user data without explicit sanitization.
- Inline large blocks of CSS or JS — use asset files.
- Duplicate repeated markup when a component/partial exists.
- `@include` shares parent scope — components don't. Know the difference.
