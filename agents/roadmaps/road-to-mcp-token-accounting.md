---
complexity: lightweight
status: draft
parent_roadmap: harvest-small-enhancements
---

# Roadmap: MCP tool-schema token accounting (context-load-budget)

> **Status: draft (trigger-gated).** Spawned from
> `road-to-harvest-small-enhancements` Phase 3a so the parent stays clean
> (council 2026-06-15: 3a is "a deferred item with no clear owner" — give it an
> open target + a trigger instead of folding it). Hidden from the dashboard until
> flipped to `ready`.

## Trigger (flip to `ready` when this holds)

`road-to-capability-discoverability` reaches its **`context-load-budget`** item.
This work belongs *inside* that budget surface — it is the MCP slice of the same
"what is this context costing?" question — and must not be built before the budget
mechanism it extends exists.

## Phase 1 — MCP tool-schema accounting (only when the trigger fires)

- [ ] In `audit_initial_context.py` (the context-load-budget tool), price MCP
      **tool schemas** ~per-tool (each connected MCP server's tool definitions add
      to the always-loaded budget) and **flag over-subscription** (many tools, few
      used). Fold into the existing `context-load-budget` accounting — NOT a new
      surface.
- [ ] Surface the per-server token cost so a maintainer can decide which MCP
      servers earn their context cost.

## Provenance

- Parent: `road-to-harvest-small-enhancements.md` Phase 3a (Source-E ADAPT — the
  discipline of pricing MCP schemas, not its script).
- Council: claude-sonnet-4-5 + gpt-4o, deep + peer-review, 2026-06-15 — "fold-in
  without an owner is a deferral in disguise; give it an open target + trigger."
