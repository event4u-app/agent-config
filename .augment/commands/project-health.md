---
skills: [quality-tools]
description: Quick project health check — show status of docs, modules, contexts, and roadmaps without creating anything
---

# project-health

## Instructions

Quick read-only health check.

### 1. Gather data (parallel)

`composer.json`, `git branch`, `git log -3`, file counts in `agents/`, `app/Modules/*/agents/`, tests.

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

- Read-only. No commit/push. Fast (file counts only). Show gaps clearly. Suggest `/project-analyze` for deep analysis.

