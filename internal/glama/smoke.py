#!/usr/bin/env python3
"""Glama-parity smoke test for the stdio MCP server.

Boots the server exactly as glama does — `bash /app/internal/glama/run` — then
asserts it speaks MCP: `initialize` succeeds and `prompts/list` returns at least
one prompt. A zero-prompt result is the canonical content-root failure (a
`.dockerignore` that dropped `dist/agent-src/`, or a build/run path bug).

Runs INSIDE the container with /opt/venv/bin/python — the `mcp` SDK lives there,
installed by internal/glama/build. This is the real integration test of the
build + run pipeline, i.e. the failure surface the 2026-06-04 path move broke.
"""
from __future__ import annotations

import anyio
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# Spawn the stdio server through the exact launch script glama runs.
SERVER = StdioServerParameters(command="bash", args=["/app/internal/glama/run"])


async def _run() -> int:
    async with stdio_client(SERVER) as (read, write):
        async with ClientSession(read, write) as session:
            init = await session.initialize()
            prompts = (await session.list_prompts()).prompts
            try:
                resources = (await session.list_resources()).resources
            except Exception:  # resources are optional for the smoke verdict
                resources = []

            info = init.serverInfo
            print(f"server:    {info.name} v{info.version}")
            print(f"prompts:   {len(prompts)} (first page)")
            print(f"resources: {len(resources)} (first page)")

            if not prompts:
                print(
                    "FAIL: prompts/list returned 0 — content root missing. "
                    "Check .dockerignore kept dist/agent-src/ and that "
                    "internal/glama/{build,run} resolve src/scripts/mcp_server."
                )
                return 1

            print("OK: MCP initialize + prompts/list succeeded")
            return 0


if __name__ == "__main__":
    raise SystemExit(anyio.run(_run))
