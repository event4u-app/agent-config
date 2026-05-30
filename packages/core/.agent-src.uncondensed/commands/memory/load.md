---
model_tier: inherit
name: memory:load
tier: 2
cluster: memory
sub: load
description: Load ALL curated entries of a given memory type into the current context — opt-in full load for deep analysis, never auto-triggered
skills: []
suggestion:
  eligible: false
  rationale: "Description states 'never auto-triggered' — opt-in deep-load only."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /memory load
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

### 1b. Surface the Tier-0 critical slice

Before loading the requested type, emit every active entry with
`priority: critical` across **all** memory types as a Tier-0 banner.
The contract for `priority: critical` is *always-surface regardless of
query*; this step honours it.

```bash
./agent-config memory:lookup --priority critical --status active --format yaml
```

Render the slice in a fenced block titled `Tier-0 (critical)`, ordered
by `(type, id)`. If the slice is empty, skip the banner silently — do
not announce absence.

If the lookup helper does not yet support `--priority`, fall back to a
file-only sweep:

```bash
python3 - <<'PY'
import pathlib, yaml
for f in sorted(pathlib.Path("agents/memory").rglob("*.yml")):
    data = yaml.safe_load(f.read_text(encoding="utf-8")) or {}
    for e in data.get("entries", []) or []:
        if e.get("priority") == "critical" and e.get("status") == "active":
            print(f"--- {f.parent.name}/{e.get('id')}")
            print(yaml.safe_dump(e, sort_keys=False), end="")
PY
```

The Tier-0 slice is surfaced once per `/memory:load` invocation, even
when the user picks a type with no critical entries — the slice spans
types deliberately. Token cost is bounded by the soft cap of 10
critical entries per type (warned by `scripts/check_memory.py`).

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
[`memory-access`](../../docs/guidelines/agent-infra/memory-access.md) for
how entries modulate edits.

### 5. Inline-review hook (intake backlog)

After step 4, count unreviewed intake entries for the same type:

```bash
./agent-config memory:lookup --types <type> --intake-only --format json | \
  python3 -c "import sys, json; print(len(json.load(sys.stdin)))"
```

Read `memory.review_threshold` from `.agent-settings.yml` (default 10).
If the count is **0** or **≤ threshold**, skip this step silently. If
**> threshold**, surface a numbered preview of the top-3 highest-
confidence intake signals (see
[`memory-consolidation`](../../skills/memory-consolidation/SKILL.md)
§ Phase 3 for the consolidation contract):

```
> ⚠️  {N} unreviewed intake signals for `{type}` (threshold {T}).
>     Top 3 by confidence:
>
>     1. [conf=high] {sig-id} — {one-line observation}
>     2. [conf=med ] {sig-id} — {one-line observation}
>     3. [conf=med ] {sig-id} — {one-line observation}
>
> Review now?
> 1. Promote — run /memory promote on a signal id
> 2. Mine more — run /memory mine-session for fresh signals
> s. Skip (default) — proceed with the loaded entries
```

Default action is **skip** — the load completes regardless. This is a
nudge, not a gate. If `memory.review_threshold` is `0`, skip this
step entirely (feature off). Never auto-promote.

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
- [`memory-access`](../../docs/guidelines/agent-infra/memory-access.md) —
  how entries flow into agent decisions
