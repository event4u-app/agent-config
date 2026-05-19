---
name: sync-gitignore:fix
tier: 2
cluster: sync-gitignore
sub: fix
skills: [sync-gitignore]
description: Scrub legacy pre-`/agents/` patterns from the consumer's .gitignore (inside or outside the managed block) and re-sync the canonical entries
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "fix .gitignore garbage, clean up legacy agent-config entries, my .gitignore has stale agent entries, /sync-gitignore is not picking up the right paths"
  trigger_context: "consumer project carries pre-/agents/ runtime patterns (.agent-chat-history, .agent-prices.md) at the root from an older install"
---

# /sync-gitignore:fix

Cleanup sibling of [`/sync-gitignore`](../sync-gitignore.md). Strips
legacy root-level patterns (pre-`/agents/` runtime artefacts —
`.agent-chat-history`, `.agent-chat-history.bak`,
`.agent-chat-history.*.bak`, `.agent-prices.md`, `.council-tmp/`) from
**anywhere** in the consumer's `.gitignore` — inside or outside the
managed block — then re-runs the regular sync so the current canonical
`/agents/`-prefixed entries land in the block.

Use when:

- An older installer (pre-May 2026) dropped root-level `.agent-chat-history`
  / `.agent-prices.md` lines that the current scripts no longer recognise.
- A hand-edit added one of those legacy paths and it now conflicts with
  the managed `/agents/...` entry.
- `/sync-gitignore` reports "already in sync" but git is still ignoring
  files at the wrong paths.

## When NOT to use

- To remove **user-added** lines from inside the block → that is
  `--replace` on the base command, and it is destructive. This
  sub-command only touches the legacy pattern list — nothing else.
- To delete the entire managed block → do it by hand.
- To migrate runtime files themselves (move `.agent-chat-history` →
  `agents/.agent-chat-history`) → the installer's
  `migrate_legacy_root_infra` step handles that. This sub-command only
  fixes `.gitignore`.

## Steps

### 1. Locate script and target

Same resolution order as [`/sync-gitignore`](../sync-gitignore.md):

1. `./agent-config/scripts/sync_gitignore.py`
2. `vendor/event4u/agent-config/scripts/sync_gitignore.py`
3. `node_modules/@event4u/agent-config/scripts/sync_gitignore.py`

Target is `<project_root>/.gitignore`. If no `.gitignore` exists,
stop — there is nothing to fix:

```
> 📝 No .gitignore found at <project_root>. Nothing to clean up.
```

### 2. Dry-run with cleanup

Run:

```bash
python3 <script> --cleanup-legacy --dry-run
```

Capture stdout (unified diff) and stderr (summary line listing the
legacy entries that would be removed). Three outcomes:

- **Nothing legacy + block in sync** → tell the user and stop:
  ```
  > ✅ .gitignore already clean — no legacy patterns, block in sync.
  ```
- **Diff produced** → show it and ask:
  ```
  > 🧹 /sync-gitignore:fix would clean up .gitignore:
  >
  > {diff}
  >
  > Summary: would remove {N} legacy entr{y|ies}: {names}
  >          would add {M} entr{y|ies} to the managed block
  >
  > 1. Apply — write the changes
  > 2. Skip — leave .gitignore untouched
  ```
- **Script error** (exit 2) → print the error and stop; do not prompt.

### 3. Act on the choice

- `1` (Apply) → re-run **without** `--dry-run`:
  ```bash
  python3 <script> --cleanup-legacy
  ```
  Confirm with the script's own summary lines (removed-legacy count and
  added-entries count both surface there).
- `2` (Skip) → stop. No changes made.

Free-text replies (`"nö"`, `"leave it"`, unrecognized input) count as
`2`. Never write on ambiguous input.

### 4. Suggest the migration check (informational, do NOT auto-run)

If the cleanup removed `.agent-chat-history` or `.agent-prices.md`,
mention that the **file** at the root (if still present) may need to
move to `agents/`. The installer does this automatically via
[`migrate_legacy_root_infra`](../../../scripts/install.sh); the
agent does not run it from this command. One line of guidance is
enough:

```
> ℹ️  If `.agent-chat-history` still sits at the project root, re-run the installer (or move it to `agents/.agent-chat-history` by hand) so the runtime can find it again.
```

## Rules

- **Append-only by default** — `--cleanup-legacy` removes legacy
  patterns only. User-added non-legacy lines (inside or outside the
  block) survive untouched.
- **Never combine with `--replace`** — the destructive full-block
  rewrite is a separate concern; mixing the two surprises users.
- **Dry-run first, always** — the user must see the diff before any
  write.
- **Do NOT push, commit, or modify other files** — this command writes
  to `.gitignore` only.

## See also

- [`/sync-gitignore`](../sync-gitignore.md) — append-only sync of the
  managed block (no legacy cleanup)
- [`scripts/sync_gitignore.py`](../../../scripts/sync_gitignore.py) —
  the helper (`--cleanup-legacy` flag)
- [`scripts/install.sh`](../../../scripts/install.sh) —
  `migrate_legacy_root_infra` (moves the **files**, complement to this
  command which fixes the **ignore rules**)
