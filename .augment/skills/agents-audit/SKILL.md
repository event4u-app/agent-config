---
name: agents-audit
description: "Use when the user says "audit agents", "clean up agents/", or wants to find duplicates and outdated docs. Audits the agents/ directory and creates an improvement roadmap."
---

# agents-audit

## When to use

Cleanup/audit `agents/` or module `agents/`. Outdated/duplicated/misplaced docs. After major refactoring. Module docs inconsistencies. NOT for: coding, regular doc updates (`agent-docs`).

## Scope: `agents/*.md`, guidelines, features, contexts, overrides (✅). Roadmaps excluded (❌). Module agents (✅ except roadmaps).

## Checks

1. **Structural** — misplaced files, missing dirs, orphans, naming inconsistency
2. **Content** — outdated refs, stale info, duplicates, overlap with `.augment/`
3. **Coverage** — undocumented modules, missing contexts, incomplete guidelines
4. **Skill alignment** — skills referencing missing docs, docs duplicating skills
5. **Module docs** — existence check, description, consistent structure, no duplicates of root docs

## Classification: Architecture (`agents/`), Convention (`.augment/guidelines/`), Pattern (`guidelines/patterns/`), Feature (`features/`), Context (`contexts/`), Module doc, Obsolete (delete).

Doesn't fit → move, merge, convert, or delete.

## Output: inventory → issues (severity) → recommendations → roadmap

## Severity: 🔴 misleading/broken, 🟡 outdated/misplaced, 🔵 improvement, ⚪ clean.

## Gotcha: ask before deleting, verify cross-refs before flagging, empty module dirs may be intentional.

## Do NOT: delete without confirmation, modify roadmaps, commit/push, audit vendor/node_modules/.augment/, rewrite for style only.

## Related: `agent-docs`, `override`, `module`, `/agents-audit`, `/agents-cleanup`
