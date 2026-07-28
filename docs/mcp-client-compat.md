---
stability: experimental
---

# MCP Client-Compatibility Falsification Spike

Phase 3 of `road-to-credible-install` (§ MCP hygiene) asked one question in
two parts: **does the MCP surface this package ships actually get consumed
the way a real MCP client consumes it?** A stdio-only spike would answer
only half of that — the F2 (Streamable HTTP) deferral is specifically a
*remote-transport* question, so it needs its own leg.

Two re-runnable, committed checks. Neither is a one-time note — both re-run
on demand and this doc records the last observed result + date.

## Leg A — stdio prompts/resources are actually consumable

**File:** [`tests/contracts/mcp_client_compat_stdio.test.ts`](../tests/contracts/mcp_client_compat_stdio.test.ts)

**What it tests:** speaks raw, newline-delimited JSON-RPC over stdio to the
FULL local kernel server (`src/scripts/mcp_server/`, bundled as
`dist/mcp/server.mjs` via `npm run build:mcp-bundle`, falling back to
`tsx src/scripts/mcp_server/__main__.ts` when the bundle is absent) — the
same wire transport a real MCP client speaks. Asserts: `initialize` returns
a real `serverInfo` + `protocolVersion`; `prompts/list` returns > 0 entries;
`prompts/get` on the first listed prompt returns real content;
`resources/list` returns > 0 entries; `resources/read` on the first listed
resource returns real content.

This is the **machine-checkable** half. It proves the wire contract is real
and reachable. It does **not** prove any specific MCP client (Claude
Desktop, Zed, Continue, …) actually drives it correctly in a live session —
that interpretive half stays a manual per-client smoke, not something a CI
process can assert.

**Re-run:**

```bash
npm run build:mcp-bundle   # optional — falls back to tsx if skipped
npx vitest run tests/contracts/mcp_client_compat_stdio.test.ts
```

**Last observed result:** 2026-07-27 — **7/7 passed**, against both code
paths (the prebuilt `dist/mcp/server.mjs` bundle AND the `tsx` fallback,
spot-checked manually). `initialize` → `serverInfo.name: "agent-config"`;
`prompts/list` → 473 prompts; `resources/list` → 265 resources;
`prompts/get` + `resources/read` on the first entries both returned
non-empty content. Boot log: `registered 31 tools (19 implemented, 12
stubs)`.

## Leg B — remote raw-POST Worker reachability

**File:** [`tests/contracts/mcp_client_compat_remote.test.ts`](../tests/contracts/mcp_client_compat_remote.test.ts)

**What it tests:** whether a mainstream remote MCP client — which speaks
the full Streamable HTTP transport (session negotiation, `Mcp-Session-Id`,
an `Accept: application/json, text/event-stream` header) — can connect to
the deployed Cloud Worker in its **current** raw-POST-only form (see
[`internal/workers/mcp/README.md`](../internal/workers/mcp/README.md) —
"JSON-RPC over HTTP … POST", no session/SSE negotiation implemented). The
test issues a raw `POST /` `initialize` call with the same headers a real
Streamable-HTTP client would send, and records the outcome
(`unreachable` / `reachable` + status + content-type + whether the body
parsed as JSON-RPC) — it does **not** hard-assert pass/fail on that
outcome, because a legitimate protocol-level rejection is the documented
status quo, not a bug.

**Network-gated.** Never runs on a normal `npx vitest run` pass. Requires
BOTH:

- `AC_CLIENT_COMPAT_NET=1` — explicit opt-in to make a real network call.
- `MCP_WORKER_URL=<url>` — the deployed Worker's URL (same env-var name
  [`internal/workers/mcp/test/dev-smoke.ts`](../internal/workers/mcp/test/dev-smoke.ts)
  already uses for the post-deploy smoke). This package does not own the
  Cloudflare account subdomain — `CLOUDFLARE_WORKER_SUBDOMAIN` is a
  CI-only secret consumed by
  [`.github/workflows/deploy-mcp-worker.yml`](../.github/workflows/deploy-mcp-worker.yml) —
  so there is no safe public default to fall back to.

Missing either → skips cleanly with a logged reason.

**Re-run (from CI or an operator with the URL):**

```bash
AC_CLIENT_COMPAT_NET=1 \
MCP_WORKER_URL=https://agent-config-mcp.<your-account-subdomain>.workers.dev \
npx vitest run tests/contracts/mcp_client_compat_remote.test.ts
```

**Last observed result:** 2026-07-27 — **not run against the real
deployment**. This session ran with `AC_CLIENT_COMPAT_NET=1` and no
`MCP_WORKER_URL` (the account-subdomain secret is CI-only and unavailable
in this sandbox); the test skipped cleanly with the logged reason above,
which is itself the correctly-recorded outcome for "no URL available," not
a failure. Separately-existing evidence: the post-deploy smoke
(`internal/workers/mcp/test/dev-smoke.ts`, run by
`deploy-mcp-worker.yml` on every release) already exercises a bare
`fetch(url, {method:'POST', body: <json-rpc>})` against the real Worker and
gets valid JSON-RPC back — but that is NOT the same probe as "does a real
Streamable-HTTP client library connect" (it doesn't send the
`Accept: application/json, text/event-stream` header or attempt session
negotiation), so it does not stand in for Leg B. **The genuine leg-B
falsification run against the real deployment is still outstanding** —
a maintainer or CI run with `MCP_WORKER_URL` set is needed to close it.

## The F2 rule

```
ONLY A FAILING LEG B (remote clients genuinely cannot connect) REOPENS
THE F2 (Streamable HTTP) DEFERRAL. A REVIEWER'S ASSERTION DOES NOT.
AN UN-RUN LEG B (no URL available) IS NEITHER A PASS NOR A FAILURE —
IT DOES NOT REOPEN ANYTHING; IT STAYS OPEN AS A TODO.
```

Until leg B actually runs against the real deployment and records a genuine
`unreachable` (or a `reachable` result whose status/content-type shows the
Worker rejecting the Streamable-HTTP request shape), the F2 deferral stands
as-is. Positioning copy that claims "remote MCP clients connect out of the
box" should not be shipped until this leg has run for real — see
[`docs/setup/mcp-cloud-endpoints.md`](setup/mcp-cloud-endpoints.md) and
[`docs/contracts/mcp-cloud-scope.md`](contracts/mcp-cloud-scope.md) for the
current scope statement.
