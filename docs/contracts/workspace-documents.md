# Workspace Documents Contract

> **Status** · v0 / design · 2026-05-24. Phase 5 of the
> employee-product workstream.
> Builds on the [`daily-workspace`](daily-workspace.md) surface and
> the host-agent protocol from
> [`ADR-023`](../decisions/ADR-023-host-agent-protocol.md). Documents
> are the **output shape** of selected launcher prompts.

## When a launcher prompt produces a document

A launcher prompt is **document-shaped** when its frontmatter sets
`output_shape: document`. Otherwise the prompt is **chat-shaped**
(default) — the host reply lands in the session JSONL log only.

```yaml
# agents/roles/galabau/prompts/angebot-erstellen.md
---
title: Angebot erstellen
output_shape: document
document_type: offer
slug: from_title
---
```

Recognised `document_type` values (v0): `offer`, `mail-draft`,
`memo`, `brief`, `video-script`. Unknown types are rejected at
launcher-load time with a banner; the prompt falls back to
chat-shaped.

## Storage layout

```
~/.event4u/agent-config/workspace/documents/
├── offer/
│   ├── kundeX-angebot-2026-05-24.md          ← body
│   └── kundeX-angebot-2026-05-24.history.jsonl ← per-save revision log
├── mail-draft/
├── memo/
├── brief/
└── video-script/
```

Slug rules: kebab-case ASCII; deduped by appending `-2`, `-3`, …;
filename never contains PII. Slug default = `slugify(title) + "-" + iso-date`.

## Document frontmatter

```markdown
---
type: offer
title: Angebot Kunde X
created_at: 2026-05-24T12:08:00Z
last_edited_at: 2026-05-24T12:14:00Z
source_prompt: agents/roles/galabau/prompts/angebot-erstellen.md
source_session: 20260524T120800Z-a1b2c3d4
role: galabau
tags: [kunde-x, gartenbau, 2026-q2]
schema: workspace-document/v0
---

[document body — Markdown, host-generated, user-edited]
```

`source_prompt` + `source_session` form the provenance pair: every
document points back to the prompt that produced it and the session
that ran it. The session JSONL stays in the session store; only the
**reference** lives here.

## Revision log

Path: `<slug>.history.jsonl`. Append-only. One entry per save.

```json
{
  "ts": "2026-05-24T12:14:00Z",
  "actor": "user",
  "kind": "save",
  "delta": { "added": 12, "removed": 4 },
  "body_sha256": "ab12…"
}
```

Actor `host` marks the initial-creation save (from the host agent's
reply). Actor `user` marks every subsequent edit. No body in the
log — only the SHA. The body lives in the `.md` file; rollback walks
the SHA chain and reconstructs from a tracked-base + delta is
**deferred** to v1 (v0 keeps only the latest body).

## Export

| Format | How | Notes |
|---|---|---|
| Markdown | identity copy of `<slug>.md` | always available |
| PDF | `markitdown` reverse path (preferred), `pandoc` fallback | requires `pandoc` on PATH for fallback |
| DOCX | `pandoc <slug>.md -o <slug>.docx` | requires `pandoc` on PATH |

Export target: user picks a folder via the OS picker. No autosave to
cloud, no upload, no remote backend. Export failures surface as a
banner; partial files are not left behind.

## Workspace integration

- Phase 4 right-rail "Recent documents" list shows ≤ 20 most-recent
  entries scoped to the current role; click → opens the body in the
  user's default Markdown editor.
- The workspace **centre pane** for a document-shaped session shows
  the document body live (read-only) plus a "Edit" button that
  hands off to the OS default `.md` editor.
- Closing the workspace does not lock the document file — it stays
  user-editable.

## Failure modes

- Host CLI returns a non-document reply for a document-shaped prompt
  → workspace stores the raw text under `<slug>.md` with a
  `quarantine: true` frontmatter flag; UI shows a one-line banner.
- Disk full → red banner, no silent body loss.
- Frontmatter parse failure → revision log still appends a
  `kind: save_failed` record; user's working file is preserved
  alongside as `<slug>.broken.md`.

## Coverage requirements (Phase 5 Step 6)

- Golden tests on the export rendering: 3 fixture documents × 3
  export formats (Markdown / PDF / DOCX). Fixtures under
  `tests/golden/workspace-documents/`.
- Schema-validation tests on the frontmatter contract using
  `tests/fixtures/workspace-documents/valid/` and `invalid/`.
- ≥ 80 % branch on save + history-append paths.

## Cross-references

- [`daily-workspace`](daily-workspace.md) — workspace shell that
  hosts the document view.
- [`host-agent-protocol`](host-agent-protocol.md) — how the document
  body is produced.
- [`local-knowledge-ingestion`](local-knowledge-ingestion.md) —
  sources cited inside documents.
- ADRs: [`023`](../decisions/ADR-023-host-agent-protocol.md), [`024`](../decisions/ADR-024-workspace-v0-feature-floor.md), [`025`](../decisions/ADR-025-workspace-chrome.md).
