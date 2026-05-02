---
type: "auto"
alwaysApply: false
description: "Security-sensitive code paths — authentication, authorization, billing, tenant boundaries, secrets, file uploads, external integrations, webhooks, public endpoints — stop and run threat analysis BEFORE editing"
source: package
---

# Security-Sensitive Stop Rule

Before editing any file that matches a security-sensitive surface, **stop and
run a threat analysis first**. Shipping a security-sensitive change without a
prior threat pass is the #1 driver of authorization and data-exposure bugs.

## What counts as security-sensitive

A file or planned change is security-sensitive when **any** of the following
is true:

| Surface | Examples |
|---|---|
| Authentication | login, session, token issuance, password reset, 2FA, SSO |
| Authorization | policies, gates, voters, middleware that gates actions, admin checks |
| Tenancy | tenant scope / `tenant_id` / row-level security / per-tenant keys |
| Billing / money | charge, refund, subscription, invoice, balance, credit |
| Secrets | API keys, tokens, signing keys, `.env`, vault, KMS, OAuth client secrets |
| File uploads | any endpoint that accepts user files or URLs for files |
| External integrations | outbound HTTP to third parties, webhooks, queue consumers from external sources |
| Public endpoints | any route with no auth gate (including health/status) |
| Data exposure | API resources, serializers, exception renderers, log channels, admin panels |

If the change touches any of these, the rule fires.

## What to do when it fires

STOP writing code. Run the matching analysis skill first:

| Change type | Analysis skill |
|---|---|
| New or modified permission / tenant check | `authz-review` |
| New feature touching any surface above | `threat-modeling` |
| Data flows to logs / API / external | `data-flow-mapper` |
| Wide refactor of security-sensitive code | `blast-radius-analyzer` |

**Before the analysis, consult memory for prior incidents** on this
surface. Via [`memory-access`](../../docs/guidelines/agent-infra/memory-access.md):

```python
from scripts.memory_lookup import retrieve
priors = retrieve(
    types=["incident-learnings", "historical-patterns"],
    keys=<touched file paths>,
    limit=3,
)
```

A prior security incident on the same path is the cheapest input to a
threat pass — cite any matching `id` so the required control or
regression test ships with the fix.

Capture the analysis output (abuse cases, missing controls, required
negative tests) — implement against that list, not your first instinct.
Never silently fall back to editing without the analysis; if blocked,
ask the user.

## When NOT to fire

Typo/comment-only edits · test-only edits without behavior change · automated
tooling output (lockfile, generated code) the user explicitly requested.
These still deserve review, but do not require a full threat pass.

## Rationale

Authorization and tenancy bugs are often invisible in logs and fire silently
until an auditor or attacker finds them. The cheapest moment to catch them
is before the first edit — this rule makes that the default path.

See also: `threat-modeling` · `authz-review` · `data-flow-mapper` · `minimal-safe-diff` · `think-before-action`.
