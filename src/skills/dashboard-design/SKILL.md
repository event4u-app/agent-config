---
model_tier: medium
name: dashboard-design
description: "Use when designing monitoring dashboards — visualization selection, layout principles, observability strategies (RED/USE/Golden Signals), and data storytelling."
domain: devops
recommended_for_user_types: [ops, gtm]
framework: laravel
workspaces:
  - engineering
packs:
  - engineering-base
---

# dashboard-design

## When to use

Use when designing a new Grafana or admin dashboard, deciding what goes where (Grafana vs. app), or embedding Grafana panels in the Laravel app.

Do NOT use when:
- Writing Grafana queries/JSON (use `grafana` skill)
- Building Livewire components (use `livewire` skill)

## Procedure: Design a dashboard

1. **Inspect the data sources** — Identify which signals already exist (logs, metrics, app queries) and where they live (Grafana / Loki / app DB) before designing a new panel.
2. **Pick the surface** — Use the decision tables below to choose Grafana, app dashboard, or embed; document audience and refresh cadence.
3. **Draft the layout** — Sketch panels, choose visualization per signal (RED / USE / Golden Signals), define filters and thresholds.
   **Ground the chart-type choice** in the adopted data-viz corpus instead
   of memory: `ground.py search --manifest
   <skills-root>/design-intelligence/data/manifest.json --domain chart
   "<data shape>"` returns the best chart type, when-NOT-to-use, data-volume
   threshold, a11y grade + colorblind fallback, and a library
   recommendation per row (see
   [`design-intelligence`](../design-intelligence/SKILL.md)).
4. **Implement and verify** — Build the dashboard, load realistic data, and confirm every panel answers a named question for the named audience.

| Domain | Technology | Purpose |
|---|---|---|
| **Monitoring** | Grafana + Loki | Infrastructure health, error rates, logs, SLAs |
| **Business/Admin** | Laravel + Livewire + Tailwind | Customer KPIs, import stats, usage metrics |

### Decision: What goes where?

| Data | Where |
|---|---|
| Server metrics, error rates, latency | Grafana |
| Log analysis, traces | Grafana (Loki) |
| SLA/uptime tracking | Grafana |
| Customer-facing KPIs | App dashboard |
| Import statistics per customer | App dashboard (+ Grafana embed) |
| User activity, usage metrics | App dashboard |

### Grafana Embedding

```html
<iframe
  src="https://grafana.example.com/d-solo/{dashboard-uid}/{panel-id}?orgId=1&from=now-24h&to=now&var-fqdn={{ $customer->fqdn }}&theme=light"
  width="100%" height="300" frameborder="0"
></iframe>
```

Config required: `allow_embedding = true`, `cookie_samesite = none` (cross-origin), anonymous access/auth proxy, tenant variables via URL params, `&theme=light|dark`.

| Scenario | Approach |
|---|---|
| Quick KPI overview | Embed Grafana stat panels |
| Detailed investigation | Link to full Grafana dashboard |
| Customer-facing | Build in app (full UX control) |

## Admin Dashboard Design (Laravel)

### Widget types

| Widget | Implementation |
|---|---|
| Stat card | Livewire + Tailwind |
| Trend card | Stat + sparkline (Chart.js / Grafana embed) |
| Table widget | Livewire table with pagination |
| Chart widget | Chart.js / Grafana embed |
| Status list | Blade component with color indicators |
| Activity feed | Livewire with polling/streaming |

### Layout: F-pattern

```
┌──────────┬──────────┬──────────┬──────────┐
│ Stat     │ Stat     │ Stat     │ Stat     │  ← KPI row
├──────────┴──────────┼──────────┴──────────┤
│ Chart (trend)       │ Chart (breakdown)   │  ← Viz row
├─────────────────────┼─────────────────────┤
│ Table (recent)      │ Activity feed       │  ← Detail row
└─────────────────────┴─────────────────────┘
```

### Livewire patterns

- `wire:poll.30s` for auto-refresh
- `wire:init` for lazy loading expensive queries
- `$dispatch('refresh-stats')` for cross-widget updates
- Cache expensive aggregations, refresh on schedule

### Validate

- Verify each panel answers exactly one question.
- Confirm time ranges are explicit, not "last X" without context.
- Check that critical KPIs are visible without scrolling.
- Ensure no chart mixes unrelated metrics on the same axis.

## Output format

1. Dashboard layout with panel placement and visualization types
2. Data source mapping — which metrics/queries feed each panel
3. Alerting thresholds where applicable

## Gotcha

- Max 8 panels per dashboard — cognitive overload kills usability.
- Simple table often beats fancy visualization.
- Always scope to customer/tenant — no unfiltered admin views.
- Always define time range explicitly.

## Do NOT

- Do NOT create dashboards with more than 8 panels — cognitive overload.
- Do NOT mix ops metrics with business KPIs on the same dashboard.
- Do NOT show admin data without tenant scoping.

## Auto-trigger keywords

- dashboard
- monitoring dashboard
- visualization
- KPI
- metrics display
