---
name: project-health
skills: [quality-tools]
description: Quick project health check — show status of docs, modules, contexts, and roadmaps without creating anything
disable-model-invocation: true
---

# project-health

## Instructions

This is a **quick, read-only** health check. No documents are created or modified.

### 1. Gather data

Run in parallel:
- `composer.json` → framework, PHP version
- `git branch --show-current` → current branch
- `git log --oneline -3` → recent activity
- Count files in `agents/` (docs, features, roadmaps, contexts)
- Count files in `app/Modules/*/agents/` (per module)
- Check `app/Modules/` for module list
- Count test files

### 2. Display health report

```
═══════════════════════════════════════════════
  🏥 PROJEKT-HEALTH CHECK
═══════════════════════════════════════════════

📦 {project-name} | {framework} {version} | PHP {version}
🔀 Branch: {current-branch}

───────────────────────────────────────────────
SESSION:
───────────────────────────────────────────────

  🎯 Next step: {next action}

───────────────────────────────────────────────
AGENT DOCS:          {total count}
───────────────────────────────────────────────

  📄 Projekt-Docs:    {count} in agents/
  📄 Guidelines:       {count} in .augment/guidelines/
  📋 Features:         {count} in agents/features/
  🗺️  Roadmaps:        {count} in agents/roadmaps/
  📄 Contexts:         {count} in agents/contexts/

───────────────────────────────────────────────
MODULE:              {total count}
───────────────────────────────────────────────

  Module             Agent Docs  Roadmaps  Features  Contexts
  ───────────────    ──────────  ────────  ────────  ────────
  {ModuleName}       {count}     {count}   {count}   {count}
  ...

───────────────────────────────────────────────
ROADMAP STATUS:
───────────────────────────────────────────────

  {For each active roadmap:}
  📄 {roadmap-name}
     Progress: [{completed}/{total}] {progress-bar}
     Last modified: {file modification date}

  {If stale roadmaps (old modification date):}
  ⚠️  Potentially outdated:
    • {roadmap} — last modified {n} days ago

───────────────────────────────────────────────
GAPS:
───────────────────────────────────────────────

  {List gaps found:}
  ⚠️  {count} modules without context document
  ⚠️  {count} modules without agent docs
  ⚠️  No active feature plans
  ✅  All areas documented (if no gaps)

═══════════════════════════════════════════════

{If gaps found:}
💡 Run /project-analyze for a full analysis with action plan.
```

### Rules

- **Do NOT create or modify any files** — this is read-only.
- **Do NOT commit or push.**
- **Keep it fast** — no deep code analysis, just file counts and metadata.
- **Show gaps clearly** — the user should see what's missing at a glance.
- **Suggest `/project-analyze`** if significant gaps are found.
