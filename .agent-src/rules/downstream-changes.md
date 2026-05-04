---
type: "auto"
tier: "2b"
alwaysApply: false
description: "After EVERY code edit, find ALL downstream changes needed to existing files, including callers, tests, imports, types, and documentation"
source: package
---

# Downstream Changes

## The Iron Law

```
EVERY EDIT IS INCOMPLETE UNTIL ALL DOWNSTREAM CHANGES ARE MADE.
MISSING A CALLER, A TEST, OR AN IMPORT IS A CRITICAL FAILURE.
```

Do NOT move on to the next task, claim completion, or suggest
committing until every caller, test, import, and reference is updated.

## Rule

After EVERY code edit, find **ALL downstream changes** needed. Missing a caller, a test,
or an import is a critical failure — it leaves the codebase in a broken state.

## What to check

After editing any file, search for **all** of these:

| What | How to find | What to update |
|---|---|---|
| **Callers / call sites** | `codebase-retrieval` + `grep` for the changed method/class name | Update signatures, parameters, return type handling |
| **Interface implementations** | Search for `implements {Interface}` or `extends {Class}` | Match new method signatures in all implementations |
| **Subclasses** | Search for `extends {Class}` | Override or implement changed methods |
| **Tests** | Search test directories for the changed class/method name | Update assertions, mocks, method calls |
| **Imports / use statements** | Search for `use {Old\Namespace}` | Update to new namespace after moves/renames |
| **Type definitions** | Search for type hints referencing the changed class | Update parameter types, return types, PHPDoc |
| **Config / bindings** | Search service providers, config files | Update class references in DI bindings |
| **API schemas / OpenAPI** | Check controller attributes | Update if response structure changed |
| **Routes** | Search `routes/` for controller references | Update after controller rename/move |
| **Documentation** | Search `agents/`, `docs/` for references | Update if behavior or API changed |

## Breaking changes

Before making a change that affects a **public API** (endpoint response, service method signature,
event payload, job constructor), assess the impact:

### Always ask the user first when:

- Removing or renaming a public method/class
- Changing a method signature (new required params, changed return type)
- Changing an API response structure (new/removed fields, changed types)
- Removing a database column or table
- Changing an event payload that listeners depend on
- Renaming a route name that the frontend uses

### Proceed without asking when:

- Adding a new optional parameter with a default value
- Adding a new method (doesn't break existing callers)
- Adding a new field to an API response (additive, non-breaking)
- Internal refactoring that doesn't change the public interface
- Fixing a bug (the current behavior is wrong)

## Verification

After completing all downstream changes:

1. **No broken imports** — `php -l` or PHPStan catches these
2. **No broken tests** — run the test suite
3. **No broken types** — PHPStan Level 9 catches signature mismatches
4. **No stale references** — grep for the old name/namespace to confirm zero results
