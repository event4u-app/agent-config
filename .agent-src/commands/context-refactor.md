---
name: context-refactor
skills: [agent-docs-writing]
description: Analyze, update, and extend an existing context document
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "update the context doc, refresh this context document"
  trigger_context: "existing agents/contexts/*.md referenced in the prompt"
---

# context-refactor

## Instructions

### 1. Find the context

- List all context documents in `agents/contexts/`.
- Also check module-level `app/Modules/*/agents/contexts/`.

If only one context exists, ask if that's the one to refactor.
If the user has a context file open in their editor, use that one.
If multiple exist, show a list:

```
📂 Existing context documents:

  #  Name                    Ort                  Typ            Letzte Aktualisierung
  ─  ──────────────────────  ───────────────────  ─────────────  ─────────────────────
  1  client-software.md      Modul: ClientSoftware Module        2026-03-15
  2  import-pipeline.md      Projekt-Root          Domain        2026-03-10
  3  probaus-api.md          Projekt-Root          Integration   2026-02-28

Which context do you want to update? (number or name)
```

If no contexts exist:
```
ℹ️  No context documents found. Create one first with /context-create.
```
Stop.

### 2. Load and display the context

- Read the selected context file completely.
- Display a summary:

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

### 3. Re-analyze the code

Re-analyze the documented area to find changes:

- Check if documented files still exist.
- Look for new files/classes that aren't documented.
- Verify database tables and endpoints are still accurate.
- Check for new tests.

**Show findings:**

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

**Option 1 — Auto-update:**
- Remove entries for deleted files/classes.
- Add entries for new files/classes.
- Update changed entries.
- Show all changes for confirmation before applying.

**Option 2 — Manual edit:**
Show section list:
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

**Option 3 — Add new areas:**
- Ask what to add.
- Analyze the relevant code.
- Add new sections or entries.

### 5. Apply changes

- Update the context file.
- Update `Last Updated` to today's date.
- Show a diff summary:

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

If option 1 or 2 → loop back to analysis and update.

### Rules

- **Do NOT commit or push.**
- **Always re-analyze the code** before updating — don't just edit text.
- **Show changes before applying** — the user should confirm.
- **Preserve user-written notes and context** — don't overwrite manual additions.
- **Update `Last Updated`** after every change.
