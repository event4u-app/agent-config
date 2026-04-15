---
name: flux
description: "Use when writing Laravel Flux UI components — the official Livewire component library by the Laravel team. Covers components, slots, and variants."
source: package
---

# flux

## When to use

Use when building UI with Flux components in a project that uses `livewire/flux`.

Do NOT use when:
- Raw Blade templates without Flux (use `blade-ui` skill)
- Livewire component logic (use `livewire` skill)

## Procedure: Create a Flux view

### Step 0: Inspect

1. Confirm Flux is installed — check `composer.json` for `livewire/flux`.
2. Check existing views — match Flux component usage patterns.
3. Check Flux docs — https://fluxui.dev/docs for latest API.

### Step 1: Build the view

1. Use `<flux:*>` components instead of raw HTML.
2. Use `variant` prop for styling (not custom Tailwind for standard styles).
3. Use `wire:model` for Livewire binding.
4. Use `label` prop on form fields (accessibility).

### Step 2: Validate

1. No raw HTML form elements where Flux equivalents exist.
2. No manual error rendering (Flux has built-in validation display).
3. No conflicting Tailwind classes overriding Flux styles.

## Conventions

→ See guideline `php/flux.md` for component reference, variants, forms, icons.

## Gotcha

- The model tends to use old Flux API syntax — always check latest docs.
- Flux has built-in validation display — don't add manual error rendering alongside it.
- Don't mix Flux with raw HTML form elements in the same form.

## Do NOT

- Do NOT use raw `<input>`, `<select>`, `<button>` when Flux equivalents exist.
- Do NOT override Flux styles with conflicting Tailwind — use variants or slots.
- Do NOT skip the `label` prop on form fields — accessibility.

## Auto-trigger keywords

- Flux UI
- Livewire components
- Flux component
- Laravel Flux
