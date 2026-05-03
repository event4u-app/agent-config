---
name: agents-audit
description: Audits agents/ and module agents/ directories — finds outdated docs, structural issues, duplicates, orphaned overrides, and creates an improvement roadmap.
skills: [agents-audit, agent-docs-writing, override-management, module-management]
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "audit my agent docs, check the state of the agents/ directory"
  trigger_context: "stale files under agents/ or recent edits to .augment/ without doc updates"
superseded_by: agents audit
deprecated_in: "1.17.0"
---

> ⚠️  /agents-audit is deprecated; use /agents audit instead.
> This shim is retained for one release cycle (1.17.0 → next minor) and forwards to the same instructions below. See [`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md).

# /agents-audit

Audits all agent documentation across the project — root `agents/`, module `app/Modules/*/agents/`,
and `agents/overrides/`.

## Steps

### 1. Inventory all agent docs

Scan all directories:

```bash
# Root-level docs
find agents/ -maxdepth 1 -name '*.md' | sort

# Subdirectories
find agents/features/ agents/contexts/ -name '*.md' 2>/dev/null | sort

# Overrides
find agents/overrides/ -name '*.md' -not -name '.gitkeep' 2>/dev/null | sort

# Guidelines
find .augment/guidelines/ -name '*.md' | sort

# Module-level docs (excluding roadmaps)
find app/Modules/*/agents/ -name '*.md' -not -path '*/roadmaps/*' 2>/dev/null | sort
```

For each file, extract:
- Filename and path
- First heading (title)
- File size and last git modification date (`git log -1 --format='%ai' -- {file}`)

### 2. Scan module agents coverage

Check every module for agent docs:

```bash
for dir in app/Modules/*/; do
  name=$(basename "$dir")
  if [ -d "$dir/agents" ]; then
    count=$(find "$dir/agents" -name '*.md' | wc -l | tr -d ' ')
    echo "✅  $name — $count docs"
  else
    echo "❌  $name — no agents/ dir"
  fi
done
```

For each module WITH agents, check structure:

| Check | Expected | Severity |
|---|---|---|
| Module description file exists | `agents/{name}.md` or `agents/README.md` | 🟡 Warning |

| Features dir (if planned work) | `agents/features/` | 🔵 Info |
| Contexts dir (if complex domain) | `agents/contexts/` | 🔵 Info |
| Consistent format across modules | Same heading structure, same sections | 🔵 Info |

### 3. Scan overrides

For each override in `agents/overrides/`:

```bash
find agents/overrides/ -name '*.md' -not -name '.gitkeep' | while read f; do
  # Extract Mode and Original path from header
  mode=$(grep -m1 'Mode:' "$f" | sed 's/.*`\(.*\)`.*/\1/')
  original=$(grep -m1 'Original:' "$f" | sed 's/.*`\(.*\)`.*/\1/')
  # Check if original exists
  if [ -f "$original" ]; then
    echo "✅  $f → $original ($mode)"
  else
    echo "❌  $f → $original (ORPHANED — original missing)"
  fi
done
```

| Check | Severity |
|---|---|
| Override has valid `Mode` header (`extend` or `replace`) | 🔴 Critical if missing |
| Override has valid `Original` path | 🔴 Critical if missing |
| Original file exists | 🟡 Warning if orphaned |
| Override content is not empty (beyond template) | 🟡 Warning if empty |

### 4. Classify each document

For each doc, determine its category:

- **Architecture** — project-level architecture docs (DB, auth, tenancy)
- **Convention** — coding guidelines and standards
- **Pattern** — design pattern documentation
- **Feature plan** — planned features
- **Context** — codebase area snapshots
- **Module doc** — module-specific documentation
- **Override** — project-level override of shared resource
- **Unclear** — doesn't fit a clear category

### 5. Check for issues

**Structural issues:**
- Files in wrong directories (e.g., a guideline in `agents/` root)
- Missing expected directories
- Naming inconsistencies (not kebab-case)
- Module docs that should be root-level (cross-module concern)
- Root docs that should be module-level (single-module concern)

**Content issues (for each doc):**
- Read the file and extract referenced file paths, class names, method names
- Use `codebase-retrieval` or file checks to verify references still exist
- Flag references to deleted/renamed code

**Duplication:**
- Compare doc topics — are two docs covering the same thing?
- Check overlap between `agents/` docs and `.augment/skills/` content
- Check overlap between root docs and `.augment/guidelines/` docs
- Check overlap between module docs and root docs

**Coverage gaps:**
- Active modules without any agent docs
- Complex areas (many files, many services) without documentation
- Overrides that reference sections no longer in the original

### 6. Display audit report

```
═══════════════════════════════════════════════
  🔍  AGENTS AUDIT
═══════════════════════════════════════════════

📁  Scanned: {total} files in {dirs} directories

───────────────────────────────────────────────
INVENTAR
───────────────────────────────────────────────

  Category         Count   Files
  ───────────────  ──────  ────────────────────────────
  Architecture     {n}     database-setup.md, ...
  Convention       {n}     guidelines/controllers.md, ...
  Pattern          {n}     guidelines/patterns/service-layer.md, ...
  Feature          {n}     {or "keine"}
  Context          {n}     {or "keine"}
  Module Doc       {n}     Import/agents/import.md, ...
  Override         {n}     overrides/skills/eloquent.md, ...
  Unklar           {n}     {files that don't fit}

───────────────────────────────────────────────
MODULE AGENTS
───────────────────────────────────────────────

  Module             Status  Docs  Description   Features  Contexts
  ─────────────────  ──────  ────  ────────────  ────────  ────────
  Import             ✅      3     ✅            ✅        ❌
  Backoff            ✅      1     ✅            ❌        ❌
  Grafana            ✅      2     ✅            ❌        ❌
  ClientSoftware     ❌      0     ❌            ❌        ❌
  ...

───────────────────────────────────────────────
OVERRIDES
───────────────────────────────────────────────

  Override                          Mode     Original  Status
  ────────────────────────────────  ───────  ────────  ──────
  {or "No overrides found"}

───────────────────────────────────────────────
ISSUES
───────────────────────────────────────────────

🔴  Kritisch ({count}):
  •  {file} — {issue description}

🟡  Warnung ({count}):
  •  {file} — {issue description}

🔵  Info ({count}):
  •  {file} — {improvement suggestion}

⚪  Clean ({count} files without issues)

───────────────────────────────────────────────
DUPLICATES / OVERLAPS
───────────────────────────────────────────────

  •  {file1} ↔ {file2} — {what overlaps}

───────────────────────────────────────────────
GAPS
───────────────────────────────────────────────

  ⚠️  Modules without docs: {list}
  ⚠️  Missing contexts: {list}
  ⚠️  Orphaned overrides: {list}

═══════════════════════════════════════════════
```

### 7. Create improvement roadmap

```
Create an improvement roadmap?

1. ✅  Yes — create roadmap in agents/roadmaps/agents-cleanup.md
2. 📋  Show recommendations only (no file creation)
3. ❌  No — the audit was all that was needed
```

**Option 1:** Create a roadmap using `.augment/templates/roadmaps.md` with phases:

- **Phase 1: Critical fixes** — orphaned overrides, broken references, broken structure
- **Phase 2: Structural cleanup** — move misplaced files, merge duplicates
- **Phase 3: Module docs** — create missing module descriptions and contexts
- **Phase 4: Cleanup** — delete obsolete docs, clean up naming, align formats

**Option 2:** Show recommendations inline without creating a file.

### 8. Offer next steps

```
What next?

1. 🧹  Start cleanup → /agents-cleanup
2. 📄  Update a specific doc → /context-refactor
3. ✅  Done
```

## Rules

- **Do NOT modify or delete any files** — this command is analysis only.
- **Do NOT commit or push.**
- **Do NOT audit `agents/roadmaps/` or `app/Modules/*/agents/roadmaps/`** — roadmaps have their own lifecycle.
- **Do NOT audit `.augment/`** — skills and rules are managed separately.
- **Verify references against the actual codebase** — don't guess.
- **Be specific about issues** — name the file, the reference, and what's wrong.
- **Don't flag missing module docs for tiny/inactive modules** — only for active modules with significant code.
