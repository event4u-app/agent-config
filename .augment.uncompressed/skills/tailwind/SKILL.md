---
name: tailwind
description: "Use when writing Tailwind CSS — utility classes, responsive design, dark mode support, and project conventions."
---

# tailwind

## When to use

Use this skill when:
- Styling HTML/Blade/Vue/React components with Tailwind CSS
- Building responsive layouts
- Working with dark mode
- Customizing Tailwind config
- Creating reusable utility patterns

## Before writing code

1. **Detect Tailwind version** — check `package.json` for `tailwindcss` (v3 vs v4).
2. **Check config** — read `tailwind.config.js` / `tailwind.config.ts` for custom theme, plugins, content paths.
3. **Check for CSS framework** — is Tailwind used standalone or with Flux, DaisyUI, Headless UI, etc.?
4. **Match existing patterns** — look at neighboring templates for class ordering, spacing scale, color usage.
5. **Check dark mode** — is `darkMode: 'class'` or `'media'` configured?

## Core rules

### Class ordering

Follow a consistent order (Tailwind's recommended / Prettier plugin order):

1. Layout (`flex`, `grid`, `block`, `hidden`)
2. Positioning (`relative`, `absolute`, `fixed`, `z-*`)
3. Box model (`w-*`, `h-*`, `p-*`, `m-*`)
4. Typography (`text-*`, `font-*`, `leading-*`)
5. Visual (`bg-*`, `border-*`, `rounded-*`, `shadow-*`)
6. Interactive (`hover:*`, `focus:*`, `cursor-*`)
7. Transitions (`transition-*`, `duration-*`)

### Responsive design

- **Mobile-first** — base classes apply to all screens, then add breakpoint prefixes.
- Breakpoints: `sm:` (640px), `md:` (768px), `lg:` (1024px), `xl:` (1280px), `2xl:` (1536px).
- Example: `class="w-full md:w-1/2 lg:w-1/3"`

### Spacing and sizing

- Use the project's spacing scale consistently.
- Prefer Tailwind's scale (`p-4`, `gap-6`) over arbitrary values (`p-[17px]`).
- Use arbitrary values only when the design requires a specific non-standard value.

### Colors

- Use the project's color palette from `tailwind.config.js`.
- Prefer semantic color names if defined (e.g. `text-primary`, `bg-danger`).
- Use opacity modifiers: `bg-blue-500/50` for 50% opacity.

### Dark mode

```html
<div class="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
```

- Always provide dark mode variants when the project uses dark mode.
- Test both modes visually.

### Typography

- Use Tailwind's typography scale: `text-sm`, `text-base`, `text-lg`, etc.
- Use `font-medium`, `font-semibold`, `font-bold` for weight.
- Use `leading-*` for line height, `tracking-*` for letter spacing.

### Common patterns

```html
{{-- Card --}}
<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">

{{-- Flex row with gap --}}
<div class="flex items-center gap-4">

{{-- Grid layout --}}
<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">

{{-- Truncated text --}}
<p class="truncate text-sm text-gray-500">

{{-- Button-like --}}
<button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
```

### Tailwind v4 specifics

If the project uses Tailwind v4:
- CSS-first configuration (no `tailwind.config.js`).
- Theme values defined in CSS with `@theme`.
- New default color palette.
- Check the project's CSS entry point for theme configuration.

```css
/* app.css — Tailwind v4 theme */
@import "tailwindcss";

@theme {
  --color-primary: #3b82f6;
  --color-primary-dark: #2563eb;
  --font-sans: 'Inter', sans-serif;
  --spacing-18: 4.5rem;
}
```

## Design system patterns

### Consistent component classes

Define reusable patterns for common UI elements:

```html
<!-- Button variants — keep consistent across the project -->
<!-- Primary -->
<button class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">
<!-- Secondary -->
<button class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
<!-- Danger -->
<button class="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
```

### Spacing scale discipline

Stick to the spacing scale — don't mix arbitrary values:

```html
<!-- ✅ Consistent spacing -->
<div class="space-y-4 p-6">
  <div class="mb-2">...</div>
</div>

<!-- ❌ Inconsistent — mixing arbitrary and scale values -->
<div class="space-y-[18px] p-6">
  <div class="mb-[7px]">...</div>
</div>
```

### Accessibility with Tailwind

- Use `sr-only` for screen-reader-only text.
- Use `focus-visible:` instead of `focus:` for keyboard-only focus styles.
- Ensure sufficient contrast — test with browser dev tools.
- Use `motion-reduce:` for users who prefer reduced motion.

## What NOT to do

- Do not use inline `style` attributes when Tailwind classes exist.
- Do not create custom CSS classes for things Tailwind handles natively.
- Do not use arbitrary values (`[17px]`) when a scale value is close enough.
- Do not mix Tailwind with another CSS framework unless the project already does.
- Do not ignore dark mode when the project supports it.
- Do not introduce new color values — use the configured palette.
- Do not use `focus:` when `focus-visible:` is more appropriate.
- Do not skip responsive testing — always check mobile, tablet, desktop.


## Gotcha

- Don't use `@apply` excessively — it defeats the purpose of utility-first CSS. Use components instead.
- The model tends to add classes that conflict (e.g., `w-full` and `w-64`) — last one wins, but it's confusing.
- Dark mode classes (`dark:`) must be defined alongside the light variant — don't put them in separate files.

## Do NOT

- Do NOT use inline style attributes when Tailwind classes exist.
- Do NOT use arbitrary values when a scale value is close enough.
- Do NOT introduce new color values — use the configured palette.

## Auto-trigger keywords

- Tailwind CSS
- utility classes
- responsive design
- dark mode
