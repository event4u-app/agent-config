---
skills: [agent-docs]
description: Analyze a codebase area and create a structured context document
---

# context-create

## Instructions

### 1. Ask what to document

Topic provided → use. Otherwise:

```
📄 What area do you want to document?

Examples:
- A module (e.g. "ClientSoftware Module")
- A service (e.g. "CustomerService and Tenant-Switching")
- An integration (e.g. "ProBauS API Integration")
- A domain area (e.g. "Import pipeline from upload to processing")
- Infrastructure (e.g. "Queue system with Horizon")
```

### 2. Scope (module vs project-wide)

```
Should the context be created in a module or in the project root?

1. 📦 In a module → app/Modules/{Module}/agents/contexts/
2. 🌐 Project root → agents/contexts/
```

Module → `app/Modules/{Module}/agents/contexts/`. Project → `agents/contexts/`.

### 3. Context type

```
What type of context is this?

1. 📦 Module — structure and purpose of a module
2. 🏢 Domain — business logic across multiple modules
3. ⚙️ Service — complex service with dependencies
4. 🔗 Integration — external API/system integration
5. 🏗️ Infrastructure — DevOps, infrastructure
```

### 4. Analyze code

Per type: **Module** → dirs, services, controllers, models, routes, tests. **Domain** → cross-module, data flow, models. **Service** → class, deps, call chain. **Integration** → API clients, config, error handling. **Infrastructure** → config, Docker, monitoring.

Share findings:
```
🔍 Ich analysiere den Code...

Gefunden:
  • 5 Services in App/Services/
  • 3 Controllers mit 12 API Endpoints
  • 8 Models mit Beziehungen zu customer_database
  • 42 Tests (15 Unit, 20 Component, 7 Integration)

Should I investigate any specific areas in more detail?
```

### 5. Discuss findings — ask about deps, coverage, issues, gaps

### 6. Create context

Template: `.augment/templates/contexts.md`. Fill sections, set `Last Updated`. Ask filename:
```
Context name?

> 1. {suggested-kebab-case-name} (suggested)
> 2. Enter a custom name

Target: {target-directory}/{name}.md
```

### 7. Show result

```
═══════════════════════════════════════════════
  ✅  CONTEXT CREATED
═══════════════════════════════════════════════

📄 {path/to/context.md}
📊 Typ: {type}
📦 Module: {module or "project-wide"}

───────────────────────────────────────────────
INHALT:
───────────────────────────────────────────────

  Key Files:       {count}
  Key Classes:     {count}
  DB Tables:       {count}
  API Endpoints:   {count}
  Known Issues:    {count}

═══════════════════════════════════════════════
```

### 8. Offer next steps

```
What's next?

1. ✏️ Adjust context → /context-refactor
2. 📋 Plan a feature based on this context → /feature-plan
3. ✅ Done
```

### Rules

- No commit/push. Analyze code first. Be factual. Link to specific files.

