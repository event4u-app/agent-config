---
name: dashboard-design
description: "Use when designing monitoring dashboards — visualization selection, layout principles, observability strategies (RED/USE/Golden Signals), and data storytelling."
source: package
---

# Dashboard Design Skill

## When to use

Planning/designing dashboards (Grafana or app), visualization selection, Grafana embedding, dashboard review.

## Dashboard Domains

| Domain | Tech | Purpose |
|---|---|---|
| **Monitoring** | Grafana + Loki | Infra health, errors, logs, SLAs |
| **Business/Admin** | Laravel + Livewire + Tailwind | Customer KPIs, imports, usage |

**Grafana:** server metrics, error rates, latency, logs, SLA. **App:** customer KPIs, tenant-scoped stats, user activity.

### Grafana Embedding

**iframe embedding:**
```html
<iframe
  src="https://grafana.example.com/d-solo/{dashboard-uid}/{panel-id}?orgId=1&from=now-24h&to=now&var-fqdn={{ $customer->fqdn }}&theme=light"
  width="100%"
  height="300"
  frameborder="0"
></iframe>
```

Config: `allow_embedding = true`, `cookie_samesite = none` (cross-origin), pass tenant vars via URL params, `&theme=light`/`dark`.

Embed for quick KPIs. Link for detailed investigation. Build in app for customer-facing (UX control).

## Observability Strategies

### RED Method (services/APIs)

| Signal | Measures | Visualization | Example |
|---|---|---|---|
| **R**ate | Requests per second | Time series (line) | `sum(rate(http_requests_total[$__interval]))` |
| **E**rrors | Failed requests per second | Time series + stat | Error rate as % of total |
| **D**uration | Latency distribution | Histogram / heatmap | p50, p95, p99 response times |

### USE Method (infrastructure — CPU, memory, disk, network)

| Signal | Measures | Visualization | Example |
|---|---|---|---|
| **U**tilization | % of resource used | Gauge / time series | CPU usage %, memory usage % |
| **S**aturation | Queue depth, backlog | Time series | Queue length, pending jobs |
| **E**rrors | Error count | Stat / time series | Disk I/O errors, network drops |

### Golden Signals (SRE): Latency (success vs error), Traffic (req/sec), Errors (5xx/exceptions), Saturation (CPU/memory/queue depth)

## Visualization Selection

| Data type | Best visualization | Avoid |
|---|---|---|
| Single current value | **Stat** panel | Table (overkill) |
| Value over time | **Time series** (line) | Pie chart |
| Comparison of categories | **Bar chart** | Line chart |
| Distribution / percentiles | **Histogram** or **heatmap** | Single stat |
| Status (up/down) | **State timeline** or **stat** with thresholds | Time series |
| Tabular data (logs, events) | **Table** | Any chart |
| Proportions of a whole | **Pie chart** (sparingly) | Bar chart |
| Geographic data | **Geomap** | Table |

Current value → Stat. Over time → Time series. Breakdown → Bar/pie. Outliers → Histogram/heatmap. Health → Stat + thresholds. Events → Table.

## Layout (F-pattern)

```
┌─────────────────────────────────────────────┐
│  KPIs / Health Summary (Stats)              │  ← Eye lands here first
├─────────────────────────────────────────────┤
│  Primary metrics (Time series)              │  ← Main story
│                                             │
├──────────────────────┬──────────────────────┤
│  Detail A (Table)    │  Detail B (Chart)    │  ← Supporting data
└──────────────────────┴──────────────────────┘
```

Top = KPIs (stats). Middle = trends (time series). Bottom = details (tables). Left = general, right = specific. Max 3-4 rows. Consistent widths.

## Colors: 🟢 healthy, 🟡 warning, 🔴 critical, 🔵 info, ⚪ no data. Use sparingly, consistent meaning, add yellow for accessibility.

## Dashboard Types

| Type | Purpose | Strategy | Example |
|---|---|---|---|
| **Overview** | Health at a glance | Golden Signals / RED | "API Health" |
| **Service** | Deep dive into one service | RED + detailed metrics | "Import Service" |
| **Infrastructure** | Resource monitoring | USE method | "Server Resources" |
| **Business** | Business KPIs | Custom metrics | "Daily Imports by Customer" |
| **Investigation** | Ad-hoc debugging | Logs + traces | "Error Investigation" |
| **SLA/SLO** | Compliance tracking | Error budgets, uptime | "SLA Dashboard" |

## Admin Dashboard (Laravel)

Widgets: stat cards (Livewire+Tailwind), trend cards (sparkline), tables (pagination), charts (Chart.js/Grafana), status list, activity feed.

Layout: 4 stat cards → charts → table + feed.

Livewire: `wire:poll.30s`, `wire:init` (lazy), `$dispatch('refresh-stats')`, cache aggregations.

## Anti-patterns: wall of numbers (→ group), rainbow (→ consistent colors), too many panels (→ split), no context (→ thresholds), stale data (→ auto-refresh), mixing domains (→ separate), no tenant scoping.

## Related: `grafana`, `logging-monitoring`, `fe-design`, `livewire`, `tailwind`

## Gotcha: max 8 panels, prefer simple table over fancy viz, explicit time ranges.

## Do NOT: dashboards without clear KPIs, pie charts >5 categories, mix too many viz types.
