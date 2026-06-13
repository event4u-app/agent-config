---
model_tier: medium
name: knowledge
pack: product-discovery
tier: 2
visibility: internal
description: Knowledge orchestrator — routes to ingest, list, forget. Local-only file ingestion into the agent memory namespace.
cluster: knowledge
type: orchestrator
suggestion:
  eligible: true
  trigger_description: "ingest local folder, add my customer files, point the agent at this folder, list ingested knowledge, forget that ingest"
  trigger_context: "user wants to feed local files (folder, .zip, single doc) to the agent without OAuth connectors"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /knowledge

Top-level orchestrator for the `/knowledge` family — the **local
knowledge ingestion** cluster. Single-user, single-machine, no OAuth,
no remote fetches. Feeds local files (folder · `.zip` · single PDF /
DOCX / XLSX / MD / TXT / image) into the existing memory namespace
under the `knowledge/` prefix.

Anchors: [`local-knowledge-ingestion`](../../docs/contracts/local-knowledge-ingestion.md)
contract — input shapes, bounds, redaction defaults, storage layout.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/knowledge ingest` | `commands/knowledge/ingest.md` | Walk a local path, redact, chunk, persist to `agents/memory/knowledge/<ingest-id>/` |
| `/knowledge list` | `commands/knowledge/list.md` | List existing ingests (table or JSON); pin / unpin by id prefix |
| `/knowledge forget` | `commands/knowledge/forget.md` | Drop a single ingest by id prefix (atomic, no partial state) |
| `/knowledge cross-repo` | `commands/knowledge/cross-repo.md` | Targeted read-only retrieval over opted-in linked-project siblings (ADR-032 Option A) |

Sub-command names match the locked contract in
[`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md).

## Dispatch

1. Parse the user's argument: `/knowledge <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the routed file and follow its `## Steps` section
   verbatim with the remaining args.
4. If the sub-command is unknown or missing, print the table above and ask:

   > 1. ingest — point at a local folder, `.zip`, or file
   > 2. list — show what's already ingested (`--pin` / `--unpin` to flag)
   > 3. forget — drop an ingest by id prefix
   > 4. cross-repo — targeted read-only retrieval over opted-in siblings

## Rules

- **Local-only.** Remote URLs (`http://`, `https://`, `s3://`, `gs://`,
  `azure://`) are rejected at the input validator. Never fetch the
  network from this cluster.
- **Bounds are non-negotiable** — see the contract. ≤ 1000 docs, ≤ 20 MB
  per file, ≤ 500 MB namespace (LRU eviction at the namespace level).
- **Redaction defaults to ON.** Five PII classes (email, phone, IBAN,
  credit card, SSN-shape) and five secret patterns (AWS, GitHub PAT,
  OpenAI key, private-key blocks, generic high-entropy `api_key=...`
  assignments) are replaced before storage. `--no-redact` exists for
  trusted maintainer corpora; it never becomes the default.
- **Do NOT commit, push, or open a PR** unless the user explicitly asks.
- **Do NOT chain sub-commands.** One `/knowledge <sub>` per turn.
- If the user invokes `/knowledge` with no argument, **show the menu** —
  do not guess which sub-command they meant.
