---
model_tier: medium
name: sync-gitignore-fix
pack: engineering-base
tier: 2
visibility: internal
cluster: sync-gitignore
sub: fix
skills: [sync-gitignore]
description: Scrub legacy pre-`/agents/` patterns from the consumer's .gitignore (inside or outside the managed block) and re-sync the canonical entries
suggestion:
  eligible: true
  trigger_description: "fix .gitignore garbage, clean up legacy agent-config entries, my .gitignore has stale agent entries, /sync-gitignore is not picking up the right paths"
  trigger_context: "consumer project carries pre-/agents/ runtime patterns (.agent-chat-history, .agent-prices.md) at the root from an older install"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /sync-gitignore:fix

Cleanup sibling of [`/sync-gitignore`](../sync-gitignore.md). Strips
legacy patterns (pre-`/agents/` runtime artefacts —
`.agent-chat-history`, `.agent-chat-history.bak`,
`.agent-chat-history.*.bak`, `.agent-prices.md`, `.council-tmp/` —
plus the 2.x intermediate `agents/runtime/.agent-prices.md`) from **anywhere**
in the consumer's `.gitignore` — inside or outside the managed block —
then re-runs the regular sync so the current canonical entries
(`/agents/runtime/` catch-all, plus the legacy back-compat lines
`/agents/.agent-chat-history*`) land in the block.

Use when:

- An older installer (pre-May 2026) dropped root-level `.agent-chat-history`
  / `.agent-prices.md` lines that the current scripts no longer recognise.
- A 2.x install left `/agents/runtime/.agent-prices.md` in the block before the
  cache moved under `/agents/runtime/`.
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
  `agents/runtime/.agent-chat-history`) → the installer's
  `migrate_legacy_root_infra` step handles that. This sub-command only
  fixes `.gitignore`.

## Steps

### 1. Locate script and target

Same resolution order as [`/sync-gitignore`](../sync-gitignore.md):

1. `./agent-config/scripts/sync_gitignore.ts`
2. `vendor/event4u/agent-config/scripts/sync_gitignore.ts`
3. `node_modules/@event4u/agent-config/scripts/sync_gitignore.ts`

Target is `<project_root>/.gitignore`. If no `.gitignore` exists,
stop — there is nothing to fix:

```
> 📝 No .gitignore found at <project_root>. Nothing to clean up.
```

### 2. Dry-run with cleanup

Run:

```bash
./scripts-run <script> --cleanup-legacy --dry-run
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
  ./scripts-run <script> --cleanup-legacy
  ```
  Confirm with the script's own summary lines (removed-legacy count and
  added-entries count both surface there).
- `2` (Skip) → stop. No changes made.

Free-text replies (`"nö"`, `"leave it"`, unrecognized input) count as
`2`. Never write on ambiguous input.

### 4. Suggest the migration check (informational, do NOT auto-run)

If the cleanup removed `.agent-chat-history` or any flavour of
`.agent-prices.md`, mention that the **file** itself (if still present
at its old location) may need to move. The installer does this
automatically via
[`migrate_legacy_root_infra`](../../../scripts/install.sh) (chat-history,
root → `agents/`) and
[`migrate_legacy_prices_file`](../../../scripts/install.sh) (prices,
root or `agents/` → `agents/runtime/`); the agent does not run them
from this command. One line of guidance is enough:

```
> ℹ️  If `.agent-chat-history` still sits at the project root, or `.agent-prices.md` still sits at the project root or under `agents/`, re-run the installer so the runtime can find them again.
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

### 5. Ignored-but-tracked detection pass

After the legacy-cleanup sync, run the tracked-but-ignored check
and surface any files that are now in the ignore list but still committed:

```bash
npx tsx node_modules/@event4u/agent-config/src/scripts/check_tracked_but_ignored.ts
```

If files are reported:

```
> ⚠️  The following files are tracked by git but now covered by an ignore
> pattern. They will appear in every `git status` until untracked.
>
> To remove them from the index (files stay on disk):
>
>   git rm --cached \
>     <file1> \
>     <file2>
>
> Then commit the result. This is a one-time cleanup.
```

Do NOT run `git rm --cached` automatically — git-ops are user-owned.

### 6. Agent artefacts not covered by the managed block

Scan for known agent-artefact shapes that are neither ignored nor
legitimately tracked. Use `agents-paths.yml` as the reference:

```bash
npx tsx node_modules/@event4u/agent-config/src/scripts/check_gitignore_freshness.ts
```

If the check fails, offer to re-sync the block with the current template:

```
> ⚠️  gitignore-block.txt has entries not yet in your .gitignore.
> Run option 1 to sync, or 2 to skip.
```

## See also

- [`/sync-gitignore`](../sync-gitignore.md) — append-only sync of the
  managed block (no legacy cleanup)
- [`scripts/sync_gitignore.ts`](../../../src/scripts/sync_gitignore.ts) —
  the helper (`--cleanup-legacy` flag)
- [`scripts/check_tracked_but_ignored.ts`](../../../src/scripts/check_tracked_but_ignored.ts) —
  ignored-but-tracked detection (Phase 5.2)
- [`scripts/check_gitignore_freshness.ts`](../../../src/scripts/check_gitignore_freshness.ts) —
  manifest vs block coverage check (Phase 3.4)
- [`docs/contracts/agents-layout.md`](../../../docs/contracts/agents-layout.md) —
  full classification contract for `agents/` entries
