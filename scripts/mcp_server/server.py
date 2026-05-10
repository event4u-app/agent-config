"""MCP Server — registers `prompts/list` + `prompts/get` over stdio.

Phase 2 boundary (A0 Hard Contract still holds): read-only. No
`tools/*`, no `resources/*` (deferred to Phase 3), no filesystem
writes. New in Phase 2:

- **B1/B2** full skills + commands coverage via `PromptCache`.
- **B4** cursor-based pagination on `prompts/list`.
- **B5** hot-reload — `PromptCache` re-scans on mtime change before
  each `prompts/list` response.

`build_server` still accepts a plain `list[SkillPrompt]` so the
Phase-1 contract tests keep passing without touching their fixtures.
"""
from __future__ import annotations

import asyncio
import sys
from typing import Callable, Union

import mcp.types as types
from mcp.server import NotificationOptions, Server
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server

from . import SERVER_NAME, __version__
from .prompts import (
    PromptCache,
    SkillPrompt,
    to_mcp_prompt_meta,
)

# Page size for cursor-based pagination. Conservative default —
# Claude Desktop and Zed handle larger pages, but small pages keep
# wire payloads under typical stdio frame limits.
DEFAULT_PAGE_SIZE = 100

PromptsSource = Union[
    list[SkillPrompt],
    Callable[[], tuple[list[SkillPrompt], list[str]]],
]


def _make_loader(
    source: PromptsSource,
) -> Callable[[], tuple[list[SkillPrompt], list[str]]]:
    """Normalise to a callable returning `(prompts, errors)`."""
    if callable(source):
        return source
    static = list(source)
    return lambda: (static, [])


def _decode_cursor(cursor: str | None, total: int) -> int:
    """Cursor is a stringified integer offset. Invalid → start at 0."""
    if cursor is None:
        return 0
    try:
        offset = int(cursor)
    except (TypeError, ValueError):
        return 0
    if offset < 0 or offset > total:
        return 0
    return offset


def build_server(
    source: PromptsSource,
    *,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> Server:
    """Construct the MCP Server with the new-style paginated handler.

    Pure factory — no I/O. Tests pass a static list; the stdio
    entrypoint passes a `PromptCache.get` callable for hot-reload.
    """
    loader = _make_loader(source)
    server: Server = Server(
        name=SERVER_NAME,
        version=__version__,
        instructions=(
            "agent-config MCP server (Phase 2, experimental). Exposes "
            "all skills + commands as instructional prompts. Read-only."
        ),
    )

    @server.list_prompts()
    async def _list_prompts(
        req: types.ListPromptsRequest,
    ) -> types.ListPromptsResult:
        prompts, _errors = loader()
        cursor = req.params.cursor if req.params else None
        start = _decode_cursor(cursor, len(prompts))
        end = start + page_size
        page = prompts[start:end]
        next_cursor: str | None = str(end) if end < len(prompts) else None
        return types.ListPromptsResult(
            prompts=[types.Prompt(**to_mcp_prompt_meta(p)) for p in page],
            nextCursor=next_cursor,
        )

    @server.get_prompt()
    async def _get_prompt(
        name: str,
        arguments: dict[str, str] | None = None,
    ) -> types.GetPromptResult:
        prompts, _errors = loader()
        index = {to_mcp_prompt_meta(p)["name"]: p for p in prompts}
        prompt = index.get(name)
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
    """Entrypoint — load prompts via cache, run server over stdio."""
    cache = PromptCache()
    prompts, errors = cache.get()
    for line in errors:
        print(f"mcp-server: warn: {line}", file=sys.stderr)
    print(
        f"mcp-server: loaded {len(prompts)} prompts "
        f"({len(errors)} warnings)",
        file=sys.stderr,
    )
    server = build_server(cache.get)
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
