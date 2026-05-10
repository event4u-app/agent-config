---
complexity: lightweight
---

# Road to MCP Distribution

**Status:** Not started — successor roadmap, dormant until a real consumer ask surfaces.
**Started:** 2026-05-10 (stub only)
**Trigger:** AI Council 3-round verdict on Phase 6 of `road-to-mcp-server.md` deferred F2 (SSE transport) out of "distribution polish" because it is a deployment primitive with its own A0 amendment, not polish. Predecessor:
[`agents/council-responses/mcp-phase-6-distribution-verdict.md`](../council-responses/mcp-phase-6-distribution-verdict.md).

## Purpose

Land the **remote-MCP** distribution channel — HTTP/SSE transport that
lets MCP clients connect to a server they do not co-locate with the
project tree. The stdio bundle from `road-to-mcp-server.md` Phase 6 F3
covers co-located scenarios (local Docker, remote-SSH-piped stdio); a
real consumer ask for **client → network → server** mode is the
trigger for this roadmap.

## Wake-up trigger — required before any code

At least one of:

- A named consumer (internal or external) requests SSE/HTTP-MCP access
  to agent-config and is willing to operate the transport (TLS, auth,
  rotation).
- The MCP ecosystem's reference clients standardize on an HTTP/SSE
  transport variant the stdio bundle cannot serve.
- Marketplace listing (`road-to-mcp-server.md` F4) ships and demands a
  hosted endpoint as part of its onboarding.

Without one of these, this roadmap stays dormant. Speculative
infrastructure pulls A0-amendment review time it has not earned.

## Locked design when it wakes

The council convergence is **not** a native SSE server. It is the
HTTP-bridge pattern documented in
[`mcp-request-signing § Appendix — HTTP-bridge stdio-kernel pattern`](../../docs/guidelines/agent-infra/mcp-request-signing.md#appendix--http-bridge-stdio-kernel-pattern-reference):

- The MCP server stays stdio-only (one process per session).
- A separate **bridge process** terminates HTTP/SSE, performs HMAC
  verification (per the request-signing guideline), enforces the tool
  allowlist a second time, applies backpressure, and forwards
  validated JSON-RPC frames to a supervised stdio kernel.
- The stdio kernel never trusts a frame the bridge has not signed.
- Multi-tenancy lives in the bridge — never in the kernel.

This keeps the A0 contract (read-only except allowlisted tools, no
direct shell-exec, no HTTP imports in the server module) untouched
inside the kernel.

## Phases (skeleton)

- [ ] **G1** — Bridge spec + A0 amendment review (network surface,
  auth model, rate limits).
- [ ] **G2** — Bridge implementation in a separate module
  (`scripts/mcp_bridge/`), import-surface guarded the same way
  `scripts/mcp_server/` is.
- [ ] **G3** — Operator doc + Docker image for the bridge.
- [ ] **G4** — Smoke harness: end-to-end test that signs a request,
  posts it through the bridge, observes the kernel response.

## What stays out of this roadmap

- Native SSE inside `scripts/mcp_server/` — explicitly rejected by the
  council ("if F2 ever revives, build (a) bridge, not (b) native").
- Marketplace listing — that is `road-to-mcp-server.md` F4 and depends
  on the upstream identity decision in
  `road-to-better-skills-and-profiles.md`.
- Identity/auth model design — the
  [`mcp-request-signing`](../../docs/guidelines/agent-infra/mcp-request-signing.md)
  guideline already locks the primitive; this roadmap **uses** it,
  does not redesign it.

## Reference

- Predecessor verdict:
  [`agents/council-responses/mcp-phase-6-distribution-verdict.md`](../council-responses/mcp-phase-6-distribution-verdict.md)
- Bridge pattern:
  [`docs/guidelines/agent-infra/mcp-request-signing.md`](../../docs/guidelines/agent-infra/mcp-request-signing.md)
- Stdio bundle (predecessor F3):
  [`docs/setup/mcp-server-docker.md`](../../docs/setup/mcp-server-docker.md)
