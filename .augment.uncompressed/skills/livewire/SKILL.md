---
name: livewire
description: "Use when writing Livewire components — reactive state, events, lifecycle hooks, and clean separation between component logic and Blade templates."
---

# livewire

## When to use

Use this skill when:
- Creating or editing Livewire components
- Building reactive UI with server-side state
- Handling forms, modals, tables, or real-time updates via Livewire
- Integrating Livewire with Alpine.js

This skill extends `coder`, `laravel`, and `blade-ui`.

## Before writing code

1. **Detect Livewire version** — check `composer.json` for `livewire/livewire`.
   - Livewire 3.x uses `#[Layout]`, `#[Title]`, property attributes.
   - Livewire 2.x uses `$layout`, `$listeners`, method-based hooks.
2. **Check existing components** — look in `app/Livewire/` or `app/Http/Livewire/` to match style.
3. **Check views** — Livewire views live in `resources/views/livewire/`.
4. **Read project docs** — check `./agents/` for any Livewire-specific conventions.

## Component structure (Livewire 3.x)

```php
<?php

declare(strict_types=1);

namespace App\Livewire;

use Livewire\Component;
use Livewire\Attributes\Layout;
use Livewire\Attributes\Title;

#[Layout('layouts.app')]
#[Title('User List')]
final class UserList extends Component
{
    public string $search = '';

    public function updatedSearch(): void
    {
        // Runs when $search changes
    }

    public function render(): \Illuminate\View\View
    {
        return view('livewire.user-list', [
            'users' => User::query()
                ->where('name', 'like', '%' . $this->search . '%')
                ->paginate(20),
        ]);
    }
}
```

## Core rules

### State management
- Use typed public properties for component state.
- Keep state minimal — only what the UI needs.
- Use `#[Locked]` for properties that must not be tampered with from the frontend.
- Use `#[Url]` for properties that should sync with the URL query string.

### Actions
- Public methods on the component are callable from the frontend.
- Validate input before processing: `$this->validate()`.
- Use `$this->dispatch()` for cross-component communication (Livewire 3).
- Use `$this->emit()` in Livewire 2.

### Forms
- Use Livewire Form Objects (`Livewire\Form`) for complex forms (Livewire 3).
- Use `wire:model` for two-way binding.
- Use `wire:model.live` for real-time updates (Livewire 3) or `wire:model.debounce` for delayed.
- Validate with Laravel validation rules.

### Performance
- Use `wire:key` on list items to help Livewire track DOM changes.
- Use `#[Computed]` for derived data that should be cached per request (Livewire 3).
- Avoid loading large datasets — paginate or use search filters.
- Use `wire:loading` for loading indicators.

### Alpine.js integration
- Use `@entangle` to share state between Livewire and Alpine.
- Use `$wire` in Alpine to call Livewire methods.
- Keep Alpine for client-side-only interactions (dropdowns, modals, animations).

## Blade template conventions

```blade
<div>
    <input type="text" wire:model.live="search" placeholder="Search...">

    <div wire:loading>Loading...</div>

    @foreach($users as $user)
        <div wire:key="user-{{ $user->id }}">
            {{ $user->name }}
        </div>
    @endforeach

    {{ $users->links() }}
</div>
```

**Rules:**
- Every Livewire view must have **one root element** (usually `<div>`).
- Use `wire:key` on dynamic lists.
- Use `wire:loading` for user feedback.
- Follow existing Blade/CSS conventions (see `blade-ui` skill).

## Testing

- Use `Livewire::test(ComponentClass::class)` for component tests.
- Test state changes: `->set('property', 'value')->assertSet(...)`.
- Test actions: `->call('methodName')->assertHasNoErrors()`.
- Test rendering: `->assertSee('text')`.

## What NOT to do

- Do not put heavy business logic in components — delegate to services.
- Do not use Livewire for purely static pages — use regular Blade.
- Do not expose sensitive data as public properties.
- Do not skip validation on form submissions.
- Do not nest Livewire components deeply — keep the tree shallow.


## Gotcha

- Livewire components serialize all public properties between requests — don't put large objects in state.
- The model forgets that `wire:model` is deferred by default in Livewire 3 — use `wire:model.live` for real-time.
- Don't call `$this->redirect()` and `$this->dispatch()` in the same method — only the redirect executes.

## Do NOT

- Do NOT put heavy computation in render() — it runs on every update.
- Do NOT use Livewire for simple static pages — use Blade.
- Do NOT skip wire:key on list items — it causes DOM diffing issues.

## Auto-trigger keywords

- Livewire
- reactive component
- wire:model
- lifecycle
- real-time UI
