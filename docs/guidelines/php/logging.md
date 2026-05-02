# Logging Guidelines

> Logging conventions — levels, structured context, what to log, Sentry patterns.

**Related Skills:** `logging-monitoring`, `grafana`

## Use Laravel's Log Facade

```php
use Illuminate\Support\Facades\Log;

// Standard logging
Log::info('Import completed', ['customer_id' => $customerId, 'count' => $count]);

// Channel-specific
Log::channel('loki')->info('Import snapshot', ['data' => $snapshotData]);
```

## Structured Context — Always

```php
// ✅ Correct — structured context
Log::warning('Import failed', ['customer_id' => $id, 'error' => $message]);

// ❌ Wrong — interpolated message
Log::warning("Import failed for customer {$id}: {$message}");
```

Context keys must be `snake_case` — consistency matters for Loki queries.

## Log Levels

| Level | When | Example |
|---|---|---|
| `emergency` | System unusable | Database unreachable |
| `critical` | Immediate action required | Payment gateway down |
| `error` | Needs investigation | Import failed for customer |
| `warning` | Unusual, may need attention | Rate limit approaching |
| `info` | Significant business events | Import completed, user created |
| `debug` | Diagnostic (dev/staging only) | Query params, intermediate values |

## What to Log

- Business events: imports, state transitions, user actions
- Error context: what was happening, with which data, for which customer
- External interactions: API calls, webhook receipts
- Performance markers: long operations, batch sizes, durations

## What NOT to Log

- Passwords, tokens, API keys, PII (GDPR)
- Entire request/response bodies — log summary or hash
- Expected conditions at high levels (validation failures ≠ `error`)
- Every loop iteration — log the summary

## Correlation IDs

For multi-step operations:

```php
$correlationId = Str::uuid()->toString();
Log::info('Import started', ['correlation_id' => $correlationId, ...]);
Log::info('Import completed', ['correlation_id' => $correlationId, ...]);
```

## Sentry

- Use `MonitoringHelper::captureException()` — never Sentry SDK directly.
- Breadcrumbs: use `BreadcrumbType` and `BreadcrumbLevel` enums.
- Context names: use `ContextName` enum.
- Sentry has 200KB event size limit — large context gets truncated.

## Do NOT

- Use `var_dump()`, `print_r()`, `dd()` — disallowed by PHPStan.
- Use Sentry SDK directly — use `MonitoringHelper`.
- Hardcode log channel names in business logic — use config.
- Log at `error` for expected/handled conditions — use `warning` or `info`.
- Interpolate variables into log messages — use context array.
