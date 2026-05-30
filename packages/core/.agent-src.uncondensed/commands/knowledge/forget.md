---
model_tier: inherit
name: knowledge:forget
tier: 2
cluster: knowledge
sub: forget
description: Drop a knowledge ingest from `agents/memory/knowledge/` by id prefix. Atomic, no partial state. Pinning protects from LRU eviction, not from explicit forget — pinned ingests are dropped the same.
skills: [file-editor]
suggestion:
  eligible: true
  trigger_description: "forget this ingest, drop the acme knowledge, remove the customer folder from agent memory"
  trigger_context: "user wants to purge a specific knowledge ingest"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /knowledge forget

Removes one ingest from `agents/memory/knowledge/`. The id prefix
must resolve to exactly one ingest — otherwise the command refuses
and asks for a longer prefix.

## Prerequisites

- An ingest matching the prefix exists. Run `/knowledge list` first
  to find it.
- The id prefix is **8 characters or more** in practice — uuid7 ids
  are unique on the first 8 hex chars within a single namespace,
  and the dispatcher rejects ambiguous prefixes.

## Steps

### 1. Parse the argument

```
/knowledge forget <ingest-id-prefix>
```

If the prefix is missing → print the usage line above and stop. Do
**not** guess — there is no safe default.

### 2. Run the implementation

```bash
python3 packages/core/installer/python/knowledge_ingest.py \
    forget <ingest-id-prefix>
```

The module:

- Resolves the prefix; rejects if zero or multiple matches.
- Removes the entire `agents/memory/knowledge/<ingest-id>/` directory
  in one `shutil.rmtree` — chunks, manifest, everything.
- Returns the full ingest-id that was removed.

### 3. Surface the result

```
> ✅ forgot 01a2b3c4-5d6e-7890-abcd-ef1234567890
>   source: /Users/maintainer/clients/acme
>   documents: 12, chunks: 47, bytes recovered: 318012
```

If the prefix matched zero ingests, surface a structured error:

```
> ❌ no ingest matches prefix: <prefix>
>    run /knowledge list to see what's there
```

If the prefix matched multiple ingests:

```
> ❌ ambiguous prefix: <prefix> — matches <n> ingests
>    use a longer prefix (first 8 hex chars is usually enough)
```

## Safety

- **Destructive — no undo.** The chunked content is gone after this
  command returns. The Python module does not move-to-trash; it
  removes the directory.
- The command **never** removes the parent `agents/memory/knowledge/`
  directory itself — only the matching `<ingest-id>/` subdirectory.
- The command **never** writes outside `agents/memory/knowledge/`.
- Pinning is irrelevant here — pinning protects from LRU eviction,
  not from explicit user-driven forget.

## See also

- [`/knowledge ingest`](ingest.md) — add a new ingest.
- [`/knowledge list`](list.md) — find an id prefix.
- [`local-knowledge-ingestion`](../../../docs/contracts/local-knowledge-ingestion.md)
  § Storage — directory layout.
