"""Consumer tool catalog — source of truth for Phase 1 discovery stubs.

Loaded once at module import from ``consumer_tool_catalog.json``. Both
the stdio server (``tools.py``) and the cloud pack
(``scripts/pack_mcp_content.py``) read from this file so the manifest
returned by ``tools/list`` on either transport is byte-identical apart
from per-tool ``implemented_on`` metadata.

Side-effect classification (``ro`` / ``fs-write`` / ``shell``) and the
``not_implemented`` envelope contract live in
``docs/contracts/mcp-tool-stub-envelope.md``.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

_CATALOG_FILE = Path(__file__).resolve().parent / "consumer_tool_catalog.json"

# Stable error code surfaced in the ``not_implemented`` envelope. The
# Worker mirrors this string verbatim — keep them in sync via the
# envelope contract.
NOT_IMPLEMENTED_CODE = "not_implemented"


@dataclass(frozen=True)
class CatalogEntry:
    """One row in ``consumer_tool_catalog.json``.

    ``implemented_on`` lists transports where a real handler is wired
    (``stdio`` / ``worker``); missing transports return the
    ``not_implemented`` envelope.
    """

    name: str
    description: str
    side_effect: str
    implemented_on: tuple[str, ...]
    input_schema: dict[str, Any]


def _validate(raw: dict[str, Any]) -> None:
    """Refuse to boot on a malformed catalog. Boot-time errors only."""
    if raw.get("schema_version") != 1:
        raise ValueError(
            f"catalog: unsupported schema_version="
            f"{raw.get('schema_version')!r}; expected 1"
        )
    tools = raw.get("tools")
    if not isinstance(tools, list) or not tools:
        raise ValueError("catalog: 'tools' must be a non-empty list")
    seen: set[str] = set()
    for entry in tools:
        if not isinstance(entry, dict):
            raise ValueError("catalog: every tool entry must be an object")
        for field in ("name", "description", "side_effect", "input_schema"):
            if field not in entry:
                raise ValueError(f"catalog: tool missing '{field}'")
        if entry["side_effect"] not in ("ro", "fs-write", "shell"):
            raise ValueError(
                f"catalog: tool {entry['name']!r} has invalid side_effect "
                f"{entry['side_effect']!r} (expected ro / fs-write / shell)"
            )
        name = entry["name"]
        if name in seen:
            raise ValueError(f"catalog: duplicate tool name {name!r}")
        seen.add(name)


def load_catalog(path: Path | None = None) -> list[CatalogEntry]:
    """Parse and validate the catalog. Returns entries in file order."""
    target = path or _CATALOG_FILE
    raw = json.loads(target.read_text(encoding="utf-8"))
    _validate(raw)
    return [
        CatalogEntry(
            name=t["name"],
            description=t["description"],
            side_effect=t["side_effect"],
            implemented_on=tuple(t.get("implemented_on") or ()),
            input_schema=t["input_schema"],
        )
        for t in raw["tools"]
    ]


def load_raw(path: Path | None = None) -> dict[str, Any]:
    """Return the raw parsed JSON. Used by the cloud packer."""
    target = path or _CATALOG_FILE
    raw = json.loads(target.read_text(encoding="utf-8"))
    _validate(raw)
    return raw


def install_hint(raw: dict[str, Any] | None = None) -> str:
    """Stable install-hint surfaced in the envelope."""
    data = raw if raw is not None else load_raw()
    return str(data.get("install_hint_stdio") or "")


def not_implemented_envelope(
    tool_name: str,
    *,
    transport: str,
    install_hint_value: str,
) -> dict[str, Any]:
    """Wire-shape error envelope used when a stub is invoked.

    Mirrored verbatim by the Cloud Worker (`internal/workers/mcp/src/stubs.ts`).
    """
    return {
        "code": NOT_IMPLEMENTED_CODE,
        "tool": tool_name,
        "transport": transport,
        "install_hint": install_hint_value,
        "alternative": "stdio",
        "message": (
            f"Tool '{tool_name}' is in the discovery catalog but not "
            f"implemented on the {transport} transport. See the install "
            "hint to wire it up locally, or check "
            "docs/contracts/mcp-tool-stub-envelope.md."
        ),
    }
