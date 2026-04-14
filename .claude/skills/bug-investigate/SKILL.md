---
name: bug-investigate
description: "bug-investigate"
disable-model-invocation: true
---

# bug-investigate

## Instructions

### 1. Auto-detect ticket from branch

`git branch --show-current` → extract `[A-Z]+-[0-9]+` pattern.
If found:

```
🔀 Branch: {branch-name}
🎫 Ticket detected: {TICKET-ID}

> 1. Yes — load ticket
> 2. No — skip
```

### 2. Ask for bug sources

```
🐛 Bug Investigation

What information do you have? (multiple allowed)

1. 🎫 Jira ticket(s) — provide key(s) (e.g. DEV-1234)
2. 🔴 Sentry issue — provide URL or issue ID
3. 💬 Bug description — describe the bug manually
4. 📋 Error message — paste error message or stacktrace
```

Accept multiple sources.

### 3. Gather context

**Jira ticket:** Fetch `/issue/{key}` → title, description, priority, status, comments, Sentry links.

```
🎫 Jira: {KEY} — {title}

  Status:       {status} | Priority: {priority}
  Description:  {summary}
  Comments:     {count} ({key points})
  Sentry links: {extracted URLs or "none found"}
```

**Sentry issue:** `get_issue_details` + `get_issue_tag_values`.

```
🔴 Sentry: {issue-title}

  Events:      {count} | Users: {count}
  Erste:       {first seen} | Letzte: {last seen}
  Environment: {distribution}
  Stacktrace:  {top 3-5 frames}
```

**Error message:** Search codebase for exact string → show files + lines.

**User description:** Note repro steps, expected vs actual.

### 4. Analyze the code

1. Read stacktrace (top down) 2. `codebase-retrieval` for related code 3. Read call chain 4. Check context docs 5. Trace data flow

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

- Do NOT commit/push or start fixing before presenting root cause
- Check branch for ticket IDs first
- Combine all sources — more context = better
- Trace to root cause, not symptom
- Check for similar patterns
- Use Sentry tools when URLs available
