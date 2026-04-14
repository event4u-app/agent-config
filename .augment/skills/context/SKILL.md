---
name: context
description: "Use when the user says "create context", "document this area", or wants a structured snapshot of a codebase area for agent orientation."
source: package
---

# context

## When to use

Document module/service/integration, explore unfamiliar code, prep multi-area features. NOT for: coding, roadmaps.

Context = present-focused snapshot (what/why, key files, DB/API, deps, issues). Unlike features (future) or roadmaps (tasks).

## File structure

```
.augment/contexts/                       # Shared contexts (about the agent system itself)
├── augment-infrastructure.md
├── skills-and-commands.md
└── documentation-hierarchy.md

agents/contexts/                         # Project-wide contexts
├── {context-name}.md

app/Modules/{Module}/agents/contexts/    # Module-scoped contexts
├── {context-name}.md

.augment/templates/
└── contexts.md                          # Context template
```

## Context types

| Type | Scope | Example |
|---|---|---|
| **Module** | Single module's structure and purpose | `client-software.md` |
| **Domain** | Business domain across modules | `import-pipeline.md` |
| **Service** | Complex service with its dependencies | `customer-service.md` |
| **Integration** | External API/system integration | `probaus-api.md` |
| **Infrastructure** | DevOps or infrastructure concern | `queue-system.md` |

## Where to store contexts

| Content | Location |
|---|---|
| About the `.augment/` system itself | `.augment/contexts/` (shared package) |
| Project-wide or cross-module | `agents/contexts/` |
| Module-specific | `app/Modules/{Module}/agents/contexts/` |
| If unsure | Ask the user |

### Shared vs. project-specific contexts

**`.augment/contexts/`** — Part of the shared package. Describes the agent infrastructure:
how overrides work, what skills/commands exist, the documentation hierarchy.
These are read-only at project level (like all `.augment/` content).

**`agents/contexts/`** — Project-specific. Describes the project's business domain:
modules, services, integrations, database architecture.
These are created and maintained per project.

## Integration with other systems

### Sessions
When working in an area that has a context document, load it at session start.
The session's Context section can reference it.

### Features
Before planning a feature, check if a context document exists for the affected area.
It provides the baseline understanding needed for planning.

### Module exploration
`/module-explore` gathers the data needed to create a module context.
`/context-create` turns that exploration into a persistent document.

### Overrides
When customizing a shared skill or command, read `.augment/contexts/override-system.md` for the naming conventions and format.

### Shared contexts
When working on the agent infrastructure itself (skills, commands, rules), check
`.augment/contexts/` for existing documentation about the system.

## Rules: analyze code first (factual, specific), update `Last Updated` on changes. Commands: `context-create`, `context-refactor`.

## Gotcha: docs become stale (verify code), don't create for fast-changing areas, factual not aspirational.

## Do NOT: create without analysis, guess (verify), duplicate AGENTS.md.
- Do NOT commit or push without permission.
- Do NOT create contexts for trivial areas — only when the knowledge is worth persisting.
