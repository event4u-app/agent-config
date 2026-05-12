"""Project-scope installed-tools manifest at ``agents/installed-tools.lock``.

Phase 3 of road-to-global-first-install (ADR-008). Committed
bill-of-materials for AI tooling a project depends on. Sibling to the
global lockfile (``installed_lock.py``) but architecturally distinct:

- ``installed_lock.py`` lives in ``~/.config/agent-config/`` and tracks
  the user-scope environment (a single ``agent_config_version`` and a
  flat ``tools[]`` list).
- ``installed_tools.py`` lives in ``agents/`` and tracks **per-project**
  tooling with richer per-entry metadata (``scope``, ``bridge_marker``,
  ``installed_at``).

The file is machine-managed: ``init`` appends / merges; ``sync`` replays;
``validate`` drift-checks. Schema is YAML; ``pyyaml`` is used when
available, otherwise a constrained manual parser handles the documented
schema (no anchors, no flow style, single-level nesting under
``tools``).
"""
from __future__ import annotations

import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

MANIFEST_ENV = "AGENT_CONFIG_INSTALLED_TOOLS"
DEFAULT_MANIFEST_RELATIVE = Path("agents") / "installed-tools.lock"
SCHEMA_VERSION = 1

_VALID_SCOPES = ("global", "project")


def manifest_path(project_root: Path, env: Optional[dict] = None) -> Path:
    """Return the active manifest path, honoring the env override."""
    env = env if env is not None else os.environ
    override = env.get(MANIFEST_ENV)
    if override:
        return Path(override).expanduser()
    return project_root / DEFAULT_MANIFEST_RELATIVE


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------

_TOP_KEY_RE = re.compile(r'^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*"?([^"\n]*?)"?\s*$')
_LIST_DASH_RE = re.compile(r"^\s*-\s*(.+?)\s*$")
_INDENT_KEY_RE = re.compile(r'^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*"?([^"\n]*?)"?\s*$')


def read_manifest(path: Path) -> Optional[dict[str, Any]]:
    """Parse the manifest into a dict; return ``None`` if absent.

    Tolerates partial / malformed files: missing keys yield missing dict
    entries rather than raising, so a corrupted file does not brick
    ``init``.
    """
    try:
        text = path.read_text(encoding="utf-8")
    except (FileNotFoundError, OSError):
        return None
    try:
        import yaml  # type: ignore[import-untyped]
        data = yaml.safe_load(text) or {}
        if isinstance(data, dict):
            data.setdefault("tools", [])
            return data
    except ImportError:
        pass
    except Exception:
        # Fall through to the manual parser; corrupt YAML is recoverable
        # from our strict schema as long as the top-level shape holds.
        pass
    return _parse_manual(text)


def _parse_manual(text: str) -> dict[str, Any]:
    data: dict[str, Any] = {"tools": []}
    in_tools = False
    current: Optional[dict[str, Any]] = None
    for raw in text.splitlines():
        stripped = raw.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped == "tools:":
            in_tools = True
            current = None
            continue
        if in_tools:
            m = _LIST_DASH_RE.match(raw)
            if m:
                first = m.group(1)
                current = {}
                data["tools"].append(current)
                # Could be inline like `- name: foo` — handle that.
                inline = _TOP_KEY_RE.match(first)
                if inline:
                    current[inline.group(1)] = inline.group(2)
                continue
            mk = _INDENT_KEY_RE.match(raw)
            if mk and current is not None:
                current[mk.group(1)] = mk.group(2)
                continue
        m_top = _TOP_KEY_RE.match(raw)
        if m_top:
            key, value = m_top.group(1), m_top.group(2)
            if key == "schema_version":
                try:
                    data[key] = int(value)
                except ValueError:
                    data[key] = value
            else:
                data[key] = value
            in_tools = False
            current = None
    return data


# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------


def _render(
    version: str,
    tools: list[dict[str, Any]],
) -> str:
    lines = [
        f"schema_version: {SCHEMA_VERSION}",
        f'agent_config_version: "{version}"',
        "tools:",
    ]
    for tool in tools:
        lines.append(f"  - name: {tool['name']}")
        lines.append(f"    scope: {tool['scope']}")
        lines.append(f"    bridge_marker: {tool['bridge_marker']}")
        lines.append(f'    installed_at: "{tool["installed_at"]}"')
    return "\n".join(lines) + "\n"


def write_manifest(
    path: Path,
    version: str,
    tools: list[dict[str, Any]],
) -> Path:
    """Atomically write the manifest; return the path written."""
    path.parent.mkdir(parents=True, exist_ok=True)
    rendered = _render(version, tools)
    fd, tmp_name = tempfile.mkstemp(
        prefix=".installed-tools.lock.", dir=str(path.parent), text=False
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(rendered)
        os.replace(tmp_name, path)
    except Exception:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise
    return path


# ---------------------------------------------------------------------------
# Mutation helpers
# ---------------------------------------------------------------------------


class ScopeMismatchError(RuntimeError):
    """Raised when an existing manifest entry conflicts with the new scope."""

    def __init__(self, name: str, recorded_scope: str, new_scope: str):
        super().__init__(
            f"tool {name!r} is committed as scope={recorded_scope}; "
            f"refusing to change it to scope={new_scope} without --force"
        )
        self.name = name
        self.recorded_scope = recorded_scope
        self.new_scope = new_scope


def upsert_tool(
    existing: list[dict[str, Any]],
    *,
    name: str,
    scope: str,
    bridge_marker: str,
    installed_at: Optional[str] = None,
    force: bool = False,
) -> list[dict[str, Any]]:
    """Return a new tools list with ``name`` added or refreshed.

    Idempotency rules from ADR-008 §Lifecycle:
    * Same name, same scope → no-op (timestamp preserved).
    * Same name, different scope → raise ``ScopeMismatchError`` unless
      ``force=True``, in which case the entry is rewritten.
    * New name → appended in install order (not alphabetised).
    """
    if scope not in _VALID_SCOPES:
        raise ValueError(f"scope must be one of {_VALID_SCOPES}: {scope!r}")
    stamp = installed_at or _today()
    result: list[dict[str, Any]] = []
    found = False
    for entry in existing:
        if entry.get("name") == name:
            found = True
            recorded = str(entry.get("scope", ""))
            if recorded == scope:
                # Idempotent no-op — preserve original installed_at.
                result.append(entry)
                continue
            if not force:
                raise ScopeMismatchError(name, recorded, scope)
            result.append({
                "name": name,
                "scope": scope,
                "bridge_marker": bridge_marker,
                "installed_at": stamp,
            })
            continue
        result.append(entry)
    if not found:
        result.append({
            "name": name,
            "scope": scope,
            "bridge_marker": bridge_marker,
            "installed_at": stamp,
        })
    return result


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")
