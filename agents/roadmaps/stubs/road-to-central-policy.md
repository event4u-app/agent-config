# Road to Central Policy — STUB

> **Status** · stub. Not started. Created 2026-05-24 to satisfy
> Phase 9 Step 4 of
> [`road-to-employee-product-and-external-proof.md`](../road-to-employee-product-and-external-proof.md).
> See [`stubs/README.md`](README.md) for promotion criteria.

## Surface this stub tracks

Centralised policy enforcement for a multi-user deployment: which
skills, rules, and commands are allowed per role; which knowledge
sources may be ingested; which host agents may be invoked; audit
log centralisation.

## Why this stays cancelled today

Multi-tenant policy without an identity surface is a half-solution.
The archived `road-to-internal-ai-os-deployment.md` cancelled this
together with SSO. The
[`team-deployment-posture`](../../../docs/deploy/team-deployment-posture.md)
document points teams at git-shared `agents/overrides/` for the
small-team case, which suffices until org-mode is funded.

## Prerequisites for promotion

1. **SSO must land first** — promote [`road-to-team-sso.md`](road-to-team-sso.md)
   before this stub. Policy without identity is meaningless.
2. **Recruited customer** — same gate as SSO: a real organisation
   asks for central policy and commits to adoption.
3. **Funded security audit** — covers the policy server's threat
   model, audit-log surface, and tenant-isolation guarantees.
4. **Choice of policy surface** — file-shipped (git-served) vs
   server-shipped (HTTP API) decided in a separate ADR.

## What is explicitly out of scope of this stub

- The small-team recipe ([`small-team-recipe`](../../../docs/deploy/small-team-recipe.md))
  already covers shared-overrides-via-git for 3–10 person teams.
  This stub is only for the org-mode case where the recipe hits its
  scale ceiling.
- Override-management as it ships today (per-user
  `agents/overrides/`) is unaffected.

## Cross-references

- SSO prerequisite: [`road-to-team-sso.md`](road-to-team-sso.md).
- Posture: [`docs/deploy/team-deployment-posture.md`](../../../docs/deploy/team-deployment-posture.md).
- Archived precursor: `agents/roadmaps/archive/road-to-internal-ai-os-deployment.md` (Phase 3).
