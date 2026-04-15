# Livewire Guidelines

> Livewire component conventions — state, actions, forms, performance, Alpine.js, templates.

**Related Skills:** `livewire`, `flux`, `blade-ui`

## Component Structure (Livewire 3.x)

```php
#[Layout('layouts.app')]
#[Title('User List')]
final class UserList extends Component
{
    public string $search = '';

    public function render(): \Illuminate\View\View
    {
        return view('livewire.user-list', [
            'users' => User::query()->where('name', 'like', '%' . $this->search . '%')->paginate(20),
        ]);
    }
}
```

## State Management

- Use typed public properties for component state.
- Keep state minimal — only what the UI needs.
- `#[Locked]` for properties that must not be tampered with from frontend.
- `#[Url]` for properties that should sync with URL query string.

## Actions

- Public methods are callable from frontend.
- Validate input before processing: `$this->validate()`.
- `$this->dispatch()` for cross-component communication (Livewire 3).

## Forms

- Use Livewire Form Objects (`Livewire\Form`) for complex forms (Livewire 3).
- `wire:model` for two-way binding.
- `wire:model.live` for real-time updates, `wire:model.debounce` for delayed.
- Validate with Laravel validation rules.

## Performance

- `wire:key` on list items for DOM tracking.
- `#[Computed]` for derived data cached per request (Livewire 3).
- Avoid large datasets — paginate or filter.
- `wire:loading` for loading indicators.

## Alpine.js Integration

- `@entangle` to share state between Livewire and Alpine.
- `$wire` in Alpine to call Livewire methods.
- Alpine for client-side-only interactions (dropdowns, animations).

## Template Rules

- Every Livewire view must have **one root element** (usually `<div>`).
- Use `wire:key` on dynamic lists.
- Use `wire:loading` for user feedback.

## Do NOT

- Put heavy business logic in components — delegate to services.
- Use Livewire for purely static pages — use Blade.
- Expose sensitive data as public properties.
- Nest Livewire components deeply — keep tree shallow.
- Put heavy computation in `render()` — runs on every update.
- Skip `wire:key` on list items — causes DOM diffing issues.
