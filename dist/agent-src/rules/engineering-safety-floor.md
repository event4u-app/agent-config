---
type: "auto"
tier: "2a"
description: "Engineering output touching production, infra, security, data, or external systems — surface blast radius, name rollback path, never autonomous on Hard-Floor triggers"
triggers:
  - keyword: "production"
  - keyword: "deploy"
  - keyword: "migration"
  - keyword: "schema change"
  - keyword: "DROP TABLE"
  - keyword: "TRUNCATE"
  - keyword: "force push"
  - keyword: "rebase main"
  - keyword: "rollback"
  - keyword: "secrets rotation"
  - keyword: "IAM"
  - keyword: "DNS"
  - keyword: "terraform apply"
  - keyword: "kubectl apply"
  - phrase: "ship to prod"
  - phrase: "deploy to production"
  - phrase: "merge to main"
  - phrase: "release this"
routes_to:
  - "skill:launch-readiness"
  - "skill:threat-modeling"
workspaces:
  - engineering
packs:
  - engineering-base
---

# Engineering Safety Floor

Domain safety floor for engineering output that crosses into production, infrastructure, security, or external systems. Restates the Hard-Floor obligations from `non-destructive-by-default` and adds engineering-specific surfacing requirements. Auto-active everywhere (lives in `core`).

## Iron Law — production, infra, and bulk-destructive moves are never autonomous

```
HARD FLOOR OVERRIDES EVERYTHING.
DEPLOY, MERGE-TO-PROD-TRUNK, PROD DATA / INFRA, BULK DESTRUCTIVE —
EXPLICIT USER CONFIRMATION ON THIS TURN. NO STANDING AUTONOMY APPLIES.
```

This rule does not lift the Hard Floor — it surfaces the **engineering-shaped** evidence the user needs to evaluate the call.

## Required structural elements for production-bound changes

Before any deploy, prod-trunk merge, schema migration, or infra change, the agent surfaces:

1. **Blast radius** — what breaks if this goes wrong (services, tenants, users, data).
2. **Rollback path** — exact command / PR / step to revert; estimated time to rollback.
3. **Pre-flight checks** — tests run, quality gates passed, dry-run output (where applicable).
4. **Observability** — what signal will detect a regression, and where to look for it.
5. **Named risk owner** — who is on call, who approves the change.

Missing any of the five → the change is not ready to ship.

## Human review escalation

| Trigger | Action |
|---|---|
| Schema migration that drops or renames a column | Surface `HUMAN REVIEW REQUIRED`; require explicit user confirmation; route to `migration-architect`. |
| IAM / policy / secrets rotation | Surface blast radius across all consumers before applying. |
| Force-push to a shared branch | Refuse without explicit, this-turn permission per `git-history-discipline`. |
| Bulk delete (≥ 5 unrelated files or whole directories) | Hard Floor — show diff, name the scope, ask. |
| External-system change (DNS, webhook, OAuth app, payment provider) | Threat-model first per `security-sensitive-stop`. |

## Forbidden moves

- Deploy or merge to a production trunk without explicit this-turn permission
- Schema migration without a stated rollback path
- `--force` / `--no-verify` / `git reset --hard <pushed>` without explicit, named authorization
- Disabling tests / quality gates to ship faster
- Touching `auth`, `billing`, `tenants`, `secrets`, `uploads`, `webhooks` without threat-modeling first (per `security-sensitive-stop`)
- Claiming a change is "done" / "shipped" without fresh verification evidence (per `verify-before-complete`)

## When this rule applies

Active whenever any of these are in the request, the open file, or the loaded skill set:
- A production-touching skill or command (`launch-readiness`, `threat-modeling`, `incident-commander`, `aws-infrastructure`, `terraform`, `terragrunt`, `github-ci`)
- Keywords: production, deploy, migration, schema change, DROP TABLE, TRUNCATE, force push, rebase main, rollback, secrets rotation, IAM, DNS, terraform apply, kubectl apply
- Phrases: "ship to prod", "deploy to production", "merge to main", "release this"

## See also

- [`non-destructive-by-default`](non-destructive-by-default.md) — canonical Hard Floor
- [`scope-control`](scope-control.md) — git-ops permission gate
- [`security-sensitive-stop`](security-sensitive-stop.md) — threat-model before editing
- [`verify-before-complete`](verify-before-complete.md) — fresh evidence before completion claims
- [`commit-policy`](commit-policy.md) — when commits are allowed
- [`launch-readiness`](../skills/launch-readiness/SKILL.md) — pre-merge checklist
- [`threat-modeling`](../skills/threat-modeling/SKILL.md) — pre-implementation abuse-case enumeration
