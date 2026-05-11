# MCP Registry Listing — submission package

Single source of truth for every MCP-registry submission of the hosted
`agent-config-mcp` Worker. Copy-paste sections from this file into the
target registry's template; do not maintain per-registry forks.

Phase 6.1 of `agents/roadmaps/road-to-cloudflare-mcp-hosting.md`.

## One-liner

> Read-only governance surface for AI coding agents — 174 skills, 104
> commands, 60 rules, 100 guidelines + contexts. Hosted MCP bridge
> over the `event4u/agent-config` package.

## Endpoints

| Shape | URL | Use |
|---|---|---|
| Rolling latest | `https://mcp.<operator-domain>/latest/sse` | clients tracking the live build |
| Pinned release | `https://mcp.<operator-domain>/v<X.Y.Z>/sse` | clients pinning a reproducible version |
| Liveness | `GET https://mcp.<operator-domain>/` | release identity + signature |

The `<operator-domain>` placeholder reflects the package's design —
every operator hosts their own Worker. The package upstream does not
run a public reference deployment; consumers point their Worker at
their own R2 bucket per `docs/setup/mcp-r2-bootstrap.md`.

## Wire surface (MVP-1)

| Method | Status |
|---|---|
| `initialize` | implemented |
| `ping` | implemented |
| `prompts/list`, `prompts/get` | implemented |
| `resources/list`, `resources/read` | implemented |
| `tools/list` | implemented (returns deprecated stubs only) |
| `tools/call` | **not implemented** — returns `-32601 Method not found` |
| `notifications/*` | not implemented |

No mutation, no auth, no subrequests at runtime. Full contract:
`docs/contracts/mcp-cloud-scope.md` § A0-cloud.

## Stability

**Experimental.** Wire surface, URL shapes, and the `_meta.signature`
field are pinned for the lifetime of the *experimental* window.
Breaking changes require a stability-label bump (see
`docs/contracts/mcp-phase-1-scope.md`).

## Identity & reproducibility

Every response carries `_meta.skillSetSignature` — a 12-char SHA-256
prefix over the sorted `(uri, body)` pairs of the bundled content.
Identical content → identical signature, across machines and builds.
R2 archives every release indefinitely under
`releases/v<X.Y.Z>-<sha>/`.

## Categories (for registry tagging)

- `governance`
- `meta-prompting`
- `skills`
- `agent-infrastructure`
- `code-review`
- `experimental`

## License & contact

| Field | Value |
|---|---|
| License | MIT |
| Source | `https://github.com/event4u-app/agent-config` |
| Maintainer | event4u-app (org) |
| Contact | GitHub issues |

## Links to upstream contracts

- A0-cloud safety contract: `docs/contracts/mcp-cloud-scope.md`
- Phase-1 scope (inherited): `docs/contracts/mcp-phase-1-scope.md`
- URL shapes & DNS: `docs/setup/mcp-cloud-endpoints.md`
- Local stdio kernel (predecessor): `scripts/mcp_server/`

## Submission targets

| Target | Status | Notes |
|---|---|---|
| [`awesome-mcp-servers`](https://github.com/punkpeye/awesome-mcp-servers) | ready for PR | low-friction listing, accepts experimental |
| [`modelcontextprotocol.io` catalog](https://modelcontextprotocol.io/servers) | ready for PR after `awesome-mcp-servers` merges | needs evidence of community uptake |

Both submissions reuse the **One-liner**, **Endpoints**, **Wire
surface**, **Stability**, and **License & contact** sections verbatim
from this file.

## Out of scope for this roadmap

npm-launcher listing (`npx @event4u/agent-config-mcp`) targets the
**local stdio** server, not the hosted Worker. Different transport,
different installation pattern, different audience — captured in
`agents/roadmaps/road-to-mcp-server.md` if revived.
