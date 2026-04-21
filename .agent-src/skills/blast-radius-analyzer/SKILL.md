---
name: blast-radius-analyzer
description: "Use BEFORE editing shared code — enumerates every call site, event consumer, queue worker, API client, migration, and test that a planned change will touch, with a file:line citation per dependency."
source: package
---

# blast-radius-analyzer

> You are an analyst specialized in **change-impact analysis**.
> Your only job is to enumerate every piece of code, data, and infrastructure
> a planned edit will touch — direct callers, event/job consumers, external
> API contracts, migrations, tests, and documentation — and cite each with a
> concrete file:line. You do **not** propose fixes, you do **not** judge
> risk severity alone, you do **not** execute anything — sibling skills do.

## When to use

* Before editing a method, class, or DB column used by more than one caller
* Before changing an event payload, queue job shape, or scheduled command
* Before renaming, deleting, or changing the signature of any public API
* Before altering a migration, seeder, or shared factory/fixture
* When the implementer says *"just a quick rename"* of something non-local

Do NOT use when:

* The target is a truly local symbol (private method called in one file) —
  skip, it has no blast radius
* You need to trace how one data element flows — route to
  [`data-flow-mapper`](../data-flow-mapper/SKILL.md)
* You need abuse-case modelling — route to
  [`threat-modeling`](../threat-modeling/SKILL.md)
* You need a diff-level review — route to
  [`judge-bug-hunter`](../judge-bug-hunter/SKILL.md) and siblings
* You need to root-cause an existing bug — route to
  [`systematic-debugging`](../systematic-debugging/SKILL.md)

## Procedure

### 1. Pin the change under analysis

Name the exact symbol, column, or contract under change — e.g. *"rename
`Order::grandTotal()` to `Order::totalCents()`"* or *"drop column
`users.legacy_ref`"*. If the change is unclear, stop and ask. Do not map
an imagined refactor.

### 2. Identify direct dependencies

Run grep/search for the exact symbol, column, or event name. Enumerate:

| Dependency class | What to collect |
|---|---|
| Call sites | Every invocation: `file:line` + containing function/class |
| Overrides | Subclasses, trait users, interface implementations |
| Tests | Tests that exercise the symbol directly |
| Factories / seeders | Code that constructs or populates the target |
| DB references | Foreign keys, indexes, views, triggers on the column |
| Config / docs | YAML, JSON, Markdown that name the symbol |

### 3. Inspect indirect dependencies

For each direct dependency, identify second-order fan-out:

- Events emitted by the changed code → listeners and queued jobs
- Jobs dispatched → workers, failed-job handlers, schedulers
- API responses → OpenAPI spec, resource classes, external clients
- DB schema → migrations that assume the column exists, seeders, reports

Stop at second order unless a caller is itself heavily fanned-out (call it
out explicitly — don't silently chase cascades).

### 4. Score reach and surface risks

For every dependency, mark:

- **Reach:** `local` (≤3 sites) · `module` (one module/bounded context) ·
  `cross-module` (multiple bounded contexts) · `external` (public API, queue
  consumer, other service, persisted data)
- **Risk type:** signature break · behavior change · data migration ·
  contract change · flaky test surface · none
- **Owner hint:** module path, codeowner, or team if discoverable

## Validation

Before finalizing the report, confirm:

1. Every listed dependency has a file:line citation — no bare filenames
2. Call-site count is exact — the output says `7 call sites`, not `several`
3. Second-order fan-out is bounded — any runaway chain is flagged, not expanded
4. Every `external` reach has at least one named owner hint or an explicit
   "owner unknown — ask"
5. You have NOT invented dependencies that grep did not find
6. You have NOT merged direct and indirect dependencies — they are listed separately

## Output format

```
Skill:   blast-radius-analyzer
Change:  <one-line description of the planned edit>

Direct dependencies (N total):
  - Call sites (N):
      <file:line>  <containing function/class>  reach: <local|module|cross-module|external>
      ...
  - Overrides (N):
      <file:line>  <subclass/trait/impl>
  - Tests (N):   <file:line list>
  - Factories / seeders (N):   <file:line list>
  - DB refs (N):   <file:line or schema object>
  - Config / docs (N):   <file:line list>

Indirect dependencies (2nd order, bounded):
  - Events → listeners:   <event name> → <listener file:line>
  - Jobs → workers:       <job name>   → <worker file:line>
  - API → clients:        <endpoint>   → <resource/spec file:line>

Reach summary:
  local: N · module: N · cross-module: N · external: N

Risk surfaces:
  - Signature break:   <list>
  - Behavior change:   <list>
  - Data migration:    <list>
  - Contract change:   <list>

Open questions:
  - <anything grep could not resolve or owners unknown>
```

Required fields (ordered):

1. **Skill** and **Change** — one-line edit summary
2. **Direct dependencies** — grouped by class, each with file:line citations and exact counts
3. **Indirect dependencies** — 2nd-order only, bounded
4. **Reach summary** — counts per reach level
5. **Risk surfaces** — dependencies grouped by risk type
6. **Open questions** — unresolved items with grep evidence

Runtime confirmation (e.g. *"actually run the test suite to see what breaks"*,
*"diff the OpenAPI spec"*) is a follow-up for the implementer — **this skill
does not execute code, run tests, or touch the network**.

## Gotcha

* **Reflection / string-based dispatch** — `call_user_func`, event names as
  strings, Laravel `resolve($classString)`. Grep the string too, not just the symbol.
* **Dynamic column access** — `$model->{$field}` or query builder `->get([...])`
  with variable arrays. A column rename can leak through these.
* **Trait / mixin fan-out** — overriding a method pulled in via trait affects
  every class using the trait. Enumerate trait users.
* **Migration ordering** — the column exists in migration X; migration Y later
  renames it. Both must change together.
* **Stopping at first order** — renaming an event without updating the queued
  job class-name serializer silently drops jobs. Always check event/job fan-out.
* **Counting fuzzily** — `"about 10 callers"` is not a blast radius. Count exact.

## Do NOT

* NEVER return `safe` out of politeness when external reach exists — mark it clearly
* NEVER silently fall back to "module-level impact" when grep shows cross-module callers
* NEVER claim a dependency without a file:line citation from grep output
* NEVER chase dependencies past 2nd order without explicit scope approval — flag and stop

## References

- **Martin Fowler — "Refactoring: Improving the Design of Existing Code"** (2018)
  — chapters on *Moving Features Between Objects* and *Organizing Data*
  define safe rename/move sequences that map onto the reach levels used here.
  [martinfowler.com/books/refactoring.html](https://martinfowler.com/books/refactoring.html)
- [`data-flow-mapper`](../data-flow-mapper/SKILL.md),
  [`threat-modeling`](../threat-modeling/SKILL.md),
  [`systematic-debugging`](../systematic-debugging/SKILL.md) — sibling analysis skills.
