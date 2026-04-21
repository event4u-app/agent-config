---
name: grafana
description: "Use when working with Grafana — dashboards, Loki LogQL queries, alerting rules, monitoring panels — even when the user just says 'build me a dashboard' or 'query the logs' without naming Grafana."
source: package
---

# Grafana Skill

## When to use

Use this skill when:
- Creating or editing Grafana dashboards (JSON provisioning)
- Writing Loki LogQL queries for log analysis
- Configuring alerting rules or contact points
- Working on a Grafana module (if the project has one)
- Debugging log-based issues using Loki data

## Procedure: Create Grafana dashboard

### Project setup

Check if the project has a dedicated Grafana module or Docker config. Typical structure:

```
{grafana-location}/
├── .docker/
│   ├── grafana/
│   │   ├── dashboards/              ← Dashboard JSON files (provisioned)
│   │   ├── provisioning/
│   │   │   ├── datasources/         ← Loki, Prometheus data sources
│   │   │   └── dashboards/          ← Dashboard provisioning config
│   │   └── alerting/                ← Alert rules, contact points, notification policies
│   └── loki/
│       └── loki-config.yml          ← Loki server configuration
├── App/
│   ├── Logging/                     ← Loki timestamp processors
│   └── Console/Commands/            ← GrafanaPushDashboardsCommand
├── Docs/
│   └── Loki.md                      ← Loki documentation
└── Routes/console.php
```

### Configuration

- **Grafana config:** `config/grafana.php`
- **Logging channels:** `config/logging.php` (Loki channels)
- **Loki package:** `itspire/monolog-loki` via Monolog handler

## Dashboard conventions

### JSON provisioning

Dashboards are stored as JSON in `.docker/grafana/dashboards/` and auto-provisioned.
Use `GrafanaPushDashboardsCommand` to push dashboards to remote Grafana instances.

### Panel rules

- **Always hide Loki metadata columns** in table panels:
  `labelTypes`, `traceID`, `traceID (field)` → add to `excludeByName` in the `organize` transformation.
- **Verify column names match data semantics:** If the timestamp represents `imported_at`,
  name the column "Imported", not "Uploaded".
- **Use consistent time ranges:** Default to "Last 24 hours" for operational dashboards.
- **Add variables** for customer FQDN, environment, and time range filters.

### Naming

| Element | Convention | Example |
|---|---|---|
| Dashboard title | Descriptive, Title Case | "Import Overview (Loki)" |
| Panel title | Short, descriptive | "Import Results by Status" |
| Variable names | lowercase, underscore | `$fqdn`, `$environment` |

## Loki LogQL

### Query patterns

```logql
# Filter by service and status
{service="import_result"} |= "DONE" | json | status = "DONE"

# Count by label
sum by (status) (count_over_time({service="import_result"} | json [$__interval]))

# Filter by customer FQDN
{service="import_result", fqdn=~"$fqdn"} | json
```

### Service labels

| Label | Purpose | Notes |
|---|---|---|
| `import_result` | Final import states (DONE, FAILED) | Use for result dashboards |
| `import_snapshot` | Cron-based status snapshots | Use for timeline dashboards |
| `service=import` | Legacy static label | Do NOT query — use specific labels above |

### Best practices

- Use `json` parser for structured log entries
- Use `line_format` for human-readable output in explore view
- Use `$__interval` for rate/count queries (auto-adjusts to time range)
- Filter early in the pipeline (labels before line filters before parsers)

## Alerting

### Structure

```
.docker/grafana/alerting/
├── alert-rules.yml          ← Alert conditions and thresholds
├── contact-points.yml       ← Notification targets (Slack, email)
└── notification-policies.yml ← Routing rules (which alerts → which contacts)
```

### Conventions

- Alert names: descriptive, include severity: "Import Failure Rate > 10% (Critical)"
- Use `for` duration to avoid flapping (e.g., `for: 5m`)
- Group related alerts by folder/namespace

## Integration with logging

The project uses structured logging via Monolog → Loki:

- **`LokiTimestampProcessor`** — Adds precise timestamps to log entries
- **`LokiTimestampChannelTap`** — Configures Loki channels with timestamp processing
- **Import events** are logged via `ImportEventLogger` service

When adding new log entries for Grafana visualization:
1. Use a dedicated log channel (defined in `config/logging.php`)
2. Log as JSON with consistent field names
3. Add appropriate Loki labels for filtering
4. Update or create a dashboard panel for the new data

## Related

- **Skill:** `logging-monitoring` — full monitoring stack overview
- **Skill:** `dashboard-design` — visualization selection, layout, KPI strategies
- **Skill:** `traefik` — HTTPS for Grafana embedding in the app
- Check the project for Grafana module or Docker config location
- **Config:** `config/grafana.php`, `config/logging.php` (if applicable)


## Output format

1. Grafana dashboard JSON or LogQL/PromQL queries
2. Panel configuration with data source and thresholds
3. Alert rule definitions where applicable

## Gotcha

- Loki queries use LogQL, not PromQL — the syntax is different despite looking similar.
- Don't create alerts without a clear notification channel — silent alerts are useless.
- Dashboard panels that query too much data (>7 days at full resolution) will timeout — use downsampling.

## Do NOT

- Do NOT create panels without proper units and labels.
- Do NOT use alerting rules without a notification channel.
- Do NOT hardcode datasource names — use variables.

## Auto-trigger keywords

- Grafana
- Loki
- dashboard
- log query
- alerting
- monitoring panel
