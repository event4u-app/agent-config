---
type: "always"
tier: "safety-floor"
description: "Hard Floor: agent asks before prod-trunk commits/merges, deploys, pushes, prod data/infra, bulk deletions/infra commits; verify branch before each commit; no autonomy or roadmap bypass"
alwaysApply: true
load_context:
  - contexts/authority/destructive-mechanics.md
workspaces:
  - engineering
packs:
  - engineering-base
---

# Non-Destructive by Default

Universal safety floor — every mode, every conversation, every turn. Autonomy, "just keep going", roadmap authorizations, standing permissions narrow other rules — **none lift this one**.

## The Iron Law

```
HARD FLOOR OVERRIDES EVERYTHING.
NO AUTONOMY SETTING, NO ROADMAP STEP, NO STANDING INSTRUCTION,
NO "JUST KEEP GOING" CAN BYPASS IT.
```

Triggers below require explicit user confirmation **on this turn** — not from a previous turn, not from a roadmap, not from a standing autonomy directive (anchor list: [`autonomous-execution`](autonomous-execution.md)):

| Trigger | Examples |
|---|---|
| **Production-branch merge** | `main`, `master`, `prod`, `production`, `release/*`, or any project-marked deployment trunk |
| **Commit on a production branch** | any `git commit` while `HEAD` is on a prod trunk (set above). **Verify branch before every commit** — `main` is opt-in only, never inferred from a prior turn or a merged PR that left the repo on `main` |
| **Deploy / release** | prod `terraform apply` / `kubectl apply`, deploy scripts, release commands, CI-deploying tag pushes |
| **Push to remote** | any `git push` (also covered by [`scope-control`](scope-control.md), restated so the floor never weakens) |
| **Production data / infra** | prod DB writes / migrations, prod config, secrets rotation, IAM / role / policy, DNS, anything in a `prod`-scoped path or pipeline |
| **Whimsical / unscoped bulk deletion** | `rm -rf <dir>`, `git rm -r`, glob deletions, `DROP TABLE`, `TRUNCATE`, `git reset --hard` past unpushed work — when **not required** by the current task. Task-aligned WIP deletions are allowed (below) |
| **Commit containing bulk deletions or infra changes** | diff removes a directory, deletes ≥5 unrelated files, or touches Terraform / Pulumi / k8s / Ansible / cloud-config — surface the diff and confirm even when [`commit-policy`](commit-policy.md) authorizes |

Standing "just keep going" + next step crosses the floor → STOP, surface what's about to happen (one numbered-options block per [`user-interaction`](user-interaction.md)), wait. Other rules still apply to every other step.

## Not in scope — deterministic regeneration

Output regenerated from a tracked source (condensation, code-gen, formatter passes, lock-file rebuilds) is reversible from source — **not destructive**. Lives in [`autonomous-execution`](autonomous-execution.md). Per-file diff approval is theater.

## Bulk deletions during WIP — allowed if task-connected

Deletions inside an **active, user-stated task** are allowed in the working tree, even multiple files / folders — the Hard Floor moves to the **commit** (row 6), not the in-progress edit. Whimsical / drive-by / unnamed-scope deletions still trip the floor on the edit. Allowed / forbidden lists: [`destructive-mechanics`](../contexts/authority/destructive-mechanics.md).

## Failure modes

Full catalog (autonomy-as-cover, roadmap-as-authorization, refusing-named-deletions, commit-without-diff-surface, roadmap-step ≠ commit-authorization): [`destructive-mechanics`](../contexts/authority/destructive-mechanics.md).

## Cloud Behavior

Floor applies on every surface — Claude.ai Web, Skills API, any cloud agent. No "cloud override".

## See also

[`autonomous-execution`](autonomous-execution.md) · [`commit-policy`](commit-policy.md) · [`scope-control`](scope-control.md) · [`user-interaction`](user-interaction.md).
