# Tool Integration — Concrete PR Series

**Status: ✅ COMPLETE**

## Goal

Introduce external capability access without undermining governance.

## Outcome after this series

The system should support:

- [x] explicit tool declarations
- [x] adapter-based integrations
- [x] permission checks
- [x] auditability
- [x] CI validation of tool metadata

---

# PR 1 — Tool schema and registry ✅

## Objective

Define how tools are represented before implementing adapters.

## Files to create

- `.augment.uncompressed/guidelines/tool-integration.md`
- `.augment.uncompressed/rules/tool-safety.md`
- `schemas/tool.schema.json` (optional)
- `scripts/tool_registry.py`
- `tests/test_tool_registry.py`

## Files to update

- `scripts/skill_linter.py`
- `AGENTS.md`
- `README.md`

## Schema example

```yaml
allowed_tools:
  - github
  - jira

tool_permissions:
  github:
    actions:
      - read_pr
      - create_pr
```

## Linter changes

Add errors/warnings for:
- undeclared tool usage
- tool listed but unsupported
- automated execution with undeclared tools
- permission block missing for restricted tools

## Acceptance criteria

- tool metadata can be parsed and validated
- linter understands allowed_tools and permission blocks

---

# PR 2 — GitHub adapter ✅

## Objective

Implement first real tool integration with strong safety boundaries.

## Files to create

- `scripts/tools/github_adapter.py`
- `tests/test_github_adapter.py`
- optional: `docs/tools/github.md`

## Supported actions (start small)

- read PR metadata
- read issue metadata
- create PR draft payload (not necessarily send yet)

## Constraints

- read-only first unless explicitly approved
- no broad repo mutation
- adapter must expose a fixed interface

## Acceptance criteria

- GitHub adapter works through registry
- actions are allowlisted
- tests cover success and denied cases

---

# PR 3 — Jira adapter ✅

## Objective

Add second adapter to prove extensibility.

## Files to create

- `scripts/tools/jira_adapter.py`
- `tests/test_jira_adapter.py`
- optional: `docs/tools/jira.md`

## Supported actions

- read ticket
- search ticket by key
- prepare comment payload (optional, not send by default)

## Constraints

- no write action by default
- no ambiguous search without explicit constraints

## Acceptance criteria

- Jira adapter follows same interface as GitHub adapter
- registry can list supported actions per tool

---

# PR 4 — Permission enforcement and audit logs ✅

## Objective

Make tool access safe and reviewable.

## Files to create/update

- `scripts/tool_permissions.py`
- `scripts/tool_audit.py`
- `tests/test_tool_permissions.py`
- `tests/test_tool_audit.py`
- `.augment.uncompressed/rules/tool-safety.md`

## Features

- permission validation before execution
- audit event recording
- denied action reporting
- consistent error messages

## CI changes

- validate all declared tools against registry
- fail on undeclared tool/action pair

## Acceptance criteria

- tool requests without permission fail deterministically
- audit logs are created for allowed and denied calls

---

# PR 5 — Custom tools and extension contract ✅

## Objective

Allow controlled growth without special-casing every integration.

## Files to create

- `docs/custom-tool-contract.md`
- `scripts/tools/base_adapter.py`
- `tests/test_custom_tool_contract.py`

## Content

Define:
- adapter interface
- input/output contract
- authentication model boundary
- timeout / retry expectations

## Acceptance criteria

- a future custom tool can be added without changing core architecture
- the extension contract is documented and testable

---

# Suggested sequencing notes

- do not add free-form shell tool execution here
- do not mix runtime and tools in one PR
- keep all tools deny-by-default
- prefer read-only integrations first
