---
name: logging-monitoring
description: "Use when working with logging or monitoring — Sentry error tracking, Grafana/Loki log aggregation, structured logging channels, or monitoring helpers."
---

# logging-monitoring

## When to use

Logging, error tracking, monitoring, Sentry/Grafana/Loki. Before: `config/logging.php`, `app/Modules/Grafana/`, module docs.

## Stack: Sentry (errors, `sentry/sentry-laravel`), Grafana (dashboards), Loki (logs, `itspire/monolog-loki`), Slack (alerts).

## Sentry: `MonitoringHelper::captureException()` (NEVER `\Sentry\captureException()`). Context auto-set by tenant switching. Breadcrumbs: `BreadcrumbType`/`BreadcrumbLevel` enums. Context keys: `ContextName` enum.

## Channels: `stack_without_slack` (daily+errorlog), `slack` (alerts), `loki` (Loki), `loki_import_*` (import-specific), `daily` (rotating). Loki labels: `app`, `service`, `env` — distinct `service` per domain.

## Conventions: `Log::info('message', ['context' => $val])`. Always structured context (second arg), never interpolate. `Log::channel('loki')->info(...)` for channel-specific.

Env flags: `LOG_CLIENT_SOFTWARE_REQUESTS`, `LOG_EXTERNAL_API_REQUESTS`, `LOG_WEBHOOK_REQUESTS`, `LOG_CHANNEL_IMPORT`.

## Grafana: hide Loki metadata columns, correct service labels, column names match semantics.

## Levels: emergency (system down) → critical (immediate action) → error (investigation) → warning (attention) → info (business events) → debug (dev only).

Log: business events, error context, external interactions, performance markers. DON'T log: passwords/tokens/PII, full bodies (summary only), expected conditions at error level, loop iterations.

Use correlation IDs for multi-step operations.

## Gotcha: no sensitive data, appropriate levels (not debug everywhere), Sentry 200KB limit, snake_case keys.

## Do NOT: var_dump/dd, Sentry SDK directly (use MonitoringHelper), hardcode channel names, new Loki channels without Grafana query, error level for expected conditions, interpolate in messages.
