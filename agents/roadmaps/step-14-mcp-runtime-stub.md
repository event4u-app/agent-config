---
complexity: cross-runtime
---

# Roadmap: MCP runtime stub (Claude-Desktop-native invocation)

> Stub roadmap owning the **MCP-native invocation surface** so commands
> currently runnable only from a terminal become invocable from Claude
> Desktop without local CLI access. Closes `step-12-universal-os-reframe.md`
> L72. Stub status — phases are intentionally coarse; refinement happens
> when the MCP-server scaffold lands.

## Source

- **Council verdict:** `agents/council-responses/2026-05-15-step12-closure-run2.json`
  D3 (c) — author a tracking stub instead of burying L72 in an annotation
  (Reviewer-A precedent argument; pattern-consistency with step-9 / step-13).
- **Parent roadmap:** [`archive/step-12-universal-os-reframe.md`](archive/step-12-universal-os-reframe.md) L72 *(archived on closure run #2)*.
- **MCP context:** `.agent-src.uncompressed/skills/mcp/SKILL.md`,
  `.agent-src.uncompressed/skills/mcp-builder/SKILL.md`.

## Prerequisites

- [x] CLI prompt path live (step-12 P4 closed earlier) — this stub upgrades
  the CLI path to MCP-native.
- [ ] MCP server scaffold chosen (FastMCP Python vs. MCP TS SDK) — Phase 1
  decision.

## Context

step-12 L72 reads: "MCP-compatible: command invocable from Claude Desktop
without terminal access; uses MCP native input prompts. The CLI prompt
path ships now; MCP native prompts depend on the upcoming MCP runtime
wiring tracked under the MCP roadmap." That "upcoming MCP roadmap" is
**this file**. Annotation-deferral was rejected by the council (D3 (c))
because annotations bury cross-cutting work; a stub surfaces in
`git grep`, README indices, and dashboard counts.

## Phase 1 — Decision

- [ ] **MCP server runtime selection:** FastMCP (Python) vs. MCP TS SDK
  — decision recorded as an ADR (`docs/contracts/adr-mcp-runtime.md`)
  with the trade-offs (latency, packaging, install footprint).
- [ ] **Tool surface scoping:** Which CLI commands warrant MCP exposure?
  Minimum viable list: `agent-config init`, `agent-config skills list`,
  `agent-config council estimate`. Out: any destructive command
  (write / push / merge) — those stay terminal-gated.

## Phase 2 — Scaffold

- [ ] **MCP server scaffold:** `mcp_server/` directory with the chosen
  runtime, registered tools matching Phase 1 scope, native input prompt
  shapes (no CLI argument parsing).
- [ ] **Install path:** `agent-config install --mcp` writes the
  Claude-Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`
  on macOS) and validates the server boots.

## Phase 3 — Acceptance

- [ ] **Cold-install validation:** A non-developer recruit (coordinated
  with `step-13-non-dev-community-validation.md` Phase 1) reaches a useful
  invocation entirely inside Claude Desktop, zero terminal commands.
- [ ] **Parent flip:** `step-12-universal-os-reframe.md` L72 flipped
  `[x]` with a pointer at this roadmap and a citation of the recruit
  finding in `agents/eval-findings/`.

## Acceptance criteria

- [ ] ADR recording runtime choice merged
- [ ] `mcp_server/` scaffold runs locally; smoke test green
- [ ] `agent-config install --mcp` wires Claude Desktop without manual
  config-file editing
- [ ] Phase 3 recruit confirms zero-terminal flow

## Done

- [ ] All phases complete; step-12 L72 flipped.

## Notes

- **Stub status:** Phases 1–3 are intentionally coarse. Once Phase 1
  lands, this file expands with concrete deliverables. Today it exists
  to keep the dependency *trackable* (council D3 (c) rationale) rather
  than buried in a parent annotation.
- **Destructive-command gate:** No `push`, `merge`, `commit`, or
  prod-write CLI gets MCP-exposed without an explicit `non-destructive-by-default`
  override path documented per command.
