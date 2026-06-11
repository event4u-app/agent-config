---
model_tier: medium
name: module-explore
pack: engineering-base
tier: 2
cluster: module
sub: explore
skills: [laravel, symfony-workflow, php-coder]
description: Explore a module — load its structure, docs, and context into the current conversation
suggestion:
  eligible: true
  trigger_description: "show me the X module, load the module context"
  trigger_context: "existing Modules/<Name>/ referenced in the prompt"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /module explore
## Instructions

### 1. Resolve module roots

Read the `modules:` block from `.agent-project-settings.yml` via the
loader (`get_modules_config()` in `scripts/_lib/agent_settings.py`):

- If `modules.enabled` is `true` and `modules.root_paths` is non-empty,
  use those paths verbatim. Skip the fallback table.
- If the block is missing / disabled / empty, fall back to the
  auto-detection table below — same shape `propose_modules_config.py`
  uses internally.

**Auto-detection fallback table** (consulted only when `modules:` is
unset):

- **Laravel HMVC**: Check `app/Modules/`.
- **Symfony / DDD-lite**: Check `src/<Domain>/` or `src/Module/<Domain>/`.
- **Composer packages / libraries**: Check `./agents/` or `src/` for domain directories.
- **Node / TS monorepo**: Check `packages/`, `apps/`, or `modules/`.
- **Python**: Check top-level package dirs under `src/<package>/` or flat `<package>/`.
- **Go**: Check `internal/<domain>/` or `cmd/<service>/`.

If both the `modules:` block and the fallback table yield nothing:

```
⚠️  No module system found (no Modules/, src/<Domain>/, packages/, internal/, or equivalent directory).
   Run `python3 scripts/propose_modules_config.py` to surface candidates.
```

Stop.

### 2. List available modules

Enumerate modules across every resolved root via `enumerate_modules()`
(see `scripts/_lib/agent_settings.py`). Skip directories listed in
`modules.skip_dirs` (defaults: `.module-template`, `.example`) and
hidden dirs. The "Agent Docs" column reflects the configured
`modules.agent_folder` (default `agents/`):

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

Resolve `{agent_folder}` from `modules.agent_folder` (default `agents`).
Let `{module_dir}` be the selected module's `module_path` from
`enumerate_modules()`. For the selected module, gather in parallel:

**Auto-load module contexts (entry-point hook):**
- If `{module_dir}/{agent_folder}/settings/contexts/` exists, read every
  `*.md` it ships and surface it into the conversation context per the
  same conventions as [`commands/context/create.md`](../context/create.md).
- Skip silently when the folder is absent — never error.

**Structure:**
- List all directories and files (2 levels deep)
- Count source files per directory (Controllers, Services, Models, Jobs, Commands, etc. — adapt to the configured stack)
- List route / entry-point files and their contents

**Code:**
- Use `codebase-retrieval` to understand the module's purpose and key classes
- Read `README.md` if it exists
- Read agent docs (`{module_dir}/{agent_folder}/`) if they exist — features, roadmaps, contexts
- Read `Docs/` if it exists (human-facing documentation)

**Tests:**
- Count test files per suite (Unit, Component, Integration)

**Roadmaps:**
- Check `{module_dir}/{agent_folder}/roadmaps/*.md` for active roadmaps
- For each: count completed vs total steps (e.g. "3/7 steps done")
- Highlight the next open step

**Context:**
- Check `{module_dir}/{agent_folder}/settings/contexts/` for module-level context docs (already surfaced by the auto-load hook above)
- Check `agents/settings/contexts/` for project-root contexts
- Check `{module_dir}/{agent_folder}/features/` for related feature plans

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

  {modules.namespace_template substituted with {ModuleName}, or
   "—" when the stack has no PHP-style namespace}

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
