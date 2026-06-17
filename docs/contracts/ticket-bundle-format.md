# Ticket-bundle format

> The contract every downstream artifact reads from: the `emit-tickets` skill,
> the buildability/manifest linters, and the `implement-ticket` bundle
> input path. Authoritative for the frontmatter
> schema, the body doctrine, the tracker mapping, and the self-containedness
> floor. Locked by [ADR-101](../decisions/ADR-101-ticket-bundle-emission.md).

## 1. Why this exists

A roadmap step is a one-line checkbox; the full build spec is spread across the
roadmap (what), ADRs (why), and the code (how). A `high`-tier agent holds that
together; a `lite`-tier agent (Haiku) cannot. A **ticket bundle** is the closed,
durable, importable artifact that lets an expensive planning agent hand a cheap
building agent a complete unit of work. Markdown is the source of truth; a
tracker issue (Linear/Jira) is a copy you make by paste or via MCP — not a
generated export (§8).

## 2. Layout

A bundle is a directory, one per roadmap, under `agents/tickets/`:

```
agents/tickets/{roadmap-slug}/
  manifest.yml                 # machine index: dependency graph
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
id: T-001                      # bundle-local id; stable handle for the ticket
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
  - "python3 src/scripts/lint_ticket_buildable.py exits 0"
boundaries:                    # ENFORCED by the work_engine boundary guard
  must_touch:    [src/scripts/lint_ticket_buildable.py]
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
```

The manifest carries no tracker state — there is no API export to keep
idempotent (§8). The bundle is the source of truth; a tracker issue is created
by paste or by the agent via MCP, never synced back into the manifest.

## 7. Registry (`agents/tickets/_registry.yml`, machine-generated)

```yaml
bundles:
  road-to-ticket-bundles:
    manifest_path: agents/tickets/road-to-ticket-bundles/manifest.yml
    source_roadmap: agents/roadmaps/archive/road-to-ticket-bundles.md
    status: in_progress        # derived from manifest
```

`update_roadmap_progress.py` reads this one file; never recursive-globs bundles.

## 8. Tracker handoff — paste-ready, or via MCP (no API export)

A ticket goes into Linear/Jira **by copy/paste** or, when programmatic, by the
**agent using a tracker MCP server**. There is **no bundled API client and no
automatic export** — the ticket Markdown *is* the handoff artifact.

| Ticket field | Tracker issue |
|---|---|
| frontmatter `title` | issue title |
| the Markdown **body** (everything after the frontmatter) | issue description — paste it; Markdown renders in Linear/Jira |
| `priority` / `estimate` / `labels` | the matching issue fields (set during paste / by MCP) |
| `parent` (phase root) | parent issue, when the tracker supports sub-issues |

- **Copy/paste (default):** the ticket body is clean, render-ready Markdown.
  Paste it into a new Linear/Jira issue; set title from `title`. Asset images
  are relative repo paths — attach them in the tracker, or (public repo) paste a
  `raw.githubusercontent.com` URL.
- **MCP (programmatic):** to create issues without pasting, the agent calls the
  Linear/Jira **MCP server** with the ticket as input. The package ships **no**
  API wiring of its own — MCP is the integration surface.
- **One direction only:** the bundle is the source of truth; a tracker issue is
  a copy, never read back into the bundle (no sync, no `linear_state`).

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

## 12. Kill-switch & rollback

Two reversal surfaces, since a bundle is git-tracked and the tracker is a
projection:

- **Per-ticket.** A ticket is reverted by `git`-restoring its `T-NNN-*.md`
  (and `.assets/`) to a prior commit. A `lite` build gone wrong is bounded by
  the ticket's `boundaries` (the work_engine boundary guard halts out-of-scope
  edits before commit) — so the blast radius is the ticket's `must_touch` set.
- **Per-bundle.** To abandon a bundle entirely, `git mv` it to
  `agents/tickets/archive/{slug}/` (it moves with its roadmap on archival,
  §2) — never delete in place, so the audit trail survives.

A tracker issue created by paste/MCP from a ticket is a one-way copy (§8); the
bundle is the source of truth, so reverting the bundle needs no tracker
coordination — fix the issue in the tracker by hand if it was already created.

## 13. Status projection — one direction only

Three surfaces show a ticket's progress; exactly one is the truth and the other
two are derived. The writeback is **single-directional** so they never become
rival truths:

```
ticket `status` (MD)  ──►  roadmap checkbox  ──►  agents/roadmaps-progress.md (dashboard)
```

- The ticket file's `status` (`ready` / `draft` / `done`) is the **truth**.
- When a ticket flips to `done`, its roadmap step's `<!-- ticket: T-NNN -->`
  checkbox flips `[x]` in the **same edit**, and the dashboard regenerates
  (`./agent-config roadmap:progress`) — the existing `roadmap-progress-sync`
  cadence, unchanged.
- A tracker issue (created by paste/MCP, §8) is a point-in-time copy; its state
  is **not** read back into the ticket. If you keep a tracker issue in sync, do
  it from the ticket outward (re-paste / MCP update), never the reverse.

Never wire the reverse (tracker → ticket): that recreates the two-drifting-truths
failure the whole format avoids.

## See also

- [ADR-101](../decisions/ADR-101-ticket-bundle-emission.md) — the format commitment + council convergence.
- [`roadmaps.md`](../../src/agent-src/templates/roadmaps.md) — the sibling planning artifact.
- [ADR-035](../decisions/ADR-035-model-capability-tiers.md) — the `model_tier` bands.
