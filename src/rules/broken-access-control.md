---
type: "auto"
tier: "2a"
alwaysApply: false
description: "Endpoint/query returning user or tenant data — authenticated ≠ authorized; enforce a server-derived ownership/tenant/role check + the three negative tests (401/non-owner/cross-tenant)"
triggers:
  - intent: "returning user or tenant data"
  - intent: "adding an endpoint that reads a record by id"
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
---

# Broken Access Control

The single most common — and most damaging — failure in real systems and in AI-written code: you log in as one user and see another user's data. **Authenticated ≠ authorized.** The login check passes, so the endpoint *feels* protected; the per-object ownership/tenant check is a separate line that devs and AI omit — especially when the object id comes straight from the request. Broken Access Control is OWASP Web #1 (A01:2021) and API #1 (BOLA/IDOR), trivially scriptable, and a recurring real-world breach class — e.g. First American Financial (885M documents exposed via sequential ids with no ownership check).

## The Iron Law

```
AUTHENTICATED IS NOT AUTHORIZED. EVERY REQUEST-SUPPLIED ID/FILTER GETS A
SERVER-DERIVED OWNERSHIP/TENANT CHECK BEFORE ANY DATA IS RETURNED.
NO DATA-RETURNING ENDPOINT IS DONE WITHOUT THREE NEGATIVE TESTS:
UNAUTHENTICATED → 401 · NOT-OWNER → 403/404 · CROSS-TENANT → 403/404 (404 HIDES EXISTENCE).
ROLE DECIDES WHICH FIELDS — THE SERVER STRIPS THEM. THE FRONTEND HIDING A FIELD IS NOT PROTECTION.
A LIVE CROSS-USER EXPOSURE IS A NOTIFIABLE BREACH — NEVER SILENTLY PATCH IT.
```

## Non-optional controls (every data-returning surface)

- **Server-derived principal.** Ownership/tenant is derived from the session/token, **never** from a request header/param/body the caller controls. A matching id in the request is not authorization.
- **Ownership/tenant check on every request id** before returning data. `findById(params.id)` with no `where owner/tenant = currentPrincipal` is the canonical bug.
- **Tenant-scoped by construction.** Every query on a tenant table carries the tenant predicate; prefer a base scope that injects it so a forgotten clause can't leak. (German DSGVO: Mandantentrennung / Trennungskontrolle is a required TOM — a missing `tenant_id` filter is a compliance failure, not just a bug.)
- **Response minimization.** Return only the fields the caller is entitled to — no `SELECT *` / full-object serialization leaking PII "because the model has it" (Art. 25(2) by default).
- **Property-level authz (BOPLA / mass assignment).** Reject `role` / `user_id` / `tenant_id` / `is_admin` from the request body; explicit field allow-list, never whole-body binding.
- **Role/field-level output filtering (vertical BOPLA).** *Which* fields a principal receives depends on role + business rules — a driver role must not receive `price`; an office role must not receive the boss's `offer`. Serialize via a **role-scoped output DTO**, never the raw model / `to_json()`; sensitive fields (`price`/`cost`/`margin`/`salary`/`discount`/`offer`/internal notes) default-deny per role.
- **No guessable public ids** on sensitive resources — UUID/ULID, not sequential integers (turns one bug into full-DB enumeration).

## The three negative tests — the completion gate

A protected endpoint is **not complete** until these exist and pass (happy-path 200 alone is the tautology this rule exists to stop):

1. **unauthenticated → 401** (no token).
2. **authenticated but not the owner → 403/404** (user A requests user B's object with A's token).
3. **cross-tenant → 403/404** (a principal in tenant A requests tenant B's resource; prefer 404 on sensitive resources — a hard 403 confirms the id exists in another tenant).

Small + task-aligned gap in code you touched → add the check **and** its negative test in the same commit (see `active-remediation` for the auto-fix boundary). Bigger → surface it.

## Role-based field-level access — both directions (vertical BOPLA + BFLA)

Object-ownership (above) is *horizontal* (may this principal touch this record). This is *vertical*: which **fields** and which **functions** a role may reach — the maintainer's case (driver ≠ price, office worker ≠ boss's offer). It depends on role + business rules, and **the server is the only boundary** — the frontend hiding a field does not protect it: the raw JSON on the wire is readable via `curl`/DevTools/a proxy (the 3Fun leak: a privacy toggle filtered only in the app; the server returned every user's location to a direct query).

- **Read side (CWE-213 / Excessive Data Exposure).** Build the response from a **role-scoped output DTO** — never serialize the ORM model directly. Sensitive fields default-deny per role. A client `?fields=` selection is ergonomics, not authorization — intersect it server-side with the role's read-allowlist.
- **Write side (CWE-915).** Bind input through a **role-scoped write-allowlist** — never the raw body. Read-allowed ≠ write-allowed: a role may *see* `status` but not *set* `status:"approved"`; the two allowlists are independent sets.
- **Function level (BFLA, OWASP API #5).** A role must not reach a function/verb reserved for a higher role. Gate **every mutating verb** (POST/PUT/PATCH/DELETE), deny-by-default — not just the GET you were asked about. The admin button being hidden is not a control.
- **Nested / GraphQL.** Field-level checks propagate to nested selections; a low-role token selecting a restricted field gets null/error, not data.
- **Negative tests, per (role × sensitive field), both directions:** lower-role token → the field is **absent from the raw response body** (assert the body, not the UI); lower-role setting the field on input → rejected/ignored, **verified by re-reading the persisted record**; every privileged verb → 403 for lower roles (403/404 on sensitive object reads).

## Defense-in-depth (so one miss can't leak)

Stack ≥2 independent layers on sensitive data — query-level ownership scoping, a centralized default-deny policy layer (a route with no policy is denied, not silently open), and DB row-level security as the backstop for a forgotten `WHERE tenant_id`. The RLS / policy-layer configuration, the per-role authz matrix, and the audit greps live once in [`authz-review`](../skills/authz-review/SKILL.md).

## GDPR / DSGVO — data protection by design

A cross-user data leak violates **Art. 5(1)(f)** (integrity & confidentiality — a principle → higher fine tier), **Art. 25** (by design/default: default-deny + least privilege + response minimization), and **Art. 32** — which also **mandates a process for regularly testing the effectiveness** of these controls (untested authz is a direct Art. 32 gap; this is why the three negative tests are non-optional). A discovered live exposure is a **notifiable breach** (Art. 33, 72 h from discovery) — surface it as "notify + remediate", never a silent patch. This is data-protection context, not legal advice → `privacy-review`, `domain-safety-pii`.

## Backstop greps (authoring-time)

```bash
# Record fetched by request id with no owner/tenant predicate nearby (high-noise — a hit means read the line, not auto-fix)
rg -n '(findById|find|findOne|get)\(\s*(req\.|request\.|params\.|\$request|\$id)'
# Client-supplied tenant/user hint used as the scope (should come from the session)
rg -n '(tenant|tenantId|user_id|userId)\s*=\s*(req|request|params|headers|query)\.'
```

The full authoring-time grep set (mass-assignment, raw-serialization, secrets) lives once in [`ai-code-blindspots`](../skills/ai-code-blindspots/SKILL.md).

A hit means read that line — is the ownership/tenant check present? Some are safe (already scoped); none should ship unchecked.

## When it fires

Writing/modifying any endpoint, route, query, or serializer that returns user- or tenant-owned data, or any auth/session/login/tenant path.

## When NOT to fire

- Public, non-user-specific data with no principal concept (a public docs page, a health check with no data).
- Prose/docs/config-only edits.

## See also

- [`authz-review`](../skills/authz-review/SKILL.md) — the 6-stage per-entrypoint chain, defense-in-depth, authz matrix, negative-test contract.
- [`security-sensitive-stop`](security-sensitive-stop.md) — threat-model BEFORE editing an auth/tenant path (fires first).
- [`active-remediation`](active-remediation.md) — the fix-now/ask/follow-up ladder + the live-exposure safety carve-out.
- [`threat-modeling`](../skills/threat-modeling/SKILL.md), [`multi-tenancy`](../skills/multi-tenancy/SKILL.md), [`ai-code-blindspots`](../skills/ai-code-blindspots/SKILL.md), [`privacy-review`](../skills/privacy-review/SKILL.md).
