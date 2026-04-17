# Runtime Layer — Concrete PR Series

**Status: ✅ COMPLETE**

## Goal

Add a minimal but extensible runtime model that lets skills move from static workflows toward controlled execution.

## Outcome after this series

The system should support:

- [x] explicit execution metadata on skills
- [x] a runtime registry / dispatcher layer
- [x] basic assisted vs automated execution distinction
- [x] runtime-aware linting / validation
- [x] execution-safe CI checks

---

# PR 1 — Runtime spec and schema ✅

## Objective

Define the runtime model before implementing anything executable.

## Files to create

- `.augment.uncompressed/guidelines/runtime-layer.md`
- `.augment.uncompressed/rules/runtime-safety.md`
- `docs/runtime-schema.md` or `roadmaps/runtime-schema.md`
- optional: `schemas/skill-execution.schema.json`

## Files to update

- `AGENTS.md`
- `README.md`
- `skill-writing`
- `skill-reviewer`
- `scripts/skill_linter.py`

## Content to define

### Execution block proposal

```yaml
execution:
  type: manual | assisted | automated
  handler: none | shell | php | node | internal
  timeout_seconds: 30
  safety_mode: strict
  allowed_tools: []
```

## Linter changes

Add warnings/errors for:

- invalid execution type
- automated execution without handler
- automated execution without safety mode
- disallowed handler values

## CI changes

- extend `skill-lint.yml` to lint runtime metadata
- add tests for runtime schema validation

## Acceptance criteria

- runtime schema exists
- linter understands execution block
- no existing skills break without explicit migration plan

---

# PR 2 — Runtime registry and dispatcher scaffold ✅

## Objective

Add a lightweight runtime layer without enabling dangerous execution yet.

## Files to create

- `scripts/runtime_registry.py`
- `scripts/runtime_dispatcher.py`
- `tests/test_runtime_registry.py`
- `tests/test_runtime_dispatcher.py`

## Suggested responsibilities

### `runtime_registry.py`
- discover skills with execution metadata
- validate handler support
- expose list of runtime-capable skills

### `runtime_dispatcher.py`
- resolve execution type
- block unsupported automated execution
- produce structured execution request object

## Taskfile changes

Add:

- `task runtime:list`
- `task runtime:validate`

## CI changes

- run runtime tests in `tests.yml`
- optionally upload runtime validation artifact

## Acceptance criteria

- runtime-capable skills can be listed
- dispatcher can resolve execution metadata
- no real execution happens yet

---

# PR 3 — Assisted execution path ✅

## Objective

Support safe assisted execution first.

## Files to create/update

- `scripts/runtime_execute.py`
- `tests/test_runtime_execute.py`
- `AGENTS.md`
- `developer-like-execution`
- runtime docs/guidelines

## Behavior

For `execution.type: assisted`:

- prepare exact command or action plan
- validate environment assumptions
- return execution proposal
- do not run silently

## Example output

- skill selected
- handler chosen
- command preview
- safety notes
- verification requirements

## Acceptance criteria

- assisted execution produces deterministic proposed actions
- nothing executes without explicit operator confirmation

---

# PR 4 — Automated execution (strict allowlist only) ✅

## Objective

Introduce minimal automated execution under strict constraints.

## Files to update

- `scripts/runtime_execute.py`
- `scripts/runtime_registry.py`
- `scripts/skill_linter.py`
- `tests/test_runtime_execute.py`
- `.augment.uncompressed/rules/runtime-safety.md`

## Rules

Automated execution allowed only if:

- execution type = automated
- handler is allowlisted
- allowed_tools (if any) are declared
- safety mode is strict
- verification path exists

## Linter additions

Fail if automated skill:
- has no verification guidance
- has no allowed handler
- has no safety mode
- violates tool restrictions

## Acceptance criteria

- minimal automated execution works in safe cases
- unsafe declarations are blocked by lint/review

---

# PR 5 — Runtime hooks, timeouts, and failures ✅

## Objective

Make runtime behavior operationally useful.

## Files to create/update

- `scripts/runtime_hooks.py`
- `scripts/runtime_errors.py`
- `tests/test_runtime_hooks.py`
- `tests/test_runtime_errors.py`
- `.augment.uncompressed/guidelines/runtime-layer.md`

## Features

- timeout handling
- failure classification
- before/after hooks
- structured error output

## CI changes

- add runtime test targets to `task test`
- fail on unhandled runtime exceptions

## Acceptance criteria

- runtime failures are structured
- timeouts are enforced
- hooks are documented and test-covered

---

# Suggested sequencing notes

- Do not add external tool calls before runtime safety exists
- Do not add async execution in this phase
- Keep runtime conservative
- Optimize for explicitness, not convenience
