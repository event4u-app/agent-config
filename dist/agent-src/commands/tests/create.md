---
model_tier: medium
name: tests-create
pack: engineering-base
tier: 2
visibility: internal
cluster: tests
sub: create
skills: [test-case-discovery, pest-testing, quality-tools]
description: Write meaningful tests for the current branch — stack-adaptive (pest / phpunit / vitest / jest / pytest / …)
suggestion:
  eligible: false
  trigger_description: "write tests for these changes, add tests for this branch"
  trigger_context: "code changes on the branch without matching test changes"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /tests create
## Instructions

### 1. Detect the test framework

Resolve the framework via the
[`toolchain-resolver`](../../contexts/execution/toolchain-resolver.md) — write
tests in the framework the project actually uses, never a hard-coded one:

- **PHP** → Pest (`pestphp/pest`) or PHPUnit.
- **JS/TS** → Vitest or Jest. **Python** → pytest. **Go** → `testing`.
  **Rust** → `#[test]`.

Then read the existing tests under the project's test directory to match
the style and conventions already in use (assertion shape, naming, fixtures).

### 2. Identify what changed

- Run `git diff origin/main..HEAD --name-only` or `git diff origin/master..HEAD --name-only` (depending on project) to get all changed
  files.
- Focus on **source files with business logic** in the detected
  language — skip config, generated files, migrations, views, assets.
- Read each changed file and understand what was added or modified.

### 3. Understand the code before writing tests

- Use `codebase-retrieval` to understand the classes, their dependencies, and how they're used.
- Read existing tests for the same or related classes to match patterns.
- Understand what the method is supposed to do, not just what it does.

### 4. Discover the test cases BEFORE writing tests

Run the [`test-case-discovery`](../../skills/test-case-discovery/SKILL.md)
funnel per changed behavior — enumerate first, write second:

1. **Behavior inventory** — 1–3 one-sentence behaviors per changed unit.
2. **Dimension scan** — input validity (null / empty / zero / negative / max /
   Unicode / off-by-one), state (prerequisites, transitions, idempotency),
   collaborator failure (timeout, 4xx/5xx, exceptions, empty results),
   security surface (authz, tenant, injection) where applicable.
3. **Case synthesis with floor** — per behavior at least **1 happy +
   1 boundary + 1 error case**; +1 abuse case on security-relevant paths.
   No behavior gets a happy-path-only test.
4. **Cross-check** — when subagents are available, ask ONE subagent with an
   adversarial lens ("what non-obvious failure mode is missing?"); otherwise
   run the mandatory self-review pass with the same question.
5. **Prioritize** — most important cases first (likelihood × impact), cap
   5–8 per behavior, each case must fail for a distinct reason. Record
   dropped cases with a one-line reason.

### 5. Write meaningful tests

**DO write tests that:**

- Test the **actual business logic** and expected behavior.
- Implement the **case matrix from step 4** — happy path, boundaries, error
  handling, and (where security-relevant) abuse cases.
- Test **different code paths**: if/else branches, early returns, fallback behavior.
- Verify **return values and side effects** that matter.
- Use descriptive test names that explain the scenario (e.g. `it returns fallback status when input is empty`).

**Do NOT write tests that:**

- Assert trivial things like parameter count, method existence, or class name.
- Just repeat the implementation as assertions (testing that `1+1` returns `2` when the code literally does `1+1`).
- Test framework internals or getter/setter boilerplate.
- Test private methods directly — test through the public API.
- Have no real assertion value (e.g. "it does not throw" without meaningful setup).

### 6. Test structure

- One test file per class/service being tested.
- Place tests in the matching directory structure under `tests/` (mirror the source structure).
- Group related tests with `describe` blocks (Pest, Jest, vitest) or separate test methods (PHPUnit, pytest test classes).
- Use data providers for testing multiple input/output combinations.
- Mock external dependencies (database, HTTP, file system) — don't test infrastructure.

### 7. Verify

- Run the tests locally in the PHP container to make sure they pass.
- If a test fails, fix it — don't just delete it.

### Rules

- **Do NOT commit or push.**
- **Quality over quantity** — 5 meaningful tests beat 20 trivial ones.
- **Breadth is part of quality** — a happy-path-only suite is incomplete
  regardless of how meaningful the single test is; the step-4 floor applies.
- If a class is hard to test (too many dependencies, global state), flag it and suggest a refactoring approach instead of writing brittle
  tests.

## See also

- [`role-contracts`](../../docs/guidelines/agent-infra/role-contracts.md#tester) — Tester mode output contract (Behaviour under test / Edge cases / Negative paths / Reproduction / Coverage gaps)
