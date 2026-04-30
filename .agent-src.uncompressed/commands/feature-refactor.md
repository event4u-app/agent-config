---
name: feature-refactor
skills: [laravel, php-coder]
description: Refine and update an existing feature plan through interactive discussion
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "update the feature plan, refine the feature spec"
  trigger_context: "existing agents/features/*.md referenced in the prompt"
---

# feature-refactor

## Instructions

### 1. Find the feature

- List all feature plans in `agents/features/`.
- Also check module-level `app/Modules/*/agents/features/` directories.

If only one feature exists, load it directly.
If multiple exist, show a list:

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

### 2. Load and display the feature

- Read the selected feature file completely.
- Display a summary:

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

Based on the user's choice, start a focused conversation:

**Problem/Proposal (Option 1):**
- Show current text.
- Ask what changed or what's wrong.
- Research codebase if new context is needed.
- Rewrite the section together.

**Scope (Option 2):**
- Show current In Scope / Out of Scope.
- Ask what to add, remove, or move between lists.
- Challenge additions: "Do we really need this for the first version?"
- Validate removals: "Wenn wir X weglassen, funktioniert Y dann noch?"

**Technical Approach (Option 3):**
- Show current approach and options considered.
- Research codebase for new patterns or constraints.
- Present new options if the landscape changed.
- Update the Options Considered table.

**Open Questions (Option 4):**
- Go through each open question.
- Research codebase to help answer them.
- Mark resolved questions as `[x]`.
- Add new questions if they come up.

**Jira-Tickets (Option 5):**
- Show currently linked Jira tickets (from the feature's `Jira` field).
- Ask: "Ticket-Key(s) zum Verlinken? (z.B. DEV-1234, DEV-5678)"
- Fetch each ticket via Jira API and show a summary.
- For Epics: also fetch child issues and show their status.
- Add the ticket links to the feature's `Jira` field.
- If the ticket contains new requirements or acceptance criteria, ask:
  ```
  > The ticket contains new requirements. What to do?
  > 1. Incorporate — add requirements to the feature
  > 2. Ignore — just link the ticket
  ```
- If yes, update Problem, Scope, or Acceptance Criteria accordingly.

**Status (Option 6):**
- Show current status and available statuses (from template).
- Ask for new status.
- If changing to `❌ Rejected`, ask for reason and add to Notes.

**Reject (Option 7):**
- Confirm with numbered options:
  ```
  > 1. Yes — mark feature as ❌ Rejected
  > 2. Cancel
  ```
- If confirmed: Set status to `❌ Rejected`, add reason to Notes.

### 5. Update the feature file

- Apply all changes to the feature file.
- Show a diff summary of what changed:

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

- **Do NOT commit or push.**
- **Do NOT modify roadmaps** — that's `/feature-roadmap`'s job.
- **Do NOT delete feature files** — mark as `❌ Rejected` instead.
- **Research the codebase** when technical questions come up.
- **Show changes clearly** — the user should know exactly what was modified.
- **Preserve history** — don't silently remove decisions or notes.
