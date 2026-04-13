---
name: livewire
description: "Use when writing Livewire components — reactive state, events, lifecycle hooks, and clean separation between component logic and Blade templates."
---

# livewire

## When to use

Livewire components, reactive UI, forms/modals/tables, Alpine.js integration. Extends `coder`, `laravel`, `blade-ui`.

## Before: detect version (3.x: attributes, 2.x: properties/methods), existing components (`app/Livewire/`), views (`resources/views/livewire/`), project docs.

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

## Rules

**State:** typed public properties, minimal, `#[Locked]` (tamper-proof), `#[Url]` (query sync). **Actions:** public methods, `$this->validate()`, `$this->dispatch()` (v3) / `$this->emit()` (v2). **Forms:** Form Objects (v3), `wire:model`, `wire:model.live` (real-time). **Performance:** `wire:key`, `#[Computed]`, paginate, `wire:loading`. **Alpine:** `@entangle`, `$wire`, client-only interactions.

## Blade: one root element, `wire:key` on lists, `wire:loading`.

## Testing: `Livewire::test()` → `set()`/`call()` → `assertSet()`/`assertSee()`/`assertHasNoErrors()`.

## Gotcha: public props serialize between requests (no large objects), `wire:model` deferred by default (use `.live`), no `redirect()` + `dispatch()` in same method.

## Do NOT: heavy logic in components (→ services), Livewire for static (→ Blade), sensitive data as public props, heavy render(), skip wire:key.
