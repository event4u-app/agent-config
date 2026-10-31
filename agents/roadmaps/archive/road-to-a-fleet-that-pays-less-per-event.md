---
complexity: lightweight
status: ready
tree_pin: 818dbb3dbe
execution:
  mode: autonomous
review_by: 2026-12-15
estate_offset_exempt: "Owner-invoked inbox round inbox-2026-10-bm with execution in the same change (owner, 2026-10-31: \"danach arbeite die roadmaps ab mit /roadmap:process-full\"); the file closes and archives in the PR that adds it. Owner search at 818dbb3dbe (grep -rlF for enableCompileCache, gitNumstatRows, resourceUsage, maxRSS, STAGED_ENTRIES, mcp_bridge over agents/roadmaps, later, stubs): nothing owns these per-event costs; stubs/road-to-runtime-orchestration-substrate owns a resident runtime and fleet admission, stubs/road-to-per-turn-hook-economy-host-repro owns owner-machine readings."
relates:
  - slug: road-to-runtime-orchestration-substrate
    relation: disjoint
    note: "Keeps the resident runtime and fleet admission; nothing here makes a process resident."
  - slug: road-to-per-turn-hook-economy-host-repro
    relation: extends
    note: "Owner-machine readings (fleet capture, tap cost, double-fire) are parked there."
---
# Road to a fleet that pays less per event

> **Source:** `agents/tmp.old/inbox-2026-10-bm/` (topic T3).
> **Arrivals:** 1 — `inbox-2026-10-bm` (2026-10-31). Owner demand
> (2026-10-20): with up to five sessions and four subagents each the machine
> stays usable, with no loss of agent quality.

## Goal

Each hook event and each MCP start costs less without anything new running in
the background, and the cost of an event is measurable as memory and CPU, not
only wall time.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | No resident process, no new setting, no new CLI verb, no host process is killed or reniced | owner directive 2026-10-12 (no settings), ADR-041, `README.md` no-daemon claim | the owner authorises a resident runtime |
| D2 | reversible-technical | agent | Compile cache is feature-guarded and fails open | node ≥ 22.6 floor in `package.json` | a node build lacks the API |
| D3 | reversible-technical | agent | Resource columns are written only when hook timings are already on, so zero cost otherwise | `concern_timings.ts` env gate | — |

## Phase 1 — Cheaper per event

- [x] **1.1 One Stop snapshot.** `end_review_nudge_hook.ts` and <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/end_review_nudge_hook.ts -->
      `obligation_settle_hook.ts` share one memoised git numstat / untracked read
      per dispatch.
      verify: `npx vitest run tests/scripts/end_review_nudge_hook.test.ts` -> 0 plus a case counting one git call for both concerns.
- [x] **1.2 Compile cache.** `dispatch_entry.ts` and the MCP server entry call <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/dispatch_entry.ts -->
      `module.enableCompileCache` when present, failing open.
      verify: `npx vitest run tests/scripts/dispatch_entry_compile_cache.test.ts` -> 0
- [~] **1.3 MCP without npx.** <!-- deferred-resolution: carried-to=road-to-an-mcp-start-without-npm --> `dist/mcp` joins the staged runtime;
      `mcp_bridge.ts` writes the staged node + server when a stage exists and
      keeps npx as fallback.
      verify: `npx vitest run tests/install/staged_runtime.test.ts tests/scripts/mcp_bridge_pin.test.ts` -> 0
      <!-- carried 2026-10-31 to later/road-to-an-mcp-start-without-npm: `dist/mcp/server.mjs` bundles the kernel server (src/scripts/mcp_server/__main__.ts), while `.mcp.json` launches the CLI turnkey server (src/cli/commands/mcpServer.ts, with read_skill); pointing at it swaps the tool surface. Blocker: no standalone bundle of the turnkey server exists. Options: new build script for a turnkey bundle (kept, carried) / accept the kernel surface (rejected, regression) / cancel (owner only). Closes when that bundle exists and the staged path is written with npx as fallback. -->
- [x] **1.4 Honest dedup comment.** `claude_settings_hooks.ts` says the <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/claude_settings_hooks.ts -->
      plugin/settings dedup is unverified.
      verify: `npx vitest run tests/install/claude_settings_hooks.test.ts` -> 0

## Phase 2 — Measured in memory and CPU

- [x] **2.1 Resource columns.** `concern_timings.ts` records per-dispatch <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/concern_timings.ts -->
      `maxRSS` and user+system CPU µs when timings are on.
      verify: `npx vitest run tests/scripts/concern_timings.test.ts` -> 0 with a numeric-only row case.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-31 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Memo leaks across dispatches | implementation | A cached snapshot reused by a later event reports a stale diff | Keyed per dispatch with an explicit reset | Phase 1 — Cheaper per event |
| 2 | MCP fails where no stage exists | implementation | A user without the staged runtime loses MCP | npx stays the fallback | Phase 1 — Cheaper per event |

## Acceptance Criteria

- [~] AC-1 — A Stop with both concerns runs one git snapshot, and MCP starts without npm when a staged runtime exists. <!-- snapshot half met (1.1); MCP half carried with 1.3 to later/road-to-an-mcp-start-without-npm --> <!-- deferred-resolution: carried-to=road-to-an-mcp-start-without-npm -->
- [x] AC-2 — A timings run records memory and CPU per dispatch.
