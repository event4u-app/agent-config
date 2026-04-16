---
name: feature-plan
skills: [feature-planning]
description: Interactively plan a feature — research, discuss, and create a structured feature document
disable-model-invocation: true
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

**Auto-detect ticket from branch:**
Run `git branch --show-current` and extract ticket IDs (pattern: `[A-Z]+-[0-9]+`).

If a ticket ID is found:
```
🔀 Branch: {branch-name}
🎫 Ticket detected: {TICKET-ID}

Load the ticket? (y/n)
```

If yes → fetch via Jira API and show summary.

**Then ask for additional sources:**
```
Any additional sources?

1. 🎫 Jira-Ticket(s) oder Epic(s) — Key(s) angeben (z.B. DEV-1234)
2. 🔴 Sentry-Issue(s) — URL(s) angeben (falls relevant)
3. 🔗 Andere Links — Confluence, Slack, Docs, etc.
4. ❌ No — start without additional sources
```

If the user provides ticket keys:
- Fetch each ticket via Jira API (`/issue/{key}`).
- For Epics: also fetch child issues (`/search/jql` with `"Epic Link" = {key}` or `parent = {key}`).
- Extract and summarize:
  - **Title & description** — the original requirement
  - **Acceptance criteria** — if defined in the description or subtasks
  - **Comments** — relevant discussion, decisions, or clarifications
  - **Status & priority** — current state
  - **Linked issues** — related tickets, blockers, dependencies
  - **Subtasks / child issues** — for Epics, list all child tickets with status

Show a structured summary:

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

Use this as **foundation for the feature plan** — pre-fill Problem, Proposal, and Scope from the ticket data.
Challenge gaps: "The ticket says X, but there's no statement about Y. How should that work?"

### 3. Check for existing work

Run in parallel:
- Check `agents/features/` for existing plans that might overlap or relate.
- Check `agents/roadmaps/` for related roadmaps.

If a related feature plan exists:
```
ℹ️  Es gibt bereits ein verwandtes Feature:
📄 agents/features/{name}.md — {title}

Should I build on this or create a new feature?
```

### 4. Research the codebase

Before asking detailed questions, **proactively research**:

- Use `codebase-retrieval` to find:
  - Existing code related to the feature
  - Affected modules, models, services, controllers
  - Similar patterns already implemented
  - Database tables that would be affected
- Read module-level `agents/` docs if a specific module is involved.

**Share key findings with the user** — this informs the discussion:

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

### 5a. Check for existing context

Check if a context document exists for the affected area:
- `agents/contexts/` for project-wide contexts
- `app/Modules/{Module}/agents/contexts/` if a module is involved

If a context exists:
```
📄 There's a context for this area:
   {path/to/context.md} — {title}

I'll use it as the basis for the technical analysis.
```
Read it and use it to pre-fill Affected Areas and Technical Approach.

If no context exists, note this for step 8 (offer to create one after planning).

### 5b. Determine scope (module vs. project-wide)

Check if `app/Modules/` exists in the project. If yes, ask:

```
Does this feature belong to a specific module?

1. 📦 Yes — in a module (feature + roadmaps in module directory)
2. 🌐 No — project-wide (feature + roadmaps in root)
```

If the user chooses a module:
- List available modules from `app/Modules/`.
- Ask which module, or accept the module name directly.
- Target directories become:
  - Feature: `app/Modules/{Module}/agents/features/`
  - Roadmaps (later): `app/Modules/{Module}/agents/roadmaps/`
  - Create directories if they don't exist (with `.gitkeep`).

If project-wide:
- Target: `agents/features/` and `agents/roadmaps/`.

### 5c. Interactive planning

Walk through the feature plan sections **conversationally** — not as a form.
Ask 1–2 questions at a time, building on previous answers.

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

**Round 3 — Technical Approach:**
Based on codebase research, present options:
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

### 6. Create the feature document

- Read `.augment/templates/features.md` for the structure.
- Create the feature file in the target directory determined in step 5a:
  - Module: `app/Modules/{Module}/agents/features/{feature-name}.md`
  - Project-wide: `agents/features/{feature-name}.md`
- Fill in all sections based on the conversation.
- Set the `Module` field in the feature doc accordingly.
- Set status to `📋 Planned`.
- If Jira tickets were provided, add them to the `Jira` field and reference them in the feature doc.

**Ask for the filename:**
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

If no context document exists for this area, offer to create one:

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

- **Do NOT commit or push.**
- **Do NOT skip codebase research** — always check what exists before planning.
- **Do NOT create roadmaps** — that's `/feature-roadmap`'s job.
- **Be collaborative** — ask questions, don't assume.
- **Challenge scope** — suggest what can be deferred.
- **Reference existing code** — link to files and patterns found in research.
