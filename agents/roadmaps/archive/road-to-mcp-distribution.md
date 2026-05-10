---
complexity: lightweight
---

# Road to MCP Distribution

**Status:** Archived 2026-05-10 — fully superseded by
[`road-to-cloudflare-mcp-hosting.md`](../road-to-cloudflare-mcp-hosting.md).
Bridge work (G1–G4) absorbed by Cloudflare Phases 1–5; registry
listing (G5) absorbed by Cloudflare Phase 6 (experimental-label
listing — the "wait for beta" gate was self-imposed and dropped).
**Started:** 2026-05-10 (stub only)
**Trigger:** AI Council 3-round verdict on Phase 6 of `road-to-mcp-server.md` deferred F2 (SSE transport) out of "distribution polish" because it is a deployment primitive with its own A0 amendment, not polish. The follow-up F4 closure call (2026-05-10) deferred-in F4 (marketplace listing) by the same logic — same deployment-primitive shape, blocked on the *experimental* stability label. Predecessors:
[`mcp-phase-6-distribution-verdict.md`](../council-responses/mcp-phase-6-distribution-verdict.md),
[`mcp-phase-6-f4-marketplace-verdict.md`](../council-responses/mcp-phase-6-f4-marketplace-verdict.md),
[`cloudflare-mcp-hosting-verdict.md`](../council-responses/cloudflare-mcp-hosting-verdict.md).

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
- The server graduates from *experimental* (per
  `docs/contracts/mcp-phase-1-scope.md`) to stable, unlocking G5
  (marketplace listing — deferred-in from `road-to-mcp-server.md` F4).

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

- [-] **G1** — Bridge spec + A0 amendment review (network surface,
  auth model, rate limits). **Superseded** by
  [`road-to-cloudflare-mcp-hosting.md`](road-to-cloudflare-mcp-hosting.md)
  Phase 1 (`mcp-cloud-scope.md` is the bridge spec + A0 amendment for
  the Worker shape). No separate `scripts/mcp_bridge/` module — the
  Worker IS the bridge.
- [-] **G2** — Bridge implementation in a separate module
  (`scripts/mcp_bridge/`), import-surface guarded the same way
  `scripts/mcp_server/` is. **Superseded** by `workers/mcp/` in
  the Cloudflare roadmap (TS, Cloudflare Worker).
- [-] **G3** — Operator doc + Docker image for the bridge.
  **Superseded** by `docs/setup/mcp-cloud-endpoints.md` in the
  Cloudflare roadmap; no Docker image because Workers are the
  runtime.
- [-] **G4** — Smoke harness: end-to-end test that signs a request,
  posts it through the bridge, observes the kernel response.
  **Superseded** by the live-replay smoke against the deployed
  Worker in Cloudflare-roadmap Phase 5 (no HMAC for MVP-1 because
  content is OSS + read-only; HMAC moves to MVP-2 alongside tool
  restoration).
- [-] **G5** — Plugin marketplace listing. **Superseded** by
  [`road-to-cloudflare-mcp-hosting.md`](../road-to-cloudflare-mcp-hosting.md)
  Phase 6 (Registry Listing). The "experimental → beta" gate that
  blocked G5 in this roadmap was self-imposed — MCP catalog and
  `awesome-mcp-servers` accept experimental servers when the label
  is honestly declared. npm-launcher listing (wrapping the local
  stdio server) is out of scope there too.

## What stays out of this roadmap

- Native SSE inside `scripts/mcp_server/` — explicitly rejected by the
  council ("if F2 ever revives, build (a) bridge, not (b) native").
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
