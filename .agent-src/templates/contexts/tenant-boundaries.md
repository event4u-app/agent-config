# Tenant Boundaries

<!--
  Template shipped by event4u/agent-config.
  Copy to `agents/contexts/tenant-boundaries.md` in the consumer project
  and fill in. Required reading for any review that touches data access,
  queries, or public endpoints in a multi-tenant system.

  Delete this HTML comment after filling in.
-->

## Tenancy type

<!-- Pick one and delete the rest. -->

- [ ] **Single-tenant** — one database per deployment. No cross-tenant
      leakage is possible at the infra layer. Delete this file if true
      and the app will never shard.
- [ ] **Multi-tenant, shared database** — one table with a tenant key
      column (e.g., `tenant_id`, `workspace_id`).
- [ ] **Multi-tenant, schema per tenant** — one DB, one schema each.
- [ ] **Multi-tenant, database per tenant** — each tenant has its own
      connection.

## Tenant identifier

- **Column / connection key:** <!-- e.g., `tenant_id` on every tenanted table -->
- **Request scope source:** <!-- JWT claim / subdomain / session / header -->
- **Switched at:** <!-- middleware / service provider / connection factory -->

## Scope propagation

<!--
  Name every layer that MUST filter by tenant. Omissions are the most
  common bug class in multi-tenant systems.
-->

- **HTTP layer:** <!-- how controllers get the tenant -->
- **Background jobs:** <!-- how tenant context is serialized -->
- **Queued listeners and events:** <!-- same -->
- **CLI commands:** <!-- explicit flag or env var -->
- **Admin UI / support impersonation:** <!-- whether it switches tenant -->

## Known exceptions

<!--
  Intentional cross-tenant read or write paths. Each one MUST be listed
  — reviewers treat any missing entry as a bug.
-->

| Path | Why cross-tenant | Guard |
|---|---|---|
| e.g., `/admin/reports/usage` | aggregates across all tenants | superuser role + audit log |
| … | … | … |

## Gotchas

<!--
  Record every tenant-leak bug the team has ever shipped. A reviewer
  reads this before approving any query touching tenanted data.
-->

- …

## See also

- `agents/contexts/auth-model.md` — roles that sit on top of tenants
- `agents/contexts/data-sensitivity.md` — tenant-scoped vs. shared data
