---
name: agents-cleanup
skills: [agent-docs-writing]
description: Execute cleanup actions from an agents-audit — move, merge, delete, and update agent docs
disable-model-invocation: true
suggestion:
  eligible: false
  rationale: "Consumes prior audit output; only meaningful right after /agents-audit."
---

# agents-cleanup

## Instructions

### 1. Check for audit roadmap

- Check if `agents/roadmaps/agents-cleanup.md` exists (created by `/agents-audit`).
- If yes → load it and show the phases.
- If no → ask:

```
⚠️  No audit roadmap found.

1. 🔍 Run /agents-audit first
2. 💬 I know what to do — start directly
```

**Recommendation: 1 — Run /agents-audit first** — without an audit roadmap, the cleanup is shooting in the dark. Caveat: pick 2 only if you already know exactly which docs to touch.

If option 2, ask what to clean up.

### 2. Show action plan

If a roadmap exists, display the phases:

```
═══════════════════════════════════════════════
  🧹 AGENTS CLEANUP
═══════════════════════════════════════════════

Phase 1: Critical fixes ({count} actions)
  - [ ] {action}
  - [ ] {action}

Phase 2: Structural cleanup ({count} actions)
  - [ ] {action}
  - [ ] {action}

Phase 3: Fill gaps ({count} actions)
  - [ ] {action}

Phase 4: Cleanup ({count} actions)
  - [ ] {action}

═══════════════════════════════════════════════

Which phase to work on?

1. Start Phase 1 (recommended — top to bottom)
2. Choose a specific phase
3. Choose a specific action
```

### 3. Execute actions

For each action, follow the appropriate workflow:

**Move file:**
```
📁 Move: {source} → {target}
Reason: {why}

Confirm? (y/n)
```
- Move the file.
- Update all references in other docs that link to the old path.
- Check `.augment/skills/` and `.augment/commands/` for references.

**Merge files:**
```
🔗 Merge:
  {file1} + {file2} → {target}
Reason: {why — what overlaps}

Confirm? (y/n)
```
- Read both files.
- Show the proposed merged content.
- Create the merged file, delete the originals.
- Update references.

**Delete file:**
```
🗑️  Delete: {file}
Reason: {why — what's obsolete}

Content (preview):
  {first 5 lines}

Confirm? (y/n)
```
- Delete the file.
- Check for and remove references in other docs.

**Update file:**
```
✏️  Update: {file}
Reason: {what's outdated}

Changes:
  - {reference to deleted class} → remove
  - {outdated section} → update
  - {missing info} → add

Confirm? (y/n)
```
- Read the file.
- Make the changes.
- Show a summary of what changed.

**Create context:**
```
📄 Create context: {area}
Reason: {why it's needed}

> 1. Yes — start /context-create
> 2. Skip
```
- Transition to `/context-create` with the area pre-selected.

### 4. Update roadmap progress

After each action:
- Mark the step as `[x]` in the roadmap file.
- Show progress:

```
✅  Action complete: {description}

Progress Phase {n}: [{completed}/{total}]
██████████░░░░░░ 60%

> 1. Continue with next action
> 2. Stop here
```

### 5. Summary

After completing a phase or all actions:

```
═══════════════════════════════════════════════
  ✅  CLEANUP SUMMARY
═══════════════════════════════════════════════

  📁 Moved:     {count} files
  🔗 Merged:    {count} files
  🗑️  Deleted:   {count} files
  ✏️  Updated:   {count} files
  📄 Created:   {count} contexts

  Remaining:        {count} actions in {phases} phases

═══════════════════════════════════════════════
```

### Rules

- **Do NOT commit or push.**
- **Always confirm before each destructive action** (delete, merge, move).
- **Always update references** when moving or renaming files.
- **Update the roadmap** after each completed action.
- **Show file content** before deleting — the user should see what's being removed.
- **Check `.augment/` references too** — skills and commands may link to agents docs.
