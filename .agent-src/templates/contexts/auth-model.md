# Auth Model

<!--
  Template shipped by event4u/agent-config.
  Copy to `agents/contexts/auth-model.md` in the consumer project and
  fill in. This file is consumed by the Waves 2-3 security skills (see
  `road-to-defensive-agent.md`) — an agent asked to review auth logic
  starts by reading this.

  Delete this HTML comment after filling in.
-->

## Roles

<!-- List every role the system recognizes. Include role slug, who holds it, and how they obtain it. -->

| Role slug | Description | Granted by | Notes |
|---|---|---|---|
| `admin` | … | … | … |
| `member` | … | … | … |

## Permissions

<!--
  Describe the permission model: RBAC, ABAC, policy-based, mix. Name the primary
  authorization checks (Gate, Policy, middleware, attribute) and where they live.
-->

- **Model:** <!-- RBAC | ABAC | Policy-based | Mix -->
- **Primary checks:** <!-- e.g., `Gate::check`, `UserPolicy`, `@can` directive -->
- **Source of truth:** <!-- file / table / config that defines the matrix -->

## Override and impersonation

<!--
  If admins can act on behalf of other users (support, debugging, billing
  adjustments), document the mechanism and its audit trail.
-->

- **Who can impersonate:** <!-- roles / feature flag / audit trail path -->
- **How the audit trail is emitted:** <!-- log channel / event / table -->
- **Fields or actions impersonation MUST NOT touch:** <!-- e.g., 2FA reset, password change -->

## Known exceptions

<!--
  Intentional deviations from the default model: system-user endpoints,
  CLI bypasses, public-read namespaces. Each exception MUST be listed —
  reviewers assume anything missing is unauthorized.
-->

- …

## See also

- `agents/contexts/tenant-boundaries.md` — tenancy scope, multi-tenant
  rules that sit on top of the role model
- `../../../docs/guidelines/agent-infra/*` — reviewer skills that read this
  file
