"""Detect IDE-attached sibling projects (linked-projects scope, Option A).

Pure, dependency-free detector. Reads on-disk IDE config the developer already
created by attaching a sibling repo, and returns the sibling project roots that
sit *outside* the current project. Config-driven only — never guesses from
arbitrary adjacent directories.

Sources:
  * PhpStorm / IntelliJ  — ``.idea/modules.xml`` (``<module fileurl>``) and
    ``.idea/vcs.xml`` (``<mapping directory>``).
  * VS Code              — ``*.code-workspace`` (``folders[].path``).

Guardrails (per the linked-projects council, Option A):
  * a candidate must resolve OUTSIDE the project root, exist, and contain a
    ``.git/`` directory;
  * a candidate whose file count exceeds ``max_files`` (default 20000) is
    **flagged** ``large: true`` — NOT excluded. Under Option A the agent only
    carries a passive awareness note and never bulk-includes sibling files, so
    repo size is cost-irrelevant to detection; a real frontend repo routinely
    exceeds 20000 files (excluding node_modules) and must still be surfaced.
    The flag lets the awareness note say "large repo — check targeted impact,
    do not scan the whole tree";
  * the bloat directories ``node_modules``/``.git``/``dist``/``build``/
    ``.venv``/``target`` are never descended into while counting.

The detector returns awareness candidates; it does NOT include any sibling
files in context and does NOT persist anything. Opt-in + persistence is the
caller's job.
"""

from __future__ import annotations

import json
import logging
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

#: File-count ceiling above which a sibling is skipped (token-blowup guard).
DEFAULT_MAX_FILES = 20000

#: Directories never descended into while counting a sibling's size.
SKIP_DIRS: frozenset[str] = frozenset(
    {"node_modules", ".git", "dist", "build", ".venv", "target", ".idea"}
)


def detect_linked_projects(
    project_root: Path | str,
    *,
    max_files: int = DEFAULT_MAX_FILES,
) -> list[dict[str, Any]]:
    """Return IDE-attached sibling projects outside ``project_root``.

    Each entry is ``{"path": <absolute str>, "detected_via": <source>,
    "large": <bool>}`` where source is one of ``phpstorm_modules`` /
    ``phpstorm_vcs`` / ``vscode_workspace`` and ``large`` is true when the
    sibling's file count (excluding bloat dirs) exceeds ``max_files``. Results
    are de-duplicated by resolved path (first source wins) and sorted by path.
    Size never excludes — see the module docstring.
    """
    root = Path(project_root).resolve()
    if not root.is_dir():
        logger.info("linked_projects: project_root %s is not a directory", root)
        return []

    candidates: list[tuple[Path, str]] = []
    candidates.extend((p, "phpstorm_modules") for p in _phpstorm_modules(root))
    candidates.extend((p, "phpstorm_vcs") for p in _phpstorm_vcs(root))
    candidates.extend((p, "vscode_workspace") for p in _vscode_workspace(root))

    seen: set[Path] = set()
    out: list[dict[str, Any]] = []
    for path, source in candidates:
        try:
            resolved = path.resolve()
        except OSError:
            logger.info("linked_projects: cannot resolve %s", path)
            continue
        if resolved in seen:
            continue
        if not _is_valid_sibling(resolved, root):
            continue
        large = _exceeds_size(resolved, max_files)
        if large:
            logger.info(
                "linked_projects: %s exceeds %d files — flagged large (awareness only)",
                resolved,
                max_files,
            )
        seen.add(resolved)
        out.append(
            {"path": str(resolved), "detected_via": source, "large": large}
        )

    out.sort(key=lambda e: e["path"])
    return out


def _is_valid_sibling(candidate: Path, root: Path) -> bool:
    """A sibling must be outside the project root, exist, and be a git repo."""
    try:
        if candidate == root or root in candidate.parents:
            return False  # inside the project — that's the module system's job
        if candidate in root.parents:
            return False  # an ancestor of the project, not a sibling
        if not candidate.is_dir():
            logger.info("linked_projects: candidate missing/not-a-dir %s", candidate)
            return False
        if not (candidate / ".git").exists():
            logger.info("linked_projects: candidate not a git repo %s", candidate)
            return False
    except OSError:
        logger.info("linked_projects: unreadable candidate %s", candidate)
        return False
    return True


def _exceeds_size(candidate: Path, max_files: int) -> bool:
    """True if the tree (minus SKIP_DIRS) holds more than ``max_files`` files."""
    import os

    count = 0
    for dirpath, dirnames, filenames in os.walk(candidate):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        count += len(filenames)
        if count > max_files:
            return True
    return False


def _phpstorm_modules(root: Path) -> list[Path]:
    """Sibling roots from ``.idea/modules.xml`` ``<module fileurl>`` entries."""
    path = root / ".idea" / "modules.xml"
    elems = _iter_xml_attrs(path, "module", ("fileurl", "filepath"))
    out: list[Path] = []
    for attrs in elems:
        raw = attrs.get("fileurl") or attrs.get("filepath")
        if not raw:
            continue
        resolved = _resolve_idea_url(raw, root)
        if resolved is None:
            continue
        # raw points at <sibling>/.idea/<name>.iml → sibling is .idea's parent.
        if resolved.parent.name == ".idea":
            out.append(resolved.parent.parent)
        else:
            out.append(resolved)
    return out


def _phpstorm_vcs(root: Path) -> list[Path]:
    """Sibling roots from ``.idea/vcs.xml`` ``<mapping directory>`` entries."""
    path = root / ".idea" / "vcs.xml"
    out: list[Path] = []
    for attrs in _iter_xml_attrs(path, "mapping", ("directory",)):
        raw = attrs.get("directory")
        if not raw:
            continue
        resolved = _resolve_idea_url(raw, root)
        if resolved is not None:
            out.append(resolved)
    return out


def _vscode_workspace(root: Path) -> list[Path]:
    """Sibling roots from ``*.code-workspace`` ``folders[].path`` entries."""
    out: list[Path] = []
    try:
        workspaces = sorted(root.glob("*.code-workspace"))
    except OSError:
        return out
    for ws in workspaces:
        data = _read_jsonc(ws)
        if not isinstance(data, dict):
            continue
        folders = data.get("folders")
        if not isinstance(folders, list):
            continue
        for folder in folders:
            if not isinstance(folder, dict):
                continue
            rel = folder.get("path")
            if not isinstance(rel, str) or not rel.strip():
                continue
            out.append((root / rel).resolve())
    return out


def _resolve_idea_url(raw: str, root: Path) -> Path | None:
    """Resolve a PhpStorm path token to an absolute Path, or None."""
    value = raw.strip()
    if value.startswith("file://"):
        value = value[len("file://") :]
    value = value.replace("$PROJECT_DIR$", str(root))
    if not value:
        return None
    try:
        return (Path(value) if Path(value).is_absolute() else root / value).resolve()
    except OSError:
        return None


def _iter_xml_attrs(
    path: Path, tag: str, _attrs: tuple[str, ...]
) -> list[dict[str, str]]:
    """Return the attribute dicts of every ``<tag>`` in ``path`` (tolerant)."""
    if not path.is_file():
        return []
    try:
        tree = ET.parse(path)
    except (ET.ParseError, OSError) as exc:
        logger.info("linked_projects: malformed/unreadable %s (%s)", path, exc)
        return []
    return [dict(el.attrib) for el in tree.iter(tag)]


def _read_jsonc(path: Path) -> Any:
    """Parse JSON that may carry ``//`` comments and trailing commas (VS Code)."""
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # tolerant fallback: strip line comments + trailing commas, retry once.
    stripped = re.sub(r"^\s*//.*$", "", text, flags=re.MULTILINE)
    stripped = re.sub(r",(\s*[}\]])", r"\1", stripped)
    try:
        return json.loads(stripped)
    except json.JSONDecodeError as exc:
        logger.info("linked_projects: malformed workspace JSON %s (%s)", path, exc)
        return None
