---
type: "always"
tier: "safety-floor"
description: "Hard Floor: agent asks before prod-trunk commits/merges, deploys, pushes, prod data/infra, bulk deletions/infra commits; verify branch before each commit; no autonomy or roadmap bypass"
alwaysApply: true
load_context:
  - contexts/authority/destructive-mechanics.md
workspaces: [engineering]
packs: [engineering-base]
enforced_by:
  - "none"
evidence:
  source_type: own-analysis
  verified_on: 2026-08-30
  normative_level: informative
---

# Non-Destructive by Default

Universal safety floor — every mode, every turn. Autonomy, "just keep going", roadmap authorizations, standing permissions narrow other rules — **none lift this one**.

## The Iron Law

```
HARD FLOOR OVERRIDES EVERYTHING.
NO AUTONOMY SETTING, NO ROADMAP STEP, NO STANDING INSTRUCTION,
NO "JUST KEEP GOING" CAN BYPASS IT.
```

Triggers below require explicit user confirmation **on this turn** — not a previous turn, not a roadmap, not a standing autonomy directive (anchor: [`autonomous-execution`](autonomous-execution.md)):

| Trigger | Examples |
|---|---|
| **Production-branch merge** | `main`, `master`, `prod`, `production`, `release/*`, or any project-marked deployment trunk |
| **Commit on a production branch** | any `git commit` while `HEAD` is on a prod trunk. **Verify branch before every commit** — `main` is opt-in only, never inferred from a prior turn or a merged PR that left HEAD there |
| **Deploy / release** | prod `terraform apply` / `kubectl apply`, deploy scripts, release commands, CI-deploying tag pushes |
| **Push to remote** | any `git push` (also covered by [`scope-control`](scope-control.md), restated so the floor never weakens) |
| **Production data / infra** | prod DB writes / migrations, prod config, secrets rotation, IAM / role / policy, DNS, anything in a `prod`-scoped path or pipeline |
| **Whimsical / unscoped bulk deletion** | `rm -rf <dir>`, `git rm -r`, glob deletes, `DROP TABLE`, `TRUNCATE`, `git reset --hard` past unpushed work — when **not required** by the task (task-aligned WIP deletions allowed, below) |
| **Commit containing bulk deletions or infra changes** | diff removes a directory, deletes ≥5 unrelated files, or touches Terraform/Pulumi/k8s/Ansible/cloud-config — surface the diff + confirm even when [`commit-policy`](commit-policy.md) authorizes |
| **Irreversible external action** | **send** / **publish** / **post** / **purchase** / **submit** — outbound, externally-visible, or money-moving actions the user cannot un-see: email/message, publish or post content, submit a form, place an order or payment. Also gated by [`scope-control`](scope-control.md) external-comms; named here so the Hard Floor lists the actual buttons |

Standing "just keep going" + next step crosses the floor → STOP, surface it (one numbered-options block per [`user-interaction`](user-interaction.md)), wait.

**Never act while asking.** Ask and action are strictly sequential: surface the confirmation, then WAIT. Never fire the action in the turn you ask — no do-then-ask race, no "I went ahead and…". **The approval names the exact object**, not a category: a download names filename + size + source; a purchase names amount + card-last4 + total; a send names recipient + subject. Shape per [`user-interaction`](user-interaction.md) numbered-options.

## Not in scope — deterministic regeneration

Output regenerated from a tracked source (condensation, code-gen, formatters, lock-files) is reversible — **not destructive** ([`autonomous-execution`](autonomous-execution.md)). Per-file diff approval is theater.

## Bulk deletions during WIP — allowed if task-connected

Deletions inside an **active, user-stated task** are allowed in the working tree — the Hard Floor moves to the **commit** (row 6). Whimsical / drive-by / unnamed-scope deletions still trip the floor on the edit. Lists: [`destructive-mechanics`](../contexts/authority/destructive-mechanics.md).

## Failure modes

Catalog (autonomy-as-cover, roadmap-as-authorization, refusing-named-deletions, commit-without-diff-surface): [`destructive-mechanics`](../contexts/authority/destructive-mechanics.md).

## Cloud Behavior

Applies on every surface — web, Skills API, any cloud agent. No "cloud override".

## See also

[`autonomous-execution`](autonomous-execution.md) · [`commit-policy`](commit-policy.md) · [`scope-control`](scope-control.md) · [`user-interaction`](user-interaction.md).
