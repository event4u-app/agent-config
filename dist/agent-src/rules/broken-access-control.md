---
type: "auto"
tier: "2a"
alwaysApply: false
description: "Endpoint/query on user/tenant data — authenticated ≠ authorized: server-derived ownership/tenant/role + negative tests (401/non-owner/cross-tenant)"
triggers:
  - keyword: "endpoint"
  - keyword: "route"
  - keyword: "authorization"
  - keyword: "tenant"
  - keyword: "IDOR"
  - keyword: "session"
  - keyword: "login"
  - keyword: "controller"
  - keyword: "findById"
routes_to:
  - "skill:authz-review"
  - "skill:threat-modeling"
  - "skill:multi-tenancy"
workspaces: [engineering]
packs: [engineering-base]
collision_ok:
  "controller": "controllers return user data — the ownership/tenant check floor"
  "endpoint": "every data-returning endpoint needs the three negative tests"
  "tenant": "cross-tenant isolation is this rule's core subject"
# obligation: line 55
obligation_frequency: "per-edit"
evidence:
  source_type: external-standard
  verified_on: 2026-08-30
  normative_level: recommended
---

# Broken Access Control

The most common — and most damaging — failure in real systems and AI-written code: log in as one user, see another user's data. **Authenticated ≠ authorized** — the per-object ownership/tenant check is a separate line devs and AI omit, especially when the object id comes from the request (OWASP Web #1 A01:2021 / API #1 BOLA/IDOR).

## The Iron Law

```
AUTHENTICATED IS NOT AUTHORIZED. EVERY REQUEST-SUPPLIED ID/FILTER GETS A
SERVER-DERIVED OWNERSHIP/TENANT CHECK BEFORE ANY DATA IS RETURNED.
NO DATA-RETURNING ENDPOINT IS DONE WITHOUT THREE NEGATIVE TESTS:
UNAUTHENTICATED → 401 · NOT-OWNER → 403/404 · CROSS-TENANT → 403/404 (404 HIDES EXISTENCE).
ROLE DECIDES WHICH FIELDS — THE SERVER STRIPS THEM. THE FRONTEND HIDING A FIELD IS NOT PROTECTION.
A LIVE CROSS-USER EXPOSURE IS A NOTIFIABLE BREACH — NEVER SILENTLY PATCH IT.
```

## The three negative tests — the completion gate

A protected endpoint is **not complete** until these exist and pass (happy-path 200 alone is the tautology this rule exists to stop):

1. **unauthenticated → 401** (no token).
2. **authenticated but not the owner → 403/404** (user A requests user B's object with A's token).
3. **cross-tenant → 403/404** (a principal in tenant A requests tenant B's resource; prefer 404 on sensitive resources — a hard 403 confirms the id exists in another tenant).

Small + task-aligned gap in code you touched → add the check **and** its negative test in the same commit (see `active-remediation` for the auto-fix boundary). Bigger → surface it.

## When it fires

Writing/modifying any endpoint, route, query, or serializer that returns user- or tenant-owned data, or any auth/session/login/tenant path.

## When NOT to fire

- Public, non-user-specific data with no principal concept (a public docs page, a health check with no data).
- Prose/docs/config-only edits.

Body migrated to [`skill:authz-review` § Broken-access-control depth](../skills/authz-review/SKILL.md) (per P4 of `road-to-kernel-and-router.md`) — non-optional controls, role-based field-level access (vertical BOPLA + BFLA), defense-in-depth, GDPR/DSGVO grounding, backstop greps.
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).

## See also

- [`authz-review`](../skills/authz-review/SKILL.md) — the 6-stage per-entrypoint chain, defense-in-depth, authz matrix, negative-test contract, and the migrated depth above.
- [`security-sensitive-stop`](security-sensitive-stop.md) — threat-model BEFORE editing an auth/tenant path (fires first).
- [`active-remediation`](active-remediation.md) — the fix-now/ask/follow-up ladder + the live-exposure safety carve-out.
- [`threat-modeling`](../skills/threat-modeling/SKILL.md), [`multi-tenancy`](../skills/multi-tenancy/SKILL.md), [`ai-code-blindspots`](../skills/ai-code-blindspots/SKILL.md), [`privacy-review`](../skills/privacy-review/SKILL.md).
