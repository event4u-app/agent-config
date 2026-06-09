# Team Deployment Posture

> **Status** · v0 · 2026-05-24. Phase 9 of
> [`road-to-employee-product-and-external-proof.md`](../../agents/roadmaps/archive/road-to-employee-product-and-external-proof.md).
> Codifies what is shipped today, what stays cancelled-with-reason,
> and what is reachable via existing primitives — so feedback rounds
> 9+ asking "team SSO when?" land on a written answer.

## Where agent-config sits today

| Surface | Status |
|---|---|
| Single-user workspace | **Shipped** (Phases 4–7 of this roadmap, single-user / single-machine) |
| Small-team via shared overrides | **Shipped** (existing primitives — see [`small-team-recipe`](small-team-recipe.md)) |
| Organization mode (SSO, central policy, OAuth connectors) | **Cancelled-with-reason** — tracked in successor roadmap stubs |

## Shipped — what works today

The phases below this section, once implemented, deliver:

- A daily workspace browser tab (Phase 4) — per-user, local-only.
- Document workflows (Phase 5) — offer / mail / memo / brief /
  video-script with local revision history and export.
- Plain explain mode (Phase 6) — role-aware translation of the
  memory-trust surface.
- Local analytics (Phase 7) — top prompts, completion rate,
  session length; never leaves the machine.
- At-rest encryption (Phase 8) — AES-256-GCM with OS keyring,
  default on from workspace v1.0.

All of these run on **one machine, one OS user, one workspace**. No
remote backend. No shared state. No sign-on screen.

## Reachable via existing primitives — small-team mode

A team of 3–10 people can use the package collaboratively today
without any code change, by leaning on three existing primitives:

| Primitive | What it gives the team |
|---|---|
| `agents/overrides/` repo, shared via git | Shared prompts, role experiences, glossaries, skills overrides |
| Knowledge ingestion from a shared NAS / SharePoint mount | Each user runs `/knowledge:ingest` against the same mount; per-user index, same content |
| Manual prompt-pack distribution via npm `@event4u/agent-config-<team>` | Team publishes a thin pack of role experiences as a private npm package |

The recipe lives in [`small-team-recipe`](small-team-recipe.md).

## Cancelled-with-reason — organization mode

The prior archived `road-to-internal-ai-os-deployment.md` Phases 2–5
were cancelled under Hard-Floor (no real first customer, no audit
funding, no recruit-session signal). Phase 9 **does not reactivate
them**. The cancellations stand:

| Cancelled surface | Reason | Successor roadmap (stub) |
|---|---|---|
| **SSO / OIDC sign-on** | No customer requires it. Auth surface is auth-adjacent — `engineering-safety-floor` Hard-Floor on adoption without a funded security audit. | `road-to-team-sso.md` |
| **Central policy enforcement** | Multi-tenant policy without SSO is a half-solution. Wait for SSO. | `road-to-central-policy.md` |
| **Team-shared overrides server** | Shared-overrides-via-git already works for the small-team case. Server only makes sense once the org-mode threshold is reached. | `road-to-team-context.md` |
| **OAuth connectors (Google, Slack, M365)** | Per-connector OAuth flow is a permanent footprint we can't ship without an org user agreeing to scope it. | `road-to-internal-connectors.md` |

### 2026-05 feedback citation — same three asks, same Hard-Floor

The 9.3/10 feedback round (delivered in chat 2026-05-25) re-affirmed
the same three P0 items the cancellations cover: OAuth knowledge
connectors, IAM / org mode with admin roles + quotas + audit
retention, and organization-shared memory. The verbatim asks land on
the same Hard-Floor wall — no funded audit, no recruited team
customer, no scope to adopt auth-adjacent code into the package.

| 9.3/10 ask | Verbatim phrasing (2026-05-25) | Maps to cancellation |
|---|---|---|
| OAuth knowledge connectors | "GitHub / Jira / Confluence connectors so the team's docs join the agent's knowledge index" | `road-to-internal-connectors.md` |
| IAM / org governance | "user accounts + admin roles + quotas + audit retention" | `road-to-team-sso.md` + `road-to-central-policy.md` |
| Organization-shared memory | "team-wide memory so what one engineer answers, the next one inherits" | `road-to-team-context.md` |

Each row carries the same three release gates: **recruited customer
+ funded audit + maintainer ADR**. Until all three are met, the
cancellation stands. Feedback rounds 11+ that re-ask the same
questions land on this row directly.

Each successor roadmap is an empty-named stub today; activation
requires a recruited team customer plus a human-reviewed security
audit. Until then, the answer to "team SSO when?" is: **not on this
package, not on this roadmap**.

## Decision posture going forward

- **Default answer to org-mode requests**: point at this document.
  Do not re-open the cancellation without a recruited customer +
  funded audit.
- **Default answer to small-team requests**: point at
  [`small-team-recipe`](small-team-recipe.md). The recipe is
  sufficient for 3–10 people, no code change required.
- **Default answer to single-user requests**: workspace + Phases
  4–7 deliver the daily experience.

The Hard-Floor item stays in force. Nothing in Phase 9 lifts it.
The successor roadmap stubs exist so cross-references resolve and
so a future maintainer (or external contributor with funding) can
pick them up without re-deriving the cancellation rationale.

## Cross-references

- Recipe: [`small-team-recipe`](small-team-recipe.md).
- Archived: `agents/roadmaps/archive/road-to-internal-ai-os-deployment.md`.
- Stubs (created by Phase 9 Step 4):
  - `agents/roadmaps/stubs/road-to-team-sso.md`
  - `agents/roadmaps/stubs/road-to-central-policy.md`
  - `agents/roadmaps/stubs/road-to-team-context.md`
  - `agents/roadmaps/stubs/road-to-internal-connectors.md`
- Engineering safety floor: [`.augment/rules/non-destructive-by-default.md`](../../.augment/rules/non-destructive-by-default.md).
