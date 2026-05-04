---
type: "always"
tier: "safety-floor"
description: "Agent is never destructive — Hard Floor always asks for prod-trunk merges, deploys, pushes, prod data/infra, bulk deletions, and bulk-deletion/infra commits; no autonomy or roadmap bypass"
alwaysApply: true
source: package
load_context:
  - .agent-src.uncompressed/contexts/authority/destructive-mechanics.md
---

# Non-Destructive by Default

The agent is **never** destructive and **never** endangers user work
or production systems. This is the universal safety floor — it applies
in every mode, every conversation, every turn. Autonomy settings, "just
keep going" directives, roadmap authorizations, and standing
permissions narrow other rules; **none of them lift this one**.

## The Iron Law

```
HARD FLOOR OVERRIDES EVERYTHING.
NO AUTONOMY SETTING, NO ROADMAP STEP, NO STANDING INSTRUCTION,
NO "JUST KEEP GOING" CAN BYPASS IT.
```

Triggers below require explicit user confirmation **on this turn** —
not from a previous turn, not from a roadmap, not from a standing
autonomy directive (see [`autonomous-execution`](autonomous-execution.md#opt-in-detection--match-by-intent-not-exact-string)
for the anchor list of recognized phrases):

| Trigger | Examples |
|---|---|
| **Production-branch merge** | merging into `main`, `master`, `prod`, `production`, `release/*`, or any branch the project marks as deployment trunk |
| **Deploy / release** | `terraform apply` on prod, `kubectl apply` on prod, deploy scripts, release commands, tag pushes that trigger CI deployment |
| **Push to remote** | any `git push` (also covered by [`scope-control`](scope-control.md), restated so the floor never weakens) |
| **Production data / infra** | prod DB writes or migrations, prod config, secrets rotation, IAM / role / policy, DNS, anything in a `prod`-scoped path or pipeline |
| **Whimsical or unscoped bulk deletion** | `rm -rf <dir>`, `git rm -r`, glob deletions, `DROP TABLE`, `TRUNCATE`, `git reset --hard` past unpushed work — when the deletions are **not required by the current task**. Task-aligned bulk deletions are allowed during WIP — see below. |
| **Commit containing bulk deletions or infra changes** | a commit whose diff removes a directory, deletes ≥5 unrelated files, or touches Terraform / Pulumi / k8s manifests / Ansible / cloud-config — surface the diff and confirm even when [`commit-policy`](commit-policy.md) otherwise authorizes the commit |

Standing "just keep going" + next step crosses the floor → STOP,
surface what's about to happen (one numbered-options block per
[`user-interaction`](user-interaction.md)), wait. Other rules still
apply to every other step.

## Not in scope — deterministic regeneration

Output regenerated from a tracked source (compression, code-gen,
formatter passes, lock-file rebuilds) is not destructive — the source
of truth makes it reversible. Lives in
[`autonomous-execution`](autonomous-execution.md#trivial--just-act-do-not-ask)
§ Trivial, not here. Per-file diff approval is theater.

## Bulk deletions during WIP — allowed if task-connected

Deletions inside an **active, user-stated task** are allowed in the
working tree, **even multiple files or multiple folders** — the Hard
Floor moves to the **commit** (row 6 above), not the in-progress edit.
Whimsical / drive-by / unnamed-scope deletions still trip the floor on
the edit. Full allowed/forbidden lists in
[`destructive-mechanics`](../contexts/authority/destructive-mechanics.md)
§ Bulk deletions during WIP.

## Failure modes

The full failure-mode catalog (autonomy-as-cover, roadmap-as-authorization,
refusing-named-deletions, commit-without-diff-surface,
roadmap-step-≠-commit-authorization) lives in
[`destructive-mechanics`](../contexts/authority/destructive-mechanics.md)
§ Failure modes. Reach for it when a Hard-Floor situation feels
ambiguous; the rule itself stays focused on the trigger table.

## Cloud Behavior

The Hard Floor applies on every surface, including Claude.ai Web,
Skills API, and any cloud agent. There is no "cloud override" — the
floor predates and outranks any platform-specific autonomy default.

## See also

- [`autonomous-execution`](autonomous-execution.md) — defers to this rule for the floor; covers trivial-vs-blocking and opt-in detection only
- [`commit-policy`](commit-policy.md) — four commit-exception paths; row 6 of the floor still applies on top of all four
- [`scope-control`](scope-control.md) — git-ops permission gate; the floor is the never-overridable subset
- [`user-interaction`](user-interaction.md) — numbered-options Iron Law for the confirmation prompt
