"""MCP Server — registers `prompts/*` + `resources/*` over stdio.

Phase 3 boundary (A0 Hard Contract still holds): read-only. No
`tools/*`, no filesystem writes. New in Phase 3:

- **C1/C2** `resources/list` + `resources/read` for rules,
  guidelines, contexts via `ResourceCache`.
- **C3** cursor-based pagination on `resources/list` (same shape as
  prompts/list).
- **C4** hot-reload — `ResourceCache` re-scans on mtime change before
  each `resources/list` response.

Carried over from Phase 2:

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
from typing import Callable, Iterable, Union

import mcp.types as types
from mcp.server import NotificationOptions, Server
from mcp.server.lowlevel.helper_types import ReadResourceContents
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from pydantic import AnyUrl

from . import SERVER_NAME, __version__
from .prompts import (
    PromptCache,
    SkillPrompt,
    to_mcp_prompt_meta,
)
from .resources import (
    Resource,
    ResourceCache,
    to_mcp_resource_meta,
)
from .tools import (
    ToolCache,
    boot_log_line as tools_boot_log_line,
    to_mcp_tool_meta,
)

# Page size for cursor-based pagination. Conservative default —
# Claude Desktop and Zed handle larger pages, but small pages keep
# wire payloads under typical stdio frame limits.
DEFAULT_PAGE_SIZE = 100

PromptsSource = Union[
    list[SkillPrompt],
    Callable[[], tuple[list[SkillPrompt], list[str]]],
]
ResourcesSource = Union[
    list[Resource],
    Callable[[], tuple[list[Resource], list[str]]],
]


def _make_loader(
    source: PromptsSource,
) -> Callable[[], tuple[list[SkillPrompt], list[str]]]:
    """Normalise to a callable returning `(prompts, errors)`."""
    if callable(source):
        return source
    static = list(source)
    return lambda: (static, [])


def _make_resource_loader(
    source: ResourcesSource,
) -> Callable[[], tuple[list[Resource], list[str]]]:
    """Normalise to a callable returning `(resources, errors)`."""
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
    resources: ResourcesSource | None = None,
    tools: ToolCache | None = None,
) -> Server:
    """Construct the MCP Server with the new-style paginated handlers.

    Pure factory — no I/O. Tests pass a static list; the stdio
    entrypoint passes a `PromptCache.get` callable for hot-reload.
    When `resources` is omitted, resources/* handlers are still
    registered but return an empty list — clients can probe the
    capability without seeing a protocol error.
    """
    loader = _make_loader(source)
    resource_loader = _make_resource_loader(resources or [])
    server: Server = Server(
        name=SERVER_NAME,
        version=__version__,
        instructions=(
            "agent-config MCP server (Phase 3, experimental). Exposes "
            "all skills + commands as instructional prompts, plus "
            "rules + guidelines + contexts as read-only resources."
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

    @server.list_resources()
    async def _list_resources(
        req: types.ListResourcesRequest,
    ) -> types.ListResourcesResult:
        items, _errors = resource_loader()
        cursor = req.params.cursor if req.params else None
        start = _decode_cursor(cursor, len(items))
        end = start + page_size
        page = items[start:end]
        next_cursor: str | None = str(end) if end < len(items) else None
        return types.ListResourcesResult(
            resources=[types.Resource(**to_mcp_resource_meta(r)) for r in page],
            nextCursor=next_cursor,
        )

    @server.read_resource()
    async def _read_resource(uri: AnyUrl) -> Iterable[ReadResourceContents]:
        items, _errors = resource_loader()
        index = {r.uri: r for r in items}
        resource = index.get(str(uri))
        if resource is None:
            raise ValueError(f"Unknown resource: {uri}")
        return [
            ReadResourceContents(content=resource.body, mime_type=resource.mime_type),
        ]

    if tools is not None:
        tool_cache = tools

        @server.list_tools()
        async def _list_tools() -> list[types.Tool]:
            return [types.Tool(**to_mcp_tool_meta(t)) for t in tool_cache.list()]

        @server.call_tool()
        async def _call_tool(
            name: str,
            arguments: dict[str, object],
        ) -> dict[str, object]:
            return await tool_cache.dispatch(name, arguments or {})

    return server


async def run_stdio() -> None:
    """Entrypoint — load prompts + resources via caches, run server over stdio."""
    cache = PromptCache()
    prompts, errors = cache.get()
    for line in errors:
        print(f"mcp-server: warn: {line}", file=sys.stderr)
    print(
        f"mcp-server: loaded {len(prompts)} prompts "
        f"({len(errors)} warnings)",
        file=sys.stderr,
    )
    resource_cache = ResourceCache()
    resources_list, resource_errors = resource_cache.get()
    for line in resource_errors:
        print(f"mcp-server: warn: {line}", file=sys.stderr)
    print(
        f"mcp-server: loaded {len(resources_list)} resources "
        f"({len(resource_errors)} warnings)",
        file=sys.stderr,
    )
    tool_cache = ToolCache()
    print(tools_boot_log_line(tool_cache), file=sys.stderr)
    server = build_server(
        cache.get,
        resources=resource_cache.get,
        tools=tool_cache,
    )
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
