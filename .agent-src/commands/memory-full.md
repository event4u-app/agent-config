---
name: memory-full
description: Load ALL curated entries of a given memory type into the current context — opt-in full load for deep analysis, never auto-triggered
skills: []
disable-model-invocation: true
suggestion:
  eligible: false
  rationale: "Description states 'never auto-triggered' — opt-in deep-load only."
---

# /memory-full

Loads every entry of a single memory type into the current conversation
as a formatted block. Use when the normal `memory_lookup` filter is too
narrow and you need the full type for an architecture decision, audit,
or migration.

Opt-in only. Agents must never call this implicitly — the cost is linear
in the entry count and the signal-to-noise degrades fast on large types.

## Prerequisites

- Consumer project has `agents/memory/<type>/` or
  `agents/memory/<type>.yml`.
- User explicitly asked for the full view (e.g. "show me everything we
  know about `domain-invariants`").

## Steps

### 1. Pick the type

```
> Which memory type should I load in full?
>
> 1. domain-invariants
> 2. architecture-decisions
> 3. incident-learnings
> 4. product-rules
> 5. historical-patterns
> 6. ownership
```

### 2. Warn about volume

Before loading, count the entries:

```bash
./agent-config memory:lookup --types <type> --format json | \
  python3 -c "import sys, json; print(len(json.load(sys.stdin)))"
```

If the count exceeds 25, warn:

```
> This will load {N} entries (~{N×200} tokens).
>
> 1. Continue — load everything
> 2. Narrow by key — run /memory-full with --key pattern
> 3. Cancel
```

### 3. Load

```bash
./agent-config memory:lookup --types <type> --format yaml
```

Render the output verbatim, grouped by status (`active` first, then
`deprecated`, then `archived`). Each entry shows `id`, `confidence`,
`last_validated`, and the rule body. Skip `archived` unless the user
opts in.

### 4. Confirm absorption

```
✅  Loaded {N} {type} entries into context.
    Active: {n_active}  · Deprecated: {n_dep}  · Archived skipped: {n_arch}
    Source: agents/memory/{type}/ (or agents/memory/{type}.yml)
```

The agent should now treat every loaded entry as an authority signal
with its declared `confidence` — see
[`memory-access`](../guidelines/agent-infra/memory-access.md) for
how entries modulate edits.

## When to reject

- User is mid-implementation and asks for the full load as a shortcut
  around a targeted `memory_lookup` call — redirect to the narrower
  lookup; full load is for analysis/audit, not coding.
- Type directory is empty — respond with "no entries yet, use
  `/memory-add` to start".

## See also

- [`memory-add`](memory-add.md) — add a single entry
- [`memory-promote`](memory-promote.md) — promote an intake signal to
  a curated entry
- [`memory-access`](../guidelines/agent-infra/memory-access.md) —
  how entries flow into agent decisions
