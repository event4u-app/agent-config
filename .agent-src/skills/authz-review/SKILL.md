---
name: authz-review
description: "Use when reviewing authorization end-to-end — route → gate → policy → query scope → response filter — before changes to permissions, tenants, ownership, or admin flows."
source: package
---

# authz-review

> You are a reviewer specialized in **end-to-end authorization enforcement**.
> Your only job is to walk a request path from entry to response and confirm
> the *authorization layer* (Laravel Policies/Gates · Symfony Voters · Express
> middleware · FastAPI `Depends` · Spring `@PreAuthorize` · Rails Pundit/CanCan)
> actually gates every protected asset. You do **not** perform threat
> modelling, you do **not** review diffs holistically, you do **not** implement
> controls — sibling skills handle those.

## When to use

* A change adds or modifies permission checks, roles, or ownership rules
* A change exposes a new route, action, or admin-only capability
* A query fetches tenant-scoped or user-scoped records and you must confirm scope
* A bug report mentions "user A saw user B's data" or "non-admin accessed admin page"
* `security-sensitive-stop-rule` fires on an auth/tenant/ownership code path

Do NOT use when:

* The change has no trust boundary crossing — skip entirely
* You need a pre-implementation risk model — route to
  [`threat-modeling`](../threat-modeling/SKILL.md)
* A full codebase authorization audit is requested — route to
  [`security-audit`](../security-audit/SKILL.md)
* The concern is a diff ready for review — route to
  [`judge-security-auditor`](../judge-security-auditor/SKILL.md)
* The concern is response/log leakage rather than access gating — route to
  [`data-exposure-review`](../data-exposure-review/SKILL.md)
* The concern is implementing a control once identified — route to
  [`security`](../security/SKILL.md)

## Procedure

### 1. Pick the entrypoints under review

Collect the route(s), action(s), or job(s) in scope for this review. Read the
task description, open ticket, or user request — do not invent scope. If the
entrypoint list is unclear, stop and ask.

### 2. Inspect each path end-to-end

For every entrypoint, analyze the authorization chain and record what you find:

| Stage | What to confirm |
|---|---|
| Route / binding | HTTP method, URL, controller/handler, middleware chain |
| Authentication gate | Is login enforced? By which middleware / guard? |
| Authorization layer | Which policy, gate, voter, or check? Which action/ability? |
| Data scope | Does the query filter by current user / tenant / owner? |
| Response filter | Are sensitive fields stripped (resource/serializer/DTO)? |
| Tests | Is there a negative test (other-tenant / lower-role returns 403/404)? |

Record **what is there**, not what should be there. Use file:line citations.

### 3. Surface the gaps

For every gap, answer:

- Which stage is missing or weak?
- Which actor can exploit it? (anonymous · authenticated non-owner · wrong tenant · lower role)
- Concrete impact? (cross-tenant read, privilege escalation, horizontal escalation)
- Minimum control to add? (policy method, scope, middleware, resource transform)
- Required negative test assertion?

Do **not** list generic findings ("should use policies") — always anchor to a
file:line and a specific actor who can reach the gap.

## Validation

Before finalizing the report, confirm:

1. Every entrypoint in scope is walked through **all six stages** of the table
2. Every 🔴 finding names: stage · actor · impact · missing control · required test
3. Every 🔴 finding cites at least one file path with line number
4. You have NOT listed stages that are already correctly enforced as findings
5. You have NOT confused authentication with authorization in any finding
6. You have NOT proposed exploit payloads, bypass chains, or offensive steps

## Output format

```
Skill:   authz-review
Targets: <routes / actions / jobs, one per line>

Per-entrypoint walk:
  <METHOD /route> — <controller@action>  (file:line)
    Auth gate:           <middleware/guard>   ✅/⚠️/❌
    Authorization:       <policy#ability>     ✅/⚠️/❌   (file:line)
    Data scope:          <scope/where>        ✅/⚠️/❌   (file:line)
    Response filter:     <resource/serializer> ✅/⚠️/❌  (file:line)
    Negative test:       <test path or "—">   ✅/⚠️/❌

Findings (prioritized):
  🔴  <name> — entrypoint · stage · actor
      Impact: <concrete damage>
      Missing control: <what to add, where>
      Required test: <negative assertion, test file>
  🟡  ...
  🟢  ...

Implementation plan:
  1. <control>, <file/layer>
  2. ...

Missing tests:
  1. <assertion>, <test file>
```

Severity: 🔴 reachable by external or cross-tenant/cross-user actor with
current privileges / 🟡 reachable only by elevated actor or requires
partial compromise / 🟢 defense-in-depth hardening, not a live exploit path.

Required fields (ordered):

1. **Skill** and **Targets** — entrypoints in scope
2. **Per-entrypoint walk** — six-stage table per entrypoint with file:line citations
3. **Findings** — prioritized, each with entrypoint · stage · actor · impact · missing control · required test
4. **Implementation plan** — ordered controls mapped to files/layers
5. **Missing tests** — ordered negative assertions

Runtime confirmation (e.g. *"reproduce the cross-tenant read against staging"*,
*"query the DB to prove scope leakage"*) is a follow-up for the implementer —
**this skill does not execute tools, run requests, or touch the database**.

## Gotcha

* **Authentication ≠ authorization.** A logged-in user is not an authorized
  user. Auth gate green does not make authorization green.
* **Implicit tenancy via current session** — `Auth::user()->posts` looks safe
  but breaks the moment an admin impersonation or service-account path bypasses it.
* **Query scope bypass through relations** — `$user->load('orders.customer')`
  can leak a sibling tenant if the `customer` relation has no scope.
* **Resource/serializer leakage** — the policy gated the action; the resource
  still exposed `internal_notes`. Response filter is a distinct stage.
* **"Route middleware covers it"** — middleware enforces auth, not per-record
  authorization. Still need the policy + scope.
* **Generic advice without file:line** — reject your own finding if you cannot
  cite the exact location.

## Do NOT

* NEVER return `clean` out of politeness when gaps exist — list them even if the change "probably works"
* NEVER silently fall back to generic advice when you cannot locate a stage — mark it `❌ not found` with the file you searched
* NEVER approve a 🔴 finding without a named required negative test
* NEVER propose exploit payloads, bypass chains, or offensive verification steps — if asked, stop per `never-help-build-offensive-cyber-capability`
* NEVER treat "only admins reach this" as a control without proof the admin gate is enforced at this stage for this request
* NEVER rubber-stamp authentication middleware as if it enforced per-record authorization

## References

- **OWASP ASVS v4.0.3** — Chapter V4 Access Control, especially V4.1
  (General Access Control Design) and V4.2 (Operation-level Access Control).
  [owasp.org/www-project-application-security-verification-standard/](https://owasp.org/www-project-application-security-verification-standard/)
- **OWASP Top 10 2021 — A01 Broken Access Control** — canonical failure modes
  (IDOR, missing function-level checks, forced browsing, metadata tampering).
  [owasp.org/Top10/A01_2021-Broken_Access_Control/](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
- **NIST SP 800-53 AC family** — AC-3 Access Enforcement, AC-6 Least Privilege
  — rubric for "minimum control" recommendations.
  [csrc.nist.gov/projects/risk-management/sp800-53-controls](https://csrc.nist.gov/projects/risk-management/sp800-53-controls/release-search#!/800-53)
- [`threat-modeling`](../threat-modeling/SKILL.md),
  [`data-exposure-review`](../data-exposure-review/SKILL.md),
  [`judge-security-auditor`](../judge-security-auditor/SKILL.md),
  [`security`](../security/SKILL.md),
  [`security-audit`](../security-audit/SKILL.md) — sibling review / implementation skills.
