---
name: sync-gitignore
description: Sync the `event4u/agent-config` block in the consumer project's .gitignore — adds missing entries, preserves user-added lines, shows a diff before writing
disable-model-invocation: true
---

# /sync-gitignore

Ensures the consumer project's `.gitignore` contains every entry the
package expects to be ignored (symlinked `.augment/` subdirectories,
`/agent-config` CLI wrapper, `.agent-settings*`, `.agent-chat-history*`).
Canonical list lives in `config/gitignore-block.txt`; the same file
drives the installer, so the two cannot drift.

Use when:

- A fresh package version added new managed entries and the installer
  has not been re-run yet.
- The project's `.gitignore` never got the block (older install, manual
  setup, or installer ran with `--skip-gitignore`).
- You want to audit what the block **should** look like without writing.

## When NOT to use

- To disable logging or change what is logged → that is
  `chat_history.enabled` in `.agent-settings.yml`, not `.gitignore`.
- To delete the block entirely → do it by hand; the package will not
  re-remove its own entries.
- To change what the block contains → edit
  `config/gitignore-block.txt` in the package repo and re-release.

## Steps

### 1. Locate script and target

The sync script ships in the installed package. Resolve in order:

1. `./agent-config/scripts/sync_gitignore.py` — if the CLI wrapper
   directory exists at the project root.
2. `vendor/event4u/agent-config/scripts/sync_gitignore.py` — Composer.
3. `node_modules/@event4u/agent-config/scripts/sync_gitignore.py` — npm.

Target is always `<project_root>/.gitignore`. If no `.gitignore` exists,
stop and tell the user — the package does not create one unilaterally:

```
> 📝 No .gitignore found at <project_root>. Create one first (e.g. `touch .gitignore`), then re-run /sync-gitignore.
```

### 2. Dry-run — show the user what would change

Run the script with `--dry-run` and capture stdout. Three outcomes:

- **No changes** (exit 0, stdout says "already in sync") → tell the
  user and stop. No prompt needed.
  ```
  > ✅ .gitignore already in sync — nothing to do.
  ```
- **Additions only** (default append-only mode) → show the unified
  diff and ask:
  ```
  > 📝 /sync-gitignore would add {N} entr{y|ies} to .gitignore:
  >
  > {diff}
  >
  > 1. Apply — write the changes
  > 2. Skip — leave .gitignore untouched
  ```
- **Script error** (exit 2, e.g. template missing) → print the error
  and stop; do not prompt.

### 3. Act on the choice

- `1` (Apply) → re-run the script **without** `--dry-run`. Confirm:
  ```
  > ✅ .gitignore updated ({N} entries added).
  ```
- `2` (Skip) → stop. No changes made.

Free-text replies (`"nö"`, `"leave it"`, unrecognized input) count as
`2`. Never write on ambiguous input.

### 4. Offer `--replace` only when asked

Do **not** suggest `--replace` by default. It rewrites the block in
full and drops user-added lines inside the block — destructive.
Mention it only if the user explicitly asks to clean up or reset the
block, and confirm once more before running it.

## Gotchas

- The script honors the explicit `# event4u/agent-config — END` marker.
  Legacy blocks without it get the marker added automatically on the
  first sync — that is expected, not a bug.
- User-added lines **inside** the block survive append-only syncs.
  They do not survive `--replace`.
- Changes to `config/gitignore-block.txt` require a package update in
  the consumer project before this command can apply them.

## See also

- [`scripts/sync_gitignore.py`](../../../scripts/sync_gitignore.py) — the helper
- [`config/gitignore-block.txt`](../../../config/gitignore-block.txt) — canonical block body
- [`scripts/install.sh`](../../../scripts/install.sh) — installer integration (same source of truth, `--skip-gitignore` to opt out)
