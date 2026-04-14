---
name: feature-plan
description: "Create a structured feature plan"
disable-model-invocation: true
argument-hint: "[description]"
---

# feature-plan

## Instructions

### 1. Gather the idea

If the user provided a description, use it. Otherwise ask:

```
📋 Which feature do you want to plan?

Describe briefly:
- What should the feature do?
- What problem does it solve?
```

### 2. Gather external context

`git branch --show-current` → extract ticket `[A-Z]+-[0-9]+`. If found:
```
🔀 Branch: {branch-name}
🎫 Ticket detected: {TICKET-ID}

Load the ticket? (y/n)
```

**Additional sources:**
```
Any additional sources?

1. 🎫 Jira-Ticket(s) oder Epic(s) — Key(s) angeben (z.B. DEV-1234)
2. 🔴 Sentry-Issue(s) — URL(s) angeben (falls relevant)
3. 🔗 Andere Links — Confluence, Slack, Docs, etc.
4. ❌ No — start without additional sources
```

Tickets provided → fetch via Jira API, Epics: child issues too. Extract title, AC, comments, status, links:

```
📋 Jira context loaded:

  {KEY}: {title}
  Status: {status} | Priority: {priority}
  Description: {first 2-3 sentences}
  Acceptance criteria: {list or "none defined"}
  Comments: {count} ({summary of key points})

  {If Epic — show child issues:}
  Untertickets:
    ✅  {KEY}: {title} (Done)
    🔄 {KEY}: {title} (In Progress)
    ⏸️  {KEY}: {title} (To Do)
```

Pre-fill Problem/Proposal/Scope from ticket. Challenge gaps.

### 3. Check for existing work

Check `agents/features/` + `agents/roadmaps/` for overlap. If related:
```
ℹ️  Es gibt bereits ein verwandtes Feature:
📄 agents/features/{name}.md — {title}

Should I build on this or create a new feature?
```

### 4. Research codebase

`codebase-retrieval` → existing code, affected modules/models/services, similar patterns, DB tables. Module docs.
Share findings:

```
I analyzed the code. Here's what I found:

🔍 Affected areas:
  - Module: Import (app/Modules/Import/)
  - Service: ImportService — already has similar logic
  - Model: ImportUpload — needs new fields
  - API: /api/v1/imports — new endpoint needed

💡 Existing patterns:
  - The ExportService uses a similar queue pattern
  - There's already an ImportUploadType enum
```

### 5a. Check for context

Check `agents/contexts/` + module contexts. If exists:
```
📄 There's a context for this area:
   {path/to/context.md} — {title}

I'll use it as the basis for the technical analysis.
```
No context → note for step 8.

### 5b. Scope (module vs project-wide)

```
Does this feature belong to a specific module?

1. 📦 Yes — in a module (feature + roadmaps in module directory)
2. 🌐 No — project-wide (feature + roadmaps in root)
```

Module → `app/Modules/{Module}/agents/features/`. Project-wide → `agents/features/`.

### 5c. Interactive planning

Conversational, 1-2 questions at a time:

**Round 1 — Problem & Proposal:**
```
Do I understand correctly: {restate the problem}?

And the solution would be: {restate the proposal}?

What's missing or incorrect?
```

**Round 2 — Scope:**
```
What definitely belongs in scope?
And what can we consciously leave out or defer?
```

**Round 3 — Technical Approach (present options):**
```
For the implementation I see two approaches:

Option A: {approach} — {pros/cons}
Option B: {approach} — {pros/cons}

Was passt besser?
```

**Round 4 — Open Questions:**
```
Mir sind noch ein paar offene Fragen aufgefallen:
- {question 1}
- {question 2}

Hast du dazu schon eine Meinung?
```

### 6. Create feature document

Use `.augment/templates/features.md`. Status `📋 Planned`. Include Jira refs. Ask filename:
```
What should the feature be named?

Suggestion: {suggested-kebab-case-name}
{If module: "Target: app/Modules/{Module}/agents/features/{name}.md"}
{If root: "Target: agents/features/{name}.md"}
```

### 7. Show the result

Display a summary:

```
═══════════════════════════════════════════════
  📋 FEATURE GEPLANT
═══════════════════════════════════════════════

📄 agents/features/{name}.md
📊 Status: 📋 Planned

───────────────────────────────────────────────
OVERVIEW:
───────────────────────────────────────────────

Problem:    {one sentence}
Solution:   {one sentence}
Scope:      {in-scope summary}
Module:     {affected modules}
Open questions: {count}

═══════════════════════════════════════════════
```

### 8. Next steps

No context? Offer `/context-create`:

```
📄 No context document exists for this area yet.
   A context documents the current state (structure, key classes, DB, API)
   and helps with implementation.

   Should I create one? → /context-create
```

Then show next steps:

```
What's next?

1. 🗺️ Create roadmap → /feature-roadmap
2. 📄 Create context → /context-create
3. ✏️ Refine feature further → /feature-refactor
4. ✅ Done for now — continue later
```

### Rules

- Do NOT commit/push. Do NOT create roadmaps (→ `/feature-roadmap`).
- Always research codebase first. Be collaborative. Challenge scope. Reference found code.
