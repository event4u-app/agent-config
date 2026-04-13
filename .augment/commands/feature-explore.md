---
skills: [laravel]
description: Brainstorm and explore a feature idea before committing to a full plan
---

# feature-explore

## Instructions

Lightweight conversational exploration. Help user think through idea.

### 1. Start

Idea provided → explore. Otherwise ask:

```
💡 What's your idea? Describe it briefly — one sentence is enough to start.
```

### 2. External context

`git branch --show-current` → extract ticket. If found:
```
🔀 Branch: {branch-name}
🎫 Ticket detected: {TICKET-ID} — Load the ticket? (y/n)
```

**Then ask for additional sources:**
```
Gibt es weitere Quellen?

1. 🎫 Jira-Ticket(s) oder Epic(s) — Key(s) angeben
2. 🔴 Sentry-Issue(s) — URL(s) angeben
3. 🔗 Andere Links — Confluence, Slack, Docs
4. ❌ Nein — ohne weitere Quellen starten
```

Tickets → fetch Jira API (Epics: include children). Show summary:

```
📋 Jira context loaded:

  {KEY}: {title}
  Status: {status} | Priority: {priority}
  Description: {first 2-3 sentences}
  Acceptance criteria: {list or "none defined"}
  Comments: {count} ({summary of key points})
  Linked issues: {list or "none"}
```

Use as input — challenge, validate against codebase, identify gaps.

### 3. Understand

Probe: Problem, Vision, Scope, Context. Jira context → pre-fill + follow-ups:
```
Based on the ticket, this is about {summary}. Is that still accurate, or has the requirement changed?
```

1-2 follow-ups at a time, not a checklist.

### 4. Research codebase

`codebase-retrieval` → related code, `agents/features/` → overlap, `app/Modules/` → location. Share naturally:

```
I looked at the code — there's already an `ImportService` with
similar logic. We could extend it instead of building something new.
What do you think?
```

### 5. Challenge and refine

Thought partner: challenge scope, suggest alternatives, identify risks, defer complexity.

### 6. Summarize (after 3-8 exchanges)

```
───────────────────────────────────────────────
💡 SUMMARY
───────────────────────────────────────────────

Problem:   {one sentence}
Idea:      {one sentence}
Scope:     {small / medium / large}
Affected modules: {list}
Risks:     {key risks}

───────────────────────────────────────────────
```

Then ask:

```
What's next?

1. 📋 Plan the feature → /feature-plan (create structured feature document)
2. 🔍 Keep brainstorming (not ready to plan yet)
3. ⏸️ Park the idea (revisit later)
4. ❌ Discard (not worth pursuing)
```

### 7. Handle decision

- **Option 1:** Transition to `/feature-plan` — pass the exploration context along.
- **Option 2:** Continue the conversation, dig deeper.
- **Option 3:** Optionally create a minimal note in `agents/features/{name}.md` with status `💡 Idea`.
- **Option 4:** Acknowledge and move on. No file created.

### Rules

- No full feature plan (→ `/feature-plan`), no commit/push
- Always research codebase. Be honest. Conversational.
- Max 1 file (optional idea note).

