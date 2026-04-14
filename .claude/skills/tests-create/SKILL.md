---
name: tests-create
description: "tests-create"
disable-model-invocation: true
---

# tests-create

## Instructions

### 1. Detect framework — Pest (`pestphp/pest`) or PHPUnit. Match existing test style.

### 2. Identify changes — `git diff origin/main..HEAD --name-only`. Focus: business logic PHP files.

### 3. Understand code — `codebase-retrieval`, existing tests, intended behavior.

### 4. Write meaningful tests

**DO:** business logic, edge cases, error handling, code paths, descriptive names.
**DON'T:** trivial assertions, implementation copies, framework internals, private methods, empty assertions.

### 5. Structure — one file per class, mirror source dirs, `describe` blocks, data providers, mock externals.

### 6. Verify — run in container, fix failures.

### Rules — No commit/push. Quality > quantity. Hard-to-test → flag + suggest refactor.
