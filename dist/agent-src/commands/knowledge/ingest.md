---
model_tier: medium
name: knowledge:ingest
pack: product-discovery
tier: 2
cluster: knowledge
sub: ingest
description: Walk a local path (folder, .zip, single file), redact PII + secrets, chunk to 2 KB markdown, and persist into the agent memory namespace under `knowledge/<ingest-id>/`.
skills: [file-editor]
suggestion:
  eligible: true
  trigger_description: "ingest this folder, add these PDFs to the agent, point the agent at my customer files, /knowledge:ingest <path>"
  trigger_context: "user wants the agent to know about a local folder or document without OAuth connectors"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /knowledge ingest

Indexes a local path into the agent's memory namespace. Local-only,
single-user, bounded. Implements the
[`local-knowledge-ingestion`](../../../docs/contracts/local-knowledge-ingestion.md)
contract.

## Prerequisites

- Python 3.10+ available on the host.
- Path is local — absolute or relative to the project root. Remote
  schemes are rejected.
- `markitdown` is on `PATH` (or `--markitdown=<bin>` supplied) **if**
  the corpus contains binary formats (PDF, DOCX, XLSX, EPUB, PPTX,
  images). Pure markdown / text corpora work without it.

## Steps

### 1. Parse the argument

The user invokes `/knowledge ingest <path> [--no-redact]
[--markitdown=<bin>]`. The path is the first positional argument.

If `<path>` is missing → print the usage line above and stop.

### 2. Pre-flight checks

Run before any file is touched:

- Reject `http://`, `https://`, `s3://`, `gs://`, `azure://`.
- Resolve the path; reject if it does not exist.
- If the path is a `.zip`, the implementation unpacks into `$TMPDIR`
  and cleans up after the call returns — no manual handling needed.

### 3. Run the implementation

```bash
python3 packages/core/installer/python/knowledge_ingest.py \
    ingest <path> [--no-redact] [--markitdown=<bin>]
```

The module enforces:

- ≤ 1000 documents per call
- ≤ 20 MB per file
- ≤ 500 MB total namespace footprint (LRU eviction by `last_touched`)
- ≤ 10 directories deep

Crossing any bound is a **hard reject** with a structured error
naming the bound and the observed value. No partial writes.

### 4. Surface the result

The module prints a JSON manifest. Summarize in chat:

```
> ✅ ingested <ingest-id-short> from <source>
>   documents: <n>, chunks: <m>, bytes_stored: <b>
>   PII redacted: EMAIL=<x>, PHONE=<y>, IBAN=<z>, CC=<a>, SSN=<b>
>   secrets redacted: <s>
>   skipped: <count> unsupported MIME
```

If `redacted: false` (user passed `--no-redact`), surface a
**non-omittable warning** that the corpus may contain PII or secrets
in plaintext.

### 5. Hand off

Show the user how to retrieve:

```
> Next steps:
> 1. /knowledge list             — see all ingests + sizes
> 2. /knowledge list --pin <id>  — pin so it survives LRU eviction
> 3. /knowledge forget <id>      — drop this ingest atomically
```

## Safety

- The command **never** fetches the network. Remote-URL rejection is
  the first input check, before any path resolution.
- The command **never** writes outside `agents/memory/knowledge/`.
- Redaction defaults to ON. `--no-redact` is a deliberate maintainer
  opt-out, not a UX default.
- LRU eviction is by **ingest**, never by chunk — partial ingests
  cannot exist in the namespace.

## See also

- [`local-knowledge-ingestion`](../../../docs/contracts/local-knowledge-ingestion.md)
  — contract (input shapes, bounds, storage, redaction).
- [`/knowledge list`](list.md) — what's been ingested, pinning.
- [`/knowledge forget`](forget.md) — drop an ingest atomically.
- [`markitdown`](../../skills/markitdown/SKILL.md) — peer-side adapter
  for PDF / DOCX / XLSX / images.
