# Downstream-Changes Mechanics — closed-set evolution

> The procedure behind [`downstream-changes`](../../../src/rules/downstream-changes.md)
> for one change class its table does not reach: a **closed set** whose member
> list changed. Cited by `skill:code-review` (the propagation dimension) and
> `skill:code-refactoring` (the reference sweep).
>
> It lives here rather than in the rule for a measured reason. Project-scope
> rules are a gated bucket of the per-spawn standing payload, and that payload
> currently measures **at** its grace ceiling
> (`src/config/preamble-payload-budget.json`), so the rule cannot grow by a
> single line without reddening `check_preamble_payload_budget`. Guidelines are
> an excluded bucket — read on demand, not re-sent per spawn. The obligation is
> therefore carried by the two skills that fire at the moment it matters, and
> the rule keeps its current size until a reduction lands.

## The Iron Law

```
CHANGING A MEMBER OF A CLOSED SET IS NEVER DONE WHEN THE TYPE COMPILES.
EVERY CONSUMER IS CLASSIFIED: EXHAUSTIVE, DELIBERATE FALLBACK, OR MISSING CASE.
A `default` THAT SWALLOWS THE NEW MEMBER IS A MISSING CASE WEARING A BRANCH.
```

## Why the ordinary sweep misses it

`downstream-changes` enumerates callers, tests, imports, type definitions,
config bindings, routes and docs — all of which are found by searching for the
**identifier**. A closed set breaks that assumption: the member list changes,
the type still compiles, and a serializer, a badge variant, an OpenAPI schema or
a transition table silently keeps the old set. None of them names the type, so
no identifier search reaches them. This is the shotgun-surgery shape — one
conceptual change scattered across many small sites, where forgetting one is the
default outcome rather than the unlucky one.

## What counts as a closed set

PHP enums · TypeScript enums · discriminated unions · literal-union state types ·
Rust enums · sealed types · Python `enum` classes · DB enum and check
constraints · OpenAPI / JSON-Schema `enum` · state machines · role and permission
sets · finite component variants.

## Discover by shape, not by identifier

- the member name and its **backing value** (the wire value often differs);
- `match` / `switch` / if-chains over the type;
- `Record<Member, …>`, lookup tables and maps keyed by it;
- `cases()` / `values()` iteration;
- validators and serializers;
- DB constraints and migrations;
- API schemas;
- UI option sources and variant maps;
- translation keys;
- tests, factories and fixtures.

## Classify every hit — three outcomes, one defect

| Class | What it means | Action |
|---|---|---|
| Exhaustive | The compiler or the data structure forces completeness (a fully-typed `Record<Member, …>`, a `match` with no default) | nothing — this is the outcome to prefer |
| Deliberate fallback | The fallback is part of the contract: a forward-compatible external value, a protocol unknown, a defensive boundary parse | record why, leave it |
| Missing case | The new member reaches code written for the old set | fix it |

**There is deliberately no blanket rule that a `default` branch is wrong.** Such
a rule would be refuted by every protocol parser and boundary parse in the tree.
What is true is sharper and easier to miss: where an exhaustiveness check exists,
**a `default` clause suppresses its report entirely**, so adding one to quiet the
check removes exactly the signal it existed to give.
<!-- harvest:exhaustiveness-default-clause-masks-the-check -->

Prefer the language-native guarantee over a comment. In TypeScript a
`Record<Member, T>` where every member needs a value fails to compile on a new
member, while a partially-typed string-keyed map does not. In PHP an exhaustive
`match` without a masking `default` throws on an unhandled case.

## Prove the sweep, do not assert it

Add a **synthetic member** to the set, confirm the checks you are relying on go
red, then update the consumers and confirm they go green. A sweep never seen red
has unknown coverage — the same sensitivity argument
[`downstream-changes`](../../../src/rules/downstream-changes.md) § Verification
makes for tests, applied to the discovery step.

## See also

- [`downstream-changes`](../../../src/rules/downstream-changes.md) — the rule this
  extends; its § Defect-pattern search is the sibling-occurrence half.
- [`redundancy-taxonomy`](../redundancy-taxonomy.md) — the naming half: one
  concept, several terms.
- [`prefer-enums-over-literals`](../../../src/rules/prefer-enums-over-literals.md)
  — how a closed set comes to exist in the first place.
