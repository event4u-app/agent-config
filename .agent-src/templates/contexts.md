# Context Template

Templates for context documents stored in `agents/contexts/` or `app/Modules/{Module}/agents/contexts/`.

A **context document** captures the architectural understanding of a codebase area — its structure,
key classes, patterns, dependencies, and conventions. It's a snapshot of knowledge that helps
agents (and developers) quickly orient themselves when working in that area.

---

## Rules for Context Documents

1. **Factual.** Based on codebase analysis, not assumptions.
2. **Navigational.** Help others find their way — point to key files and patterns.
3. **Maintainable.** Update when the codebase changes.
4. **Language:** All context documents must be written in **English**.
5. **One area per file.** Don't combine unrelated contexts.

---

## Context Types

| Type | When to use | Example |
|---|---|---|
| **Module** | Document a module's structure and purpose | `client-software.md` |
| **Domain** | Document a business domain across modules | `import-pipeline.md` |
| **Service** | Document a complex service and its dependencies | `customer-service.md` |
| **Integration** | Document an external API/system integration | `probaus-api.md` |
| **Infrastructure** | Document infrastructure or DevOps concerns | `queue-system.md` |

---

## Template

Copy the structure below into a new file:

```markdown
# Context: {title}

> {One sentence: What area does this context cover?}

**Type:** {Module | Domain | Service | Integration | Infrastructure}
**Created:** {YYYY-MM-DD}
**Last Updated:** {YYYY-MM-DD}
**Module:** {module name or "project-wide"}
**Related Features:** {links to feature plans or "none"}

## Overview

{2-3 sentences describing what this area does, why it exists, and who/what depends on it.}

## Key Files

| File | Purpose |
|---|---|
| `{path/to/file.php}` | {what it does} |
| `{path/to/file.php}` | {what it does} |

## Architecture

{How the pieces fit together. Data flow, request flow, or processing pipeline.
Use bullet points or a simple ASCII diagram.}

## Key Classes & Services

### {ClassName}

- **Location:** `{full/path.php}`
- **Purpose:** {what it does}
- **Key methods:** `{method1()}`, `{method2()}`
- **Dependencies:** {what it depends on}

## Database

| Table | Purpose | Connection |
|---|---|---|
| `{table_name}` | {what it stores} | {api_database / customer_database} |

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/{path}` | {what it does} |

## Dependencies

### Internal
- {Other modules or services this depends on}

### External
- {External APIs, packages, or systems}

## Patterns & Conventions

- {Patterns specific to this area}
- {Naming conventions, coding patterns}

## Known Issues / Technical Debt

- {Known problems or areas for improvement}

## Notes

{Optional: edge cases, gotchas, historical context.}
```

---

## Tips

- **Start with `/module-explore`** to gather data before creating a context.
- **Link to specific files** — `app/Modules/Import/App/Services/ImportService.php` beats "the import service".
- **Document the "why"** — why was it built this way? What tradeoffs were made?
- **Include known issues** — future agents will thank you.
- **Update `Last Updated`** whenever you modify the context.

