---
type: "always"
description: "Agent is never destructive and never endangers production systems — Hard Floor that always asks for production-trunk merges, deploys, pushes, prod data/infra changes, whimsical bulk deletions, and commits containing bulk deletions or infra changes; no autonomy setting, roadmap step, or standing instruction can bypass it"
alwaysApply: true
source: package
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
working tree, **even multiple files or multiple folders**. The floor
moves to the **commit** (row 6 above), not the in-progress edit.

**Allowed during WIP (no floor on the edit):**

- A roadmap step or current task explicitly names the files / folders to remove
- Refactor naturally drops deprecated code the user already agreed is dead
- Cleanup of generated artifacts — `node_modules/`, `dist/`, `.next/`,
  build caches, `vendor/` reinstall — never source code
- Single-file edits, single-class refactors, deleting **one** file the
  user just named
- Renames and moves (technically delete + add)

**Floor fires on the edit when the deletion is:**

- Whimsical — "while I was in there", drive-by cleanup not part of the task
- Unnamed scope — "delete all the old tests" without a list, glob
  across unrelated files, "clean up the legacy folder" with no inventory
- ≥5 unrelated files in one operation, outside the current task scope
- Content destruction — `DROP TABLE`, `TRUNCATE`, `git reset --hard`
  past unpushed work, database wipes (destroys *content*, not just tree)

Ambiguous → floor wins. Ask.

**The commit of task-aligned bulk deletions still needs its own ask.**
A roadmap or task authorizes the *edit*; only the user-this-turn
authorizes the *commit* (row 6). Surface the diff (paths + counts), get
confirmation, then commit.

## Failure modes

- Treating a standing autonomy directive as cover for a Hard-Floor
  action. Standing autonomy never lifts the floor; merging to `main`,
  deploying, pushing, prod-data edits, or whimsical `rm -rf <dir>`
  always ask.
- Reading a roadmap step that says "deploy to staging" or
  "merge into main" as authorization. The roadmap can sequence the
  work; only the user-this-turn can authorize the floor crossing.
- Refusing to delete files the user already named because "the floor
  fires on `rm`". It does not — task-aligned WIP deletions are
  allowed, even multi-folder. The floor fires when the deletion is
  whimsical, unscoped, or about to be committed.
- Committing a diff that removes a directory, deletes ≥5 unrelated
  files, or touches Terraform / k8s manifests / Ansible without
  surfacing the diff first — even when [`commit-policy`](commit-policy.md)
  otherwise authorizes commits (e.g. `/commit-in-chunks`, roadmap
  pre-scan, an explicit "commit this now"). Bulk-deletion / infra
  commits need their own ask, every time.
- Reading a roadmap step listing files to delete as authorization to
  *commit* the deletion. The step authorizes the *edit*; the commit
  is row 6 of the Hard Floor and needs its own confirmation.

## Cloud Behavior

The Hard Floor applies on every surface, including Claude.ai Web,
Skills API, and any cloud agent. There is no "cloud override" — the
floor predates and outranks any platform-specific autonomy default.

## See also

- [`autonomous-execution`](autonomous-execution.md) — defers to this rule for the floor; covers trivial-vs-blocking and opt-in detection only
- [`commit-policy`](commit-policy.md) — four commit-exception paths; row 6 of the floor still applies on top of all four
- [`scope-control`](scope-control.md) — git-ops permission gate; the floor is the never-overridable subset
- [`user-interaction`](user-interaction.md) — numbered-options Iron Law for the confirmation prompt
