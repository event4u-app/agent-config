---
name: laravel-pennant
description: "Use when managing feature flags with Laravel Pennant — gradual rollouts, A/B testing, scope-based flags, or database/array drivers."
---

# laravel-pennant

## When to use

Feature flags: gradual rollouts, per-user/tenant toggling, A/B testing, env gating.

## Installation

```bash
composer require laravel/pennant
php artisan vendor:publish --provider="Laravel\Pennant\PennantServiceProvider"
php artisan migrate
```

## Defining features

### Class-based features (recommended)

```bash
php artisan pennant:feature NewDashboard
```

```php
declare(strict_types=1);

namespace App\Features;

use App\Models\User;
use Illuminate\Support\Lottery;

class NewDashboard
{
    /** Resolve the feature's initial value. */
    public function resolve(User $user): bool
    {
        // Percentage rollout
        return Lottery::odds(1, 10)->choose();  // 10% of users
    }
}
```

### Closure-based features

```php
// In a service provider
use Laravel\Pennant\Feature;

Feature::define('new-dashboard', function (User $user): bool {
    return $user->getCustomer()?->isEarlyAdopter() ?? false;
});

// Rich values (A/B testing)
Feature::define('checkout-button', function (User $user): string {
    return Arr::random(['blue', 'green', 'red']);
});
```

## Checking features

```php
// Boolean check
if (Feature::active('new-dashboard')) {
    // Show new dashboard
}

// Via the user model (HasFeatures trait)
if ($user->features()->active('new-dashboard')) {
    // ...
}

// Rich value
$color = Feature::value('checkout-button');  // 'blue', 'green', or 'red'

// Blade directive
@feature('new-dashboard')
    <x-new-dashboard />
@else
    <x-legacy-dashboard />
@endfeature
```

## Managing features

```php
// Activate for a specific user
Feature::for($user)->activate('new-dashboard');

// Deactivate
Feature::for($user)->deactivate('new-dashboard');

// Activate for everyone
Feature::activateForEveryone('new-dashboard');

// Deactivate for everyone
Feature::deactivateForEveryone('new-dashboard');

// Purge stored values (re-resolve on next check)
Feature::purge('new-dashboard');
```

## Scopes

Features can be scoped to any model, not just users:

```php
// Per-tenant feature
Feature::for($customer)->active('advanced-reporting');

// Define with tenant scope
Feature::define('advanced-reporting', function (Customer $customer): bool {
    return $customer->getPlan() === 'enterprise';
});
```

## Drivers

| Driver | Storage | Use case |
|---|---|---|
| `database` | DB table | Production — persistent, shared across servers |
| `array` | In-memory | Testing — no persistence |

```php
// config/pennant.php
'default' => env('PENNANT_STORE', 'database'),
```

## Eager loading

```php
// Prevent N+1 when checking features for multiple users
Feature::for($users)->loadAll();

// Load specific features
Feature::for($users)->load(['new-dashboard', 'advanced-reporting']);
```

## Core rules

- **Use class-based features** for anything non-trivial — they're testable and discoverable.
- **Scope to the right model** — user, customer, or team depending on the feature.
- **Eager load** when checking features for collections of users.
- **Purge after full rollout** — remove the flag once 100% of users have the feature.
- **Use `array` driver in tests** — prevents test pollution.
- **Clean up old flags** — feature flags are temporary, not permanent config.

## Gotcha: DB driver needs migration, always pass scope, don't nest flag checks.

## Do NOT: leave flags forever, flags for permanent config, loops without eager loading, skip purge on logic change.
