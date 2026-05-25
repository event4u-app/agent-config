# agent-config MCP Worker

Cloudflare Worker that serves `agent-config` prompts and resources over MCP
(JSON-RPC over HTTP). Read-only, identity-stable per release.

Governed by [`docs/contracts/mcp-cloud-scope.md`](../../docs/contracts/mcp-cloud-scope.md)
(A0-cloud) and the [Phase 2-5 verdict](../../agents/council-responses/cloudflare-mcp-phase-2-5-verdict.md).

## Layout

```
workers/mcp/
├── wrangler.toml         # Cloudflare config — bindings, compat date, vars
├── package.json          # @event4u/agent-config-mcp-worker
├── tsconfig.json         # strict TS, Bundler resolution
├── content.json          # ← packer overwrites this at build time
└── src/
    ├── index.ts          # fetch handler + HTTP framing
    ├── handlers.ts       # JSON-RPC dispatch (pure function — testable)
    ├── prompts.ts        # prompts/list, prompts/get
    ├── resources.ts      # resources/list, resources/read
    ├── stubs.ts          # deprecated tool stubs
    ├── manifest.ts       # manifest schema + runtime validator
    └── content.ts        # bundled blob types + STUB_BLOB
```

## Operator setup

First-time Cloudflare onboarding (account, R2, API token, GitHub
secrets) lives in
[`docs/setup/mcp-cloud-setup.md`](../../docs/setup/mcp-cloud-setup.md).
Run `task mcp:cloud:setup` for the guided chain.

## Local dev

```bash
cd workers/mcp
npm install
npm run dev        # wrangler dev on :8787

# in another shell:
npm run smoke:dev  # quick HTTP probes
```

Or from the repo root: `task mcp:cloud:dev`.

The committed `content.json` is the dev stub (zero entries). The pipeline
(`scripts/pack_mcp_content.py`, Phase 3) overwrites it before
`wrangler deploy`.

## Wire shape

- `initialize` returns `serverInfo` + `_meta.{releaseKey, skillSetSignature}`.
- `prompts/{list,get}` covers `skill://` and `command://` URIs.
- `resources/{list,read}` covers `rule://`, `guideline://`, `context://`.
- `tools/list` returns deprecated stubs (`_meta.deprecated: true`).
- `tools/call` on any name returns JSON-RPC `-32601` (method not found).

All response shapes mirror `scripts/mcp_server/` (the local stdio kernel)
verbatim — the same Python live-replay baseline drives both via
`--target=` (Phase 5).

## Not in scope (MVP-1)

- HMAC request signing — deferred to MVP-2 (`mcp-cloud-scope.md` §3.5).
- R2 runtime reads — R2 is archival-only; the bundle inlines content.
- KV / Durable Objects — measure first.
