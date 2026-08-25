---
type: "auto"
tier: "2b"
alwaysApply: false
description: "After EVERY code edit, find ALL downstream changes — callers, tests, imports, types, documentation"
triggers:
  - keyword: "callers"
  - keyword: "imports"
  - keyword: "downstream"
  - phrase: "api changed"
self_contained: true
workspaces: [engineering]
packs: [engineering-base]
# obligation: line 30
obligation_frequency: "per-edit"
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
| **Documentation** | Search `agents/`, `docs/`, `README`, examples for references | Update the doc that **describes** the changed surface — see Doc-Impact below |
| **Closed-set members** | The member set changed (enum, union, literal-type, state machine, role/permission set, DB check constraint, schema `enum`) → search every `switch` / `match` / if-chain over that type, every `Record<T, …>` or lookup table keyed by it, every validator, serializer, mapping, fixture, factory, and translation key | Each consumer either handles the new member or fails loudly — see Closed-set evolution below |

## Defect-pattern search — one instance is a sample, not the population

```
A DEFECT FOUND IN ONE PLACE IS PRESUMED TO RECUR UNTIL SEARCHED.
NAME THE EXACT WRONG CONSTRUCT. SEARCH THE TREE. REPORT THE COUNT AND THE FILES.
"I FIXED IT" WITHOUT A COUNT IS A FIX OF ONE INSTANCE, NOT OF THE DEFECT.
```

After fixing a defect, before claiming the fix is complete: write down the
**exact wrong construct** — the literal pattern, not a description of it — grep
the tree for it, and report **how many sites matched and which**. Zero is a real
answer and is worth reporting; it is the difference between "this was unique"
and "I did not look".

The own-orphan sweep above greps identifiers your diff *stopped referencing*.
This greps for the **defect itself**, which nothing else does — the two run over
different sets and neither substitutes for the other.

Emit the finding as the sibling-search mandated line
([`mandated-lines`](../contexts/execution/mandated-lines.md) § 5), which is
where its shape and the reason it carries a count are specified.

**When NOT to fire:** the defect is in code the diff created this turn (there is
no population to search), or the construct is one the language makes impossible
to express twice.

## Doc-Impact — docs follow code (same change)

```
A CHANGE TO A PUBLIC SURFACE IS INCOMPLETE UNTIL THE DOC THAT
DESCRIBES IT IS UPDATED IN THE SAME CHANGE. A DOC MAKING A CLAIM
THE CODE NOW CONTRADICTS IS A BROKEN CHANGE, NOT A STYLE NIT.
```

**Public surfaces** whose change triggers a doc update: HTTP route /
endpoint · exported function / class signature · CLI command or flag ·
config / settings key · env var · DB schema or migration · event
payload. Update the doc that describes it — README, API / OpenAPI docs,
AGENTS.md, code examples, CHANGELOG — in the same commit.

**Drift = a falsifiable-claim contradiction**, not incompleteness. Fire
when a reader following the doc would be misled: an endpoint that no
longer exists, a wrong return type, a renamed key, a broken example. Do
**not** fire on "the doc could be more detailed" — completeness is a
quality nit, not drift.

**Escape hatch** (no false-positive fatigue): refactor-only / no
public-surface change → no doc obligation. If a surface changed but
genuinely needs no doc edit, state the one-line reason instead of
editing a doc to satisfy the rule.

Detection + the framework-agnostic surface→doc map (Laravel / Symfony /
Next.js / Python / Go) live in [`agent-docs-writing`](../skills/agent-docs-writing/SKILL.md)
§ Doc-Impact — run it after every code change.

## Closed-set evolution — the incomplete-refactor case

```
CHANGING A MEMBER OF A CLOSED SET IS NEVER DONE WHEN THE TYPE COMPILES.
EVERY CONSUMER IS CLASSIFIED: EXHAUSTIVE, DELIBERATE FALLBACK, OR MISSING CASE.
A `default` THAT SWALLOWS THE NEW MEMBER IS A MISSING CASE WEARING A BRANCH.
```

Adding, removing or renaming a member of an enum / union / state set is the
canonical bad refactor: the authority changes, the type still compiles, and a
serializer, a badge variant, a schema or a transition table silently keeps the
old set. None of them references the type by name, so the find-ALL-callers sweep
above does not reach them — which is why they get their own row.

**Discover by shape, not by identifier** (the row lists the shapes). Then
classify every hit: **exhaustive** (compiler or data structure forces
completeness), **deliberate fallback** (part of the contract — a
forward-compatible external value, a protocol unknown, a defensive boundary
parse), or **missing case**. Only the third is a defect. There is no blanket
rule that a `default` branch is wrong; one would be refuted by every protocol
parser in the tree.

Prefer the language-native guarantee over a comment — a fully-typed
`Record<Member, …>` where every member needs a value, an exhaustive `match`
without a masking default. Where a check exists, **a `default` clause suppresses
an exhaustiveness report entirely**, so adding one to quiet the check removes
exactly the signal it existed to give.
<!-- harvest:exhaustiveness-default-clause-masks-the-check -->

**Prove the sweep, do not assert it.** Add a synthetic member, confirm the checks
you rely on go red, update the consumers, confirm green. A sweep never seen red
has unknown coverage.

Naming half of the same problem — one concept, several terms:
[`redundancy-taxonomy`](../docs/guidelines/redundancy-taxonomy.md).

## Breaking changes

Before making a change that affects a **public API** (endpoint response, service method signature,
event payload, job constructor), assess the impact:

**Why the surface, not just the contract, is the thing to keep small** (Hyrum's
Law): with enough consumers, every *observable* behaviour of a system becomes
something somebody depends on, regardless of what the documented contract
promises — iteration order, an error message's wording, a timing side effect, a
field that happens to be present. Two consequences, and they point in opposite
directions. Adding: a smaller exported surface is fewer accidental contracts to
honour later, so do not export what the caller does not need. Removing: the
list above is a floor, not a ceiling — an observable behaviour nobody documented
can still break someone when it disappears.

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

1. **No broken imports / parse errors** — language-native syntax check (`php -l`, `tsc --noEmit`, `python -m py_compile`, `go build ./...`, `cargo check`).
2. **No broken tests** — run the project test suite (Pest / PHPUnit, Jest / Vitest, pytest, `go test ./...`, `cargo test`).
3. **No broken types / signatures** — project's type-checker (PHPStan / Psalm, TypeScript, mypy / pyright, `go vet`, `cargo check`).
4. **No stale references** — grep for the old name / namespace / import path to confirm zero results.
5. **No own-orphans** — the same sweep applied to the new diff: identifiers whose last reference disappeared in a file this diff touched are removed in the same diff (see [`minimal-safe-diff § Own-orphan cleanup`](minimal-safe-diff.md#own-orphan-cleanup)); pre-existing dead code stays.
6. **No doc drift** — a public surface changed this diff has its describing doc updated (or the one-line no-doc-needed reason stated), per Doc-Impact above.
7. **No unhandled closed-set member** — a member set changed this diff has every consumer classified per Closed-set evolution above, and the synthetic-member probe was run.
