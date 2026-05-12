# MCP Coverage Strategy — Discovery-First, RO-MVP, Write-Tools Deferred

The MCP server in this package ships under a deliberate **Discovery-First**
strategy. The conclusions below are durable — they survive the closure of
the originating roadmap (`road-to-mcp-full-coverage`, archived 2026-05-12)
and reopen only under named triggers.

## The three pillars

1. **Stub-by-default.** `tools/list` advertises the full consumer-relevant
   catalog. Tools without an `implemented_on` transport return a structured
   `not_implemented` envelope (wire shape: `mcp-tool-stub-envelope.md`).
   Silent 404s and 500s are forbidden — every call is observable.
2. **Telemetry-driven implementation cut.** Implementation priority is
   derived from real call telemetry (`tool_name, client_id_hash, ts,
   transport, outcome`), not from internal preference lists. The Phase 1
   J6 healthcheck (`scripts/mcp_telemetry_health.py`) refuses to let the
   pipeline run silent.
3. **Read-only MVP; write-tools and TS-port gated.** The shipped tool set
   is read-only under the A0 contract (`mcp-phase-1-scope.md` §A0). Two
   future expansions stay dormant under hard triggers:
   - **Write-tools** — re-open only after a named consumer ask, ≥2 weeks
     of RO telemetry, and an accepted A0 amendment.
   - **TS-native port** — re-open only on a measured latency-budget
     failure or a hosted-endpoint distribution requirement that the
     Python-subprocess pattern cannot meet. Batched mass-ports are
     forbidden; the N0 forcing function diverts any ≥3-tool batch into a
     fresh, council-gated roadmap.

## Why this is durable

The Discovery-First strategy is not retired by a single roadmap closure.
Retirement requires an explicit verdict in
`agents/decisions/mcp-strategy-retirement-<date>.md` with a fresh AI
Council call. Until that verdict exists, every MCP coverage decision
defers to the three pillars above. The 2026-05-12 closure of the
originating roadmap (`mcp-coverage-cut-2026-05-12.md`) reaffirmed all
three pillars in passing.

## Cross-links

- Wire-shape contract: [`mcp-tool-stub-envelope.md`](../../docs/contracts/mcp-tool-stub-envelope.md).
- Consumer-facing notice: [`mcp-discovery-phase-notice.md`](../../docs/contracts/mcp-discovery-phase-notice.md).
- A0 scope contract: [`mcp-phase-1-scope.md`](../../docs/contracts/mcp-phase-1-scope.md).
- Originating roadmap (archived): see `agents/roadmaps/archive/` —
  cited by file from telemetry scripts and decision files only.
