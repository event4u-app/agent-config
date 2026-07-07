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
3. **Read-only MVP; write/exec-tools gated behind a named unlock.** The
   original shipped tool set was read-only under the A0 contract
   (`mcp-phase-1-scope.md` §A0). The write-tools trigger — "a named
   consumer ask, ≥2 weeks of RO telemetry (or an explicit operator
   waiver), and an accepted A0 amendment" — **fired 2026-07-07** via
   `road-to-mcp-full-power.md`: named ask (operator), waived telemetry
   window (~24h, precedent: the 2026-05-12 cut's own 4-week waiver), and
   an accepted A0 amendment (`mcp-phase-1-scope.md` § Amendment). The
   council-gated cut list and bridge shape (build-time codegen, no
   runtime allowlist) are recorded in
   `agents/decisions/mcp-write-exec-cut-2026-07-07.md`. Any **further**
   batch (≥3 tools) beyond that verdict still requires its own fresh
   council-gated roadmap — the N0 forcing function is not spent by this
   one unlock.
   - **TS-native port** — moot: the kernel server (`src/scripts/mcp_server/`)
     completed its Python → TypeScript migration; the "Python-subprocess
     pattern cannot meet latency" trigger no longer applies to a runtime
     that no longer exists. This context file's remaining Python-era
     references are known-stale; a full refresh is a separate follow-up.

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
