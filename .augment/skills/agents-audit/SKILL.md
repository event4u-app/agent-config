---
name: agents-audit
description: "/agents-audit"
disable-model-invocation: true
---

# /agents-audit

Audit all agent docs: root `agents/`, module `app/Modules/*/agents/`, `agents/overrides/`.

## Steps

### 1. Inventory all agent docs

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

Per file: filename, path, first heading, size, last git date (`git log -1 --format='%ai' -- {file}`)

### 2. Scan module agents coverage

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

Per module WITH agents:

| Check | Expected | Severity |
|---|---|---|
| Description file | `agents/{name}.md` or `agents/README.md` | 🟡 Warning |
| Features dir | `agents/features/` | 🔵 Info |
| Contexts dir | `agents/contexts/` | 🔵 Info |
| Consistent format | Same heading structure | 🔵 Info |

### 3. Scan overrides

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

### 4. Classify documents

Categories: Architecture, Convention, Pattern, Feature plan, Context, Module doc, Override, Unclear

### 5. Check for issues

**Structural:** wrong directories, missing dirs, naming inconsistencies (not kebab-case), module/root misplacement

**Content:** extract referenced paths/classes/methods → verify against codebase → flag broken references

**Duplication:** topic overlap between `agents/` ↔ `.augment/skills/`, `agents/` ↔ `.augment/guidelines/`, module ↔ root

**Gaps:** active modules without docs, complex areas without documentation, orphaned override sections

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

**Option 1:** Roadmap via `.augment/templates/roadmaps.md` — Phase 1: Critical fixes, Phase 2: Structural cleanup, Phase 3: Module docs, Phase 4: Cleanup

**Option 2:** Inline recommendations.

### 8. Offer next steps

```
What next?

1. 🧹  Start cleanup → /agents-cleanup
2. 📄  Update a specific doc → /context-refactor
3. ✅  Done
```

## Rules

- Analysis only — do NOT modify/delete files
- Do NOT commit or push
- Skip `agents/roadmaps/` and `.augment/` (separate lifecycle)
- Verify references against codebase — don't guess
- Be specific: name file, reference, issue
- Skip tiny/inactive modules
