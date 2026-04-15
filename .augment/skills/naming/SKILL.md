---
name: naming
description: "Use when naming anything — PHP classes, routes, database columns, agent files, branches, or config keys. Provides consistent naming conventions across the project."
source: package
---

# naming

## When to use

Use when unsure about the correct naming pattern for any element in the project.

## Procedure: Name something

1. **Identify the element type** — Class, route, column, branch, agent file?
2. **Look up the convention** — See guideline `php/naming.md` for all naming tables.
3. **Check existing patterns** — Look at neighboring files, match the style.

## Quick reference

| Element | Convention |
|---|---|
| Controller | `{Action}{Entity}Controller` |
| FormRequest | `{Action}{Entity}Request` |
| Service | `{Domain}Service` |
| Job | `{Action}{Entity}Job` |
| Event | `{Entity}{PastTense}` |
| DTO | `{Entity}{Purpose}Dto` |
| Tables | snake_case, plural |
| Columns | snake_case |
| Routes | kebab-case, plural |
| Variables | camelCase |
| Constants | UPPER_SNAKE_CASE |
| Array keys | snake_case |

## Gotcha

- Consistency beats cleverness — match existing patterns.
- Spell out full words — no abbreviations (`usr`, `msg`, `cfg`).
- Don't mix conventions: DB = snake_case, PHP = camelCase, classes = PascalCase.

### Validate

- Verify the name matches the convention for its element type (see table above).
- Check that neighboring files/columns/routes use the same pattern.
- Confirm no abbreviations or acronyms unless already established in the codebase.

## Do NOT

- Do NOT use abbreviations that aren't universally understood.
- Do NOT mix naming conventions within the same context.
- Do NOT use generic names (Manager, Helper, Utils) without specificity.

## Auto-trigger keywords

- naming convention
- class naming
- route naming
- variable naming
