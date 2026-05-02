---
name: propose-memory
description: Append a provisional memory signal to the intake stream — the universal fallback for any producer (human or agent) to record a finding without committing to a curated entry.
skills: [file-editor]
disable-model-invocation: true
suggestion:
  eligible: false
  rationale: "Programmatic intake fallback — overlaps /memory-add; keep explicit."
---

# /propose-memory

Drops a **signal** into `agents/memory/intake/signals-YYYY-MM.jsonl` via
`scripts/memory_signal.py`. Signals are append-only JSONL and merge-safe.

Unlike [`/memory-add`](memory-add.md) — which writes a **curated**
entry the reviewer has validated — `/propose-memory` is cheap and
provisional. Use it whenever a finding is worth preserving but does
not yet justify a human reviewer's attention.

## When to use

- A producer command (`/bug-fix`, `/do-and-judge`, incident role exit)
  resolved a failure and the pattern could recur.
- The user says "remember this" about a finding that is not yet a
  decision.
- A reviewer spotted a smell worth recording without blocking the PR.

Do NOT use when:

- The entry is a **decision** — go to [`/memory-add`](memory-add.md)
  with `architecture-decisions` or `product-rules`.
- The finding contradicts an existing curated entry — open a
  supersede-chain discussion instead.

## Steps

### 1. Pick the memory type

```
> Which memory type fits this signal?
>
> 1. historical-patterns — a recurring bug/fix pattern
> 2. incident-learnings  — a post-mortem guardrail
> 3. ownership           — a path → team mapping
> 4. domain-invariants   — a module boundary rule
> 5. architecture-decisions — a decision to revisit
> 6. product-rules       — an intentional constraint
```

### 2. Gather minimum fields

- `path` — the affected file / module / symbol
- `body` — one or two sentences describing the finding

### 3. Offer optional extras

Ask once, numbered. If the user picks `skip`, proceed without them:

- `symptom` (historical-patterns, incident-learnings)
- `owner` (ownership)
- `rule` (domain-invariants, product-rules)
- `severity` — `low` · `medium` · `high`

### 4. Emit via the shared helper

```bash
./agent-config memory:signal \
    --type <type> \
    --path "<path>" \
    --body "<body>" \
    --origin "propose-memory" \
    --extra '{"symptom":"...","severity":"medium"}'
```

The helper deduplicates identical `(type, path, body)` within 7 days
automatically — re-running the command on the same finding will
silently skip the write. Add `--force` only when deliberate duplication
is intended (rarely).

### 5. Confirm and close

```
> ✅ Signal queued as id=<sig-xxxxxx> in <file>.
>
> Next steps:
> 1. Promote to curated now — run /memory-add
> 2. Leave as intake — reviewer will evaluate later
> 3. Done
```

## Safety

- The command **never** rewrites existing intake lines. Corrections go
  via a new entry with `type: supersede` and `supersedes: <id>`
  (append-only).
- The command **never** writes outside `agents/memory/intake/`.
- Schema mismatches (e.g., unknown `type`) raise — callers should
  treat that as a bug in the producer, not a retryable failure.

## See also

- [`/memory-add`](memory-add.md) — curated (reviewer-validated) entries.
- [`engineering-memory-data-format`](../../docs/guidelines/agent-infra/engineering-memory-data-format.md)
- [`memory-access`](../../docs/guidelines/agent-infra/memory-access.md) — the
  read-side contract that consumes what this command writes.
