---
complexity: lightweight
status: later
parent_roadmap: road-to-a-fleet-that-pays-less-per-event
tree_pin: 818dbb3dbe
execution:
  mode: autonomous
review_by: 2026-12-31
estate_growth_exempt: "+1 later_roadmaps: receiver of a carried step (road-to-a-fleet-that-pays-less-per-event 1.3 and the MCP half of its AC-1, round inbox-2026-10-bm, 2026-10-31). The step cannot be done as written and keeping it alive needs a live destination; parked, not active, so the WIP cap of five is untouched."
relates:
  - slug: road-to-a-fleet-that-pays-less-per-event
    relation: extends
    note: "Carries its step 1.3 and the MCP half of its AC-1."
---
# Road to an MCP start without npm

> **Source:** `agents/tmp.old/inbox-2026-10-bm/` (topic T3), carried out of
> `road-to-a-fleet-that-pays-less-per-event` on 2026-10-31.
> **Arrivals:** 1 — `inbox-2026-10-bm` (2026-10-31).

## Goal

An MCP start in a session with a staged runtime runs the staged node and a
bundled turnkey server directly, without an npm parent process.

## Why it is parked

`dist/mcp/server.mjs` bundles the kernel server
(`src/scripts/mcp_server/__main__.ts`), while `.mcp.json` launches the CLI
turnkey server (`src/cli/commands/mcpServer.ts`, which carries `read_skill` and
`suggest_skill_for_task`). Pointing the bridge at the existing bundle would swap
the tool surface. `dist/cli` imports the whole CLI, so staging it would stage
most of `node_modules`. **Trigger:** a single-file bundle of the turnkey server
is buildable.

## Phase 1 — A staged turnkey server

- [ ] **1.1 Bundle the turnkey server.** A build script emits one file (for
      example `dist/mcp/turnkey.mjs`) from `src/cli/commands/mcpServer.ts`, with
      the same tool surface as `npx @event4u/agent-config mcp-server`.
      verify: a test lists the bundle's tools and asserts `read_skill` and `suggest_skill_for_task` are present.
- [ ] **1.2 Stage it and point the bridge at it.** The bundle joins
      `STAGED_ENTRIES` in `src/install/stagedRuntime.ts`; `src/scripts/_lib/mcp_bridge.ts`
      writes the staged node plus that bundle when a stage exists, `npx` as fallback.
      verify: `npx vitest run tests/install/staged_runtime.test.ts tests/scripts/mcp_bridge_pin.test.ts` with a staged and an unstaged case.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-31 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Tool surface drifts | implementation | A bundle missing a tool silently degrades every MCP client | The tool-list test in 1.1 | Phase 1 — A staged turnkey server |

## Acceptance Criteria

- [ ] AC-1 — With a staged runtime, the MCP server starts without npm and exposes the same tools as the npx path.
