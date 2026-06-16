---
adr: 102
status: accepted
date: 2026-06-16
decision: ticket-handoff-paste-and-mcp
supersedes: —
superseded_by: —
phase: ticket-bundles (rework)
type: structural
---

# ADR-102 — Ticket handoff is paste/MCP, not an API export

## Status

**Accepted** · 2026-06-16. Supersedes the **transport decision** of
[ADR-101](ADR-101-ticket-bundle-emission.md) (its R2/R4 GraphQL-export +
idempotency, and the `linear_state` part of R3). The rest of ADR-101 — the
bundle format, the buildability gate, `model_tier` per ticket, the traceability
spine, v1-immutable — stands unchanged.

## Context

ADR-101 specified that a roadmap-materialised ticket bundle projects into Linear
via a GraphQL exporter (`build_ticket_export.py`) with query/map-first
idempotency tracked in a manifest `linear_state` map (CSV as a bootstrap).

The maintainer's actual requirement is simpler: **be able to copy/paste an MD
ticket into a Linear (or Jira) issue.** An automatic API export is unwanted —
"the agent can do that via MCP anyway; we don't need to wire it through an API."
The GraphQL client, the idempotency map, the transport spike, and the drift
check were solving a problem that does not exist.

## Decision

1. **No bundled API client, no automatic export.** Remove
   `build_ticket_export.py` and the planned `tickets:export` CLI.
   The package ships zero Linear/Jira API wiring.
2. **The MD ticket is the handoff artifact.** Its frontmatter `title` is the
   issue title; its Markdown body is the issue description (renders in
   Linear/Jira). A human pastes it; the body is authored render-ready.
3. **MCP is the programmatic surface.** To create issues without pasting, the
   agent uses a tracker **MCP server** (Linear/Jira) with the ticket as input.
   Integration lives at the MCP layer, not in this package.
4. **No tracker state in the bundle.** Drop `linear_state` from the manifest +
   its schema. A tracker issue is a one-way copy; nothing is read back. The
   bundle is the source of truth (ADR-101 D7, unchanged).

## Consequences

- **Positive.** Far less machinery to maintain (no API client, no idempotency
  map, no transport spike, no drift check). No token dependency — the whole
  thing works offline. Matches how the maintainer actually moves tickets.
- **Negative / cost.** No one-command bulk import; bulk creation is paste-by-paste
  or an MCP loop. Acceptable — bundles are small and the agent can drive MCP.
- **Neutral.** Re-creating an edited ticket in the tracker is a re-paste / MCP
  update; there is no automatic reconciliation (there was none worth keeping).

## Alternatives considered

1. **Keep the GraphQL exporter (ADR-101 R2).** Rejected by the maintainer —
   unwanted API surface; MCP already covers programmatic creation.
2. **CSV bootstrap.** Rejected — same "automatic export" we are removing.
3. **A thin "render paste-ready" helper.** Not needed — the ticket body is
   already paste-ready Markdown; a helper would be ceremony.

## References

- [ADR-101](ADR-101-ticket-bundle-emission.md) — the bundle format (transport
  decision superseded here).
- [`ticket-bundle-format`](../contracts/ticket-bundle-format.md) §8 — the
  paste/MCP handoff (rewritten).
