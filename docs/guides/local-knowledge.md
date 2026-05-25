---
stability: beta
keep-beta-until: 2026-08-24
---

# Local knowledge — 5-minute walkthrough

Point the agent at a folder of local files (PDFs, Markdown, Word docs, spreadsheets). It chunks, redacts PII + secrets, and persists into the agent memory namespace — local-only, single-user, no OAuth, no remote fetch.

Contract: [`local-knowledge-ingestion`](../contracts/local-knowledge-ingestion.md).
Roadmap home: `agents/roadmaps/road-to-employee-product-and-external-proof.md` Phase 2.

## Prerequisites

- Python 3.10+ on the host.
- `markitdown` on `PATH` if the corpus contains PDF / DOCX / XLSX / EPUB / images. Pure markdown / text corpora work without it.
- An `agents/` directory in the project (created by the installer). The `agents/memory/knowledge/` subdirectory is created lazily on first ingest.

## Step 1 — Pick a folder

Anything local works: a customer folder, a project drop, a `.zip` archive, a single PDF. The walk skips hidden dirs (`.git`, `.venv`, `node_modules`) and does not follow symlinks.

For this walkthrough we use a folder with one PDF and three markdown notes:

```text
/Users/maintainer/clients/acme/
├── brief.pdf
├── kickoff-notes.md
├── meeting-2026-05-12.md
└── pricing-v3.md
```

## Step 2 — Ingest

```bash
/knowledge ingest /Users/maintainer/clients/acme/
```

Realistic output (your ingest-id will differ — uuid7s are time-ordered):

```text
✅ ingested 01927f4a-2b1c from /Users/maintainer/clients/acme/
   documents: 4, chunks: 18, bytes_stored: 47312
   PII redacted: EMAIL=3, PHONE=1, IBAN=0, CC=0, SSN=0
   secrets redacted: 0
   skipped: 0 unsupported MIME
```

What just happened:

- Each file routed through `markitdown` (PDF) or passthrough (Markdown).
- Chunks split at ~2 KB boundaries, written to `agents/memory/knowledge/<ingest-id>/chunks/<n>.md`.
- A `manifest.json` recorded the source path, doc count, redaction counters, and `created_at`.
- PII regex pass replaced 3 emails + 1 phone with `[EMAIL]` / `[PHONE]` placeholders **before** the chunk hit disk.

> Want the raw text in (no redaction)? `--no-redact`. The manifest captures the flag so the audit row names every bypass. Default is always redact.

## Step 3 — Ask the agent

Use the host model normally. The MCP tool `memory_retrieve` now returns knowledge chunks alongside curated and intake entries — same envelope, with an additional `body.source_kind: knowledge` tag so the model knows the source is user-supplied, not maintainer-curated.

Example prompt:

> *"What does the acme pricing-v3 note say about volume discounts?"*

The agent retrieves the matching chunks (pinned chunks rank slightly higher than unpinned; knowledge entries are discounted ~15 % vs curated so hand-reviewed content still wins on equal relevance) and answers with a citation back to the source path stored in the manifest.

If nothing matches, the model says so. The retrieval surface does not invent a citation.

## Step 4 — List + pin

See what's been ingested:

```bash
/knowledge list
```

```text
ID        DOCS  CHUNKS  BYTES   PINNED  REDACTED  CREATED              SOURCE
01927f4a  4     18      47312   no      yes       2026-05-25T08:14:02  /Users/maintainer/clients/acme
```

Pin so it survives LRU eviction when the 500 MB namespace cap is crossed:

```bash
/knowledge list --pin 01927f4a
```

```text
✅ pinned 01927f4a
```

Prefix must be unambiguous — if it matches > 1 ingest, the command rejects with a structured error and asks for a longer prefix.

## Step 5 — Forget

When the work is done, drop the ingest atomically:

```bash
/knowledge forget 01927f4a
```

```text
✅ forgot 01927f4a — removed 18 chunks, 47312 bytes
```

Forget is atomic — no partial state. Pinned ingests are dropped the same as unpinned; pinning protects from LRU, not from explicit forget.

## What the guide does **not** cover

- Multi-user share — single-user by design. Multi-user lives behind ADR-024 workspace work and Phase 4 of the parent roadmap.
- Remote sources — every input must resolve to a local path. `http://`, `https://`, `s3://`, `gs://`, `azure://` are rejected at the input validator.
- Connector contracts (GitHub / Jira / Confluence) — those sit behind Hard-Floor OAuth and stay cancelled in `road-to-internal-ai-os-deployment.md` Phase 5.

## Troubleshooting

- **"Bound exceeded: total_ingest_size"** — the corpus is > 100 MB. Split it, or ingest a sub-folder.
- **"Bound exceeded: document_count"** — > 1000 files. Same fix.
- **"unsupported MIME"** — file skipped, counted in the summary, no chunk written. Add the file as `.md` if you need it indexed.
- **OCR confidence < 0.7** — the chunk is tagged `low_confidence`. The model still receives it but the citation surface flags the lower confidence.
- **markitdown not on PATH** — install it (`pip install 'markitdown[all]'`) or pass `--markitdown=<bin>`. Markdown-only corpora work without it.

## See also

- [`local-knowledge-ingestion`](../contracts/local-knowledge-ingestion.md) — contract (input shapes, bounds, storage, redaction).
- [`/knowledge ingest`](../../.agent-src/commands/knowledge/ingest.md) · [`/knowledge list`](../../.agent-src/commands/knowledge/list.md) · [`/knowledge forget`](../../.agent-src/commands/knowledge/forget.md)
- [`markitdown` skill](../../.agent-src/skills/markitdown/SKILL.md) — peer-side adapter for binary formats.
