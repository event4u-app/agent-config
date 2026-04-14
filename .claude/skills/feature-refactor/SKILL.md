---
name: feature-refactor
description: "feature-refactor"
disable-model-invocation: true
---

# feature-refactor

## Instructions

### 1. Find the feature

List `agents/features/` + `app/Modules/*/agents/features/`. One → load. Multiple → list:

```
📂 Existing feature plans:

  #  Name                              Ort                  Status
  ─  ──────────────────────────────    ───────────────────  ──────
  1  import-csv-validation.md          Module: Import        📋 Planned
  2  webhook-retry-logic.md            Project root         🗺️ Roadmapped
  3  user-notification-preferences.md  Module: UserProfile   💡 Idea

Which feature do you want to edit? (number or name)
```

If no features exist:
```
ℹ️  No feature plans found. Create one first with /feature-plan.
```
Stop.

### 2. Load and display

```
═══════════════════════════════════════════════
  ✏️  FEATURE: {title}
═══════════════════════════════════════════════

📊 Status:   {status}
📅 Created:   {date}
🎯 Problem:   {problem summary}
💡 Solution:  {proposal summary}

───────────────────────────────────────────────
SCOPE:
───────────────────────────────────────────────

In Scope:
  • {item 1}
  • {item 2}

Out of Scope:
  • {deferred item 1}

───────────────────────────────────────────────
OPEN QUESTIONS: {count}
───────────────────────────────────────────────

  • {question 1}
  • {question 2}

───────────────────────────────────────────────
ROADMAPS: {linked roadmaps or "keine"}
═══════════════════════════════════════════════
```

### 3. Ask what to change

```
What do you want to adjust?

1. 🎯 Revise problem / proposal
2. 📐 Change scope (add/remove/move features)
3. 🔧 Rethink technical approach
4. ❓ Resolve open questions
5. 🎫 Jira-Tickets verlinken oder aktualisieren
6. 📊 Change status
7. 🗑️ Feature verwerfen
8. 💬 Etwas anderes — sag mir was
```

### 4. Interactive refinement

Per option: show current → discuss → research codebase if needed → update.

- **1 Problem/Proposal**: show, ask what changed, rewrite together
- **2 Scope**: add/remove/move items, challenge additions
- **3 Technical**: research new patterns, update Options Considered
- **4 Open Questions**: answer via research, mark `[x]`, add new
- **5 Jira**: link tickets, fetch API, incorporate new requirements if user wants
- **6 Status**: change, `❌ Rejected` needs reason
- **7 Reject**: confirm → set `❌ Rejected` + reason

### 5. Update + show diff summary

```
───────────────────────────────────────────────
CHANGES:
───────────────────────────────────────────────

  ✏️  Problem: updated
  ✏️  Scope: 1 item added to In Scope, 2 moved to Out of Scope
  ✅  Open Questions: 2 resolved, 1 new added
  📊 Status: 📋 Planned → 🗺️ Roadmapped
```

### 6. Ask about next steps

```
Feature updated ✅

What's next?

1. ✏️ More changes to the feature
2. 🗺️ Roadmap erstellen/aktualisieren → /feature-roadmap
3. ✅ Done for now
```

### Rules

- No commit/push. No roadmap changes (→ `/feature-roadmap`).
- Don't delete features → `❌ Rejected`. Research codebase. Show changes clearly. Preserve history.
