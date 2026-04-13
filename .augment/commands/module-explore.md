---
skills: [laravel]
description: Explore a module — load its structure, docs, and context into the current conversation
---

# module-explore

## Instructions

### 1. Check for modules

Laravel: `app/Modules/`. Composer/packages: `./agents/` or `src/`. None → stop.

### 2. List modules (skip `.module-template`)

```
📦 Available modules:

  #  Module             Directories      Agent Docs    Context
  ─  ────────────────   ──────────────   ──────────    ───────
  1  ApiClient          App, Routes      ❌             ❌
  2  ClientSoftware     App, Routes      ✅ (roadmaps)  ❌
  3  Grafana            App, Routes      ✅ (roadmaps)  ❌
  4  Stubbing           App              ❌             ❌

Which module do you want to explore? (number or name)
```

### 3. Analyze (parallel)

**Structure**: dirs (2 levels), PHP file counts, routes. **Code**: `codebase-retrieval`, README, agent docs, Docs/. **Tests**: per suite. **Roadmaps**: progress + next step. **Context**: existing docs + features.

### 4. Display module overview

```
═══════════════════════════════════════════════
  📦 MODULE: {ModuleName}
═══════════════════════════════════════════════

{Description from README or auto-detected}

───────────────────────────────────────────────
STRUCTURE:
───────────────────────────────────────────────

  App/
    Console/Commands/    {count} Commands
    Enums/               {count} Enums
    Http/Controllers/    {count} Controllers
    Http/Requests/       {count} Requests
    Jobs/                {count} Jobs
    Models/              {count} Models
    Services/            {count} Services

  Routes/
    api.php              {route count} Routes
    console.php          {command count} Commands
    web.php              {route count} Routes

  Tests/
    Unit/                {count} Tests
    Component/           {count} Tests
    Integration/         {count} Tests

  Migrations/            {count} Migrations
  Config/                {exists or not}

───────────────────────────────────────────────
NAMESPACE:
───────────────────────────────────────────────

  App\Modules\{ModuleName}\App\

───────────────────────────────────────────────
KEY CLASSES:
───────────────────────────────────────────────

  Services:
    • {ServiceName} — {brief description}
    • {ServiceName} — {brief description}

  Controllers:
    • {ControllerName} — {brief description}

───────────────────────────────────────────────
AGENT DOCS:
───────────────────────────────────────────────

  {List of agent docs or "No agent docs found"}

───────────────────────────────────────────────
ROADMAPS:
───────────────────────────────────────────────

  • {roadmap title} — {completed}/{total} steps (next: {next step title})
  • "No roadmaps found" if none

───────────────────────────────────────────────
CONTEXT:
───────────────────────────────────────────────

  {Existing context doc summary or "No context found"}

═══════════════════════════════════════════════
```

### 5. Offer next steps

```
What would you like to do?

1. 🔍 Dive deeper — analyze a specific class/service
2. 📄 Create context → /context-create
3. 📋 Plan feature → /feature-plan (Module: {ModuleName})
4. 🗺️ View roadmap (if available)
5. ✅ Done — module context is loaded
```

### Rules

- Read-only. No commit/push. Load context for conversation. Remember module for follow-ups.

