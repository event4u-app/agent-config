---
complexity: lightweight
status: ready
parent_roadmap: harvest-small-enhancements
---

# Roadmap: MCP tool-schema token accounting (context-load-budget)

> **Status: ready (trigger fired 2026-06-16).** Spawned from
> `road-to-harvest-small-enhancements` Phase 3a so the parent stays clean
> (council 2026-06-15: 3a is "a deferred item with no clear owner" — give it an
> open target + a trigger instead of folding it).

## Trigger (flip to `ready` when this holds)

`road-to-capability-discoverability` reaches its **`context-load-budget`** item.
This work belongs *inside* that budget surface — it is the MCP slice of the same
"what is this context costing?" question — and must not be built before the budget
mechanism it extends exists.

**Trigger met (2026-06-16):** `road-to-capability-discoverability` is archived
(complete) and its `context-load-budget` tool `src/scripts/audit_initial_context.py`
exists — the MCP accounting folds into it as a new surface, not a new tool.

## Phase 1 — MCP tool-schema accounting (only when the trigger fires)

- [x] In `audit_initial_context.py` (the context-load-budget tool), price MCP
      **tool schemas** ~per-tool (each connected MCP server's tool definitions add
      to the always-loaded budget) and **flag over-subscription** (many tools, few
      used). Fold into the existing `context-load-budget` accounting — NOT a new
      surface.
      <!-- done 2026-06-16: mcp_tool_schemas() prices each tool's client-facing
      triple (name + description + input_schema) from consumer_tool_catalog.json,
      aggregated per server (keyed for multi-server generality), with a count-based
      over_subscription heuristic + mcp_schemas.gpt advisory budget. -->
- [x] Surface the per-server token cost so a maintainer can decide which MCP
      servers earn their context cost.
      <!-- done 2026-06-16: render_md adds an "MCP — tool-schema cost per server"
      table (tools/chars/GPT/Claude/over-subscribed?) + top-10 tools-by-cost +
      an over-subscription advisory; JSON carries the full per-tool breakdown. -->

## Provenance

- Parent: `road-to-harvest-small-enhancements.md` Phase 3a (Source-E ADAPT — the
  discipline of pricing MCP schemas, not its script).
- Council: claude-sonnet-4-5 + gpt-4o, deep + peer-review, 2026-06-15 — "fold-in
  without an owner is a deferral in disguise; give it an open target + trigger."
