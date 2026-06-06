---
model_tier: high
name: code-refactoring
description: "Use when the user says 'refactor this', 'rename class', or 'move method'. Safely refactors code in any language — finds all callers, updates downstream dependencies, verifies via quality tools."
domain: engineering
workspaces:
  - engineering
packs:
  - engineering-base
---

# refactorer

## When to use

Use this skill when renaming, moving, extracting, or restructuring code — any change that
may have downstream effects on callers, interfaces, tests, documentation, or API contracts.


Do NOT use when:
- New feature development (use `feature-planning` skill)
- Bug fixes that don't involve restructuring (use `bug-analyzer` skill)

## Before refactoring

1. **Read the agent docs** — check `agents/reference/docs/` and `agents/settings/contexts/` for the area you're refactoring.
   For modules, also read the project's module-docs directory (path varies by stack — Laravel: `app/Modules/{Module}/agents/`; Nx: `apps/{app}/docs/`; mono-repo: per-package `docs/`). See the `project-docs` skill for the mapping.
2. **Understand the scope** — what exactly needs to change and why?
3. **Find ALL references** — use `codebase-retrieval` and `view` with `search_query_regex` to find every
   caller, implementation, test, and configuration that references the code being changed.
4. **Map the impact** — create a list of all files that will need changes.
5. **Present the plan** — show the user what will be affected before starting.

## Procedure: Refactor code

### Step 1: Make the core change

- Rename, extract, move, or restructure the target code.
- Keep the change minimal and focused.

### Step 2: Update all downstream dependencies

For each affected file (from the impact analysis):

- **Callers**: Update method calls, constructor arguments, imports.
- **Interfaces / abstract methods**: Update all implementations to match new signatures.
- **Subclasses**: Update overridden methods.
- **Type hints / annotations**: Update type references (PHPDoc, TypeScript types, Python type hints, Go generics, Rust generics).
- **Config / bindings**: Update service container bindings, route references, etc.
- **Imports**: Add or update import statements (`use` for PHP, `import` for JS/TS/Python, `import` blocks for Go, `use` for Rust).

### Step 3: Update API layer (if request handlers / endpoints are affected)

When refactoring touches handlers, route registrations, request validators, or response shapers, walk the stack-appropriate boundary. Use the carve-out skill for the project's framework if one exists; otherwise consult the table below for what to check on each stack.

| Layer | What to check and update |
|---|---|
| **Route registration** | Route file / decorator / file-based-router entry — name, URL, HTTP method, parameter binding |
| **Handler / Controller** | Entry signature, injected dependencies, return type |
| **Request validator** | Validation rule definitions, allowlisted fields (FormRequest, Zod schema, class-validator DTO, Pydantic model, struct tags) |
| **Response shaper** | Field mapping in the transformer (API Resource, serializer, DTO mapper, response model) |
| **API contract** | OpenAPI annotations, generated spec, typed client (regenerate if generated) |
| **Authorization rule** | Policy / voter / guard / middleware / route dependency that protects the route |
| **Module routes** | Module-local routing surface (Laravel `app/Modules/*/Routes/`, Nx `apps/*/src/routes`, mono-repo per-package routes) |

Carve-out routing:
- Laravel: [`laravel-api-endpoint`](../laravel-api-endpoint/SKILL.md)
- Next.js: [`nextjs-patterns`](../nextjs-patterns/SKILL.md)
- Symfony: [`symfony-workflow`](../symfony-workflow/SKILL.md)

### Step 4: Update tests — with user approval

**Before changing any test**, present a summary to the user:

1. **List all affected tests** — which test files and which test cases need changes.
2. **Describe what changes** — for each test, explain what assertion/setup changes and why.
3. **Classify the change**:
   - ✅ **Non-breaking**: Test adapts to internal refactoring (renamed class, moved method) —
     same behavior, different code path. No API contract change.
   - ⚠️ **Potentially breaking**: Test expectations change (new field in response, changed
     validation rule, different error code) — this MAY affect API consumers.
   - 🔴 **Breaking**: Test removes or changes existing API behavior (removed field, changed
     endpoint URL, different response structure) — this WILL affect API consumers.
4. **Ask for confirmation** (numbered options):
   ```
   > 1. Yes — apply test changes
   > 2. No — I'll adjust the tests myself
   ```
5. Only proceed after the user confirms.

**Rules for test changes:**
- Do NOT change test expectations to make failing tests pass unless the refactoring intentionally
  changes behavior. A failing test after refactoring usually means the refactoring has a bug.
- Do NOT delete tests — adapt them to the new code structure.
- Do NOT reduce test coverage — if you split a class, split the test too.

### Step 5: Verify with the project's quality tools

Run the project's type-checker and linter after each significant step — do NOT batch everything to the end. The exact command set depends on the stack; resolve via `quality-tools` skill or the project's `Taskfile.yml` / `package.json scripts` / `composer.json scripts` / `Makefile`.

| Stack | Typical pipeline |
|---|---|
| Laravel / PHP | `vendor/bin/phpstan analyse` → `vendor/bin/rector process` → `vendor/bin/ecs check --fix` → re-run PHPStan |
| TypeScript | `tsc --noEmit` → `eslint --fix` → `prettier --write` |
| Python | `mypy` (or `pyright`) → `ruff check --fix` → `ruff format` |
| Go | `go vet ./...` → `golangci-lint run --fix` → `gofmt -w` |
| Rust | `cargo check` → `cargo clippy --fix` → `cargo fmt` |

If auto-fixers can rewrite types (Rector for PHP, `eslint --fix` for TS), re-run the type-checker after them — auto-fixers can introduce new errors.

### Step 6: Run tests

- Run tests related to the changed code first (`php artisan test --filter=...`, `pnpm test -- <pattern>`, `pytest -k <pattern>`, `go test ./{path}/...`, `cargo test {pattern}`).
- Then run the full test suite (`php artisan test`, `pnpm test`, `pytest`, `go test ./...`, `cargo test`).
- All tests must pass before the refactoring is considered complete.

### Step 7: Update documentation

After the code changes are verified, update all affected documentation:

| Documentation layer | When to update | Location |
|---|---|---|
| **Project docs** | When conventions, patterns, or key files change | `agents/reference/docs/*.md` |
| **Project contexts** | When architecture or high-level flow changes | `agents/settings/contexts/*.md` |
| **Module agent docs** | When module-specific behavior changes | `{module_root}/*/{agent_folder}/` (per `modules.root_paths` + `modules.agent_folder`) |
| **Module Docs/** | When module internals change | `{module_root}/*/Docs/` |
| **AGENTS.md** | When project-wide conventions change | `AGENTS.md` |
| **Roadmaps** | When a roadmap step is completed | `agents/roadmaps/*.md` |

**Rules for doc updates:**
- If you rename a class/method referenced in docs → update the reference.
- If you move files → update all path references.
- If you change a pattern → update the pattern description.
- If you add a new convention → document it.
- Do NOT create new docs unless the refactoring introduces a genuinely new concept.

## Common refactoring patterns

### Rename (method, class, property)
1. Find all usages → update all usages → update docs → run PHPStan → run tests.

### Extract method / class
1. Create the new method/class → move logic → update caller → update docs → run PHPStan → run tests.

### Move class to different namespace
1. Move file → update namespace → find all `use` statements → update imports → update docs → run PHPStan.

### Change method signature
1. Update the method → find all callers → update each caller → present test changes → update docs → run PHPStan.

### Change API endpoint
1. Update controller + request + resource + OpenAPI schemas + route → present test changes →
   update docs (`agents/reference/docs/controller.md`, `agents/reference/docs/api-resources.md`) → run PHPStan → run tests.

### Replace implementation (e.g. switch service)
1. Create new implementation → update binding → find all direct references → update → present test
   changes → update docs → run PHPStan → run tests → remove old implementation.

### Move/restructure module
1. Move files → update namespaces → update `ModuleServiceProvider` if needed → update module routes →
   update module agent docs → update project contexts → run PHPStan → run tests.

## Safety rules

- **Never skip the caller search** — missing a caller is the #1 cause of broken refactorings.
- **Never remove old code before verifying** the new code works everywhere.
- **Never change test expectations without user approval** — explain what changes and why first.
- **Run PHPStan after every step**, not just at the end.
- **Run tests after every step**, not just at the end.
- **Update docs after code changes** — stale docs are worse than no docs.
- **Do NOT commit or push** — only apply local changes.
- **Do NOT refactor code outside the requested scope** — no drive-by cleanups.
- If the refactoring reveals more work than expected, **stop and discuss with the user**.

## Cross-References

| Skill | Relationship |
|---|---|
| `project-docs` | Which docs to read before refactoring a specific area |
| `agent-docs-writing` | When to create/update agent documentation |
| `api-endpoint` | Full API endpoint structure (controller + request + resource + schema) |
| `php-coder` | PHP coding conventions to follow in refactored code |
| `pest-testing` | Test conventions when adapting tests |
| `openapi` | OpenAPI schema attribute patterns |


## Output format

1. Refactored code with clear separation of changes
2. Before/after comparison for key changes
3. Test verification confirming no behavior change

## Gotcha

- Always find ALL callers before renaming — the model frequently misses usages in tests and config files.
- Don't refactor and add features in the same commit — separate concerns for reviewability.
- The model tends to "improve" code it's refactoring — stay scope-focused, refactor means same behavior.
- Run the full test suite after every refactoring step — don't batch multiple refactors.

## Do NOT

- Do NOT refactor without running tests before and after.
- Do NOT change test expectations without explicit user approval.
- Do NOT refactor across module boundaries without checking downstream.

## Auto-trigger keywords

- refactoring
- rename
- move class
- change signature
