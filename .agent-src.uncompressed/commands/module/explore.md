---
name: module:explore
tier: 2
cluster: module
sub: explore
skills: [laravel, symfony-workflow, php-coder]
scope:
  structure: modular-monolith
  rationale: "Targets projects with a Modules/ or src/<Domain>/ folder convention (HMVC, DDD-lite, Symfony bundles). Pure-flat repositories have nothing to explore."
description: Explore a module — load its structure, docs, and context into the current conversation
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "show me the X module, load the module context"
  trigger_context: "existing Modules/<Name>/ referenced in the prompt"
---

# /module explore
## Instructions

### 1. Check for modules

- **Laravel HMVC**: Check `app/Modules/`.
- **Symfony / DDD-lite**: Check `src/<Domain>/` or `src/Module/<Domain>/`.
- **Composer packages / libraries**: Check `./agents/` or `src/` for domain directories.
- **Node / TS monorepo**: Check `packages/`, `apps/`, or `modules/`.
- **Python**: Check top-level package dirs under `src/<package>/` or flat `<package>/`.
- **Go**: Check `internal/<domain>/` or `cmd/<service>/`.
- If none of the above exists:
  ```
  ⚠️  No module system found (no Modules/, src/<Domain>/, packages/, internal/, or equivalent directory).
  ```
  Stop.

### 2. List available modules

Scan the detected modules directory (see step 1) and show all modules. Skip `.module-template`, `.example`, and hidden dirs:

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

### 3. Analyze the module

For the selected module, gather in parallel:

**Structure:**
- List all directories and files (2 levels deep)
- Count PHP files per directory (Controllers, Services, Models, Jobs, Commands, etc.)
- List route files and their contents

**Code:**
- Use `codebase-retrieval` to understand the module's purpose and key classes
- Read `README.md` if it exists
- Read agent docs (`agents/`) if they exist — including features, roadmaps, contexts
- Read `Docs/` if it exists (human-facing documentation)

**Tests:**
- Count test files per suite (Unit, Component, Integration)

**Roadmaps:**
- Check `agents/roadmaps/*.md` for active roadmaps
- For each: count completed vs total steps (e.g. "3/7 steps done")
- Highlight the next open step

**Context:**
- Check `agents/contexts/` for existing context docs (project-root and module-level)
- Check `agents/features/` for related feature plans

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

- **Do NOT modify any code** — this command is read-only.
- **Do NOT commit or push.**
- **Load the module context** into your understanding for the rest of the conversation.
- **Remember the module** for follow-up commands (feature-plan, context-create, etc.).
