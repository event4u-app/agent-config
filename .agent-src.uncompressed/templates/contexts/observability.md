# Observability

<!--
  Template shipped by event4u/agent-config.
  Copy to `agents/contexts/observability.md` in the consumer project and
  fill in. A reviewer reads this before approving changes to loggers,
  error handlers, metrics, or alert rules.

  Delete this HTML comment after filling in.
-->

## Error tracking

- **System:** <!-- e.g., Sentry / Rollbar / Bugsnag / custom -->
- **Project / DSN location:** <!-- env var or config path — NOT the value -->
- **Environment tag convention:** <!-- `staging`, `prod`, `dev`; must be set -->
- **Release tag source:** <!-- git SHA / version / deploy ID -->
- **beforeSend / filter hook:** <!-- file path; what it strips — cross-reference `data-sensitivity.md` -->

## Logging

<!-- Document every channel and what it is for. -->

| Channel | Destination | Retention | Used for |
|---|---|---|---|
| `stack` | stdout → collector | 30 days | default app logs |
| `audit` | DB `audit_log` table | 2 years | user-facing compliance events |
| `security` | separate index | 90 days | authn failures, permission denials |
| … | … | … | … |

### Structured log conventions

- **Format:** <!-- JSON / logfmt / plain -->
- **Required fields on every entry:** <!-- e.g., `request_id`, `user_id`, `tenant_id`, `channel` -->
- **Log-safe types:** see `data-sensitivity.md`.

## Metrics

- **System:** <!-- e.g., Prometheus / CloudWatch / Grafana Cloud -->
- **Naming convention:** <!-- `<service>_<verb>_<unit>` -->
- **Cardinality limits:** <!-- which labels are capped, which are banned -->

## Known alerts

<!--
  Every alert that will page a human. A reviewer checks this before
  changing the upstream behaviour that triggers the alert.
-->

| Alert | Signal | Routed to | Runbook |
|---|---|---|---|
| High 5xx rate | `http_errors_rate_5m > 5` | on-call | `docs/runbooks/5xx.md` |
| Queue backlog | `queue_depth{q=default} > 10k` | platform | `docs/runbooks/queue.md` |
| … | … | … | … |

## Dashboard references

- <!-- link or path to the primary dashboard + the alerting dashboard -->

## See also

- `agents/contexts/data-sensitivity.md` — what must NOT appear in logs
  or error reports
- `agents/contexts/deployment-order.md` — what to watch during a deploy
