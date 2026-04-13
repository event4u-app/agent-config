---
name: logging-monitoring
description: "Use when working with logging or monitoring — Sentry error tracking, Grafana/Loki log aggregation, structured logging channels, or monitoring helpers."
---

# logging-monitoring

## When to use

Use this skill when adding logging, error tracking, monitoring, or when working with Sentry/Grafana/Loki integrations.

## Before making changes

1. Read `config/logging.php` for available log channels and their configuration.
2. Check if a Grafana module exists: `app/Modules/Grafana/` for Loki-specific formatters.
3. Read `agents/` docs for any module-specific logging patterns.

## Monitoring stack

| Tool | Purpose | Integration |
|---|---|---|
| **Sentry** | Error tracking, exceptions, performance monitoring | `sentry/sentry-laravel` package |
| **Grafana** | Dashboard visualization | Connected to Loki data source |
| **Loki** | Log aggregation | `itspire/monolog-loki` via Monolog handler |
| **Slack** | Alert notifications | Slack webhook for error-level logs |

## Sentry integration

### Error reporting

Use `MonitoringHelper::captureException()` for reporting exceptions to Sentry:

```php
// ✅ Correct — use MonitoringHelper
MonitoringHelper::captureException($exception);

// ❌ Wrong — don't use Sentry SDK directly
\Sentry\captureException($exception);
```

### Sentry context

The tenant switching service (if applicable) typically sets Sentry context automatically:
- Tenant ID, name, domain
- Client software type and version

### Breadcrumbs

Use the project's `BreadcrumbType` and `BreadcrumbLevel` enums (`App\Enums\Sentry\*`) for structured breadcrumbs.

### Context names

Use `App\Enums\Sentry\ContextName` enum for consistent Sentry context keys.

## Log channels

Defined in `config/logging.php`:

| Channel | Driver | Purpose |
|---|---|---|
| `stack_without_slack` | stack | Daily file + errorlog (no Slack) |
| `slack` | slack | Error alerts to Slack webhook |
| `loki` | monolog (LokiHandler) | Send logs to Grafana Loki |
| `loki_import_*` | monolog (LokiHandler) | Import-specific Loki channels with custom labels |
| `daily` | daily | Rotating file logs |

### Loki labels

Loki uses **static labels** per channel for indexing:

```php
'globalLabels' => [
    'app' => '{project-name}',
    'service' => '{service}',
    'env' => $lokiEnvironment,
],
```

**Important:** The `service` label differentiates log types in Grafana queries. Use distinct service labels for distinct domains (e.g., `import_result`, `import_snapshot`).

## Logging conventions

### Use Laravel's `Log` facade

```php
use Illuminate\Support\Facades\Log;

// Standard logging
Log::info('Import completed', ['customer_id' => $customerId, 'count' => $count]);

// Channel-specific logging
Log::channel('loki')->info('Import snapshot', ['data' => $snapshotData]);
```

### Structured context

Always pass context as the second argument — never interpolate into the message:

```php
// ✅ Correct — structured context
Log::warning('Import failed', ['customer_id' => $id, 'error' => $message]);

// ❌ Wrong — interpolated message
Log::warning("Import failed for customer {$id}: {$message}");
```

### Configuration flags

Several logging features are controlled by env vars:

| Env Variable | Purpose | Default |
|---|---|---|
| `LOG_CLIENT_SOFTWARE_REQUESTS` | Log incoming client software API requests to DB | `false` |
| `LOG_EXTERNAL_API_REQUESTS` | Log outgoing external API requests | `true` |
| `LOG_WEBHOOK_REQUESTS` | Log incoming webhook requests to DB | `false` |
| `LOG_CHANNEL_IMPORT` | Channel for import logs | `daily` |

## Grafana/Loki dashboard rules

From `AGENTS.md`:

- **Always hide Loki metadata columns** in table panels: `labelTypes`, `traceID`, `traceID (field)`.
- **Use correct Loki service labels**: `import_result` for final states, `import_snapshot` for cron snapshots.
- **Verify column names match data semantics**: If timestamp represents `imported_at`, name it "Imported".

## Logging best practices

### Log levels — use them correctly

| Level | When to use | Example |
|---|---|---|
| `emergency` | System is unusable | Database server unreachable |
| `critical` | Critical failure requiring immediate action | Payment gateway down |
| `error` | Error that needs investigation but system continues | Import failed for customer |
| `warning` | Unusual situation that may need attention | API rate limit approaching |
| `info` | Significant business events | Import completed, user created |
| `debug` | Detailed diagnostic info (dev/staging only) | Query parameters, intermediate values |

### What to log

- **Business events:** Import started/completed, user actions, state transitions.
- **Error context:** What was happening, with which data, for which customer.
- **External interactions:** API calls (request/response), webhook receipts.
- **Performance markers:** Long-running operations, batch sizes, durations.

### What NOT to log

- Passwords, tokens, API keys, personal data (GDPR).
- Entire request/response bodies (log a summary or hash instead).
- Expected conditions at high levels (e.g., `Log::error` for validation failures).
- Every iteration of a loop — log the summary (count, duration, failures).

### Structured logging patterns

```php
// ✅ Good — structured context, actionable message
Log::info('Import completed', [
    'customer_id' => $customerId,
    'records_imported' => $count,
    'duration_seconds' => $duration,
    'errors' => $errorCount,
]);

// ❌ Bad — unstructured, hard to query
Log::info("Import done: {$count} records in {$duration}s for customer {$customerId}");

// ✅ Good — error with full context
Log::error('Import failed', [
    'customer_id' => $customerId,
    'exception' => $e->getMessage(),
    'file' => $currentFile,
    'line_number' => $lineNumber,
]);
```

### Correlation IDs

For multi-step operations, use a correlation ID to trace the full flow:

```php
$correlationId = Str::uuid()->toString();
Log::info('Import started', ['correlation_id' => $correlationId, ...]);
// ... later ...
Log::info('Import step completed', ['correlation_id' => $correlationId, ...]);
```

## Auto-trigger keywords

- logging
- monitoring
- Sentry
- Grafana
- structured logging
- log levels

## Gotcha

- Don't log sensitive data (passwords, tokens, PII) — even in debug mode.
- The model tends to use `Log::debug()` everywhere — use appropriate levels (info, warning, error).
- Sentry has a 200KB event size limit — large context data gets truncated silently.
- Structured logging keys must be snake_case — consistency matters for Loki queries.

## Do NOT

- Do NOT use `var_dump()`, `print_r()`, or `dd()` — disallowed by PHPStan. Exception: legacy projects where these are already used and no alternative is feasible.
- Do NOT use Sentry SDK directly — use `MonitoringHelper`.
- Do NOT hardcode log channel names in business logic — use config values.
- Do NOT create new Loki channels without adding the corresponding Grafana dashboard query.
- Do NOT log at `error` level for expected/handled conditions — use `warning` or `info`.
- Do NOT interpolate variables into log messages — use the context array.
