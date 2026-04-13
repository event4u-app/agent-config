---
skills: [agent-docs]
description: Execute cleanup actions from an agents-audit — move, merge, delete, and update agent docs
---

# agents-cleanup

## Instructions

### 1. Check for audit roadmap

- Check if `agents/roadmaps/agents-cleanup.md` exists (created by `/agents-audit`).
- If yes → load it and show the phases.
- If no → ask:

```
⚠️  No audit roadmap found.

1. 🔍 Run /agents-audit first (recommended)
2. 💬 I know what to do — start directly
```

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

**Move:**
```
📁 Move: {source} → {target}
Reason: {why}

Confirm? (y/n)
```
Move + update all references.

**Merge:**
```
🔗 Merge:
  {file1} + {file2} → {target}
Reason: {why — what overlaps}

Confirm? (y/n)
```
Show merged content → confirm → create + delete originals + update refs.

**Delete:**
```
🗑️  Delete: {file}
Reason: {why — what's obsolete}

Content (preview):
  {first 5 lines}

Confirm? (y/n)
```
Delete + remove refs.

**Update:**
```
✏️  Update: {file}
Reason: {what's outdated}

Changes:
  - {reference to deleted class} → remove
  - {outdated section} → update
  - {missing info} → add

Confirm? (y/n)
```
**Create context:**
```
📄 Create context: {area}
Reason: {why it's needed}

> 1. Yes — start /context-create
> 2. Skip
```
### 4. Update roadmap progress

Per action: mark `[x]` in roadmap.

```
✅  Action complete: {description}

Progress Phase {n}: [{completed}/{total}]
██████████░░░░░░ 60%

> 1. Continue with next action
> 2. Stop here
```

### 5. Summary

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

- No commit/push. Confirm before destructive actions. Update references + roadmap. Show content before delete.

