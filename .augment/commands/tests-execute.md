---
name: tests-execute
skills: [pest-testing]
description: Run PHP tests inside the Docker container
disable-model-invocation: true
---

# tests-execute

## Instructions

### 1. Detect the test runner

Check in this order — use the **first match**:

1. **Makefile** exists → look for test targets (`make test`, `make test-unit`, etc.)
2. **Taskfile.yml** exists → look for test tasks (`task test`, `task test-unit`, etc.)
3. **`artisan` exists** → Laravel project → `php artisan test`
4. **`vendor/bin/pest` exists** → Pest → `vendor/bin/pest`
5. **Fallback** → PHPUnit → `vendor/bin/phpunit`

**Prefer Makefile/Taskfile targets** over raw commands — they handle container access,
environment variables, and parallel settings automatically.

### 2. Run the tests

- If using Makefile/Taskfile targets → run from host (they handle Docker internally).
- If using raw commands → execute **inside the PHP Docker container** (`docker compose exec -T <service> ...`).
  Detect the PHP service name from `docker-compose.yml` / `compose.yaml` (see `rules/docker-commands.md`).
- If the user provided a specific test file or filter, pass it through:
  - Pest/Artisan: `--filter="test name"` or `tests/path/to/TestFile.php`
  - PHPUnit: `--filter="test name"` or `tests/path/to/TestFile.php`
- If no specific test is requested, run the full test suite.

### 3. Analyze results

- If all tests pass → report success with a short summary.
- If tests fail:
  - Show the failing test name, expected vs actual values, and the relevant code.
  - Analyze the failure — is it a bug in the code or a bug in the test?
  - **Ask the user** with numbered options:
    ```
    > 1. Fix the code — the test is correct
    > 2. Fix the test — the code is correct
    > 3. Skip — I'll handle this myself
    ```
  - If the user says fix it, apply the fix and re-run.

### 4. Re-run until green

- After any fix, re-run the failing tests to verify.
- Repeat until all tests pass.

### Rules

- **Do NOT commit or push.**
- **Always ask before changing test assertions** — the test might be correct and the code wrong.
- If tests are slow (>2 min), suggest running only the affected test file instead of the full suite.

