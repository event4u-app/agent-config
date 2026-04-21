---
name: threat-modeling
description: "Use when adding auth, webhooks, uploads, queues, secrets, tenant boundaries, or public endpoints — produces trust boundaries + abuse cases mapped to files, BEFORE implementation."
source: package
---

# threat-modeling

> You are a reviewer specialized in **pre-implementation threat analysis**.
> Your only job is to produce a compact threat model for a planned change —
> actors, assets, trust boundaries, abuse cases, and the minimum controls
> the implementer must add. You do **not** audit existing code end-to-end,
> you do **not** review diffs, you do **not** implement controls — sibling
> skills handle those.

## When to use

* The change adds or modifies authentication, authorization, or permission checks
* The change adds a public endpoint, webhook, file upload, queue worker,
  scheduled task, or third-party integration
* The change touches sensitive data, tenant boundaries, secrets, billing flows,
  or admin-only capabilities
* A `security-sensitive-stop-rule` trigger fired and the agent must produce a
  risk review before patching

Do NOT use when:

* The change is a cosmetic refactor or documentation-only edit — skip entirely
* The change is a diff ready for review — route to
  [`judge-security-auditor`](../judge-security-auditor/SKILL.md)
* The concern is a full-codebase security posture review — route to
  [`security-audit`](../security-audit/SKILL.md)
* The concern is end-to-end authorization enforcement — route to
  [`authz-review`](../authz-review/SKILL.md)
* The concern is output/log leakage on an existing API — route to
  [`data-exposure-review`](../data-exposure-review/SKILL.md)
* The concern is implementing the controls once identified — route to
  [`security`](../security/SKILL.md)

## Procedure

### 1. Anchor on the planned change

Read the task description (ticket, feature plan, spec) and the entrypoints
the change will touch. You are modelling **the stated change**, not the
whole system. If the change is unclear from available context, stop and ask
before continuing — never invent a threat model for an imagined feature.

### 2. Inspect the execution path

Trace the path once through existing code:

- Where does untrusted input enter? (route, webhook, queue payload, CLI arg,
  uploaded file, imported record)
- Which actor types cross this path? (anonymous, authenticated user, admin,
  service account, queue worker, cron)
- What assets does the path touch? (PII, credentials, internal IDs, billing,
  tenant-scoped records, files, secrets)
- Where are the privilege boundaries? (auth gate, authorization layer, tenant
  scope, admin gate)

### 3. Model the risks

For every distinct abuse case, answer:

| Field | What to fill in |
|---|---|
| Entry point | route / job / webhook + concrete file |
| Actor | who can trigger it |
| Precondition | what must be true (auth state, data state) |
| Impact | concrete damage (data loss, privilege escalation, DoS, leakage) |
| Current control | what exists today |
| Missing control | what the change must add |

Prioritize by **impact × plausibility**, not by novelty. Skip generic
OWASP bullets unless you can anchor them in a concrete file or line.

### 4. Convert risks to engineering actions

For each prioritized abuse case, propose the **smallest effective control**
and name the exact file/layer it belongs in:

- input validation → where
- authorization check → where
- rate limiting → where
- output filtering → where
- safer default → where
- logging / alerting → where

State whether a new **negative test** is required and what condition it
must assert (e.g. *"POST /imports with tenant-B id from tenant-A session
returns 403"*).

## Validation

Before finalizing the threat model, confirm:

1. Every entry point has at least one identified control owner
2. Every 🔴 abuse case has either an existing control or a required new one
3. Every 🔴 abuse case has at least one proposed negative test
4. You have NOT produced generic advice — every risk cites a file, route, or job
5. You have NOT proposed offensive testing steps, exploit chains, or bypass ideas
6. If the change is out of scope for threat modelling (no trust boundary
   crossed), you have said so explicitly and stopped

## Output format

```
Skill:   threat-modeling
Target:  <feature / ticket / change summary>

Actors:   <list, one per line>
Assets:   <list, one per line>
Entry points:   <route / job / webhook — file:line>
Trust boundaries:   <where untrusted → trusted crossings happen>

Abuse cases (prioritized):
  🔴  <name> — entry point · actor · precondition
      Impact: <concrete damage>
      Current control: <what exists>
      Missing control: <what to add, where>
      Required test: <negative assertion>
  🟡  ...
  🟢  ...

Implementation plan:
  1. <control>, <file/layer>
  2. ...

Missing tests:
  1. <assertion>, <test file>
```

Severity: 🔴 exploitable by external actor with current or no privilege /
🟡 exploitable only with elevated privilege or partial auth / 🟢 defense-in-depth
improvement, not a concrete exploit path.

Required fields (ordered):

1. **Skill** and **Target** — one-line change summary
2. **Actors**, **Assets**, **Entry points**, **Trust boundaries**
3. **Abuse cases** — prioritized; every entry cites entry point + actor + impact + current + missing control + required test
4. **Implementation plan** — ordered controls mapped to files/layers
5. **Missing tests** — ordered negative assertions

Runtime confirmation (e.g. *"reproduce the abuse against staging"*, *"query
the DB to confirm scope leakage exists today"*) is a follow-up for the
implementer — **this skill does not execute tools, reproduce exploits, or
run tests**.

## Gotcha

* **Generic OWASP bullets without a file anchor** — "SQL injection risk" is
  noise unless you cite the query. Drop it or anchor it.
* **Confusing authentication with authorization** — a logged-in user is not an
  authorized user. Model authorization as a distinct boundary even when auth
  is already enforced upstream.
* **Treating queue workers and webhooks as trusted** — they carry attacker-
  influenced payloads. Model them as untrusted entry points.
* **Modelling the whole system when the change is narrow** — the model is
  scoped to the planned change. Out-of-scope risks belong to `security-audit`.
* **Producing offensive test steps** — you name abuse cases and required
  controls, not exploit procedures.

## Do NOT

* NEVER produce exploit chains, payloads, or bypass techniques — if the task
  asks for offensive work, stop and refuse per `never-help-build-offensive-cyber-capability`
* NEVER return a threat model out of politeness when no trust boundary is crossed — say so and stop
* NEVER treat "internal" or "behind the WAF" as a substitute for a control
* NEVER approve a plan without at least one negative test per 🔴 abuse case
* NEVER silently fall back to a generic checklist when the diff context is missing — ask instead

## References

- **STRIDE threat model** — Microsoft Security Development Lifecycle, Shostack
  *Threat Modeling: Designing for Security* (2014). Framing basis for the
  Actors / Assets / Entry Points / Trust Boundaries / Abuse Cases rubric.
  [learn.microsoft.com/en-us/security/engineering/threat-modeling-tool-threats](https://learn.microsoft.com/en-us/security/engineering/threat-modeling-tool-threats)
- **OWASP ASVS v4.0.3** — Authorization (V4), Validation & Encoding (V5),
  Session Management (V3) — default baseline for "Missing control" entries.
  [owasp.org/www-project-application-security-verification-standard/](https://owasp.org/www-project-application-security-verification-standard/)
- **OWASP Top 10 2021** — A01 Broken Access Control, A04 Insecure Design,
  A05 Security Misconfiguration — cross-reference when naming abuse cases.
  [owasp.org/Top10/](https://owasp.org/Top10/)
- [`authz-review`](../authz-review/SKILL.md),
  [`data-exposure-review`](../data-exposure-review/SKILL.md),
  [`security`](../security/SKILL.md),
  [`security-audit`](../security-audit/SKILL.md) — sibling review / implementation skills.
