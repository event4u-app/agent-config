# Road to Team SSO — STUB

> **Status** · stub. Not started. Created 2026-05-24 to satisfy
> Phase 9 Step 4 of
> [`road-to-employee-product-and-external-proof.md`](../archive/road-to-employee-product-and-external-proof.md).
> See [`stubs/README.md`](README.md) for promotion criteria.

## Surface this stub tracks

Sign-on for multi-user deployments: OIDC / SAML provider integration,
session token handling, per-user identity propagation into the
workspace and the host-agent protocol.

## Why this stays cancelled today

The archived `road-to-internal-ai-os-deployment.md` cancelled this
under Hard-Floor: auth-adjacent surface, no recruited customer
requires it, no funded security audit covers it. The
[`team-deployment-posture`](../../../docs/deploy/team-deployment-posture.md)
document codifies the cancellation.

## Prerequisites for promotion

1. **Recruited customer** — a real organisation (named in
   `agents/recruit-sessions/<role>/`) asks for SSO and commits to
   adoption.
2. **Funded security audit** — a third-party review of the proposed
   identity flow and session-token handling is budgeted and
   scheduled.
3. **Maintainer sign-off ADR** — a written ADR lifts the Hard-Floor
   item on auth-adjacent shipping for this surface.
4. **Choice of identity surface** — OIDC vs SAML vs both is decided
   in a separate ADR before any code lands.

## What is explicitly out of scope of this stub

- Anything in [`team-deployment-posture`](../../../docs/deploy/team-deployment-posture.md)
  marked **shipped** or **reachable via existing primitives**.
- Central policy enforcement (separate stub:
  [`road-to-central-policy.md`](road-to-central-policy.md)).
- OAuth connectors to third-party services (separate stub:
  [`road-to-internal-connectors.md`](road-to-internal-connectors.md)).

## Cross-references

- Posture: [`docs/deploy/team-deployment-posture.md`](../../../docs/deploy/team-deployment-posture.md).
- Archived precursor: `agents/roadmaps/archive/road-to-internal-ai-os-deployment.md` (Phase 2).
- Engineering safety floor: [`.augment/rules/non-destructive-by-default.md`](../../../.augment/rules/non-destructive-by-default.md).

## 2026-05 feedback citation

Feedback round 2026-05 (delivered in chat 2026-05-25 as the 9.3/10 review) re-affirmed this gap as a P0 item. The ask lands on the same three-criterion release gate: **recruited team customer + funded audit + maintainer ADR**. Until all three are met, the cancellation stands; this stub is the audit-trail entry so future review rounds do not re-derive the rationale.
