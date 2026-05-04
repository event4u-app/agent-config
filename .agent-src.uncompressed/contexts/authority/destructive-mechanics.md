# Destructive-Operation Mechanics

Loaded by [`non-destructive-by-default`](../../rules/non-destructive-by-default.md).
Holds the bulk-deletion-during-WIP scope rule and the failure-mode
catalog. The rule keeps the Iron Law, the trigger table, the
deterministic-regeneration carve-out, and the cloud clause; this
context holds everything an agent reaches for once those have fired.

**Size budget:** ≤ 3,500 chars. Tracked under Phase 7.4 of
`road-to-pr-34-followups`.

## Bulk deletions during WIP — allowed if task-connected

Deletions inside an **active, user-stated task** are allowed in the
working tree, **even multiple files or multiple folders**. The Hard
Floor moves to the **commit** (row 6 of the trigger table), not the
in-progress edit.

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
authorizes the *commit* (row 6 of the rule's trigger table). Surface
the diff (paths + counts), get confirmation, then commit.

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
  surfacing the diff first — even when [`commit-policy`](../../rules/commit-policy.md)
  otherwise authorizes commits (e.g. `/commit:in-chunks`, roadmap
  pre-scan, an explicit "commit this now"). Bulk-deletion / infra
  commits need their own ask, every time.
- Reading a roadmap step listing files to delete as authorization to
  *commit* the deletion. The step authorizes the *edit*; the commit
  is row 6 of the Hard Floor and needs its own confirmation.
