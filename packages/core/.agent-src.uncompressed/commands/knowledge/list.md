---
name: knowledge:list
tier: 2
cluster: knowledge
sub: list
description: List existing knowledge ingests in `agents/memory/knowledge/` (table or JSON); pin / unpin by id prefix to control LRU eviction.
skills: [file-editor]
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "what knowledge has the agent ingested, list ingested folders, show knowledge memory, pin this ingest"
  trigger_context: "user wants to inspect or curate the local knowledge namespace"
workspaces:
  - all
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# /knowledge list

Shows everything currently held under `agents/memory/knowledge/`,
sorted by `created_at` ascending. Read-only by default; `--pin` and
`--unpin` mutate the `pinned` flag on a single ingest by id prefix.

## Prerequisites

- Python 3.10+ on the host.
- `agents/memory/knowledge/` exists or is empty — the command treats
  "empty" as a normal result, not an error.

## Steps

### 1. Parse the argument

```
/knowledge list [--format=table|json] [--pin <id-prefix>]
                [--unpin <id-prefix>]
```

- `--format` defaults to `table` (ASCII; human-readable).
- `--pin` and `--unpin` are mutually exclusive in spirit; the CLI
  accepts only one per call.

### 2. Run the implementation

```bash
python3 packages/core/installer/python/knowledge_ingest.py \
    list [--format=...] [--pin <id-prefix>] [--unpin <id-prefix>]
```

### 3. Surface the result

**Table view** columns:

```
ID        DOCS  CHUNKS  BYTES   PINNED  REDACTED  CREATED              SOURCE
01a2b3c4  12    47      318012  no      yes       2026-05-25T08:14:02  /Users/maintainer/clients/acme
```

**JSON view** — full manifest array, one object per ingest. Useful for
piping into `jq` or `/memory load` flows.

**Pin / unpin** — one-line confirmation:

```
> ✅ pinned 01a2b3c4
> ✅ unpinned 01a2b3c4
```

Pinning protects an ingest from LRU eviction when the 500 MB
namespace cap is crossed.

### 4. Empty namespace

Print `(no ingests)` and offer the next step:

```
> 1. /knowledge ingest <path>  — point at a local folder, .zip, or file
```

## Safety

- Read-only by default; only `--pin` / `--unpin` mutate state, and
  both edit a single flag on a single manifest file.
- The id prefix must be **unambiguous** — if it matches more than one
  ingest, the command rejects with a structured error and asks for a
  longer prefix.

## See also

- [`/knowledge ingest`](ingest.md) — add a new ingest.
- [`/knowledge forget`](forget.md) — drop an ingest atomically.
- [`local-knowledge-ingestion`](../../../docs/contracts/local-knowledge-ingestion.md)
  § Bounds — when LRU fires.
