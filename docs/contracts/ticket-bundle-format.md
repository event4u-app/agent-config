# Ticket-bundle format

> The contract every downstream artifact reads from: the `emit-tickets` skill,
> the export generator, the buildability/manifest linters, and the
> `implement-ticket` bundle input path. Authoritative for the frontmatter
> schema, the body doctrine, the tracker mapping, and the self-containedness
> floor. Locked by [ADR-101](../decisions/ADR-101-ticket-bundle-emission.md).

## 1. Why this exists

A roadmap step is a one-line checkbox; the full build spec is spread across the
roadmap (what), ADRs (why), and the code (how). A `high`-tier agent holds that
together; a `lite`-tier agent (Haiku) cannot. A **ticket bundle** is the closed,
durable, importable artifact that lets an expensive planning agent hand a cheap
building agent a complete unit of work. Markdown is the source of truth; the
tracker (Linear) is a generated projection.

## 2. Layout

A bundle is a directory, one per roadmap, under `agents/tickets/`:

```
agents/tickets/{roadmap-slug}/
  manifest.yml                 # machine index: dep graph + linear_state
  T-001-{slug}.md              # one ticket = one Markdown build contract
  T-001-{slug}.assets/         # durable design context for that ticket
    before.png  wireframe.png  example-io.md
  T-002-{slug}.md
  ...
agents/tickets/_registry.yml   # machine-generated index of all bundles
```

- **Separate tree, not co-located** under the roadmap — the flat-file dashboard
  and archival machinery (`update_roadmap_progress.py`,
  `archive_completed_roadmaps.py`) assume `agents/roadmaps/*.md` are flat files;
  a separate tree keeps that untouched (ADR-101 R1).
- **Discovery** is via the generated `agents/tickets/_registry.yml` — one scan,
  no recursive glob, no roadmap↔manifest circular dependency.
- **Lifecycle**: a bundle is durable (unlike transient `agents/roadmap-assets/`);
  when its roadmap archives, the bundle moves with it to
  `agents/tickets/archive/{slug}/`.

## 3. Ticket frontmatter (schema: `src/scripts/schemas/ticket.schema.json`)

```yaml
---
id: T-001                      # bundle-local id; the idempotency external key
roadmap: road-to-xyz           # back-link (traceability spine)
phase: 2                       # roadmap phase number
title: "…"                     # → Linear Title
status: ready                  # ready | draft | done
model_tier: lite               # lite | medium | high — WHO may build it (ADR-035)
estimate: 3                    # story points (from estimate-ticket)
priority: 2                    # 0–4, Linear-compatible
labels: [backend, mcp]
parent: T-000                  # → Linear "Parent issue"; null at phase root
blocked_by: [T-000]            # dependency edges (must be acyclic)
adr_refs:                      # the "why", SHA-pinned (drift here HARD-blocks)
  - { path: docs/decisions/ADR-101-ticket-bundle-emission.md, sha: <git-blob-sha> }
source_refs:                   # files the build reads/changes, SHA-pinned (drift WARNS)
  - { path: src/scripts/build_linear_digest.py, sha: <git-blob-sha> }
assets: [T-001.assets/wireframe.png]   # relative to the bundle dir
acceptance:                    # runnable AND isolation-testable; no prose-only
  - "python3 src/scripts/build_ticket_export.py agents/tickets/x/ exits 0"
boundaries:                    # ENFORCED by the work_engine boundary guard
  must_touch:    [src/scripts/build_ticket_export.py]
  may_touch:     [Taskfile.yml]
  must_not_touch: [src/scripts/work_engine/**, ".github/**"]
---
```

`status` is `done` only after the work landed + verification passed.

## 4. Ticket body doctrine (the build contract)

A lite ticket is autonomous only with this fixed section order:

| Section | Purpose |
|---|---|
| `## Why` | 1–3 lines; the outcome, not backstory |
| `## Context spine` | exact paths (`file.py:142`), the sibling-to-mirror, the producer of any shape it consumes — so the builder never searches |
| `## Do` | ordered, mechanical steps |
| `## Do NOT touch` | hard boundaries (mirrors frontmatter `boundaries`) |
| `## Acceptance` | points at frontmatter `acceptance` (runnable, isolation-testable) |
| `## Quality gates` | the concrete commands (not "run CI") |
| `## Assets` | relative links into `T-NNN.assets/` (UI tickets) |

**Self-containedness rule:** if the builder must read a file that is not in the
context spine or `source_refs`, the ticket is incomplete.

## 5. Self-containedness floor (per `model_tier`)

Enforced by `lint_ticket_buildable.py`. A ticket FAILS the gate if its tier's
row is not satisfied:

| tier | acceptance | ≥1 concrete path | non-empty boundaries | resolvable assets | size floor |
|---|---|---|---|---|---|
| `lite` | required, runnable + isolation-testable | required | required | required (or `assets: none`) | ≤ 5 files AND ≤ 200 lines, else split or escalate to `medium` |
| `medium` | required | required | recommended | recommended | — |
| `high` | required | recommended | — | — | — |

A failing `lite` ticket is rejected or auto-escalated to `medium`.

## 6. Manifest (schema: `src/scripts/schemas/ticket-manifest.schema.json`)

```yaml
status: ready
planner_tier: high
builder_tier: lite
import_targets: { linear: true, jira: false }
dependency_graph:              # acyclic (no topological layering in v1)
  T-001: { status: ready, blocks: [T-002] }
  T-002: { status: ready, blocks: [] }
linear_state:                  # the idempotency map (query/map-first export)
  T-001: { linear_id: null, last_synced_sha: null }
```

`linear_state.linear_id` is the **sole idempotency key** — Linear has no
documented external-key upsert, so re-export is query/map-first: look up
`linear_id`; create only when absent; record the returned id. `last_synced_sha`
is reserved for the deferred *mutable* mode (v1 is immutable).

## 7. Registry (`agents/tickets/_registry.yml`, machine-generated)

```yaml
bundles:
  road-to-ticket-bundles:
    manifest_path: agents/tickets/road-to-ticket-bundles/manifest.yml
    source_roadmap: agents/roadmaps/road-to-ticket-bundles.md
    status: in_progress        # derived from manifest
```

`update_roadmap_progress.py` reads this one file; never recursive-globs bundles.

## 8. Tracker mapping — Linear-first (GraphQL canonical)

| Bundle field | Linear |
|---|---|
| full Markdown body | issue `description` (Markdown renders; image URLs auto-upload to Linear's auth-gated storage) |
| `id` | the local idempotency key; stored `→ linear_id` in `linear_state` |
| `title` / `priority` / `estimate` / `labels` | the matching issue fields |
| `parent` (phase root) | `Parent issue` (phases group as parents) |
| `status` | mapped to the team workflow state |

- **Transport:** GraphQL `issueCreate`/`issueUpdate`, query/map-first idempotency
  (§6). CSV via the Linear importer is an **optional one-shot bootstrap only** —
  it is create-only (duplicates on re-run), never the canonical path (ADR-101 R2).
- **Assets:** public-repo raw URLs are auto-ingested by Linear; private repos
  need the API upload path (resolved in the Phase-1b spike).
- **Jira** is a deferred second emitter over the existing `jira-integration`
  client; same bundle, different column set.

## 9. Traceability spine (bidirectional)

`roadmap ↔ ticket ↔ ADR ↔ PR`. Each ticket frontmatter names its `roadmap` +
`adr_refs`; each materialized roadmap step carries an inline
`<!-- ticket: T-NNN -->` marker. The `work_engine` ticket envelope
(`{id, title, body, acceptance_criteria}`) is a strict subset of this
frontmatter, so `/implement-ticket` consumes a bundle with no schema fork.

## 10. Staleness — split severity

`lint_ticket_stale` recomputes the pinned SHAs:

- **`adr_refs` drift → HARD block** (`not build-ready`); ADRs are semantic
  decisions, rarely change → resolution = re-emit the bundle.
- **`source_refs` drift → WARN only**; source files churn constantly, so a hard
  block would keep most tickets perma-stale and multiply bundles. The builder
  proceeds on a warning.

## 11. Assets — durable, size-capped (LFS deferred)

Git LFS is **not** configured in this repo today, and wiring it (install +
remote LFS store) is heavier than v1 needs. v1 decision: assets are git-tracked
binaries under a **size cap** — ≤ 500 KB per asset — and authors prefer vector /
text context (Mermaid, ASCII, SVG, example-I/O Markdown) over raster where it
carries the same information. `lint_ticket_buildable.py` warns on any asset over
the cap. LFS is revisited only if `agents/tickets/**` binary weight is proven a
real problem (same "defer until observed" discipline as the mutable-tickets
mode). Non-binary design context lives as plain Markdown in the `.assets/` folder.

## See also

- [ADR-101](../decisions/ADR-101-ticket-bundle-emission.md) — the format commitment + council convergence.
- [`roadmaps.md`](../../src/agent-src/templates/roadmaps.md) — the sibling planning artifact.
- [ADR-035](../decisions/ADR-035-model-capability-tiers.md) — the `model_tier` bands.
