---
name: dashboard-design
description: "Use when designing monitoring dashboards — visualization selection, layout principles, observability strategies (RED/USE/Golden Signals), and data storytelling."
source: package
---

# Dashboard Design Skill

## When to use

Use this skill when:
- Planning a new Grafana monitoring dashboard
- Designing an admin/business dashboard in the Laravel app
- Choosing the right visualization for a metric or KPI
- Deciding what belongs in Grafana vs. the app's own dashboard
- Embedding Grafana panels into the application
- Reviewing any dashboard for clarity and usability

## Dashboard Domains

This project has two dashboard domains:

| Domain | Technology | Purpose |
|---|---|---|
| **Monitoring** | Grafana + Loki | Infrastructure health, error rates, logs, SLAs |
| **Business/Admin** | Laravel + Livewire + Tailwind | Customer KPIs, import stats, usage metrics |

### What goes where?

| Data | Where | Why |
|---|---|---|
| Server metrics (CPU, memory, queues) | Grafana | Infrastructure data, USE method |
| Error rates, latency, request rates | Grafana | Observability, RED method |
| Log analysis, traces | Grafana (Loki) | Log aggregation |
| Customer-facing KPIs | App dashboard | Business context, permissions |
| Import statistics per customer | App dashboard (+ Grafana embed) | Customer-scoped, needs tenant context |
| SLA/uptime tracking | Grafana | Time-series data, alerting |
| User activity, usage metrics | App dashboard | Needs app auth + business logic |

### Combining both: Grafana Embedding

Embed Grafana panels in the Laravel app for the best of both worlds:

**iframe embedding:**
```html
<iframe
  src="https://grafana.example.com/d-solo/{dashboard-uid}/{panel-id}?orgId=1&from=now-24h&to=now&var-fqdn={{ $customer->fqdn }}&theme=light"
  width="100%"
  height="300"
  frameborder="0"
></iframe>
```

**Configuration required:**
1. Grafana: `allow_embedding = true` in `grafana.ini`
2. Grafana: Configure `cookie_samesite = none` if cross-origin
3. Grafana: Set up anonymous access or auth proxy for embedded panels
4. App: Pass tenant variables (`var-fqdn`, `var-environment`) via URL params
5. App: Use `&theme=light` or `&theme=dark` to match app theme

**When to embed vs. link:**

| Scenario | Approach |
|---|---|
| Quick KPI overview in admin | Embed Grafana stat panels |
| Detailed log investigation | Link to full Grafana dashboard |
| Customer-facing metrics | Build in app (full control over UX) |
| Internal ops overview | Embed Grafana time series |

## Observability Strategies

### The RED Method (for services/APIs)

Monitor these three signals for every service:

| Signal | Measures | Visualization | Example |
|---|---|---|---|
| **R**ate | Requests per second | Time series (line) | `sum(rate(http_requests_total[$__interval]))` |
| **E**rrors | Failed requests per second | Time series + stat | Error rate as % of total |
| **D**uration | Latency distribution | Histogram / heatmap | p50, p95, p99 response times |

Best for: API endpoints, microservices, web requests.

### The USE Method (for infrastructure)

Monitor these three signals for every resource (CPU, memory, disk, network):

| Signal | Measures | Visualization | Example |
|---|---|---|---|
| **U**tilization | % of resource used | Gauge / time series | CPU usage %, memory usage % |
| **S**aturation | Queue depth, backlog | Time series | Queue length, pending jobs |
| **E**rrors | Error count | Stat / time series | Disk I/O errors, network drops |

Best for: Servers, containers, databases, queues.

### The Four Golden Signals (Google SRE)

| Signal | What | When |
|---|---|---|
| **Latency** | Time to serve a request | Distinguish success vs. error latency |
| **Traffic** | Demand on the system | Requests/sec, sessions, transactions |
| **Errors** | Rate of failed requests | HTTP 5xx, exceptions, timeouts |
| **Saturation** | How "full" the system is | CPU, memory, queue depth |

## Visualization Selection

### Choose by data type

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

### Choose by question

| Question | Visualization |
|---|---|
| "What is the current value?" | Stat panel |
| "How did it change over time?" | Time series |
| "What's the breakdown?" | Bar chart or pie |
| "Where are the outliers?" | Histogram or heatmap |
| "Is it healthy?" | Stat with color thresholds |
| "What happened?" | Table (logs, events) |
| "How do two things compare?" | Time series with multiple queries |

## Layout Principles

### Information hierarchy (F-pattern)

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

### Rules

1. **Top row = KPIs** — Stat panels showing the most important numbers at a glance
2. **Middle = Trends** — Time series showing how things change over time
3. **Bottom = Details** — Tables, logs, breakdowns for investigation
4. **Left to right = General to specific** — Overview panels left, detail panels right
5. **Max 3–4 rows** — If more is needed, split into multiple dashboards
6. **Consistent widths** — Panels in the same row should have equal or proportional widths

### Panel sizing

| Panel type | Recommended height | Width |
|---|---|---|
| Stat (single value) | 3–4 units | 4–6 units (fit 3–4 per row) |
| Time series | 8–10 units | 12–24 units (half or full width) |
| Table | 8–12 units | 12–24 units |
| Heatmap | 8–10 units | 12–24 units |

## Color and Thresholds

### Traffic light pattern

| Color | Meaning | Use for |
|---|---|---|
| 🟢 Green | Healthy / OK | Within normal range |
| 🟡 Yellow/Orange | Warning | Approaching threshold |
| 🔴 Red | Critical / Error | Needs immediate attention |
| 🔵 Blue | Informational | Neutral data, no judgment |
| ⚪ Gray | No data / Unknown | Missing or stale data |

### Rules

- **Use color sparingly** — not every panel needs thresholds
- **Consistent meaning** — green always means good, red always means bad
- **Avoid red/green only** — add yellow for color-blind accessibility
- **Dark backgrounds** — use light text; light backgrounds → dark text

## Dashboard Types

| Type | Purpose | Strategy | Example |
|---|---|---|---|
| **Overview** | Health at a glance | Golden Signals / RED | "API Health" |
| **Service** | Deep dive into one service | RED + detailed metrics | "Import Service" |
| **Infrastructure** | Resource monitoring | USE method | "Server Resources" |
| **Business** | Business KPIs | Custom metrics | "Daily Imports by Customer" |
| **Investigation** | Ad-hoc debugging | Logs + traces | "Error Investigation" |
| **SLA/SLO** | Compliance tracking | Error budgets, uptime | "SLA Dashboard" |

## Admin Dashboard Design (Laravel App)

### Widget types

| Widget | Implementation | Use for |
|---|---|---|
| **Stat card** | Livewire component + Tailwind | Single KPI (total imports, active customers) |
| **Trend card** | Stat + sparkline (Chart.js or embedded Grafana) | KPI with direction indicator |
| **Table widget** | Livewire table with pagination | Recent items, top-N lists |
| **Chart widget** | Chart.js / embedded Grafana panel | Time series, bar charts |
| **Status list** | Blade component with color indicators | Service health, job queue status |
| **Activity feed** | Livewire with polling/streaming | Recent events, audit log |

### Admin dashboard layout

```
┌──────────┬──────────┬──────────┬──────────┐
│ Stat     │ Stat     │ Stat     │ Stat     │  ← KPI row (4 cards)
├──────────┴──────────┼──────────┴──────────┤
│ Chart (trend)       │ Chart (breakdown)   │  ← Visualization row
├─────────────────────┼─────────────────────┤
│ Table (recent)      │ Activity feed       │  ← Detail row
└─────────────────────┴─────────────────────┘
```

### Livewire patterns for dashboards

- **Polling:** `wire:poll.30s` for auto-refresh (not too frequent)
- **Lazy loading:** `wire:init` for expensive queries (show skeleton first)
- **Events:** `$dispatch('refresh-stats')` to update related widgets
- **Caching:** Cache expensive aggregations, refresh on schedule

## Anti-Patterns

| Anti-pattern | Problem | Fix |
|---|---|---|
| **Wall of numbers** | Too many stats, no hierarchy | Group into rows, add headings |
| **Rainbow dashboard** | Every panel a different color | Use consistent color scheme |
| **Too many panels** | Scroll fatigue, slow loading | Split into focused dashboards |
| **No context** | Numbers without meaning | Add thresholds, descriptions, units |
| **Stale data** | Dashboard shows old data | Add "last updated" indicator, auto-refresh |
| **Copy-paste queries** | Same query in multiple panels | Use variables and query references |
| **Mixing domains** | Ops metrics next to business KPIs | Separate monitoring from business dashboards |
| **No tenant scoping** | Admin sees all data without filter | Always scope to customer/tenant |

## Related

- **Skill:** `grafana` — Grafana-specific implementation (JSON, Loki, alerting)
- **Skill:** `logging-monitoring` — full monitoring stack overview
- **Skill:** `fe-design` — general frontend design patterns (forms, tables, responsive)
- **Skill:** `livewire` — Livewire component implementation
- **Skill:** `tailwind` — Tailwind CSS styling


## Gotcha

- Don't create dashboards with more than 8 panels — cognitive overload kills usability.
- The model tends to suggest fancy visualizations when a simple table would be clearer.
- Always define the time range explicitly — "last 24h" means different things in different timezones.

## Do NOT

- Do NOT create dashboards without clear KPIs or metrics.
- Do NOT use pie charts for more than 5 categories.
- Do NOT mix too many visualization types on one dashboard.

## Auto-trigger keywords

- dashboard
- monitoring dashboard
- visualization
- KPI
- metrics display
