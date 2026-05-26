---
type: "always"
tier: "safety-floor"
description: "Agent is never destructive — Hard Floor always asks for prod-trunk merges, deploys, pushes, prod data/infra, bulk deletions, and bulk-deletion/infra commits; no autonomy or roadmap bypass"
alwaysApply: true
source: package
load_context:
  - contexts/authority/destructive-mechanics.md
workspaces:
  - engineering
packs:
  - engineering-base
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# Non-Destructive by Default

Universal safety floor. Applies in every mode, every conversation, every turn. Autonomy, "just keep going", roadmap authorizations, and standing permissions narrow other rules — **none lift this one**.

## The Iron Law

```
HARD FLOOR OVERRIDES EVERYTHING.
NO AUTONOMY SETTING, NO ROADMAP STEP, NO STANDING INSTRUCTION,
NO "JUST KEEP GOING" CAN BYPASS IT.
```

Triggers below require explicit user confirmation **on this turn** — not from a previous turn, not from a roadmap, not from a standing autonomy directive (anchor list: [`autonomous-execution § opt-in detection`](autonomous-execution.md#opt-in-detection--match-by-intent-not-exact-string)):

| Trigger | Examples |
|---|---|
| **Production-branch merge** | `main`, `master`, `prod`, `production`, `release/*`, or any branch the project marks as deployment trunk |
| **Deploy / release** | `terraform apply` on prod, `kubectl apply` on prod, deploy scripts, release commands, tag pushes that trigger CI deployment |
| **Push to remote** | any `git push` (also covered by [`scope-control`](scope-control.md), restated so the floor never weakens) |
| **Production data / infra** | prod DB writes / migrations, prod config, secrets rotation, IAM / role / policy, DNS, anything in a `prod`-scoped path or pipeline |
| **Whimsical / unscoped bulk deletion** | `rm -rf <dir>`, `git rm -r`, glob deletions, `DROP TABLE`, `TRUNCATE`, `git reset --hard` past unpushed work — when **not required** by the current task. Task-aligned WIP deletions are allowed (below) |
| **Commit containing bulk deletions or infra changes** | commit whose diff removes a directory, deletes ≥5 unrelated files, or touches Terraform / Pulumi / k8s manifests / Ansible / cloud-config — surface diff and confirm even when [`commit-policy`](commit-policy.md) otherwise authorizes |

Standing "just keep going" + next step crosses the floor → STOP, surface what's about to happen (one numbered-options block per [`user-interaction`](user-interaction.md)), wait. Other rules still apply to every other step.

## Not in scope — deterministic regeneration

Output regenerated from a tracked source (condensation, code-gen, formatter passes, lock-file rebuilds) is reversible from source — **not destructive**. Lives in [`autonomous-execution § Trivial`](autonomous-execution.md#trivial--just-act-do-not-ask). Per-file diff approval is theater.

## Bulk deletions during WIP — allowed if task-connected

Deletions inside an **active, user-stated task** are allowed in the working tree, even multiple files / folders — the Hard Floor moves to the **commit** (row 6), not the in-progress edit. Whimsical / drive-by / unnamed-scope deletions still trip the floor on the edit. Allowed / forbidden lists: [`destructive-mechanics § Bulk deletions during WIP`](../contexts/authority/destructive-mechanics.md).

## Failure modes

Full catalog (autonomy-as-cover, roadmap-as-authorization, refusing-named-deletions, commit-without-diff-surface, roadmap-step ≠ commit-authorization): [`destructive-mechanics § Failure modes`](../contexts/authority/destructive-mechanics.md).

## Cloud Behavior

Floor applies on every surface — Claude.ai Web, Skills API, any cloud agent. No "cloud override".

## See also

[`autonomous-execution`](autonomous-execution.md) · [`commit-policy`](commit-policy.md) · [`scope-control`](scope-control.md) · [`user-interaction`](user-interaction.md).
