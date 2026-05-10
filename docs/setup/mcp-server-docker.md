# MCP server — Docker (stdio bundle)

Phase-6 F3 ships `docker/mcp-server/Dockerfile`: a stdio-only image of
the agent-config MCP server, pinned to the same `mcp` + `PyYAML`
versions the test suite runs against. No HTTP / SSE transport — that
lives in [`road-to-mcp-distribution.md`](../../agents/roadmaps/road-to-mcp-distribution.md)
under its own A0 amendment.

## Build

Build context is the **repo root**, not `docker/mcp-server/` — the
`COPY` lines reference paths relative to the project root.

```bash
docker build -f docker/mcp-server/Dockerfile -t agent-config-mcp:local .
```

Tag conventions:

- `:local` — your machine, current working tree
- `:vX.Y.Z` — pinned to `package.json::version` at release time
- `:latest` — most recent release (avoid in MCP client configs; pin)

## Run (stdio)

The image speaks MCP over **stdin / stdout**. `docker run` must be
invoked with `-i` (interactive stdin) — without it the server has
nothing to read and exits silently.

```bash
docker run --rm -i agent-config-mcp:local
```

You should see, on **stderr**:

```
mcp-server: loaded 278 prompts (0 warnings)
mcp-server: loaded 160 resources (0 warnings)
mcp-server: registered 2 tools: ['chat_history_append', 'lint_skills']
mcp-server: identity serverVersion=0.1.0 packageVersion=1.36.1 skillSetSignature=<12-hex>
```

The fourth line is the F1 identity surface — see
[`mcp-phase-1-scope.md § Phase 6`](../contracts/mcp-phase-1-scope.md)
for semantics.

## Wire into an MCP client

```jsonc
// .mcp.json (or your client's equivalent)
{
  "mcpServers": {
    "agent-config": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "agent-config-mcp:vX.Y.Z"]
    }
  }
}
```

## Volume mounts (`chat_history_append`)

The `chat_history_append` tool writes to
`agents/.agent-chat-history` **inside the container**. For writes to
survive container lifecycle, mount the host directory:

```bash
docker run --rm -i \
  -v "$(pwd)/agents/.agent-chat-history:/app/agents/.agent-chat-history" \
  agent-config-mcp:local
```

Without the mount the tool still succeeds (path-scope check passes
inside the container), but the appended JSONL evaporates when the
container exits. The `lint_skills` tool is read-only and needs no
mount.

## Security posture

The image inherits the A0 contract verbatim — see
[`mcp-phase-1-scope.md`](../contracts/mcp-phase-1-scope.md):

- No `subprocess`, `os.system`, `requests`, `httpx`, or `urllib`
  imports anywhere on the MCP wire surface (enforced by
  `test_no_unsafe_imports_in_*` tests).
- Tools allowlist is hardcoded in `scripts/mcp_server/tools.py`. The
  container cannot grow new tools at runtime.
- Image runs as a non-root user (`mcp:mcp`). Mounted host paths must
  be writable by uid/gid `999` or you'll see permission errors.
- No HTTP listener — there is no network attack surface. Stdin/stdout
  only.

## Size

The runtime stage is `python:3.11-slim` + the pinned deps + the
`.agent-src/` content. Expect ~150-200 MB; the builder stage is
discarded.
