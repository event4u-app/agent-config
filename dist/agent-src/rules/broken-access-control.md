---
type: "auto"
tier: "2a"
alwaysApply: false
description: "Any endpoint/query returning user or tenant data — authenticated ≠ authorized; enforce a server-derived ownership/tenant check + the three negative tests (401/non-owner-403/cross-tenant-403), or it is not done"
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
  - skill:authz-review
  - skill:threat-modeling
  - skill:multi-tenancy
workspaces: [engineering]
packs: [engineering-base]
---

# Broken Access Control

The most common — and most damaging — failure in real systems and AI-written code: log in as one user, see another user's data. **Authenticated ≠ authorized.** The login check passes so the endpoint *feels* protected; the per-object ownership/tenant check is a separate line devs and AI omit — especially when the object id comes from the request. OWASP Web #1 (A01:2021) + API #1 (BOLA/IDOR, API1:2023), trivially scriptable, the single **universal** class across every AI agent tested (DryRun: 87% of AI PRs vulnerable). Real leaks: First American Financial (885M docs, sequential ids, no ownership check, undetected 5 years), Optus (~10M, sequential ids, fix on one host not another), USPS (60M, wildcard search returned any user's data), cross-tenant leak via a single client-supplied header.

## The Iron Law

```
AUTHENTICATED IS NOT AUTHORIZED. EVERY REQUEST-SUPPLIED ID/FILTER GETS A
SERVER-DERIVED OWNERSHIP/TENANT CHECK BEFORE ANY DATA IS RETURNED.
NO DATA-RETURNING ENDPOINT IS DONE WITHOUT THREE NEGATIVE TESTS:
UNAUTHENTICATED → 401 · AUTHENTICATED-NOT-OWNER → 403/404 · CROSS-TENANT → 403.
ROLE DECIDES WHICH FIELDS — THE SERVER STRIPS THEM. THE FRONTEND HIDING A FIELD IS NOT PROTECTION.
A LIVE CROSS-USER EXPOSURE IS A NOTIFIABLE BREACH — NEVER SILENTLY PATCH IT.
```

## Non-optional controls (every data-returning surface)

- **Server-derived principal.** Ownership/tenant derived from the session/token, **never** from a request header/param/body the caller controls. A matching id in the request is not authorization.
- **Ownership/tenant check on every request id** before returning data. `findById(params.id)` with no `where owner/tenant = currentPrincipal` is the canonical bug.
- **Tenant-scoped by construction.** Every query on a tenant table carries the tenant predicate; prefer a base scope that injects it so a forgotten clause can't leak. (DSGVO: Mandantentrennung / Trennungskontrolle is a required TOM — a missing `tenant_id` filter is a compliance failure, not just a bug.)
- **Response minimization.** Return only entitled fields — no `SELECT *` / full-object serialization leaking PII "because the model has it" (Art. 25(2)).
- **Property-level authz (BOPLA / mass assignment).** Reject `role` / `user_id` / `tenant_id` / `is_admin` from the request body; explicit field allow-list, never whole-body binding.
- **Role/field-level output filtering (vertical BOPLA).** *Which* fields a principal receives depends on role + business rules — a driver role must not receive `price`; an office role must not receive the boss's `offer`. Serialize via a **role-scoped output DTO**, never the raw model / `to_json()`; sensitive fields (`price`/`cost`/`margin`/`salary`/`discount`/`offer`/internal notes) default-deny per role.
- **No guessable public ids** on sensitive resources — UUID/ULID, not sequential integers (turns one bug into full-DB enumeration).

## The three negative tests — the completion gate

A protected endpoint is **not complete** until these exist and pass (happy-path 200 alone is the tautology this rule stops):

1. **unauthenticated → 401** (no token).
2. **authenticated but not the owner → 403/404** (user A requests user B's object with A's token).
3. **cross-tenant → 403** (a principal in tenant A requests tenant B's resource).

Small + task-aligned gap in code you touched → add the check **and** its negative test in the same commit (auto-fix boundary in `active-remediation`). Bigger → surface it.

## Role-based field-level access — both directions (vertical BOPLA + BFLA)

Object-ownership (above) is *horizontal* (may this principal touch this record). This is *vertical*: which **fields** and which **functions** a role may reach — the maintainer's case (driver ≠ price, office worker ≠ boss's offer). Depends on role + business rules, and **the server is the only boundary** — the frontend hiding a field does not protect it: the raw JSON on the wire is readable via `curl`/DevTools/a proxy (3Fun leak: a privacy toggle filtered only in the app; the server returned every user's location to a direct query).

- **Read side (CWE-213 / Excessive Data Exposure).** Build the response from a **role-scoped output DTO** — never serialize the ORM model directly. Sensitive fields default-deny per role. A client `?fields=` selection is ergonomics, not authorization — intersect it server-side with the role's read-allowlist.
- **Write side (CWE-915).** Bind input through a **role-scoped write-allowlist** — never the raw body. Read-allowed ≠ write-allowed: a role may *see* `status` but not *set* `status:"approved"`; two independent sets.
- **Function level (BFLA, OWASP API #5).** A role must not reach a function/verb reserved for a higher role. Gate **every mutating verb** (POST/PUT/PATCH/DELETE), deny-by-default — not just the GET you were asked about. The admin button being hidden is not a control.
- **Nested / GraphQL.** Field-level checks propagate to nested selections; a low-role token selecting a restricted field gets null/error, not data.
- **Negative tests, per (role × sensitive field), both directions:** lower-role token → the field is **absent from the raw response body** (assert the body, not the UI); lower-role setting it on input → rejected/ignored, **verified by re-reading the persisted record**; every privileged verb → 403 for lower roles.

## Defense-in-depth (so one miss can't leak) → `authz-review`

Stack ≥2 independent layers on sensitive data: **query-level ownership scoping** (base scope injects the predicate) + a **centralized default-deny policy layer** (a route with no declared policy is denied, not silently open) + **DB row-level security** (Postgres RLS `FORCE ROW LEVEL SECURITY`, tenant var via `SET LOCAL`) as the backstop for a forgotten `WHERE tenant_id`. Depth + per-role authz matrix live in `authz-review`.

## GDPR / DSGVO — data protection by design

A cross-user leak violates **Art. 5(1)(f)** (integrity & confidentiality — a principle → higher fine tier), **Art. 25** (by design/default: default-deny + least privilege + response minimization), and **Art. 32** — which also **mandates a process for regularly testing effectiveness** of these controls (untested authz is a direct Art. 32 gap; hence the three negative tests are non-optional). A discovered live exposure is a **notifiable breach** (Art. 33, 72 h from discovery) — surface as "notify + remediate", never a silent patch. Data-protection context, not legal advice → `privacy-review`, `domain-safety-pii`.

## Backstop greps (authoring-time)

```bash
# Record fetched by request id with no owner/tenant predicate nearby
rg -n '(findById|find|findOne|get)\(\s*(req\.|request\.|params\.|\$request|\$id)' src/
# Client-supplied tenant/user hint used as the scope (should come from the session)
rg -n '(tenant|tenantId|user_id|userId)\s*=\s*(req|request|params|headers|query)\.' src/
# Whole-body binding (mass assignment) + sequential-id exposure
rg -n 'create\(\s*(req\.body|request\.all\(\)|params)\s*\)|update\(\s*(req\.body|request\.all\(\))' src/
# Raw model serialization into a response (no role-scoped DTO) — field-level over-exposure
rg -n 'return\s+\$?\w+->toArray\(\)|res\.json\(\s*\w+\s*\)|return\s+model_to_dict|\.to_json\(\)|JsonResponse\(\s*\w+\.__dict__' src/
```

A hit means read that line — is the ownership/tenant check present? Some are safe (already scoped); none should ship unchecked.

## When it fires

Writing/modifying any endpoint, route, query, or serializer returning user- or tenant-owned data, or any auth/session/login/tenant path.

## When NOT to fire

- Public, non-user-specific data with no principal concept (public docs page, health check with no data).
- Prose/docs/config-only edits.

## See also

- [`authz-review`](../skills/authz-review/SKILL.md) — the 6-stage per-entrypoint chain, defense-in-depth, authz matrix, negative-test contract.
- [`security-sensitive-stop`](security-sensitive-stop.md) — threat-model BEFORE editing an auth/tenant path (fires first).
- [`active-remediation`](active-remediation.md) — the fix-now/ask/follow-up ladder + the live-exposure safety carve-out.
- [`threat-modeling`](../skills/threat-modeling/SKILL.md), [`multi-tenancy`](../skills/multi-tenancy/SKILL.md), [`ai-code-blindspots`](../skills/ai-code-blindspots/SKILL.md), [`privacy-review`](../skills/privacy-review/SKILL.md).
