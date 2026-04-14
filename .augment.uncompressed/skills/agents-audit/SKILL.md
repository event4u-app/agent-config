---
name: agents-audit
description: "Use when the user says "audit agents", "clean up agents/", or wants to find duplicates and outdated docs. Audits the agents/ directory and creates an improvement roadmap."
source: package
---

# agents-audit

## When to use

Use this skill when:
- The `agents/` or `app/Modules/*/agents/` directories need cleanup
- Docs may be outdated, duplicated, or poorly organized
- You want to align the structure with current skills, commands, and templates
- After major refactoring or module changes
- A new module was created and needs agent docs
- Module agent docs are inconsistent across modules

Do NOT use when:
- Writing new code or features
- Regular documentation updates (use `agent-docs` skill)

## What gets audited

### Scope

| Directory | Audited | Notes |
|---|---|---|
| `agents/*.md` | ✅ | Root-level docs (architecture, conventions, domain) |
| `.augment/guidelines/**` | ✅ | Coding guidelines and patterns |
| `agents/features/` | ✅ | Feature plans |
| `agents/contexts/` | ✅ | Context documents |
| `agents/overrides/` | ✅ | Override files — check for orphans, validity |
| `agents/roadmaps/` | ❌ | Excluded — roadmaps have their own lifecycle |
| `app/Modules/*/agents/` | ✅ | Module-level docs, features, contexts, roadmaps |
| `app/Modules/*/agents/features/` | ✅ | Module feature plans |
| `app/Modules/*/agents/contexts/` | ✅ | Module context documents |
| `app/Modules/*/agents/roadmaps/` | ❌ | Excluded — same as root roadmaps |

### What to check

#### 1. Structural issues

- **Misplaced files:** Docs in wrong directories (e.g., a guideline in root instead of `guidelines/`)
- **Missing directories:** Expected dirs that don't exist (features, contexts, etc.)
- **Orphaned files:** Docs that don't fit any category
- **Naming inconsistency:** Mixed naming patterns (kebab-case vs. other)

#### 2. Content quality

- **Outdated references:** Docs referencing deleted files, classes, or methods
- **Stale information:** Docs that haven't been updated after code changes
- **Duplicated content:** Same information in multiple files
- **Overlap with `.augment/`:** Content that belongs in skills/rules, not agents/

#### 3. Coverage gaps

- **Undocumented modules:** Modules without any `agents/` directory
- **Missing contexts:** Complex areas without context documents
- **Incomplete guidelines:** Guidelines that reference patterns not yet documented
- **Missing module docs:** Modules with code but no description, features, or roadmaps

#### 4. Alignment with skills

Cross-reference `agents/` docs with `.augment/skills/`:
- Does the skill reference an agents doc that doesn't exist?
- Does an agents doc cover something already in a skill?
- Are there agents docs that should become contexts instead?

#### 5. Module agent docs

For each module in `app/Modules/*/`:

**Existence check:**
```bash
find app/Modules -maxdepth 1 -mindepth 1 -type d | while read m; do
  name=$(basename "$m")
  if [ ! -d "$m/agents" ]; then echo "❌  $name — no agents/ dir"
  else echo "✅  $name — agents/ exists"; fi
done
```

**Structure check per module:**

| Check | Expected | Severity |
|---|---|---|
| `agents/` directory exists | At least for active modules | 🟡 Warning |
| Module description file | `agents/{module-name}.md` or `agents/README.md` | 🟡 Warning |
| Features dir (if planned work) | `agents/features/` | 🔵 Info |
| Roadmaps dir (if multi-step work) | `agents/roadmaps/` | 🔵 Info |
| Contexts dir (if complex domain) | `agents/contexts/` | 🔵 Info |
| No stale roadmaps | All steps either done or still relevant | 🟡 Warning |

**Consistency check across modules:**

- Are module descriptions in a consistent format?
- Do all modules use the same directory structure?
- Are there module docs that duplicate root-level `agents/` docs?
- Are there module docs that should be root-level (cross-module concern)?

## Classification

Every doc in `agents/` should fit one of these categories:

| Category | Where it belongs | Example |
|---|---|---|
| **Architecture** | `agents/{topic}.md` | `database-setup.md`, `customer-switch.md` |
| **Convention** | `.augment/guidelines/php/{topic}.md` | `controllers.md`, `eloquent.md` |
| **Pattern** | `.augment/guidelines/php/patterns/{pattern}.md` | `service-layer.md`, `repositories.md` |
| **Feature plan** | `agents/features/{name}.md` | `import-csv-validation.md` |
| **Context** | `agents/contexts/{name}.md` | `client-software.md` |
| **Module doc** | `app/Modules/{M}/agents/{topic}.md` | `backoff-module.md` |
| **Obsolete** | Should be deleted or archived | Docs referencing removed code |

Docs that don't fit any category are candidates for:
- Moving to the correct directory
- Merging into another doc
- Converting to a context document
- Deletion

## Audit output

The audit produces:
1. **Inventory** — complete list of all docs with classification
2. **Issues** — problems found, categorized by severity
3. **Recommendations** — specific actions (move, merge, delete, update, create)
4. **Roadmap** — generated in `agents/roadmaps/` for execution

## Severity levels

| Level | Meaning | Example |
|---|---|---|
| 🔴 Critical | Actively misleading or broken | Doc references deleted class as current |
| 🟡 Warning | Outdated or misplaced | Doc in wrong directory, stale content |
| 🔵 Info | Improvement opportunity | Could be merged, better organized |
| ⚪ Clean | No issues found | Up-to-date, well-placed |

## Auto-trigger keywords

- audit agents
- documentation audit
- duplicate docs
- outdated docs
- cleanup

## Gotcha

- Don't delete docs without asking the user first — some "outdated" docs are intentionally kept for reference.
- The audit may find false positives in cross-references — verify before flagging as broken.
- Module agents/ dirs may be intentionally empty if the module is new.

## Do NOT

- Do NOT delete files without confirmation — always present the plan first.
- Do NOT modify roadmaps — they're excluded from the audit scope.
- Do NOT commit or push without permission.
- Do NOT audit `vendor/`, `node_modules/`, or `.augment/` (skills/rules are separate).
- Do NOT rewrite docs just for style — focus on structural and factual issues.
- Do NOT create module agent dirs for every module — only for active/complex ones.

## Related

- **Skill:** `agent-docs` — documentation hierarchy and reading order
- **Skill:** `override` — override system (audited for orphans)
- **Skill:** `module` — module system and structure
- **Command:** `/agents-audit` — runs the audit
- **Command:** `/agents-cleanup` — applies audit recommendations
