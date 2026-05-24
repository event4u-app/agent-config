---
stability: beta
keep-beta-until: 2026-08-24
---

# Local knowledge ingestion contract

**Purpose.** Freeze the input shape, bounds, storage target, and redaction defaults for the single-user, local-only knowledge surface (`/knowledge:ingest`, `/knowledge:list`, `/knowledge:forget`) **before** any implementation lands. Closes the "Copy/Paste AI" complaint from feedback A without touching OAuth, multi-tenancy, or Hard-Floor connector territory.

Last refreshed: 2026-05-24. Roadmap home: `agents/roadmaps/road-to-employee-product-and-external-proof.md` Phase 2.

## What this doc is **not**

- Not the connector contract for GitHub / Jira / Confluence — those sit behind OAuth and stay cancelled in `road-to-internal-ai-os-deployment.md` Phase 5.
- Not a remote-fetch surface — every input must resolve to a local path on the same machine the agent runs on.
- Not a memory replacement — ingested content lives **inside** the existing memory layer under a dedicated namespace, never as a parallel store.

## Input shapes

The ingestion command accepts exactly these input shapes; anything else is rejected at the input validator with a structured error and no partial write.

| Input | Resolution rule | Example |
|---|---|---|
| `file://<absolute-path>` | Single file. Path must be absolute and inside the user's home or the project root (no `/etc`, `/var`, `~root/`, `..` escapes). | `file:///Users/maintainer/clients/acme/brief.pdf` |
| Local folder path | Recursive walk; symlinks not followed; hidden directories skipped (`.git`, `.venv`, `node_modules`). | `/Users/maintainer/clients/acme/` |
| `.zip` archive | Unpacked to a temp dir inside `$TMPDIR/agent-knowledge-<uuid>`, walked, then the temp dir is removed before the command returns. | `/Users/maintainer/clients/acme.zip` |

**Remote URLs are rejected** — `http://`, `https://`, `s3://`, `gs://`, `azure://`. The error message names `/knowledge:ingest` as local-only by design.

## Supported MIME types

The ingestion module routes each file through the existing `markitdown` adapter when the MIME type is not native markdown.

| MIME | Adapter | Notes |
|---|---|---|
| `text/markdown` | passthrough | UTF-8 only; other encodings rejected |
| `text/plain` | passthrough | UTF-8 only |
| `application/pdf` | `markitdown` | OCR if scanned; OCR confidence < 0.7 surfaces as `low_confidence` tag |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (`.docx`) | `markitdown` | |
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (`.xlsx`) | `markitdown` | One sheet per chunk |
| `application/epub+zip` (`.epub`) | `markitdown` | Chapter per chunk |
| `image/png`, `image/jpeg` | `markitdown` OCR | OCR confidence stored same as PDF |

Unsupported MIME → file skipped with a counted `skipped: <mime>` entry in the command summary. No partial-content writes.

## Bounds (non-negotiable, enforced at command entry)

| Bound | Limit | Rationale |
|---|---|---|
| Total ingest size | ≤ 100 MB per `/knowledge:ingest` call | Keeps a single ingestion bounded; multi-ingest is fine |
| Document count | ≤ 1000 per call | Avoids unbounded walks on a misconfigured folder |
| Per-file size | ≤ 20 MB | One outlier file cannot blow the budget |
| Total memory footprint | ≤ 500 MB across all ingests | LRU eviction at the namespace level when crossed |
| Path traversal depth | ≤ 10 directories | Cheap guard against pathological folder trees |

Crossing any bound is a **hard reject** at command entry — not a warning. The command returns a structured error with the bound name and the observed value.

## Storage target

Ingested content lives inside the existing memory namespace as a dedicated prefix:

```
memory/
└── knowledge/
    ├── <ingest-id>/         # uuid7 per ingest call
    │   ├── manifest.json    # source path, count, timestamps, redactions
    │   └── chunks/<n>.md    # one markdown chunk per logical unit
```

- `<ingest-id>` is a uuid7 so timestamps are recoverable from the id; never user-controlled.
- `manifest.json` is the audit row — used by `/knowledge:list` and by the LRU eviction loop.
- Chunks are markdown only after the adapter has run; the original binary is never stored.

The MCP tool `memory_retrieve` (existing surface in `agent-memory`) **must** tag retrieved entries from this namespace with `source: knowledge`. The host model decides what to do with user-supplied vs maintainer-curated entries; this contract only requires the tag.

## Redaction defaults

Redaction runs **before** the chunk write, never after.

- **PII allowlist** — only the following identifier classes survive the ingest: project names, document titles, headings, technical terminology. Everything else that pattern-matches a PII regex set (e-mail addresses, phone numbers, IBAN, credit-card-shaped strings, SSN-shaped strings) is replaced with class placeholders (`[EMAIL]`, `[PHONE]`, `[IBAN]`, `[CC]`, `[SSN]`).
- **Secrets never stored** — anything matching the existing `gitleaks` ruleset (or equivalent) is replaced with `[SECRET]` and the manifest's `secrets_redacted` counter is incremented. A chunk with ≥ 1 secret redaction is tagged `contains_redactions: true`.
- **The user can opt out per-call** with `--no-redact`, but the manifest captures the flag so the audit trail names exactly which ingests bypassed redaction. The default is always redact.

## Eviction policy

LRU at the namespace level. When the 500 MB cap is crossed, oldest ingests (by `manifest.last_touched`) are dropped whole — never per-chunk. `last_touched` updates on every `memory_retrieve` hit against an entry in the namespace. The user can pin an ingest with `/knowledge:list --pin <ingest-id>`; pinned ingests are never evicted.

## Command surface (deferred to impl PR)

`/knowledge:ingest <path>`, `/knowledge:list`, `/knowledge:forget <prefix>` are defined elsewhere — this contract pins their **inputs, bounds, storage, and redaction**. The Python module that implements the file walk + MIME routing + chunk writing lives at `packages/core/installer/python/knowledge_ingest.py`, ≤ 400 LOC, per Phase 2 Step 2.

## Open questions (Phase 2 council pass, optional)

- Chunk size — fixed (e.g. 2 KB markdown) vs adaptive per document? Default: 2 KB until the recruit sessions or eval surface a reason to change.
- OCR confidence threshold — 0.7 is a guess; first three sessions inform the right number.
- Pinning UX — `--pin` flag vs a separate `/knowledge:pin` command. Default in this contract: a flag on `/knowledge:list`.
