"""Project-scope installed-tools manifest at ``agents/installed-tools.lock``.

Phase 3 of road-to-global-first-install (ADR-008). Committed
bill-of-materials for AI tooling a project depends on. Sibling to the
global lockfile (``installed_lock.py``) but architecturally distinct:

- ``installed_lock.py`` lives in ``~/.event4u/agent-config/`` and tracks
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
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

try:
    from scripts._lib.fs_atomic import write_atomic  # noqa: PLC0415
except ImportError:  # pragma: no cover — alt sys.path layout (tests)
    from _lib.fs_atomic import write_atomic  # type: ignore[no-redef]  # noqa: PLC0415

MANIFEST_ENV = "AGENT_CONFIG_INSTALLED_TOOLS"
DEFAULT_MANIFEST_RELATIVE = Path("agents") / "installed-tools.lock"
SCHEMA_VERSION = 2

#: Schema versions older writers may have emitted. Reading any of these
#: succeeds; writing always produces :data:`SCHEMA_VERSION`.
SCHEMA_VERSIONS_SUPPORTED = (1, 2)

_VALID_SCOPES = ("global", "project")

#: Permitted values for ``files[].kind`` (P1.1, road-to-multi-package-
#: coexistence). ``bridge`` = team-pointer marker (e.g. ``.cursorrules``);
#: ``deployed`` = bundle content we wrote (e.g. ``.augment/rules/*.md``);
#: ``marker`` = one-off sentinel (e.g. ``claude-desktop`` install marker).
FILE_KINDS = frozenset({"bridge", "deployed", "marker"})

#: Stable known deploy roots — directories under which the doctor
#: command surveys for foreign files. Writers may extend the live
#: ``deploy_roots`` field per project; this constant is the canonical
#: default the installer seeds.
DEFAULT_DEPLOY_ROOTS = (
    ".augment/rules",
    ".augment/skills",
    ".augment/commands",
    ".cursor/rules",
    ".claude/skills",
    ".claude/commands",
    ".clinerules",
    ".windsurf/rules",
)


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
    ``init``. v1 and v2 wire formats both return the same shape — v2
    optional fields (``deploy_roots``, per-tool ``files`` /
    ``merged_keys``) default to empty lists when absent, so callers can
    iterate without ``.get(..., [])`` boilerplate (P1.2).
    """
    try:
        text = path.read_text(encoding="utf-8")
    except (FileNotFoundError, OSError):
        return None
    data: Optional[dict[str, Any]] = None
    try:
        import yaml  # type: ignore[import-untyped]
        loaded = yaml.safe_load(text) or {}
        if isinstance(loaded, dict):
            data = loaded
    except ImportError:
        pass
    except Exception:
        # Fall through to the manual parser; corrupt YAML is recoverable
        # from our strict schema as long as the top-level shape holds.
        pass
    if data is None:
        data = _parse_manual(text)
    return _normalise_v2_shape(data)


def _normalise_v2_shape(data: dict[str, Any]) -> dict[str, Any]:
    """Backfill v2 optional fields so consumers can iterate uniformly.

    Idempotent: calling on an already-normalised dict is a no-op. Does
    not mutate input lists — replaces missing keys with fresh empties.
    """
    if data.get("tools") is None:
        data["tools"] = []
    if data.get("deploy_roots") is None:
        data["deploy_roots"] = []
    for tool in data["tools"]:
        if not isinstance(tool, dict):
            continue
        if tool.get("files") is None:
            tool["files"] = []
        if tool.get("merged_keys") is None:
            tool["merged_keys"] = []
    return data


def _parse_manual(text: str) -> dict[str, Any]:
    """Strict v1 manual parser; v2 nested fields are skipped, not raised.

    The fallback parser handles the canonical v1 wire format (top-level
    scalars + ``tools`` array with single-level key:value entries). For
    v2 manifests it still extracts the top-level scalars and the
    per-tool scalar fields, but silently drops nested arrays
    (``files``, ``merged_keys``) and top-level ``deploy_roots``. Callers
    that need full v2 fidelity must have ``pyyaml`` available — the
    manual path is a degraded read, not a v2 round-trip.
    """
    data: dict[str, Any] = {"tools": []}
    in_tools = False
    current: Optional[dict[str, Any]] = None
    # When the current tool entry opened a nested array (``files:`` or
    # ``merged_keys:``), we suppress recognition of the deeper ``- key``
    # lines as new tools until the indent climbs back to the per-tool
    # level (4 spaces).
    skip_until_outdent = False
    for raw in text.splitlines():
        stripped = raw.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped == "tools:":
            in_tools = True
            current = None
            skip_until_outdent = False
            continue
        if in_tools:
            indent = len(raw) - len(raw.lstrip(" "))
            if skip_until_outdent and indent > 4:
                continue
            skip_until_outdent = False
            m = _LIST_DASH_RE.match(raw)
            if m and indent == 2:
                first = m.group(1)
                current = {}
                data["tools"].append(current)
                inline = _TOP_KEY_RE.match(first)
                if inline:
                    current[inline.group(1)] = inline.group(2)
                continue
            mk = _INDENT_KEY_RE.match(raw)
            if mk and current is not None and indent == 4:
                key, val = mk.group(1), mk.group(2)
                if key in ("files", "merged_keys") and not val:
                    skip_until_outdent = True
                    continue
                current[key] = val
                continue
        m_top = _TOP_KEY_RE.match(raw)
        if m_top:
            key, value = m_top.group(1), m_top.group(2)
            if key == "deploy_roots" and not value:
                # Top-level v2 array — skip until next top-level scalar.
                in_tools = False
                current = None
                skip_until_outdent = True
                continue
            if key == "schema_version":
                try:
                    data[key] = int(value)
                except ValueError:
                    data[key] = value
            else:
                data[key] = value
            in_tools = False
            current = None
            skip_until_outdent = False
    return data


# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------


def _render(
    version: str,
    tools: list[dict[str, Any]],
    *,
    deploy_roots: Optional[list[str]] = None,
) -> str:
    lines = [
        f"schema_version: {SCHEMA_VERSION}",
        f'agent_config_version: "{version}"',
    ]
    if deploy_roots:
        lines.append("deploy_roots:")
        for root in deploy_roots:
            lines.append(f"  - {root}")
    lines.append("tools:")
    for tool in tools:
        lines.append(f"  - name: {tool['name']}")
        lines.append(f"    scope: {tool['scope']}")
        lines.append(f"    bridge_marker: {tool['bridge_marker']}")
        lines.append(f'    installed_at: "{tool["installed_at"]}"')
        status = tool.get("status")
        if status:
            lines.append(f"    status: {status}")
        files = tool.get("files") or []
        if files:
            # Sort by path ascending — deterministic output for golden-
            # file tests and stable team diffs (P1.3).
            files = sorted(files, key=lambda f: f["path"])
            lines.append("    files:")
            for entry in files:
                lines.append(f"      - path: {entry['path']}")
                lines.append(f"        kind: {entry['kind']}")
                sha = entry.get("sha256")
                if sha is None:
                    lines.append("        sha256: null")
                else:
                    lines.append(f'        sha256: "{sha}"')
        merged = tool.get("merged_keys") or []
        if merged:
            # Sort by (file, json_pointer) ascending — deterministic
            # output regardless of insertion order (P1.3).
            merged = sorted(
                merged, key=lambda e: (e["file"], e["json_pointer"]),
            )
            lines.append("    merged_keys:")
            for entry in merged:
                lines.append(f"      - file: {entry['file']}")
                lines.append(f"        json_pointer: \"{entry['json_pointer']}\"")
                vh = entry.get("value_hash")
                if vh is not None:
                    lines.append(f'        value_hash: "{vh}"')
    return "\n".join(lines) + "\n"


def write_manifest(
    path: Path,
    version: str,
    tools: list[dict[str, Any]],
    *,
    deploy_roots: Optional[list[str]] = None,
) -> Path:
    """Atomically write the manifest; return the path written.

    Delegates to :func:`scripts._lib.fs_atomic.write_atomic` so the
    crash-safety guarantees (fsync file, atomic rename, fsync parent
    dir) are shared with every other v2 writer. See P1.0 of
    ``road-to-multi-package-coexistence`` for the rationale.

    ``deploy_roots`` is the optional top-level v2 field listing
    directories the doctor command surveys for foreign files. When
    omitted, the field is not emitted (callers may rely on
    :data:`DEFAULT_DEPLOY_ROOTS` for the survey scope).
    """
    rendered = _render(version, tools, deploy_roots=deploy_roots)
    return write_atomic(path, rendered)


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
    files: Optional[list[dict[str, Any]]] = None,
    merged_keys: Optional[list[dict[str, Any]]] = None,
) -> list[dict[str, Any]]:
    """Return a new tools list with ``name`` added or refreshed.

    Idempotency rules from ADR-008 §Lifecycle:
    * Same name, same scope → no-op (timestamp preserved).
    * Same name, different scope → raise ``ScopeMismatchError`` unless
      ``force=True``, in which case the entry is rewritten.
    * New name → appended in install order (not alphabetised).

    ``files`` / ``merged_keys`` are the v2 per-tool inventories
    (P1.4). When provided, they replace whatever was previously
    recorded on the entry — the installer is authoritative for the
    set of artefacts it just wrote. When ``None``, existing values
    are preserved on the idempotent path and absent on first-write.
    """
    if scope not in _VALID_SCOPES:
        raise ValueError(f"scope must be one of {_VALID_SCOPES}: {scope!r}")
    stamp = installed_at or _today()

    def _build(prior: Optional[dict[str, Any]] = None) -> dict[str, Any]:
        entry: dict[str, Any] = {
            "name": name,
            "scope": scope,
            "bridge_marker": bridge_marker,
            "installed_at": stamp,
        }
        if files is not None:
            entry["files"] = list(files)
        elif prior is not None and prior.get("files"):
            entry["files"] = list(prior["files"])
        if merged_keys is not None:
            entry["merged_keys"] = list(merged_keys)
        elif prior is not None and prior.get("merged_keys"):
            entry["merged_keys"] = list(prior["merged_keys"])
        return entry

    result: list[dict[str, Any]] = []
    found = False
    for entry in existing:
        if entry.get("name") == name:
            found = True
            recorded = str(entry.get("scope", ""))
            if recorded == scope:
                if files is None and merged_keys is None:
                    # Idempotent no-op — preserve original entry.
                    result.append(entry)
                else:
                    # Refresh inventories, preserve installed_at.
                    refreshed = _build(prior=entry)
                    refreshed["installed_at"] = entry.get(
                        "installed_at", stamp,
                    )
                    result.append(refreshed)
                continue
            if not force:
                raise ScopeMismatchError(name, recorded, scope)
            result.append(_build(prior=entry))
            continue
        result.append(entry)
    if not found:
        result.append(_build())
    return result


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")
