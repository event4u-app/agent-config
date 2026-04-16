---
name: context-document
description: "Use when the user says "create context", "document this area", or wants a structured snapshot of a codebase area for agent orientation."
source: package
---

# context

## When to use

Use this skill when:
- Documenting a module, service, or integration for future reference
- Exploring an unfamiliar area of the codebase
- Preparing for a feature that touches multiple areas
- Onboarding to a new part of the codebase


Do NOT use when:
- Writing code or features
- Creating roadmaps (use `roadmap-manager` skill)

## Procedure: Manage contexts

1. **Identify scope** — Which area of the codebase needs a context document?
2. **Research** — Use codebase-retrieval to understand the area (files, patterns, dependencies).
3. **Write or update** — Create/update the context doc following the template below.
4. **Verify** — Confirm all referenced files exist and descriptions match current code.

A **context document** is a structured snapshot of a codebase area:
- What it does, why it exists
- Key files, classes, and patterns
- Database tables and API endpoints
- Dependencies and known issues

Unlike feature plans (future-focused) or roadmaps (task-focused), contexts are
**present-focused** — they describe the current state of the code.

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

## Behavior rules

### Creating contexts

1. **Always analyze the code first** — use `codebase-retrieval`, `view`, and file listing.
2. **Be factual** — describe what IS, not what SHOULD be.
3. **Be specific** — link to files, name classes, reference tables.
4. **Ask the user** about anything unclear.

### Maintaining contexts

- Update `Last Updated` when modifying.
- When code changes affect a context, update it.
- `/context-refactor` is the dedicated command for this.

## Commands

| Command | Purpose |
|---|---|
| `context-create` | Analyze an area and create a new context document |
| `context-refactor` | Revisit, update, and extend an existing context |


## Output format

1. Context document in the correct location with structured sections
2. Cross-references to related contexts updated

## Auto-trigger keywords

- context document
- codebase context
- orientation doc
- context creation

## Gotcha

- Context docs become stale — always check the actual code before trusting a context document.
- Don't create context docs for areas that change weekly — they'll be outdated immediately.
- Keep context docs factual, not aspirational — document what IS, not what should be.

## Do NOT

- Do NOT create contexts without analyzing the code first.
- Do NOT guess about architecture — verify by reading the code.
- Do NOT duplicate information from `AGENTS.md` — reference it instead.
- Do NOT commit or push without permission.
- Do NOT create contexts for trivial areas — only when the knowledge is worth persisting.
