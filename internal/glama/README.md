# glama.ai MCP-server integration

[glama.ai](https://glama.ai/) indexes this package's read-only stdio MCP server
(`src/scripts/mcp_server/`). It clones the repo, runs a **build** step, launches
the server via **mcp-proxy**, and introspects it. glama's admin panel stores the
build + launch commands; to keep those fields free of dotted tokens (glama
truncates the last char of any token containing a dot — `3.11` → `3.1`), the
real commands live in committed scripts:

| File | glama field | What it does |
|---|---|---|
| `build` | Build steps → `bash /app/internal/glama/build` | `uv venv` + `uv pip install -r src/scripts/mcp_server/requirements.txt` |
| `run` | CMD → `["mcp-proxy","--","bash","/app/internal/glama/run"]` | `PYTHONPATH=/app/src python -m scripts.mcp_server` |

## Local test — `task mcp:glama-test`

`Dockerfile` + `smoke.py` reproduce glama's build/run environment locally and
assert the server boots and speaks MCP (`initialize` + `prompts/list > 0`).

```bash
task mcp:glama-test
```

It builds a Debian image, runs `internal/glama/build`, then runs `smoke.py`
(an MCP stdio client) against `internal/glama/run`. Green = the build/run
scripts and the server's content roots work in a glama-like container.

## Scope — what this does and does NOT prove

Decided by AI council on 2026-06-09 (anthropic/claude-sonnet-4-5 +
openai/gpt-4o, converged): test the failure surface **we** own, not glama's.

**Proves:** `build` + `run` boot the server in Debian + mcp-proxy; the content
roots (`dist/agent-src/{skills,commands,rules,contexts}`, `docs/guidelines`)
are present and the handshake works. This is exactly what the 2026-06-04
`scripts/` → `src/scripts/` move broke.

**Does NOT prove:** that glama's sync will succeed. Out of our control —
glama's git-clone, its introspection timeout, and its generated Dockerfile all
live on their side.

**`Dockerfile` is a `COPY`-based local variant, not glama's Dockerfile.** It
tests the working tree (incl. uncommitted changes), offline. The pinned
toolchain (node 24, mcp-proxy 6.4.3, python 3.11, debian trixie) is a **dated
snapshot** of glama's generated Dockerfile, not a live mirror.

## Debugging a glama sync failure

1. Open the package's glama registry page and read its **current** generated
   Dockerfile — compare node / mcp-proxy / python versions against the pins
   here; if they drifted, update the pins locally to re-test (no need to commit
   the bump unless it is a real fix).
2. Confirm glama's admin **Build steps** = `bash /app/internal/glama/build`
   and **CMD** = `["mcp-proxy","--","bash","/app/internal/glama/run"]`.
3. Run `task mcp:glama-test` to rule out a build/run regression on our side.

_Last verified glama-parity build: 2026-06-09 — image built in ~14s, `run`
booted the server (377 prompts / 189 resources / 20 tools), handshake OK._
