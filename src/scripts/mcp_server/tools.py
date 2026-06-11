"""MCP Server — Phase 4 tools layer + Phase 1 discovery stubs.

A0 contract amendment: real handlers run only for the tools listed in
``ALLOWLIST`` (`lint_skills` + `chat_history_append`). All other names
in ``scripts/mcp_server/consumer_tool_catalog.json`` are surfaced via
``tools/list`` as discovery stubs; ``tools/call`` against them returns
the ``not_implemented`` envelope defined in
``docs/contracts/mcp-tool-stub-envelope.md`` (a successful result with
``code: not_implemented``, an ``install_hint`` and an ``alternative``).
Names that are neither implemented nor catalog-listed raise
``ValueError`` (rendered by the SDK as JSON-RPC error).

Path-scoping is mandatory for any tool that writes: the resolved target
path must stay under ``<consumer_root>`` and within the allowlist of
filenames (`agents/runtime/.agent-chat-history` — current default;
`agents/.agent-chat-history` and `.agent-chat-history` — kept for
back-compat with older consumer installs that have not migrated yet).
Escape attempts surface as ``ValueError`` before the underlying writer
runs.

This module deliberately does **not** import the ``subprocess`` module
or ``os``-level shell-execution helpers directly. It imports project
modules (``skill_linter``, ``chat_history``) that internally use them;
the wire surface exposes no shell execution.

Tools return ``dict`` from their handlers — the SDK wraps that in a
``TextContent`` block with the JSON-serialized payload, so MCP clients
can render structured output.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Awaitable, Callable

from .catalog import (
    CatalogEntry,
    install_hint as _catalog_install_hint,
    load_catalog,
    not_implemented_envelope,
)
from .telemetry import Outcome, record_call

# Stable transport tag for the stub envelope. Mirrored verbatim by
# `internal/workers/mcp/src/stubs.ts` with ``"worker"``.
STDIO_TRANSPORT = "stdio"

# Allowlisted directories (relative to consumer_root) where tool writes
# are permitted. ``chat_history_append`` resolves its path through this
# guard before the underlying writer touches the filesystem.
_ALLOWED_WRITE_REL_PATHS: frozenset[str] = frozenset(
    {
        # Current default (Volatile Runtime policy — agents/runtime/ is
        # local-only and ignored by git).
        "agents/runtime/.agent-chat-history",
        # Back-compat: older consumer installs still write to the flat
        # location. Additive — both paths stay accepted until the next
        # major tool version bump.
        "agents/.agent-chat-history",
        ".agent-chat-history",
    }
)


ToolHandler = Callable[[dict[str, Any], Path], Awaitable[dict[str, Any]]]


@dataclass(frozen=True)
class BuiltinTool:
    """Static registration record for an allowlisted MCP tool.

    ``input_schema`` is a JSON-Schema dict the SDK validates against on
    each ``tools/call``. ``handler`` is an async function that receives
    the validated arguments + the resolved ``consumer_root`` Path.
    """

    name: str
    description: str
    input_schema: dict[str, Any]
    handler: ToolHandler


def _resolve_consumer_root(override: Path | None = None) -> Path:
    """Pick the consumer-project root.

    Default: the current working directory. Tests pass an explicit
    override; the stdio entrypoint relies on the CWD set by the
    ``./agent-config mcp:run`` wrapper.
    """
    if override is not None:
        return override.resolve()
    return Path.cwd().resolve()


def _validate_in_tree_path(raw: str | None, consumer_root: Path) -> Path:
    """Resolve ``raw`` under ``consumer_root`` and assert it stays in tree.

    Returns the resolved target path. Raises ``ValueError`` when the
    path escapes the root or is not in the write allowlist. ``None``
    falls back to the default chat-history location.
    """
    root = consumer_root.resolve()
    if raw is None or raw == "":
        target = root / "agents" / "runtime" / ".agent-chat-history"
    else:
        candidate = Path(raw)
        if candidate.is_absolute():
            target = candidate.resolve()
        else:
            target = (root / candidate).resolve()
    try:
        rel = target.relative_to(root)
    except ValueError as exc:
        raise ValueError(
            f"path escapes consumer_root: {target} not under {root}"
        ) from exc
    rel_str = rel.as_posix()
    if rel_str not in _ALLOWED_WRITE_REL_PATHS:
        raise ValueError(
            f"path not in write allowlist: {rel_str!r} "
            f"(allowed: {sorted(_ALLOWED_WRITE_REL_PATHS)})"
        )
    return target


async def _lint_skills_handler(
    arguments: dict[str, Any],
    consumer_root: Path,
) -> dict[str, Any]:
    """D2 — read-only wrapper around ``skill_linter.lint_file``.

    Arguments:
        paths: optional list of repo-relative paths to lint. Empty /
            missing → lint the full ``.agent-src.uncondensed/`` tree
            via ``gather_all_candidate_files``.

    Never spawns ``git`` (no ``--changed`` mode); never writes; mirrors
    the JSON output format of ``scripts/skill_linter.py --format json``.
    """
    # Import lazily so the loader-layer import-surface test stays clean.
    from scripts.skill_linter import (  # noqa: PLC0415
        format_json,
        gather_all_candidate_files,
        lint_file,
    )

    root = consumer_root.resolve()
    requested = arguments.get("paths") or []
    if not isinstance(requested, list):
        raise ValueError("'paths' must be a list of strings")

    paths: list[Path] = []
    if requested:
        for raw in requested:
            if not isinstance(raw, str):
                raise ValueError("'paths' entries must be strings")
            candidate = Path(raw)
            resolved = (
                candidate.resolve()
                if candidate.is_absolute()
                else (root / candidate).resolve()
            )
            try:
                resolved.relative_to(root)
            except ValueError as exc:
                raise ValueError(
                    f"path escapes consumer_root: {resolved}"
                ) from exc
            if resolved.exists():
                paths.append(resolved)
    else:
        paths = gather_all_candidate_files(root)

    results = [lint_file(p, repo_root=root) for p in sorted(set(paths))]
    payload = json.loads(format_json(results))
    return payload


async def _chat_history_append_handler(
    arguments: dict[str, Any],
    consumer_root: Path,
) -> dict[str, Any]:
    """D3 — append one entry to the consumer's chat-history JSONL.

    Arguments:
        text: free-form entry text. Stored under the ``text`` field.
        entry_type: short ``t`` tag (e.g. ``note``, ``decision``).
        path: optional override of the target file. Must resolve to one
            of ``agents/runtime/.agent-chat-history`` (current default),
            ``agents/.agent-chat-history``, or ``.agent-chat-history``
            under ``consumer_root``.
        session: optional 16-char session tag. Falls back to the most
            recent body entry's ``s`` (see ``chat_history.append``).
        dry_run: when true, validates the payload + path guard and
            returns the entry that *would* be written without touching
            the filesystem.
        min_schema_version: when set, the call fails fast if the
            chat-history schema version is below this number. Defaults
            to ``None`` (no version check).

    # TODO(phase-6): wrap the file write in ``fcntl.flock`` for SSE /
    # multi-process safety. stdio is single-process so this is a moot
    # concern in Phase 4.
    """
    from scripts.chat_history import (  # noqa: PLC0415
        SCHEMA_VERSION,
        append,
        init,
        read_header,
    )

    text = arguments.get("text")
    if not isinstance(text, str) or not text.strip():
        raise ValueError("'text' must be a non-empty string")
    entry_type = arguments.get("entry_type") or "note"
    if not isinstance(entry_type, str) or not entry_type.strip():
        raise ValueError("'entry_type' must be a non-empty string")
    if entry_type == "header":
        raise ValueError("'entry_type' must not be 'header'")

    session = arguments.get("session")
    if session is not None and not isinstance(session, str):
        raise ValueError("'session' must be a string when provided")

    dry_run = bool(arguments.get("dry_run", False))

    raw_path = arguments.get("path")
    target = _validate_in_tree_path(raw_path, consumer_root)

    min_schema = arguments.get("min_schema_version")
    if min_schema is not None:
        if not isinstance(min_schema, int):
            raise ValueError("'min_schema_version' must be an integer")
        existing_header = read_header(target) if target.exists() else None
        observed = (
            int(existing_header.get("v", 0))
            if isinstance(existing_header, dict)
            else SCHEMA_VERSION
        )
        if observed < min_schema:
            raise ValueError(
                f"chat-history schema {observed} below required "
                f"{min_schema}"
            )

    entry: dict[str, Any] = {"t": entry_type, "text": text}

    if dry_run:
        return {
            "dry_run": True,
            "target_path": str(target),
            "entry": entry,
            "session": session,
        }

    # `append` requires the parent directory and a header line. Lazy-init
    # the JSONL when the consumer hasn't run `agent-config chat:init` yet.
    if not target.exists() or read_header(target) is None:
        target.parent.mkdir(parents=True, exist_ok=True)
        init(path=target)
    append(entry, path=target, session=session)
    return {
        "dry_run": False,
        "target_path": str(target),
        "entry": entry,
        "session": session,
    }


# ---------------------------------------------------------------------
# Phase 3 L2 — read-only handlers added under the
# `agents/decisions/mcp-coverage-cut-2026-05-12.md` waiver verdict.
# Each handler wraps an existing project module via lazy import so the
# module-level import surface stays small.
# ---------------------------------------------------------------------


async def _chat_history_read_handler(
    arguments: dict[str, Any],
    consumer_root: Path,
) -> dict[str, Any]:
    """Phase 3 L2 — read entries from the consumer's chat-history JSONL.

    Arguments:
        last: optional trailing-N filter (positive integer).
        session: optional 16-char session id.
        entry_type: optional ``t`` field exact-match filter.
        path: optional override; must resolve under
            ``agents/runtime/.agent-chat-history`` (current default),
            ``agents/.agent-chat-history``, or ``.agent-chat-history``.
    """
    from scripts.chat_history import read_entries  # noqa: PLC0415

    raw_path = arguments.get("path")
    target = _validate_in_tree_path(raw_path, consumer_root)

    last = arguments.get("last")
    if last is not None and (not isinstance(last, int) or last < 1):
        raise ValueError("'last' must be a positive integer when provided")
    session = arguments.get("session")
    if session is not None and not isinstance(session, str):
        raise ValueError("'session' must be a string when provided")
    entry_type = arguments.get("entry_type")
    if entry_type is not None and not isinstance(entry_type, str):
        raise ValueError("'entry_type' must be a string when provided")

    if not target.exists():
        return {
            "path": str(target),
            "entries": [],
            "count": 0,
        }

    entries = read_entries(last=last, path=target, session=session)
    if entry_type:
        entries = [e for e in entries if e.get("t") == entry_type]
    return {
        "path": str(target),
        "entries": entries,
        "count": len(entries),
    }


async def _memory_lookup_handler(
    arguments: dict[str, Any],
    consumer_root: Path,
) -> dict[str, Any]:
    """Phase 3 L2 — hybrid memory retrieval over ``agents/memory/``.

    Wraps ``scripts/memory_lookup.retrieve_v1`` to keep the v1 envelope
    on the wire. File-only fallback by default; ``with_package=true``
    enables the optional ``@event4u/agent-memory`` provider when
    reachable.
    """
    import os  # noqa: PLC0415

    from scripts.memory_lookup import (  # noqa: PLC0415
        package_operational_provider,
        retrieve_v1,
    )

    types = arguments.get("types")
    if not isinstance(types, list) or not types or not all(
        isinstance(t, str) for t in types
    ):
        raise ValueError("'types' must be a non-empty list of strings")
    keys = arguments.get("keys") or []
    if not isinstance(keys, list) or not all(isinstance(k, str) for k in keys):
        raise ValueError("'keys' must be a list of strings")
    limit_raw = arguments.get("limit", 5)
    if not isinstance(limit_raw, int) or limit_raw < 1:
        raise ValueError("'limit' must be a positive integer")

    provider = None
    if arguments.get("with_package"):
        provider = package_operational_provider()

    prev_cwd = Path.cwd()
    try:
        os.chdir(consumer_root)
        envelope = retrieve_v1(
            types=list(types),
            keys=list(keys),
            limit=limit_raw,
            operational_provider=provider,
        )
    finally:
        os.chdir(prev_cwd)
    return envelope


async def _memory_status_handler(
    _arguments: dict[str, Any],
    consumer_root: Path,
) -> dict[str, Any]:
    """Phase 3 L2 — surface ``scripts/memory_status.status()`` as JSON."""
    import os  # noqa: PLC0415

    from dataclasses import asdict  # noqa: PLC0415

    from scripts.memory_status import status  # noqa: PLC0415

    prev_cwd = Path.cwd()
    try:
        os.chdir(consumer_root)
        result = status()
    finally:
        os.chdir(prev_cwd)
    payload = asdict(result)
    payload["features"] = list(result.features)
    return payload


# Module-level prompt / resource caches reused across handler calls so
# repeated `list_*` / `read_resource_body` calls share mtime tracking.
_PROMPT_CACHES: dict[str, Any] = {}
_RESOURCE_CACHES: dict[str, Any] = {}


def _get_prompt_cache(consumer_root: Path) -> Any:
    from .prompts import PromptCache  # noqa: PLC0415

    key = str(consumer_root.resolve())
    cache = _PROMPT_CACHES.get(key)
    if cache is None:
        cache = PromptCache(root=consumer_root)
        _PROMPT_CACHES[key] = cache
    return cache


def _get_resource_cache(consumer_root: Path) -> Any:
    from .resources import ResourceCache  # noqa: PLC0415

    key = str(consumer_root.resolve())
    cache = _RESOURCE_CACHES.get(key)
    if cache is None:
        cache = ResourceCache(root=consumer_root)
        _RESOURCE_CACHES[key] = cache
    return cache


async def _list_skills_handler(
    _arguments: dict[str, Any],
    consumer_root: Path,
) -> dict[str, Any]:
    """Phase 3 L2 — enumerate skill prompts (kind=='skill')."""
    from .prompts import to_mcp_prompt_meta  # noqa: PLC0415

    cache = _get_prompt_cache(consumer_root)
    prompts, errors = cache.get()
    items = [
        {
            "name": p.name,
            "description": p.description,
            "source": p.source,
            "wire_name": to_mcp_prompt_meta(p)["name"],
        }
        for p in prompts
        if p.kind == "skill"
    ]
    items.sort(key=lambda r: r["name"])
    return {"count": len(items), "skills": items, "errors": list(errors)}


async def _list_commands_handler(
    _arguments: dict[str, Any],
    consumer_root: Path,
) -> dict[str, Any]:
    """Phase 3 L2 — enumerate command prompts (kind=='command')."""
    from .prompts import to_mcp_prompt_meta  # noqa: PLC0415

    cache = _get_prompt_cache(consumer_root)
    prompts, errors = cache.get()
    items = [
        {
            "name": p.name,
            "description": p.description,
            "source": p.source,
            "wire_name": to_mcp_prompt_meta(p)["name"],
        }
        for p in prompts
        if p.kind == "command"
    ]
    items.sort(key=lambda r: r["name"])
    return {"count": len(items), "commands": items, "errors": list(errors)}


async def _list_rules_handler(
    _arguments: dict[str, Any],
    consumer_root: Path,
) -> dict[str, Any]:
    """Phase 3 L2 — enumerate rule resources (kind=='rule')."""
    cache = _get_resource_cache(consumer_root)
    resources, errors = cache.get()
    items = [
        {
            "uri": r.uri,
            "name": r.name,
            "description": r.description,
            "source": r.source,
        }
        for r in resources
        if r.kind == "rule"
    ]
    items.sort(key=lambda r: r["uri"])
    return {"count": len(items), "rules": items, "errors": list(errors)}


async def _read_resource_body_handler(
    arguments: dict[str, Any],
    consumer_root: Path,
) -> dict[str, Any]:
    """Phase 3 L2 — fetch the rendered body of a resource URI."""
    uri = arguments.get("uri")
    if not isinstance(uri, str) or not uri:
        raise ValueError("'uri' must be a non-empty string")
    cache = _get_resource_cache(consumer_root)
    resource = cache.lookup(uri)
    if resource is None:
        raise ValueError(f"resource not found: {uri}")
    return {
        "uri": resource.uri,
        "name": resource.name,
        "description": resource.description,
        "mime_type": resource.mime_type,
        "kind": resource.kind,
        "source": resource.source,
        "body": resource.body,
    }


# ---------------------------------------------------------------------
# Allowlist — hardcoded per AI Council Q1-a verdict (2026-05-10),
# extended Phase 3 L2 (2026-05-12) under the council-waiver verdict.
# Adding a tool here is a code-review event; settings cannot enable an
# unlisted tool. Boot-time stderr log enumerates the registered set.
# ---------------------------------------------------------------------

ALLOWLIST: dict[str, BuiltinTool] = {
    "lint_skills": BuiltinTool(
        name="lint_skills",
        description=(
            "Lint skill, rule, command, guideline, and persona markdown "
            "files for frontmatter and structural errors. Use before "
            "committing or opening a PR that adds or edits any of those "
            "artifacts, to catch schema violations early. Read-only — "
            "never writes files or spawns git. Returns the "
            "`scripts/skill_linter.py --format json` payload: a `summary` "
            "object (pass / pass_with_warnings / fail / total counts) and "
            "a per-file `results` array with severity-tagged findings. "
            "Pass `paths` to lint a subset; omit for a full tree scan."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "paths": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "Repo-relative paths to lint (files or "
                        "directories). Empty or missing → full tree scan "
                        "via gather_all_candidate_files."
                    ),
                },
            },
            "additionalProperties": False,
        },
        handler=_lint_skills_handler,
    ),
    "chat_history_append": BuiltinTool(
        name="chat_history_append",
        description=(
            "Append one structured entry to the consumer project's "
            "chat-history log (a JSONL file). Use to record a decision, "
            "note, or phase marker that should persist into a later "
            "session or be distilled by `mine_session`. Writes to the "
            "filesystem (`agents/runtime/.agent-chat-history` by default; "
            "`agents/.agent-chat-history` and `.agent-chat-history` "
            "accepted for back-compat) and returns the written entry plus "
            "its resolved target path. Path-scoped: a `path` outside the "
            "allowlist, or any traversal escaping the project root, raises "
            "an error before writing. Set `dry_run: true` to preview the "
            "entry and target path without touching disk."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "The entry body to record.",
                },
                "entry_type": {
                    "type": "string",
                    "description": (
                        "Short ``t`` tag categorising the entry (e.g. "
                        "note, decision, phase). Defaults to ``note``."
                    ),
                },
                "path": {
                    "type": "string",
                    "description": (
                        "Optional path override. Must resolve to "
                        "`agents/runtime/.agent-chat-history` "
                        "(current default), "
                        "`agents/.agent-chat-history`, or "
                        "`.agent-chat-history` under consumer_root."
                    ),
                },
                "session": {
                    "type": "string",
                    "description": (
                        "Optional 16-char session id to group the entry "
                        "under. Defaults to the current session."
                    ),
                },
                "dry_run": {
                    "type": "boolean",
                    "default": False,
                    "description": (
                        "When true, return the entry and resolved target "
                        "path without writing to disk."
                    ),
                },
                "min_schema_version": {
                    "type": "integer",
                    "description": (
                        "Refuse to write if the on-disk history schema is "
                        "older than this version."
                    ),
                },
            },
            "required": ["text"],
            "additionalProperties": False,
        },
        handler=_chat_history_append_handler,
    ),
    "chat_history_read": BuiltinTool(
        name="chat_history_read",
        description=(
            "Read recent entries back from the consumer project's "
            "chat-history JSONL "
            "(`agents/runtime/.agent-chat-history`; "
            "`agents/.agent-chat-history` accepted for back-compat). Use "
            "to recover context from an earlier session — decisions, "
            "notes, phase markers — at the start of a new task. "
            "Read-only. Returns the resolved file path plus a list of "
            "matching entries (newest last). Combine `session`, `last`, "
            "and `entry_type` to narrow the result."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "last": {
                    "type": "integer",
                    "minimum": 1,
                    "description": (
                        "Return only the most recent N entries, after "
                        "other filters apply."
                    ),
                },
                "session": {
                    "type": "string",
                    "description": "Filter to a single 16-char session id.",
                },
                "entry_type": {
                    "type": "string",
                    "description": (
                        "Filter by the `t` tag (e.g. note, decision, "
                        "phase)."
                    ),
                },
                "path": {
                    "type": "string",
                    "description": (
                        "Optional history-file path override; defaults to "
                        "the standard chat-history location under the "
                        "project root."
                    ),
                },
            },
            "additionalProperties": False,
        },
        handler=_chat_history_read_handler,
    ),
    "memory_lookup": BuiltinTool(
        name="memory_lookup",
        description=(
            "Retrieve engineering-memory entries for one or more memory "
            "types, optionally narrowed to specific anchor paths. Use "
            "before editing a security-sensitive or historically buggy "
            "file to surface prior incidents, ownership, and patterns "
            "tied to it. Reads `agents/memory/<type>/*.yml` plus the "
            "`agents/memory/intake/*.jsonl` signal log. Read-only. "
            "Returns the v1 retrieval envelope: a `status` field plus "
            "per-type `slices` carrying the matched entries."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "types": {
                    "type": "array",
                    "items": {"type": "string"},
                    "minItems": 1,
                    "description": (
                        "Memory types to scan, e.g. `historical-patterns`, "
                        "`incident-learnings`, `ownership`. At least one "
                        "required."
                    ),
                },
                "keys": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "Optional anchor paths or globs to match entries "
                        "against (e.g. a file you are about to edit)."
                    ),
                },
                "limit": {
                    "type": "integer",
                    "minimum": 1,
                    "default": 5,
                    "description": (
                        "Maximum entries to return per type. Defaults to 5."
                    ),
                },
                "with_package": {
                    "type": "boolean",
                    "default": False,
                    "description": (
                        "When true, also include memory shipped with the "
                        "agent-config package, not just the consumer "
                        "project's own."
                    ),
                },
            },
            "required": ["types"],
            "additionalProperties": False,
        },
        handler=_memory_lookup_handler,
    ),
    "memory_status": BuiltinTool(
        name="memory_status",
        description=(
            "Report whether the optional `@event4u/agent-memory` CLI is "
            "installed and reachable, and surface its backend and routing "
            "metadata. Use to decide whether memory-backed tools "
            "(`memory_lookup`, `memory_signal`) will return real data "
            "before relying on them. Read-only, takes no arguments. "
            "Returns a `status` (`ok` / `absent`), the active `backend`, "
            "and — when absent — the reason and the path probed."
        ),
        input_schema={
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
        handler=_memory_status_handler,
    ),
    "list_skills": BuiltinTool(
        name="list_skills",
        description=(
            "Enumerate every skill the server currently exposes as a "
            "prompt, each with its name, description, and source. Use to "
            "discover which skills are available before suggesting or "
            "invoking one. Read-only manifest view, takes no arguments. "
            "Returns a `count` plus a `skills` array."
        ),
        input_schema={
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
        handler=_list_skills_handler,
    ),
    "list_commands": BuiltinTool(
        name="list_commands",
        description=(
            "Enumerate every slash command the server currently exposes "
            "as a prompt, each with its name and description. Use to "
            "discover available commands before routing a user request to "
            "one. Read-only manifest view, takes no arguments. Returns a "
            "`count` plus a `commands` array."
        ),
        input_schema={
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
        handler=_list_commands_handler,
    ),
    "list_rules": BuiltinTool(
        name="list_rules",
        description=(
            "Enumerate every behavioral rule the server exposes as a "
            "resource, each with its URI, name, and description. Use to "
            "discover which rules are in effect, then fetch a body with "
            "`read_resource_body` or `resources/read`. Read-only manifest "
            "view, takes no arguments. Returns a `count` plus a `rules` "
            "array."
        ),
        input_schema={
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
        handler=_list_rules_handler,
    ),
    "read_resource_body": BuiltinTool(
        name="read_resource_body",
        description=(
            "Fetch the rendered body of a single resource URI (rule, "
            "guideline, or context document) in one call, without the "
            "two-step `resources/list` + `resources/read` handshake. Use "
            "when you already know the URI and want to inline its content "
            "into a tool-call result. Read-only. Returns the resource "
            "`uri`, `name`, `description`, and full text `body`."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "uri": {
                    "type": "string",
                    "description": (
                        "Resource URI to fetch, e.g. `rule://commit-policy`, "
                        "`guideline://php/patterns/events`, or "
                        "`context://authority/scope-mechanics`."
                    ),
                },
            },
            "required": ["uri"],
            "additionalProperties": False,
        },
        handler=_read_resource_body_handler,
    ),
}


def to_mcp_tool_meta(tool: BuiltinTool) -> dict[str, Any]:
    """Render a ``BuiltinTool`` as kwargs for ``mcp.types.Tool``."""
    return {
        "name": tool.name,
        "description": tool.description,
        "inputSchema": tool.input_schema,
    }


# ---------------------------------------------------------------------
# Phase 1 discovery stubs — catalog entries with no real handler.
# Loaded at module import time. The Worker reads the same catalog via
# `content.json` so `tools/list` returns identical metadata on both
# transports apart from `implemented_on`.
# ---------------------------------------------------------------------


def _make_stub_handler(entry: CatalogEntry, install_hint_value: str) -> ToolHandler:
    """Closure that returns the `not_implemented` envelope for a stub."""

    async def _stub(
        _arguments: dict[str, Any],
        _consumer_root: Path,
    ) -> dict[str, Any]:
        return not_implemented_envelope(
            entry.name,
            transport=STDIO_TRANSPORT,
            install_hint_value=install_hint_value,
        )

    return _stub


def _build_catalog_registry() -> tuple[dict[str, BuiltinTool], frozenset[str]]:
    """Build the stub registry from the catalog. ALLOWLIST wins on overlap.

    Returns (registry, stub_names). `registry` contains every catalog
    entry not already in ALLOWLIST, each wired to a closure that emits
    the envelope.
    """
    install_hint_value = _catalog_install_hint()
    entries = load_catalog()
    registry: dict[str, BuiltinTool] = {}
    stub_names: set[str] = set()
    for entry in entries:
        if entry.name in ALLOWLIST:
            continue
        registry[entry.name] = BuiltinTool(
            name=entry.name,
            description=entry.description,
            input_schema=entry.input_schema,
            handler=_make_stub_handler(entry, install_hint_value),
        )
        stub_names.add(entry.name)
    return registry, frozenset(stub_names)


CATALOG_STUBS, STUB_NAMES = _build_catalog_registry()

# Full wire-surface registry — implemented + stubs. `tools/list` reads
# from this; `tools/call` dispatches against it.
REGISTRY: dict[str, BuiltinTool] = {**ALLOWLIST, **CATALOG_STUBS}


class ToolCache:
    """Registry view backing the MCP `tools/*` handlers.

    Default registry is ``REGISTRY`` (implemented + catalog stubs).
    Tests can pass a narrower dict (e.g. ``ALLOWLIST`` alone) to isolate
    the implemented surface.
    """

    def __init__(self, registry: dict[str, BuiltinTool] | None = None) -> None:
        self._registry: dict[str, BuiltinTool] = dict(
            registry if registry is not None else REGISTRY
        )

    def names(self) -> list[str]:
        return sorted(self._registry.keys())

    def list(self) -> list[BuiltinTool]:
        return [self._registry[name] for name in self.names()]

    def get(self, name: str) -> BuiltinTool | None:
        return self._registry.get(name)

    def is_stub(self, name: str) -> bool:
        """True when `name` is a catalog stub on this cache."""
        return name in STUB_NAMES and name in self._registry

    def implemented_names(self) -> list[str]:
        """Subset of `names()` whose handlers run real logic."""
        return sorted(n for n in self._registry if n in ALLOWLIST)

    async def dispatch(
        self,
        name: str,
        arguments: dict[str, Any],
        consumer_root: Path | None = None,
    ) -> dict[str, Any]:
        root = _resolve_consumer_root(consumer_root)
        tool = self.get(name)
        if tool is None:
            # Sonnet's latent-demand pattern: log the unknown name before
            # surfacing the JSON-RPC error so Phase 2 can rank the gap.
            self._record(name, "latent_demand", root)
            raise ValueError(f"Unknown tool: {name}")
        outcome: Outcome = "stub" if self.is_stub(name) else "implemented"
        self._record(name, outcome, root)
        return await tool.handler(arguments or {}, root)

    @staticmethod
    def _record(tool_name: str, outcome: Outcome, consumer_root: Path) -> None:
        """Best-effort JSONL write — failures never break the wire surface."""
        record_call(
            tool_name=tool_name,
            outcome=outcome,
            transport=STDIO_TRANSPORT,
            consumer_root=consumer_root,
        )


def boot_log_line(cache: ToolCache) -> str:
    """Single-line stderr enumeration of the registered tools."""
    total = len(cache.names())
    implemented = len(cache.implemented_names())
    stubs = total - implemented
    return (
        f"mcp-server: registered {total} tools "
        f"({implemented} implemented, {stubs} stubs): {cache.names()}"
    )

