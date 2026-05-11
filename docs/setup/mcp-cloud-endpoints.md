# MCP Cloud Endpoints — URL shapes & DNS

Public URL shapes for the hosted `agent-config-mcp` Worker. Governed
by `docs/contracts/mcp-cloud-scope.md` (A0-cloud) and Phase 5.2 of
`agents/roadmaps/road-to-cloudflare-mcp-hosting.md`.

## Stability

**Experimental.** Inherits the label from `mcp-phase-1-scope.md`. URL
shapes below are pinned for the lifetime of the *experimental* window;
breaking changes require a stability-label bump.

## Scope — Lite surface

The hosted endpoint exposes the **read-only governance surface**
(skills, commands, rules, guidelines, contexts) as MCP prompts +
resources. `tools/list` returns two **deprecated stubs**
(`lint_skills`, `chat_history_append`) that point at their local-stdio
successors; `tools/call` against either returns `isError=true`. No
script execution, no FS access, no shell.

Full power — the ~112 Python scripts (linters, audits, `task ci`,
work-engine hooks) — requires the local install. See
[`../contracts/mcp-cloud-scope.md`](../contracts/mcp-cloud-scope.md)
for the execution-safety boundary and the Phase-7-DEFERRED gate that
governs any future tool restoration.

## URL shapes (pinned)

Two surfaces, both serve identical wire contracts (JSON-RPC over POST,
SSE on GET — A0-cloud invariant 1):

| Shape | Resolves to | Use case |
|---|---|---|
| `https://mcp.<domain>/latest/sse` | the release currently pointed at by `releases/latest.txt` in R2 | client wants the rolling cutting-edge build |
| `https://mcp.<domain>/v<X.Y.Z>/sse` | the immutable release `<X.Y.Z>` from the R2 archive | client wants a pinned, reproducible build |

The `<domain>` placeholder is operator-configured; the package itself
does not own DNS. Pin the chosen domain in your fork's
`mcp-cloud-scope.md` § Bucket / DNS.

For JSON-RPC, drop the `/sse` suffix:

| JSON-RPC | SSE |
|---|---|
| `POST https://mcp.<domain>/latest` | `GET  https://mcp.<domain>/latest/sse` |
| `POST https://mcp.<domain>/v1.37.0` | `GET  https://mcp.<domain>/v1.37.0/sse` |

The Worker reads its bundled blob at module init (per A0-cloud
invariant 2); the path prefix in MVP-1 is a routing artefact, not a
content selector. Multi-version routing lands in MVP-2.

## DNS setup (operator-side)

One-time, requires Cloudflare account + zone access:

```sh
# 1. Add the Worker custom domain in Cloudflare dashboard:
#    Workers & Pages → agent-config-mcp → Settings → Domains & Routes
#    → Add Custom Domain → "mcp.<your-domain>"
#
# 2. Cloudflare creates the AAAA + A records automatically. No manual
#    CNAME — Custom Domains is the supported path (not "Routes").
#
# 3. Verify:
curl -s -X POST https://mcp.<your-domain>/ \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"ping","params":{}}'
```

After DNS is live, uncomment the `routes` block in
`workers/mcp/wrangler.toml` and redeploy via `wrangler deploy` (or let
the GitHub Action pick it up on the next release).

The fallback `*.workers.dev` URL stays live for free; the custom
domain is only the public stability promise.

## Health probe

Every URL accepts `GET /` with no body and returns release identity:

```json
{
  "ok": true,
  "name": "agent-config-mcp",
  "release_key": "v1.37.0-2fc5084",
  "package_version": "1.37.0",
  "signature": "35bc3c5e8b83",
  "schema_version": 1
}
```

The `signature` field is the wire-surface `skillSetSignature` — same
hash that MCP clients see under `_meta.skillSetSignature` on the
identity surface.

## Parity smoke

Post-deploy CI runs `scripts/mcp_parity_smoke.py` against the new
deployment with `--target https://mcp.<domain>`. A non-zero exit
aborts the `latest.txt` repoint, so the previous release keeps
serving on `/latest/`.

## See also

- Per-client config snippets: [`mcp-client-config.md`](mcp-client-config.md)
- A0-cloud contract: `docs/contracts/mcp-cloud-scope.md`
- R2 bootstrap: `docs/setup/mcp-r2-bootstrap.md`
- Local stdio fallback: `scripts/mcp_server/` (unchanged)
