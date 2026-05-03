---
name: feature-explore
skills: [laravel]
description: Brainstorm and explore a feature idea before committing to a full plan
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "brainstorm this idea, explore this feature concept"
  trigger_context: "open-ended feature idea without acceptance criteria"
superseded_by: feature explore
deprecated_in: "1.15.0"
---

> ⚠️  /feature-explore is deprecated; use /feature explore instead.
> This shim is retained for one release cycle (1.15.0 → next minor) and forwards to the same instructions below. See [`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md).

# feature-explore

## Instructions

This is a **lightweight, conversational** exploration — no structured output yet.
The goal is to help the user think through an idea and decide if it's worth planning.

### 1. Start the conversation

If the user provided an idea in their message, acknowledge it and start exploring.
If not, ask:

```
💡 What's your idea? Describe it briefly — one sentence is enough to start.
```

### 1b. Refinement hint — detect ticket-shaped input

Before entering brainstorm mode, check whether the input looks like an
**existing ticket** rather than a fresh idea. If any of the following
match, surface the hint below and let the user pick:

- A Jira/Linear URL is present (`https://.../browse/[A-Z]+-[0-9]+`)
- The current branch name contains a ticket key (`[A-Z]+-[0-9]+`)
- The pasted text contains structured AC bullets (`- [ ]`, "Acceptance Criteria", "AC:")

Prompt:
```
🎫 Looks like you're working with an existing ticket, not a fresh idea.

1. Use `/refine-ticket` — rewrites the ticket + surfaces Top-5 risks + persona voices
2. Continue brainstorming here — I'll treat it as a new idea to explore
```

If the user picks 1, hand off to `/refine-ticket` with the same input. If 2,
continue with Step 2.

### 2. Gather external context

**Auto-detect ticket from branch:**
Run `git branch --show-current` and extract ticket IDs (pattern: `[A-Z]+-[0-9]+`).

If a ticket ID is found:
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

If the user provides ticket keys:
- Fetch each ticket via Jira API (`/issue/{key}`).
- For Epics: also fetch child issues (`/search/jql` with `"Epic Link" = {key}` or `parent = {key}`).
- Extract and summarize:
  - **Title & description** — the original requirement
  - **Acceptance criteria** — if defined
  - **Comments** — relevant discussion or decisions
  - **Status & priority** — current state
  - **Linked issues** — related tickets

Show a summary:

```
📋 Jira context loaded:

  {KEY}: {title}
  Status: {status} | Priority: {priority}
  Description: {first 2-3 sentences}
  Acceptance criteria: {list or "none defined"}
  Comments: {count} ({summary of key points})
  Linked issues: {list or "none"}
```

Use this as **input for the exploration** — challenge it, validate it against the codebase, identify gaps.

### 3. Understand the idea

Listen for and gently probe:

- **Problem:** What pain point does this solve? Who is affected?
- **Vision:** What would the ideal outcome look like?
- **Scope:** Is this a small tweak or a major feature?
- **Context:** Is this for a specific customer, internal tooling, or the platform?

If Jira context was loaded, use it to pre-fill understanding and ask targeted follow-ups:
```
Based on the ticket, this is about {summary}. Is that still accurate, or has the requirement changed?
```

**Be conversational, not interrogative.** Ask 1–2 follow-up questions at a time, not a checklist.

### 4. Research the codebase

While exploring, proactively research:

- Use `codebase-retrieval` to find related code, existing patterns, and affected areas.
- Check `agents/features/` for existing feature plans that might overlap.
- Check the module structure (`app/Modules/`) for where this would live.
- Look for existing services, models, or endpoints that could be extended.

**Share findings naturally:**

```
I looked at the code — there's already an `ImportService` with
similar logic. We could extend it instead of building something new.
What do you think?
```

### 5. Challenge and refine

Your role is **thought partner**, not yes-machine:

- **Challenge scope:** "This sounds like a big feature. What would be the absolute minimum that already delivers value?"
- **Suggest alternatives:** "Instead of building this from scratch — could we extend the existing X?"
- **Identify risks:** "This would affect the Y table, which depends on Z. We need to keep that in mind."
- **Defer complexity:** "We can do the automation in Phase 2. Manual first?"

### 6. Summarize and decide

After 3–8 exchanges, summarize what you've learned:

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

- **Do NOT create a full feature plan** — that's `/feature-plan`'s job.
- **Do NOT commit or push.**
- **Do NOT skip codebase research** — always check what exists.
- **Be honest about feasibility** — if something is hard, say so.
- **Keep it conversational** — this is brainstorming, not a formal process.
- **Max 1 file created** (optional idea note). No roadmaps, no implementation.

## See also

- [`role-contracts`](../../docs/guidelines/agent-infra/role-contracts.md#po) — PO mode output contract (Goal / Assumptions / Acceptance criteria / Impacted modules / Risks / Open questions for stakeholder)
