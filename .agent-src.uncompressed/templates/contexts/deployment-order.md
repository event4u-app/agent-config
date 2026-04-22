# Deployment Order

<!--
  Template shipped by event4u/agent-config.
  Copy to `agents/contexts/deployment-order.md` in the consumer project
  and fill in. Required reading for any change involving schema
  migrations, feature flags, or multi-service deploys. Without this,
  "breaking change" reviews are guesswork.

  Delete this HTML comment after filling in.
-->

## Environments

<!-- Name every environment in promotion order. -->

| Env | Purpose | Auto-deploy | Gate |
|---|---|---|---|
| `staging` | pre-prod verification | yes, on merge to `main` | smoke tests green |
| `prod` | customer-facing | manual trigger | staging green + approval |
| … | … | … | … |

## Migration strategy

<!-- Pick one and document deviations. -->

- [ ] **Expand → migrate → contract** (default for schema changes).
- [ ] **Backfill job** — migrations touch >1M rows.
- [ ] **Zero-downtime required** — feature flagged through the window.

### Concrete rules

- Add columns **nullable** or with default in release N, make NOT NULL
  or drop default in release N+1.
- Rename columns by **adding the new name**, writing to both, reading
  from the new one, dropping the old in a later release.
- Lock-prone DDL (`ALTER TABLE … ADD COLUMN` on large tables,
  `ADD INDEX` without `CONCURRENTLY`) requires a maintenance window or
  an online-DDL tool.

## Feature flags

- **Flag system:** <!-- e.g., Pennant / LaunchDarkly / env config -->
- **Flag naming:** <!-- e.g., `feature.<area>.<capability>` -->
- **Default state for new flags:** <!-- off, enabled for internal tenants, etc. -->
- **Retirement process:** <!-- how and when flags are removed after rollout -->

## Rollback plan

<!--
  Every deploy MUST have a rollback answer. Describe the default,
  then the exceptions.
-->

- **Default rollback:** <!-- e.g., redeploy previous tag, no data migration needed -->
- **When rollback requires a reverse migration:** <!-- conditions + runbook -->
- **When rollback is NOT possible:** <!-- destructive migrations; document how the team decides to ship anyway -->

## Known ordering constraints

<!--
  Services that must deploy in a specific order (e.g., API before
  worker, schema before app, flag before feature). A reviewer reads
  this before approving any cross-service change.
-->

- …

## See also

- `agents/contexts/observability.md` — what to watch during a deploy
- `.augment/skills/migration-safety/SKILL.md` <!-- if installed --> — reviewer
