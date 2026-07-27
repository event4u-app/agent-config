---
adr: 131
status: accepted
date: 2026-07-27
decision: mcp-sdk-hono-override
supersedes: —
superseded_by: —
phase: road-to-credible-install · Phase 0
type: dependency
review_trigger: >-
  The MCP SDK widens its `@hono/node-server` range past `^1.19.9` (upstream
  issues #2531 / #2548 resolved) — then drop the npm override and take the
  SDK's own resolution. Also reopen if any MCP transport regression is traced
  to the 2.x override.
---

# ADR-131 — Resolve the MCP-SDK `@hono/node-server` moderate chain via npm override

## Status

Accepted (2026-07-27). Fork (a) of the decision recorded in
`road-to-credible-install` Phase 0: override, not risk-acceptance.

## Context

`npm audit --omit=dev` on a fresh install reported a moderate advisory chain:
`@modelcontextprotocol/sdk` (all ≥1.25.0, including latest 1.29.0) pins
`@hono/node-server ^1.19.9`, and GHSA-frvp-7c67-39w9 (path traversal in
`serve-static` on Windows via encoded backslash) has **no patched 1.x** — the
fix line is 2.x. npm's suggested "fix" was a breaking SDK downgrade to 1.24.3,
which trades a moderate advisory for a year of SDK regressions.

The roadmap pre-registered a two-fork decision: (a) npm `overrides` for
`@hono/node-server ^2.x` + MCP smoke test of the stdio path; if red →
(b) documented risk acceptance in SECURITY.md with a verified
non-reachability claim.

## Decision

Fork (a). `package.json` carries:

```json
"overrides": { "@hono/node-server": "^2.0.5" }
```

- Resolved installed version at decision time: `@hono/node-server 2.0.12`
  under `@modelcontextprotocol/sdk 1.29.0`.
- The MCP smoke surface is green after the override: `tests/cli/
  mcp-server.e2e.test.ts`, `tests/scripts/mcp_server_server.test.ts`,
  `tests/scripts/mcp_parity_smoke.test.ts` (stdio transport — the only
  transport this package ships; the SDK's hono server adapter is not on our
  stdio path, so the override risk is confined to code we do not execute).
- `npm audit --omit=dev` reports **0 vulnerabilities** after the override
  (together with the `@fastify/static ^10.1.2` bump and `npm audit fix`).

## Upstream

Already-filed upstream issues cover exactly this range problem — linked
instead of duplicated:

- <https://github.com/modelcontextprotocol/typescript-sdk/issues/2531> —
  "Widen `@hono/node-server` range: `^1.19.9` cannot resolve past
  GHSA-frvp-7c67-39w9 (no patched 1.x)"
- <https://github.com/modelcontextprotocol/typescript-sdk/issues/2548> —
  same ask, duplicate.

## Consequences

- Fresh installs resolve a hono server adapter one major ahead of the SDK's
  declared range. The SDK uses it only for its optional hono transport;
  our stdio usage is unaffected (smoke-verified).
- The override must be dropped once upstream widens the range (see
  `review_trigger`) — a standing override against a moving SDK is debt.
- The standing release-gate audit check (Phase 0, this roadmap) fails the
  build if the chain regresses.

## Alternatives

- **(b) Risk acceptance in SECURITY.md** — rejected while (a) is green: the
  override is strictly stronger (0 findings vs documented finding) at zero
  measured cost.
- **SDK downgrade to 1.24.3** (npm's suggestion) — rejected: breaking, and
  reverts a year of SDK fixes to silence a moderate advisory.
