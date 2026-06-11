"""Per-tool inventory of files written by global deploys — and stale reaping.

Sidecar at ``~/.event4u/agent-config/deployed-files.json``. Records, per
tool, the anchor directory and the relative paths of every file the most
recent global deploy maintains there. On the next deploy the previous
inventory is diffed against the current expected file set and **only**
previously-recorded, now-orphaned files are deleted.

Why this exists (2026-06 Zed fix follow-up): deploy anchors are SHARED
directories — ``~/.agents/skills/`` holds the user's own Zed skills next to
agent-config's deployed bundle, ``~/.claude/commands/`` holds user-authored
commands. A naive "delete everything not in the source" sync would destroy
user files, so the installer historically deleted nothing — and renamed or
removed package skills (e.g. the pre-fix colon-named command-as-skill
entries from 2026-05-13) rotted in place until Zed rejected them with
"Skill name must contain only lowercase letters, numbers, and hyphens".
The inventory provides the ownership proof that makes reaping safe: a path
is deleted only if a previous agent-config deploy recorded writing it AND
the current deploy no longer ships it.

Safety properties:

- Never deletes a path that was not recorded by a previous deploy.
- Never deletes outside the recorded anchor (resolved containment check).
- Never deletes directories — only files/symlinks, then prunes empty dirs.
- Anchor moved between installs → no reaping (the old tree is unknown
  territory; the new inventory simply replaces the record).
- Missing / corrupt inventory → no reaping (first run records only).

Schema (JSON)::

    {
      "schema_version": 1,
      "tools": {
        "<tool_id>": {
          "anchor": "/abs/path/to/anchor",
          "files": ["skills/foo/SKILL.md", ...]   # anchor-relative, sorted
        }
      }
    }
"""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Optional

try:  # package-style import (pytest, installed package)
    from scripts._lib import user_global_paths
except ImportError:  # pragma: no cover — script-style sys.path fallback
    from _lib import user_global_paths  # type: ignore[no-redef]

SCHEMA_VERSION = 1
INVENTORY_BASENAME = "deployed-files.json"
INVENTORY_ENV = "AGENT_CONFIG_DEPLOY_INVENTORY"


def inventory_path(env: Optional[dict] = None) -> Path:
    """Canonical inventory location, honoring the test/env override."""
    env_map = env if env is not None else os.environ
    override = env_map.get(INVENTORY_ENV)
    if override:
        return Path(override).expanduser()
    return user_global_paths.write_target(INVENTORY_BASENAME, env=env)


def load_inventory(path: Optional[Path] = None) -> dict:
    """Read the inventory; missing or malformed files yield an empty shell."""
    target = path or inventory_path()
    try:
        data = json.loads(target.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"schema_version": SCHEMA_VERSION, "tools": {}}
    if not isinstance(data, dict) or not isinstance(data.get("tools"), dict):
        return {"schema_version": SCHEMA_VERSION, "tools": {}}
    return data


def save_inventory(data: dict, path: Optional[Path] = None) -> Path:
    """Atomically write the inventory (tempfile + os.replace)."""
    target = path or inventory_path()
    target.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(data, indent=2, sort_keys=True) + "\n"
    fd, tmp_name = tempfile.mkstemp(
        prefix=target.name + ".", dir=str(target.parent)
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(payload)
        os.replace(tmp_name, target)
    except OSError:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise
    return target


def expected_deploy_files(src: Path, dest_rel: Path) -> set[str]:
    """Anchor-relative paths the deploy of ``src`` → ``<anchor>/<dest_rel>``
    maintains — written OR skipped-as-identical.

    Mirrors the traversal of ``install._copy_dir_dereferencing_symlinks``:
    symlinked files resolve to file entries, symlinked subdirectories are
    walked through their resolved targets. ``dest_rel`` may be empty
    (``Path('')``) for plan entries that deploy into the anchor root.
    """
    out: set[str] = set()
    if not src.exists():
        return out
    if not src.is_dir():
        out.add(dest_rel.as_posix())
        return out

    def _walk(node: Path, prefix: Path) -> None:
        for entry in sorted(node.iterdir()):
            rel = prefix / entry.name
            if entry.is_dir() and not entry.is_symlink():
                _walk(entry, rel)
                continue
            resolved = entry.resolve()
            if resolved.is_dir():
                _walk(resolved, rel)
                continue
            out.add(rel.as_posix())

    _walk(src, dest_rel)
    return out


def reap_stale(
    tool_id: str,
    anchor: Path,
    current_files: set[str],
    inventory: dict,
) -> list[Path]:
    """Delete previously-deployed files that the current deploy dropped.

    Returns the absolute paths actually deleted. Mutates nothing in
    ``inventory`` — callers record the new state via :func:`record_deploy`.
    """
    entry = inventory.get("tools", {}).get(tool_id)
    if not isinstance(entry, dict):
        return []
    recorded_anchor = entry.get("anchor")
    prev_files = entry.get("files")
    if not isinstance(recorded_anchor, str) or not isinstance(prev_files, list):
        return []
    anchor_resolved = anchor.expanduser().resolve()
    if Path(recorded_anchor).expanduser().resolve() != anchor_resolved:
        # Anchor moved between installs — the old tree is not provably
        # ours anymore; record-only, never delete.
        return []

    deleted: list[Path] = []
    prune_candidates: set[Path] = set()
    for rel in sorted(set(prev_files) - current_files):
        if not isinstance(rel, str) or not rel or rel.startswith(("/", "..")):
            continue
        target = anchor_resolved / rel
        try:
            # Containment proof: the path (sans final component, which may
            # be a dangling symlink) must stay inside the anchor.
            target.parent.resolve().relative_to(anchor_resolved)
        except ValueError:
            continue
        if target.is_dir() and not target.is_symlink():
            continue  # never delete directories
        try:
            target.unlink()
        except FileNotFoundError:
            continue
        except OSError:
            continue
        deleted.append(target)
        prune_candidates.add(target.parent)

    # Prune now-empty directories left behind, up to (exclusive) the anchor.
    for start in sorted(prune_candidates, key=lambda p: len(p.parts),
                        reverse=True):
        node = start
        while node != anchor_resolved and anchor_resolved in node.parents:
            try:
                node.rmdir()  # only succeeds when empty
            except OSError:
                break
            node = node.parent
    return deleted


def bootstrap_reap_tagged(
    anchor: Path,
    dest_subs: list[str],
    current_files: set[str],
    package_tag: str,
) -> list[Path]:
    """First-run reaping for PRE-inventory installs (marker-based ownership).

    Existing installs in the wild predate the inventory sidecar, so
    :func:`reap_stale` has nothing to diff against on the first upgraded
    deploy — the legacy mess (renamed skills, retired command-as-skill
    entries, the 2026-05-13 colon-named shapes) would rot forever. Every
    deployed ``.md`` however carries the injected ``package:`` frontmatter
    tag (install P5.1), which is exactly the ownership proof reaping needs.

    Deletes ``.md`` files under ``<anchor>/<dest_sub>`` that (a) carry
    ``package: <package_tag>`` in their frontmatter and (b) are not in the
    current expected file set; then prunes empty directories. Untagged
    files (user-authored skills in shared anchors) are never touched.
    Returns the absolute paths deleted.
    """
    anchor_resolved = anchor.expanduser().resolve()
    deleted: list[Path] = []
    prune_candidates: set[Path] = set()
    needle = f"package: {package_tag}"
    for dest_sub in dest_subs:
        root = anchor_resolved / dest_sub if dest_sub else anchor_resolved
        if not root.is_dir():
            continue
        for md in root.rglob("*.md"):
            if md.is_dir():
                continue
            rel = md.relative_to(anchor_resolved).as_posix()
            if rel in current_files:
                continue
            try:
                md.parent.resolve().relative_to(anchor_resolved)
            except ValueError:
                continue
            try:
                head = md.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            if not head.startswith("---"):
                continue
            end = head.find("\n---", 3)
            block = head[: end if end != -1 else len(head)]
            if not any(
                line.strip() == needle for line in block.splitlines()
            ):
                continue
            try:
                md.unlink()
            except OSError:
                continue
            deleted.append(md)
            prune_candidates.add(md.parent)
    for start in sorted(prune_candidates, key=lambda p: len(p.parts),
                        reverse=True):
        node = start
        while node != anchor_resolved and anchor_resolved in node.parents:
            try:
                node.rmdir()  # only succeeds when empty
            except OSError:
                break
            node = node.parent
    return deleted


def record_deploy(
    tool_id: str,
    anchor: "Path | str",
    current_files: set[str],
    inventory: dict,
) -> dict:
    """Upsert the tool's inventory entry; returns the mutated inventory.

    ``anchor`` is stored AS GIVEN — pass the unexpanded form (``~/.agents/``)
    so the inventory content stays identical across machines/homes (GUI/CLI
    parity) and survives a home relocation. :func:`reap_stale` expands the
    recorded value at comparison time.
    """
    tools = inventory.setdefault("tools", {})
    tools[tool_id] = {
        "anchor": str(anchor),
        "files": sorted(current_files),
    }
    inventory["schema_version"] = SCHEMA_VERSION
    return inventory
