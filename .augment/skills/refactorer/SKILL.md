---
name: refactorer
description: "Use when the user says "refactor this", "rename class", or "move method". Safely refactors PHP code — finds all callers, updates downstream dependencies, and verifies with quality tools."
---

# refactorer

## When to use

Renaming, moving, extracting, restructuring code with downstream effects.

NOT for: new features (`feature-planning`), bug fixes (`bug-analyzer`).

## Before refactoring

1. Read agent docs (`agents/docs/`, `agents/contexts/`, module `agents/`)
2. Understand scope
3. Find ALL references (`codebase-retrieval` + `search_query_regex`)
4. Map impact (list all affected files)
5. Present plan before starting

## Workflow

1. **Core change** — minimal, focused rename/extract/move/restructure
2. **Downstream** — callers, interfaces, subclasses, type hints, config, imports
3. **API layer** (if affected) — controller, FormRequest, Resource, OpenAPI schemas, routes, route model binding, version inheritance, module routes
4. **Tests** — list affected, classify (✅ non-breaking / ⚠️ potentially breaking / 🔴 breaking), ask confirmation before changing. Never change expectations to make failing tests pass. Never delete tests.
5. **Quality tools** — PHPStan after each step. Rector fix. PHPStan again.
6. **Run tests** — filtered first, then full suite
7. **Update docs** — project docs, contexts, module docs, AGENTS.md, roadmaps. Rename → update refs. Move → update paths.

## Common patterns

- **Rename:** find usages → update → docs → PHPStan → tests
- **Extract:** create new → move logic → update caller → docs → verify
- **Move namespace:** move file → update namespace + imports → docs → PHPStan
- **Change signature:** update method → update callers → present test changes → verify
- **Change API:** controller + request + resource + OpenAPI + route → test changes → docs → verify
- **Replace impl:** new impl → update binding → update refs → tests → remove old
- **Module restructure:** move files → namespaces → ServiceProvider → routes → docs → verify

## Safety

Never skip caller search (#1 cause of broken refactors). Never remove old code before verifying new. Never change test expectations without user approval. PHPStan + tests after every step. No drive-by cleanups. Reveals more work → stop + discuss.

## Related: `project-docs`, `agent-docs`, `api-endpoint`, `coder`, `pest-testing`, `openapi`

## Gotcha: find ALL callers (model misses tests/config), separate refactor from features, stay scope-focused (same behavior), full test suite after each step.

## Do NOT: refactor without tests before/after, change test expectations without approval, cross module boundaries without checking downstream.
