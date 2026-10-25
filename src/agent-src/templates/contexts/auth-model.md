# Auth Model

<!--
  Template shipped by event4u/agent-config.
  Copy to `agents/settings/contexts/auth-model.md` in the consumer project and
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

## Delegated actors

<!--
  Every non-human or delegated actor that can change data for a requester: an
  AI assistant, a support bot, an MCP server, an integration, support staff, an
  admin tool. A claim in a conversation is an input, never an authorization —
  the subject of a write comes from an authenticated principal. One row per
  actor; an actor missing here is treated as unauthorized. The per-tool detail
  lives in `agents/settings/contexts/agent-actions.yml`.
-->

| Actor | Fields it may change | Proof required | Channel notified | Human approval |
|---|---|---|---|---|
| <!-- e.g. AI support assistant --> | <!-- e.g. shipping address only --> | <!-- e.g. signed-in session of the owner --> | <!-- e.g. old e-mail --> | <!-- required / none --> |

- **Who may change a recovery channel (e-mail, phone, MFA factor), and over
  which verified channel is that confirmed?** <!-- answer; "an AI assistant on a
  stated claim" is never a valid answer -->
- **Where is the check enforced?** <!-- the data-layer writer that guards every
  path to the field, not the endpoint or tool handler -->

## Known exceptions

<!--
  Intentional deviations from the default model: system-user endpoints,
  CLI bypasses, public-read namespaces. Each exception MUST be listed —
  reviewers assume anything missing is unauthorized.
-->

- …

## See also

- `agents/settings/contexts/tenant-boundaries.md` — tenancy scope, multi-tenant
  rules that sit on top of the role model
- `../../../docs/guidelines/agent-infra/*` — reviewer skills that read this
  file
