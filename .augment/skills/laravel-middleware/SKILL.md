---
name: laravel-middleware
description: "Use when creating or modifying Laravel middleware — request/response filtering, groups, priority, terminable middleware, or route-level assignment."
source: package
---

# laravel-middleware

## When to use

Use this skill when working with HTTP middleware:
- Creating custom middleware for authentication, logging, headers, etc.
- Configuring middleware groups and priority
- Terminable middleware (post-response processing)
- Route-level and global middleware assignment

## Procedure: Create middleware

1. **Generate class** — `php artisan make:middleware EnsureCustomerIsActive`.
2. **Implement logic** — Handle request in `handle()`, return response or pass to next.
3. **Register** — Add to route group or global middleware stack.
4. **Verify** — Run tests covering both allowed and blocked request scenarios.

### Example

```bash
php artisan make:middleware EnsureCustomerIsActive
```

```php
declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureCustomerIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        if (!$request->user()?->getCustomer()?->isActive()) {
            abort(403, 'Customer account is inactive.');
        }

        return $next($request);
    }
}
```

## Before vs. After middleware

```php
// Before middleware — runs BEFORE the request hits the controller
public function handle(Request $request, Closure $next): Response
{
    // Check something before the request
    return $next($request);
}

// After middleware — runs AFTER the controller returns a response
public function handle(Request $request, Closure $next): Response
{
    $response = $next($request);

    // Modify the response
    $response->headers->set('X-Custom-Header', 'value');

    return $response;
}
```

## Terminable middleware

Runs **after the response has been sent** to the browser:

```php
class LogRequestDuration
{
    private float $startTime;

    public function handle(Request $request, Closure $next): Response
    {
        $this->startTime = microtime(true);

        return $next($request);
    }

    public function terminate(Request $request, Response $response): void
    {
        $duration = microtime(true) - $this->startTime;
        Log::info('Request duration', [
            'url' => $request->fullUrl(),
            'duration_ms' => round($duration * 1000, 2),
        ]);
    }
}
```

## Middleware with parameters

```php
class CheckRole
{
    public function handle(Request $request, Closure $next, string $role): Response
    {
        if (!$request->user()?->hasRole($role)) {
            abort(403);
        }

        return $next($request);
    }
}

// Usage in routes
Route::get('/admin', AdminController::class)->middleware('role:admin');
```

## Assigning middleware

```php
// Route-level
Route::get('/dashboard', DashboardController::class)
    ->middleware([EnsureCustomerIsActive::class]);

// Group-level
Route::middleware(['auth', EnsureCustomerIsActive::class])->group(function () {
    // ...
});

// Global middleware (bootstrap/app.php)
->withMiddleware(function (Middleware $middleware) {
    $middleware->append(LogRequestDuration::class);
    $middleware->prepend(SetLocale::class);
})
```

## Middleware priority

```php
// bootstrap/app.php — control execution order
->withMiddleware(function (Middleware $middleware) {
    $middleware->priority([
        AuthenticateMiddleware::class,
        EnsureCustomerIsActive::class,
        CheckRole::class,
    ]);
})
```

## Core rules

- **Single responsibility** — one middleware, one concern.
- **Early return** — abort or redirect as early as possible.
- **Use terminable** for logging/metrics — don't block the response.
- **Type-hint dependencies** — use constructor injection.
- **Keep middleware thin** — delegate complex logic to services.

## Auto-trigger keywords

- middleware
- request filter
- before middleware
- after middleware
- terminable
- middleware group

## Output format

1. Middleware class with handle method and typed request/response
2. Registration in bootstrap or route group

## Gotcha

- Middleware execution order matters — registered order in the kernel defines the pipeline sequence.
- Don't modify the response in `handle()` if the next middleware might also modify it — use `terminate()` for cleanup.
- The model tends to forget that middleware runs on EVERY request in its group — keep it lightweight.

## Do NOT

- Do NOT put business logic in middleware — delegate to services.
- Do NOT create catch-all middleware that does too many things.
- Do NOT forget to register middleware — it won't run if not assigned.
- Do NOT modify the request in after-middleware — use before-middleware for that.
