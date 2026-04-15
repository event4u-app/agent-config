---
name: refactorer
description: "Use when the user says "refactor this", "rename class", or "move method". Safely refactors PHP code — finds all callers, updates downstream dependencies, and verifies with quality tools."
source: package
---

# refactorer

## When to use

Use this skill when renaming, moving, extracting, or restructuring code — any change that
may have downstream effects on callers, interfaces, tests, documentation, or API contracts.


Do NOT use when:
- New feature development (use `feature-planning` skill)
- Bug fixes that don't involve restructuring (use `bug-analyzer` skill)

## Before refactoring

1. **Read the agent docs** — check `agents/docs/` and `agents/contexts/` for the area you're refactoring.
   For modules, also read `app/Modules/{Module}/agents/`. See the `project-docs` skill for the mapping.
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
- **Type hints / PHPDoc**: Update type references.
- **Config / bindings**: Update service container bindings, route references, etc.
- **Imports**: Add or update `use` statements.

### Step 3: Update API layer (if controllers/endpoints are affected)

When refactoring touches controllers, requests, resources, or routes:

| Component | What to check and update |
|---|---|
| **Controller** | `__invoke()` signature, injected services, return type |
| **FormRequest** | `authorize()`, `rules()`, validated field names |
| **Resource** | `toArray()` field mapping, conditional fields, nested resources |
| **OpenAPI Schema Attributes** | Request schemas (`ShowResourceRequestSchema`, `CreateResourceRequestSchema`, etc.) |
| **OpenAPI Response Attributes** | Response schemas (`ShowResourceResponseSchema`, `CreateResourceResponseSchema`, etc.) |
| **OpenAPI Error Attributes** | `ResourceNotFoundResponse`, `ValidationErrorResponse` |
| **Custom Request Schemas** | Extended schema classes in `app/OpenApi/Schema/Request/v{N}/` |
| **Route definition** | Route file in `routes/api/v{N}/`, route name, URL path, HTTP method |
| **Route model binding** | Parameter name in route must match variable name in controller |
| **Version inheritance** | If v1 extends v2 (or vice versa), check both versions |
| **Module routes** | Module routes in `app/Modules/*/Routes/api.php` with version prefix |

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

### Step 5: Verify with quality tools

Run quality tools after each significant step — do NOT batch everything to the end:

- Run PHPStan: `vendor/bin/phpstan analyse` (see `quality-tools` skill for detection).
- If PHPStan finds new errors from the refactoring → fix immediately before continuing.
- Run Rector + ECS: `vendor/bin/rector process && vendor/bin/ecs check --fix`.
- Run PHPStan again after Rector (Rector can introduce issues).

### Step 6: Run tests

- Run tests related to the changed code first (`php artisan test --filter=...`).
- Then run the full test suite (`php artisan test`).
- All tests must pass before the refactoring is considered complete.

### Step 7: Update documentation

After the code changes are verified, update all affected documentation:

| Documentation layer | When to update | Location |
|---|---|---|
| **Project docs** | When conventions, patterns, or key files change | `agents/docs/*.md` |
| **Project contexts** | When architecture or high-level flow changes | `agents/contexts/*.md` |
| **Module agent docs** | When module-specific behavior changes | `app/Modules/*/agents/` |
| **Module Docs/** | When module internals change | `app/Modules/*/Docs/` |
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
   update docs (`agents/docs/controller.md`, `agents/docs/api-resources.md`) → run PHPStan → run tests.

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
| `agent-docs` | When to create/update agent documentation |
| `api-endpoint` | Full API endpoint structure (controller + request + resource + schema) |
| `coder` | PHP coding conventions to follow in refactored code |
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
