# Patterns — file-first refactor/fix recipe library

A `patterns/` entry is a **reusable refactor or fix recipe** — a concrete
problem → before → after → verification, with reliability metadata. It is read
**at authoring time** when a related workflow fires; it is **not** loaded into
every context, **not** auto-written, **not** decayed, and introduces **no
runtime**. File-first, like `rules/` — markdown the agent reads, never a service.

> Reversed REJECT (council 2026-06-15, deep + peer-review): a static `patterns/`
> dir is NOT the sunset pgvector/MCP memory store
> ([[council-agent-memory-sunset]]) and patterns are NOT personas (the
> `persona-governance` ≤2-cap does not apply). See `docs/decisions/ADR-099`.

## What is / isn't a pattern

| Surface | Holds | Read when |
|---|---|---|
| `rules/` | always-active behavior constraints | every conversation (auto-loaded) |
| `docs/guidelines/` | prose conventions ("how to write code in X") | on demand, for style |
| **`patterns/`** | **a specific fix/refactor recipe with a verification step + reliability tag** | **on demand, when the matching problem is detected** |
| `skills/` | executable workflows | matched by topic |

A pattern answers *"I have problem P — what is the proven recipe to fix it, and
how reliable is it?"* — not *"how should I name things"* (guideline) and not
*"what must I always do"* (rule).

## File shape

`src/patterns/<slug>.md`, frontmatter then body:

```markdown
---
applies_to: [laravel, eloquent]      # stacks/frameworks; [] = stack-agnostic
reliability: high                    # high | medium | low — how reliably the recipe holds
last_verified: 2026-06-15            # ISO date the recipe was last confirmed against a real codebase
---

# <Pattern name>

## Problem
One paragraph: the symptom and why it hurts.

## Before
The shape to look for (small code/excerpt).

## After
The fixed shape.

## Verification
The concrete check that proves the fix landed (a test, a query, a profiler read).

## Gotchas
When the recipe does NOT apply / how it backfires.
```

## Rules

- **File-first, no runtime** — read at authoring time; never a daemon, store, or
  auto-writer. This dir is intentionally **not** a registered condensation
  source root, so patterns are reference material (like `docs/guidelines/`), not
  projected per-tool context.
- **Every pattern carries a `Verification` step** — a recipe you cannot confirm
  is folklore, not a pattern.
- **`reliability` + `last_verified` are honest** — drop or downgrade a pattern
  the codebase has outgrown; a stale `high` is worse than no pattern.
- **Surfaced, never forced** — `learning-to-rule-or-skill` surfaces a relevant
  pattern; the human decides whether to apply it.
- **Cross-project sharing** is manual and redacted — `src/scripts/pattern_share.py`
  (a maintainer dev script, **not** a user command), gated by the same redactor
  as [`low-impact-corpus-privacy-floor`](../rules/low-impact-corpus-privacy-floor.md).

## Sunset

If patterns go unused (no surfacing hit, no edits) for two review cycles, the
surface is a candidate for removal — it must earn its keep like any artefact
(ADR-099 § Consequences).
