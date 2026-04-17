# Flux UI Guidelines

> Flux component conventions — usage, variants, forms, icons, Livewire integration.

**Related Skills:** `flux`, `livewire`, `blade-ui`

## Component Usage

- Use Flux components (`<flux:*>`) instead of raw HTML where a Flux equivalent exists.
- Follow the project's existing Flux usage patterns.
- Check Flux docs at https://fluxui.dev/docs for latest API.

## Common Components

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
    </flux:columns>
    <flux:rows>
        @foreach($items as $item)
            <flux:row :key="$item->id">
                <flux:cell>{{ $item->name }}</flux:cell>
            </flux:row>
        @endforeach
    </flux:rows>
</flux:table>
```

## Variants and Styling

- Use `variant` prop: `primary`, `danger`, `ghost`, `subtle`, `outline`.
- Use `size` prop: `sm`, `base`, `lg`.
- Add custom Tailwind via `class` only when Flux doesn't cover the need.
- Don't override Flux's built-in styling with conflicting classes.

## Forms

- Use `<flux:input>`, `<flux:textarea>`, `<flux:select>`, `<flux:checkbox>`.
- Use `label` prop — Flux handles the `<label>` element.
- Use `wire:model` for Livewire binding.
- Flux components automatically display validation errors.

## Icons

- `<flux:icon name="heroicon-name" />` — Heroicons naming convention.

## Livewire Integration

- `wire:click`, `wire:submit`, `wire:model` work directly on Flux components.
- Modals: `$this->modal('name')->show()`.

## Do NOT

- Use raw `<button>`, `<input>`, `<select>` when Flux equivalent exists.
- Override Flux component styles globally — use variants or slots.
- Mix Flux with a different UI library in the same view.
- Skip `label` prop on form fields — accessibility matters.
- Add manual error rendering alongside Flux (it's built-in).
