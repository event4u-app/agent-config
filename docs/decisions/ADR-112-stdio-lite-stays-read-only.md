---
adr: 112
status: accepted
date: 2026-07-07
decision: stdio-lite-stays-read-only
supersedes: —
superseded_by: —
phase: road-to-mcp-full-power
type: standing
review_trigger: >-
  Reopen on a named end-user ask for MCP tools without a repo checkout — a
  Claude Desktop user who wants memory_signal but will not clone. That reopens
  A1 as its own roadmap with a fresh council round, not as silent scope creep
  here. Also reopen if the Phase 4/5 kernel handlers stop importing live repo
  modules, since bundling-means-shipping-the-whole-src-tree is the cost
  premise the rejection actually rests on
---

# ADR-112 — the turnkey stdio-lite server stays read-only; tool users route to the kernel server

## Status

**Accepted** · 2026-07-07 · maintainer decision, Phase 6 of
`road-to-mcp-full-power.md`. Resolves the ADR-085 revisit trigger
("full-kernel bundling deferred — no demand"), which fired via this
roadmap's named consumer ask.

## Context

ADR-085 shipped `agent-config mcp-server` (stdio-lite, `src/cli/mcp/`) as
a read-only, zero-setup surface: prompts + resources from the bundled
`dist/agent-src/` + `docs/guidelines/`, `tools/list` empty, execution
deferred until demand existed. Demand now exists — but for the *kernel*
server: Phases 4–5 of this roadmap shipped 18 implemented tools
(write-tier + one shell-exec pilot) on `src/scripts/mcp_server/`, all
requiring a repo checkout and the full script tree
(`src/agent-src/scripts/`, `src/scripts/_cli/`, the council pricing
stack, the exec safety envelope).

The A1 option (bundle the kernel tool surface into the npm package so
`agent-config mcp-server` gains tools) was re-evaluated against that
shipped reality.

## Decision

1. **Stdio-lite stays read-only.** `agent-config mcp-server` keeps its
   ADR-085 shape: prompts + resources, zero tools, zero setup. No kernel
   bundling.
2. **Tool users route to the kernel server** (`agent-config mcp:run` on a
   repo checkout). The per-IDE docs present this as the explicit
   trade-off: zero-setup content surface vs. checkout-required execution
   surface.
3. **Rationale:**
   - The Phase 4/5 handlers import live repo modules (dashboard
     regenerator, archival sweep, doctor/conformance internals, council
     pricing, the exec envelope). Bundling them means shipping and
     version-locking effectively the whole `src/` tree inside the npm
     tarball — the "turnkey" story would inherit the kernel's full
     dependency and drift surface while losing its one virtue:
     nothing-to-break simplicity.
   - The tools mutate the consumer's `agents/` tree and spawn vitest.
     A zero-setup binary that writes and executes on first contact is
     the wrong default posture for the entry-level surface; the kernel
     path's checkout requirement is a natural consent step.
   - Maintaining one execution surface (kernel) instead of two keeps the
     A0 contract, the test suite, and the telemetry story single-homed.
4. **Revisit trigger:** a named end-user ask for MCP tools *without* a
   repo checkout (e.g. a Claude Desktop user who wants `memory_signal`
   but will not clone). That reopens A1 as its own roadmap with a fresh
   council round — not a silent scope creep on this ADR.

## Consequences

- `docs/setup/mcp-client-config.md`'s two-entry-point table stays
  accurate as written (local turnkey = read-only content; tools =
  kernel).
- ADR-111 (Glama lists the kernel only) is reinforced — the listed
  server is also the only tool-bearing one.
- The Worker remains read-only per `docs/contracts/mcp-cloud-scope.md`;
  nothing in this ADR changes cloud scope.

## Alternatives

- **A1 full-kernel bundling** — rejected above (dependency surface,
  write/exec-by-default posture, dual maintenance).
- **Partial bundling (read-only tools only in stdio-lite)** — rejected:
  splits the tool catalog across two servers with different subsets,
  making `implemented_on` client-visible behaviour diverge per entry
  point; the discovery-first catalog would need a third transport
  dimension for marginal gain.

## References

- ADR-085 — original stdio-lite shape (read-only, execution deferred).
- ADR-111 — canonical Glama listing (kernel only).
- `agents/decisions/mcp-write-exec-cut-2026-07-07.md` — the tool cut that
  created the demand this ADR routes.
- `docs/contracts/mcp-phase-1-scope.md` § Amendment — the execution
  surface this decision keeps single-homed.
