---
name: tests-create
skills: [pest-testing]
description: Write meaningful tests for the changes in the current branch
disable-model-invocation: true
---

# tests-create

## Instructions

### 1. Detect the test framework

- Check if **Pest** is installed: look for `pestphp/pest` in `composer.json` or `vendor/bin/pest`.
    - If Pest is available → write **Pest tests**.
- If Pest is not installed → write **PHPUnit tests**.
- Check existing tests in the project (`tests/` directory) to match the style and conventions already in use.

### 2. Identify what changed

- Run `git diff origin/main..HEAD --name-only` or `git diff origin/master..HEAD --name-only` (depending on project) to get all changed
  files.
- Focus on **PHP files with business logic** — skip config files, migrations, views, etc.
- Read each changed file and understand what was added or modified.

### 3. Understand the code before writing tests

- Use `codebase-retrieval` to understand the classes, their dependencies, and how they're used.
- Read existing tests for the same or related classes to match patterns.
- Understand what the method is supposed to do, not just what it does.

### 4. Write meaningful tests

**DO write tests that:**

- Test the **actual business logic** and expected behavior.
- Cover **edge cases**: null values, empty strings, boundary values, invalid input.
- Test **error handling**: what happens when things go wrong?
- Test **different code paths**: if/else branches, early returns, fallback behavior.
- Verify **return values and side effects** that matter.
- Use descriptive test names that explain the scenario (e.g. `it returns fallback status when input is empty`).

**Do NOT write tests that:**

- Assert trivial things like parameter count, method existence, or class name.
- Just repeat the implementation as assertions (testing that `1+1` returns `2` when the code literally does `1+1`).
- Test framework internals or getter/setter boilerplate.
- Test private methods directly — test through the public API.
- Have no real assertion value (e.g. "it does not throw" without meaningful setup).

### 5. Test structure

- One test file per class/service being tested.
- Place tests in the matching directory structure under `tests/` (mirror the source structure).
- Group related tests with `describe` blocks (Pest) or separate test methods (PHPUnit).
- Use data providers for testing multiple input/output combinations.
- Mock external dependencies (database, HTTP, file system) — don't test infrastructure.

### 6. Verify

- Run the tests locally in the PHP container to make sure they pass.
- If a test fails, fix it — don't just delete it.

### Rules

- **Do NOT commit or push.**
- **Quality over quantity** — 5 meaningful tests beat 20 trivial ones.
- If a class is hard to test (too many dependencies, global state), flag it and suggest a refactoring approach instead of writing brittle
  tests.

## See also

- [`role-contracts`](../guidelines/agent-infra/role-contracts.md#tester) — Tester mode output contract (Behaviour under test / Edge cases / Negative paths / Reproduction / Coverage gaps)
