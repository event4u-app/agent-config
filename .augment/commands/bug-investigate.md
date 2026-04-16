---
name: bug-investigate
skills: [bug-analyzer, sentry-integration]
description: Investigate a bug — auto-detect ticket from branch, gather Jira/Sentry/description context, trace root cause
disable-model-invocation: true
---

# bug-investigate

## Instructions

### 1. Auto-detect ticket from branch

Run `git branch --show-current` and extract ticket IDs:

- Match pattern: `[A-Z]+-[0-9]+` (e.g., `DEV-1234`, `PROJ-567`)
- Common branch formats: `fix/DEV-1234/description`, `hotfix/DEV-999`, `fix/bug-description`

If a ticket ID is found:

```
🔀 Branch: {branch-name}
🎫 Ticket detected: {TICKET-ID}

> 1. Yes — load ticket
> 2. No — skip
```

If yes → fetch via Jira API and show summary (see step 2).
If no ticket found → continue to step 2.

### 2. Ask for bug sources

```
🐛 Bug Investigation

What information do you have? (multiple allowed)

1. 🎫 Jira ticket(s) — provide key(s) (e.g. DEV-1234)
2. 🔴 Sentry issue — provide URL or issue ID
3. 💬 Bug description — describe the bug manually
4. 📋 Error message — paste error message or stacktrace
```

Accept **multiple sources** — the more context, the better.

### 3. Gather context from each source

**Jira ticket (if provided):**
- Fetch via Jira API (`/issue/{key}`).
- Extract: title, description, priority, status, comments, linked issues.
- Check for linked Sentry issues in comments or description.

```
🎫 Jira: {KEY} — {title}

  Status:       {status} | Priority: {priority}
  Description:  {summary}
  Comments:     {count} ({key points})
  Sentry links: {extracted URLs or "none found"}
```

**Sentry issue (if provided):**
- Use `get_issue_details` with the URL or issue ID.
- Use `get_issue_tag_values` for environment, browser, URL distribution.

```
🔴 Sentry: {issue-title}

  Events:      {count} | Users: {count}
  Erste:       {first seen} | Letzte: {last seen}
  Environment: {distribution}
  Stacktrace:  {top 3-5 frames}
```

**Error message (if provided):**
- Search codebase for the exact message string.
- Show matching files and line numbers.

**User description (if provided):**
- Note reproduction steps and expected vs. actual behavior.

### 4. Analyze the code

Based on gathered context:

1. **Read the stacktrace** (if available) — trace from top frame down.
2. **Use `codebase-retrieval`** to find related code.
3. **Read each file** in the call chain.
4. **Check for context docs** — `agents/contexts/` or module `agents/contexts/`.
5. **Identify the data flow** — where does the bad data/state come from?

**Share findings as you go:**

```
🔍 Code-Analyse:

  Einstiegspunkt: {controller/command/job}
  → {ServiceClass}::{method}() (Zeile {n})
  → {RepositoryClass}::{method}() (Zeile {n})
  → ❌ Hier passiert der Fehler: {description}

  Affected files:
    • {file1.php} — {role in the bug}
    • {file2.php} — {role in the bug}
```

### 5. Present root cause

```
═══════════════════════════════════════════════
  🐛 ROOT CAUSE ANALYSE
═══════════════════════════════════════════════

📍 Fehler:     {what happens}
🔍 Ursache:    {why it happens — the root cause}
📁 Betroffen:  {files and lines}
🌍 Impact:     {how many users/events, which environments}

───────────────────────────────────────────────
EXPLANATION:
───────────────────────────────────────────────

{2-5 sentences explaining the root cause in plain language.
Trace the data flow that leads to the error.}

───────────────────────────────────────────────
SUGGESTED FIX:
───────────────────────────────────────────────

{High-level description of the fix. Which files to change, what to add/remove.}

1. {concrete step}
2. {concrete step}
3. Tests: {what to test}

───────────────────────────────────────────────
SIMILAR SPOTS:
───────────────────────────────────────────────

{Other code locations with the same pattern that might have the same bug.}

═══════════════════════════════════════════════
```

### 6. Offer next steps

```
What's next?

1. 🔧 Fix implementieren → /bug-fix
2. 🔍 Tiefer analysieren (bestimmte Stelle genauer untersuchen)
3. 📋 Als Feature/Refactoring planen → /feature-plan
4. ✅ Done — only the analysis was needed
```

### Rules

- **Do NOT commit or push.**
- **Do NOT start fixing before presenting the root cause.**
- **Always check the branch** for ticket IDs first.
- **Combine all sources** — Jira + Sentry + description give the best picture.
- **Trace to the root cause** — don't just describe the symptom.
- **Check for similar patterns** elsewhere in the codebase.
- **Use Sentry tools** (`get_issue_details`, `get_issue_tag_values`) when URLs are available.
