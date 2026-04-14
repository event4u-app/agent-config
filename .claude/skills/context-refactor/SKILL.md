---
name: context-refactor
description: "context-refactor"
disable-model-invocation: true
---

# context-refactor

## Instructions

### 1. Find context

List `agents/contexts/` + `app/Modules/*/agents/contexts/`. One → confirm. Multiple → list:

```
📂 Existing context documents:

  #  Name                    Ort                  Typ            Letzte Aktualisierung
  ─  ──────────────────────  ───────────────────  ─────────────  ─────────────────────
  1  client-software.md      Modul: ClientSoftware Module        2026-03-15
  2  import-pipeline.md      Projekt-Root          Domain        2026-03-10
  3  probaus-api.md          Projekt-Root          Integration   2026-02-28

Which context do you want to update? (number or name)
```

None → `ℹ️ No contexts. Use /context-create.` Stop.

### 2. Load and display

```
═══════════════════════════════════════════════
  ✏️  CONTEXT: {title}
═══════════════════════════════════════════════

📊 Typ:              {type}
📅 Last updated:     {last updated}
📦 Module:           {module or "project-wide"}

───────────────────────────────────────────────
CURRENT CONTENT:
───────────────────────────────────────────────

  Key Files:       {count}
  Key Classes:     {count}
  DB Tables:       {count}
  API Endpoints:   {count}
  Known Issues:    {count}

═══════════════════════════════════════════════
```

### 3. Re-analyze code

Check: files still exist? New undocumented files? Tables/endpoints accurate? New tests?

```
🔍 Re-analysis complete:

  ✅  Still current:
    • ImportService — unchanged
    • 8 Models — all present

  ⚠️  Outdated / changed:
    • ProcessImportCommand — new parameters added
    • ImportUploadType — 2 new enum values

  🆕 New (not documented):
    • ImportValidationService (newly added)
    • api/v1/imports/validate endpoint

  ❌  Removed:
    • OldImportHelper — no longer exists
```

### 4. Ask what to do

```
What do you want to adjust?

1. 🔄 Auto-update everything (based on the analysis)
2. ✏️ Manually edit specific sections
3. ➕ Add new areas
4. 🗑️ Remove outdated entries
5. 💬 Something else
```

**Option 1** — Auto: remove deleted, add new, update changed (confirm before applying).
**Option 2** — Manual: show sections:
```
Which section?

1. Overview
2. Key Files
3. Key Classes & Services
4. Database
5. API Endpoints
6. Dependencies
7. Patterns & Conventions
8. Known Issues / Technical Debt
9. Notes
```

**Option 3** — Ask, analyze, add.

### 5. Apply changes + update `Last Updated`

```
───────────────────────────────────────────────
CHANGES:
───────────────────────────────────────────────

  🆕 Added: 3 Key Files, 1 Service, 1 Endpoint
  ✏️ Updated: 2 Classes, 1 Known Issue
  🗑️ Removed: 1 obsolete service
  📅 Last Updated: 2026-03-20
```

### 6. Ask for additions

```
Anything else to add?

1. ➕ Yes — document another area
2. 🔍 Investigate a specific class/service in detail
3. ✅ No, done
```

1/2 → loop back.

### Rules

- No commit/push. Re-analyze before updating. Show changes before applying. Preserve user notes. Update `Last Updated`.
