---
name: flux
description: "Use when writing Laravel Flux UI components — the official Livewire component library by the Laravel team. Covers components, slots, and variants."
source: package
---

# flux

## When to use

Flux UI components in Livewire projects. Extends `livewire`, `blade-ui`. Before: confirm `livewire/flux`, version, existing views, https://fluxui.dev/docs, project docs.

## Core rules

### Component usage

- Use Flux components instead of raw HTML where a Flux equivalent exists.
- Use the `<flux:*>` component prefix (Blade component syntax).
- Follow the project's existing Flux usage patterns.

### Common components

```blade
{{-- Button --}}
<flux:button variant="primary">Save</flux:button>
<flux:button variant="danger" wire:click="delete">Delete</flux:button>

{{-- Input --}}
<flux:input wire:model="name" label="Name" placeholder="Enter name" />

{{-- Select --}}
<flux:select wire:model="status" label="Status">
    <flux:option value="active">Active</flux:option>
    <flux:option value="inactive">Inactive</flux:option>
</flux:select>

{{-- Modal --}}
<flux:modal name="confirm-delete">
    <flux:heading>Delete item?</flux:heading>
    <flux:text>This action cannot be undone.</flux:text>
    <flux:button variant="danger" wire:click="delete">Confirm</flux:button>
</flux:modal>

{{-- Table --}}
<flux:table>
    <flux:columns>
        <flux:column>Name</flux:column>
        <flux:column>Status</flux:column>
    </flux:columns>
    <flux:rows>
        @foreach($items as $item)
            <flux:row :key="$item->id">
                <flux:cell>{{ $item->name }}</flux:cell>
                <flux:cell>{{ $item->status }}</flux:cell>
            </flux:row>
        @endforeach
    </flux:rows>
</flux:table>
```

### Variants and styling

- Use Flux's built-in `variant` prop instead of custom Tailwind classes for standard styles.
- Available button variants: `primary`, `danger`, `ghost`, `subtle`, `outline`.
- Use `size` prop for sizing: `sm`, `base`, `lg`.
- Add custom Tailwind classes via `class` attribute only when Flux doesn't cover the need.

### Forms with Flux

- Use `<flux:input>`, `<flux:textarea>`, `<flux:select>`, `<flux:checkbox>` for form fields.
- Use the `label` prop for field labels — Flux handles the `<label>` element.
- Use `wire:model` for Livewire binding.
- Flux components automatically display validation errors when wired to Livewire properties.

### Icons

- Flux includes icon support: `<flux:icon name="heroicon-name" />`.
- Use Heroicons naming convention.

## Integration with Livewire

- Flux components work seamlessly with Livewire's `wire:` directives.
- Use `wire:click`, `wire:submit`, `wire:model` directly on Flux components.
- Modals can be opened/closed via Livewire: `$this->modal('name')->show()`.

## What NOT to do

- Do not use raw `<button>`, `<input>`, `<select>` when a Flux equivalent exists.
- Do not override Flux's built-in styling with conflicting Tailwind classes.
- Do not mix Flux components with a different UI library in the same view.
- Do not skip the `label` prop on form fields — accessibility matters.
- Do not create custom components that duplicate Flux functionality.


## Gotcha

- Flux is a Livewire component library — don't mix Flux components with raw HTML form elements.
- The model tends to use old Flux API syntax — always check the latest docs for component signatures.
- Flux components have built-in validation display — don't add manual error rendering alongside them.

## Do NOT

- Do NOT mix Flux components with custom implementations of the same thing.
- Do NOT override Flux component styles globally — use variants or slots.

## Auto-trigger keywords

- Flux UI
- Livewire components
- Flux component
- Laravel Flux
