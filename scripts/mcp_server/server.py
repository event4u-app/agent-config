"""MCP Server — registers `prompts/list` + `prompts/get` over stdio.

Phase 1 boundary (A0 Hard Contract): read-only. No `tools/*`,
`resources/*` (deferred to Phase 3), or filesystem writes. The server
loads SKILL.md content once at boot — hot-reload is Phase 2.
"""
from __future__ import annotations

import asyncio

import mcp.types as types
from mcp.server import NotificationOptions, Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server

from . import SERVER_NAME, __version__
from .prompts import (
    SkillPrompt,
    load_phase_1_prompts,
    to_mcp_prompt_meta,
)

PROMPT_NAME_PREFIX = "skill."


def _index_by_mcp_name(prompts: list[SkillPrompt]) -> dict[str, SkillPrompt]:
    return {f"{PROMPT_NAME_PREFIX}{p.name}": p for p in prompts}


def build_server(prompts: list[SkillPrompt]) -> Server:
    """Construct the MCP Server, registering Phase 1 handlers.

    Pure factory — no I/O. Tests in `tests/test_mcp_server.py` call
    this with a fixture-loaded prompt list to exercise handlers without
    a stdio loop.
    """
    server: Server = Server(
        name=SERVER_NAME,
        version=__version__,
        instructions=(
            "agent-config MCP server (Phase 1, experimental). Exposes "
            "5 stack-agnostic skills as instructional prompts. Read-only."
        ),
    )
    by_name = _index_by_mcp_name(prompts)

    @server.list_prompts()
    async def _list_prompts() -> list[types.Prompt]:
        return [types.Prompt(**to_mcp_prompt_meta(p)) for p in prompts]

    @server.get_prompt()
    async def _get_prompt(
        name: str,
        arguments: dict[str, str] | None = None,
    ) -> types.GetPromptResult:
        prompt = by_name.get(name)
        if prompt is None:
            raise ValueError(f"Unknown prompt: {name}")
        return types.GetPromptResult(
            description=prompt.description,
            messages=[
                types.PromptMessage(
                    role="user",
                    content=types.TextContent(
                        type="text",
                        text=prompt.body,
                    ),
                ),
            ],
        )

    return server


async def run_stdio() -> None:
    """Entrypoint — load prompts, run server over stdio until EOF."""
    prompts = load_phase_1_prompts()
    server = build_server(prompts)
    init_options = InitializationOptions(
        server_name=SERVER_NAME,
        server_version=__version__,
        capabilities=server.get_capabilities(
            notification_options=NotificationOptions(),
            experimental_capabilities={},
        ),
    )
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, init_options)


def main() -> None:
    """Sync wrapper for `python -m scripts.mcp_server`."""
    asyncio.run(run_stdio())
