---
name: logging-monitoring
description: "Use when working with logging or monitoring — Sentry error tracking, Grafana/Loki log aggregation, structured logging channels, or monitoring helpers."
source: package
---

# logging-monitoring

## When to use

Use when adding logging, configuring monitoring stack, or integrating Sentry/Grafana/Loki.

Do NOT use when:
- Creating Grafana dashboards (use `grafana` skill)
- Dashboard design decisions (use `dashboard-design` skill)

## Procedure: Add logging or monitoring

1. Read `config/logging.php` for available channels.
2. Check for Grafana module: `app/Modules/Grafana/`.
3. Read `agents/` docs for module-specific logging.

## Monitoring stack

| Tool | Purpose | Integration |
|---|---|---|
| **Sentry** | Error tracking | `sentry/sentry-laravel`, `MonitoringHelper` |
| **Grafana** | Dashboards | Connected to Loki |
| **Loki** | Log aggregation | `itspire/monolog-loki` via Monolog |
| **Slack** | Alert notifications | Webhook for error-level |

## Log channels

| Channel | Purpose |
|---|---|
| `stack_without_slack` | Daily file + errorlog (no Slack) |
| `slack` | Error alerts to Slack |
| `loki` | Send logs to Grafana Loki |
| `loki_import_*` | Import-specific Loki with custom labels |
| `daily` | Rotating file logs |

### Loki labels

```php
'globalLabels' => ['app' => '{project}', 'service' => '{service}', 'env' => $env],
```

The `service` label differentiates log types in Grafana queries.

### Config flags

| Env Variable | Purpose | Default |
|---|---|---|
| `LOG_CLIENT_SOFTWARE_REQUESTS` | Log incoming API requests to DB | `false` |
| `LOG_EXTERNAL_API_REQUESTS` | Log outgoing external API requests | `true` |
| `LOG_WEBHOOK_REQUESTS` | Log webhook requests to DB | `false` |
| `LOG_CHANNEL_IMPORT` | Channel for import logs | `daily` |

## Grafana/Loki dashboard rules

- Hide Loki metadata columns: `labelTypes`, `traceID`, `traceID (field)`.
- Use correct Loki service labels: `import_result` for final states, `import_snapshot` for cron.
- Verify column names match data semantics.

## Conventions

→ See guideline `php/logging.md` for log levels, structured context, what to log, Sentry patterns.

## Gotcha

- Sentry has 200KB event size limit — large context gets truncated.
- Structured logging keys must be `snake_case`.
- Don't create Loki channels without corresponding Grafana dashboard query.

## Do NOT

- Do NOT use Sentry SDK directly — use `MonitoringHelper`.
- Do NOT interpolate variables into log messages — use context array.
- Do NOT log at `error` level for expected/handled conditions.

## Auto-trigger keywords

- logging
- monitoring
- Sentry
- Grafana
- structured logging
- log levels
