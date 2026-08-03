---
type: "auto"
tier: "2b"
alwaysApply: false
description: "Field with multiple non-boolean states — prefer an enum over string/numeric literals; old-style literals found → note, finish the task, ask after"
triggers:
  - keyword: "enum"
  - keyword: "status"
  - keyword: "kind"
  - keyword: "category"
  - keyword: "migration"
self_contained: true
workspaces: [engineering]
packs: [engineering-base]
---

# Prefer Enums Over Literal Values

When a field or property can hold **two or more non-boolean states** — strings (`'active'`, `'pending'`, `'archived'`) or meaningful numeric codes (priority `1`/`2`/`3`, tier levels) — model it as an **enum**, not a bare string/int. An enum names the value in code (readable), makes the value greppable and safe to rename, gives exhaustiveness/typo safety, and makes filtering and editing relations far easier than raw literals scattered across the codebase.

## The Iron Law

```
A FIELD WITH MULTIPLE NON-BOOLEAN STATES IS AN ENUM, NOT A BARE STRING OR MAGIC NUMBER.
NAME THE VALUE IN CODE — NEVER SCATTER RAW LITERALS ('active', 2, 'PENDING') ACROSS THE CODEBASE.
FOUND OLD-STYLE LITERALS WHERE AN ENUM FITS? NOTE IT, FINISH THE TASK, THEN ASK — NEVER REFACTOR MID-FLOW.
```

## Prefer an enum when

- A multi-state **string** field — `status`, `type`, `role`, `kind`, `category`, `state` — with 2+ distinct values.
- A **numeric code that is a label, not a quantity** — priority `1/2/3`, severity levels, tiers.
- Any **closed set of values the code branches on** (`match` / `switch` / `if ===`).

## Do NOT force an enum when

- A boolean (`true`/`false`) — that's a flag, not an enum.
- Open/unbounded free text — name, description, URL, comment.
- A genuine numeric **quantity** used in arithmetic — price, count, age, bytes.
- A set owned entirely by a volatile external system — unless you map it to your own enum at the boundary.

## How (framework-neutral)

- Use the language's native construct: a backed enum (PHP `enum Status: string`), a string-literal union or `enum` (TypeScript), `enum.Enum` (Python), an enum/`CHECK`-constrained column or a lookup table + FK (database).
- Persist the enum's backing value; reference the **named case** in code, never the raw literal.

## Found old-style literals where an enum fits — defer, do not disrupt

The proactive part — apply exactly this order so the current task's flow is never interrupted:

1. **While doing the actual task**, if you pass code using raw string/numeric literals for a multi-state field where an enum would be better, do **NOT** refactor it inline (that is a drive-by edit — see `minimal-safe-diff`) and do **NOT** stop to ask mid-flow.
2. **Note the site** — file:line + the literal set — in your working notes.
3. **After the actual task is delivered**, surface the noted candidates as **one** numbered-options prompt (per `user-interaction`): list each enum-candidate site, and ask whether to replace — all / selected / none.
4. **Only on an explicit yes** do you refactor, and treat it as a **separate change** with its own scope (`downstream-changes` applies — update every caller, migration, test, serializer).

If the task itself is *adding* the field, apply the enum from the start — no deferral needed; the defer-and-ask flow is only for pre-existing literals you happen to encounter.

## See also

- [`improve-before-implement`](improve-before-implement.md) — the Strategy sniff test when a second branch on the same enum/string discriminator signals the enum should become a Strategy (`docs/guidelines/php/patterns/strategy.md`).
- [`minimal-safe-diff`](minimal-safe-diff.md) — why you don't drive-by-refactor the literals you find.
- [`scope-control`](scope-control.md) — replacing an existing pattern needs the user's yes first.
- [`active-remediation`](active-remediation.md) — the general fix-now / note-and-ask / follow-up-PR ladder; the enum defer-and-ask above is one instance of it.
- [`senior-engineering-discipline`](senior-engineering-discipline.md) — the "generalize, don't overfit" anchor this extends.
