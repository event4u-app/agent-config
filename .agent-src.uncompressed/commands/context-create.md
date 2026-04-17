---
name: context-create
skills: [agent-docs-writing]
description: Analyze a codebase area and create a structured context document
disable-model-invocation: true
---

# context-create

## Instructions

### 1. Ask what to document

If the user provided a topic, use it. Otherwise ask:

```
📄 What area do you want to document?

Examples:
- A module (e.g. "ClientSoftware Module")
- A service (e.g. "CustomerService and Tenant-Switching")
- An integration (e.g. "ProBauS API Integration")
- A domain area (e.g. "Import pipeline from upload to processing")
- Infrastructure (e.g. "Queue system with Horizon")
```

### 2. Determine scope (module vs. project-wide)

Check if `app/Modules/` exists. If yes, ask:

```
Should the context be created in a module or in the project root?

1. 📦 In a module → app/Modules/{Module}/agents/contexts/
2. 🌐 Project root → agents/contexts/
```

If module:
- List available modules and ask which one.
- Target: `app/Modules/{Module}/agents/contexts/`
- Create directory if it doesn't exist.

If project-wide:
- Target: `agents/contexts/`

### 3. Determine context type

```
What type of context is this?

1. 📦 Module — structure and purpose of a module
2. 🏢 Domain — business logic across multiple modules
3. ⚙️ Service — complex service with dependencies
4. 🔗 Integration — external API/system integration
5. 🏗️ Infrastructure — DevOps, infrastructure
```

### 4. Analyze the code

Based on the type, analyze the relevant code area:

**Module context:**
- List all directories and file counts
- Read key services, controllers, models
- Analyze route files
- Check for tests, agent docs

**Domain context:**
- Search across modules for related code
- Trace data flow through services
- Identify all models and tables involved

**Service context:**
- Read the service class and its dependencies
- Trace call chain (who calls it, what it calls)
- Identify configuration and env dependencies

**Integration context:**
- Find API client classes, HTTP calls
- Read config for credentials/URLs
- Identify error handling and retry logic

**Infrastructure context:**
- Read config files, Docker setup
- Identify services and their connections
- Check monitoring/logging setup

**Share findings as you go:**
```
🔍 Ich analysiere den Code...

Gefunden:
  • 5 Services in App/Services/
  • 3 Controllers mit 12 API Endpoints
  • 8 Models mit Beziehungen zu customer_database
  • 42 Tests (15 Unit, 20 Component, 7 Integration)

Should I investigate any specific areas in more detail?
```

### 5. Interactive refinement

After analysis, discuss findings:

- "I noticed {Service} depends on {Dependency}. Is that correct?"
- "There are {count} endpoints — should all be documented?"
- "Are there known issues or technical debt in this area?"
- "Anything I missed?"

### 6. Create the context document

- Read `.augment/templates/contexts.md` for the structure.
- Create the context file in the target directory.
- Fill in all applicable sections from the analysis.
- Set `Last Updated` to today's date.

**Ask for the filename:**
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

- **Do NOT commit or push.**
- **Always analyze the code first** — never guess or assume.
- **Be factual** — document what IS, not what SHOULD be.
- **Ask the user** about unclear areas or business context.
- **Link to specific files** — not vague descriptions.
