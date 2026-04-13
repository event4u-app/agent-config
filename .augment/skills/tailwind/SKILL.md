---
name: tailwind
description: "Use when writing Tailwind CSS — utility classes, responsive design, dark mode support, and project conventions."
---

# tailwind

## When to use

Tailwind styling, responsive layouts, dark mode, config customization. Before: detect version (v3/v4), check config, CSS framework, match existing patterns, dark mode config.

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

## A11y: `sr-only`, `focus-visible:` over `focus:`, contrast, `motion-reduce:`.

## Gotcha: no excessive `@apply`, no conflicting classes, dark mode alongside light.

## Do NOT: inline styles, arbitrary values when scale works, new colors, skip responsive testing, ignore dark mode.
