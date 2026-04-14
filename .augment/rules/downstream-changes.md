---
type: "auto"
alwaysApply: false
description: "After EVERY code edit, find ALL downstream changes needed to existing files, including callers, tests, imports, types, and documentation"
source: package
---

# Downstream Changes

After EVERY edit, find **ALL downstream changes**. Missing caller/test/import = critical failure.

## What to check

| What | How to find | What to update |
|---|---|---|
| **Callers / call sites** | `codebase-retrieval` + `grep` for changed method/class | Signatures, parameters, return type handling |
| **Interface implementations** | `implements {Interface}` / `extends {Class}` | Match new signatures in all implementations |
| **Subclasses** | `extends {Class}` | Override/implement changed methods |
| **Tests** | Search test dirs for changed class/method | Assertions, mocks, method calls |
| **Imports** | `use {Old\Namespace}` | Update namespace after moves/renames |
| **Type definitions** | Type hints referencing changed class | Parameter types, return types, PHPDoc |
| **Config / bindings** | Service providers, config files | Class references in DI bindings |
| **API schemas / OpenAPI** | Controller attributes | Response structure changes |
| **Routes** | `routes/` controller references | After controller rename/move |
| **Documentation** | `agents/`, `docs/` references | Behavior or API changes |

## Breaking changes — ask first

- Removing/renaming public method/class
- Changing method signature (required params, return type)
- Changing API response structure
- Removing DB column/table
- Changing event payload
- Renaming frontend-used route name

## Non-breaking — proceed

- New optional parameter with default
- New method (additive)
- New API response field (additive)
- Internal refactoring (same public interface)
- Bug fix

## Verification

1. No broken imports — PHPStan catches these
2. No broken tests
3. No broken types — PHPStan Level 9
4. No stale references — grep old name confirms zero results

```
Every edit is incomplete until all downstream changes are made.
```
