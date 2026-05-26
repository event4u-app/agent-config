"""Claude Desktop skill ZIP bundler (Phase 4 of event4u-namespace roadmap).

Claude Desktop has no filesystem convention for skills; the Customize →
Skills UI accepts a ZIP per skill via the Upload button. This module
walks ``<package_root>/.agent-src/skills/*`` and produces one
``<skill-name>.zip`` per directory into ``dest_dir``. It additionally
walks ``<package_root>/.agent-src/commands/`` and produces one
``<command-slug>.zip`` per command ``.md`` file so Claude Desktop sees
the same surface that Claude Code exposes via the ``.claude/skills/``
symlink wrapper layer.

Contract:

- Each ZIP contains ``SKILL.md`` plus every sibling file under the same
  directory (recursive). Symlinks are dereferenced so the ZIP is
  self-contained.
- Command bundles wrap a single ``.agent-src/commands/<path>.md`` file
  as ``SKILL.md`` inside the ZIP. Nested commands flatten to
  ``<cluster>-<leaf>`` slugs (e.g. ``council/default.md`` →
  ``council-default.zip``) to mirror ``condense.py``.
- Exclusions: ``.git*``, ``__pycache__``, ``*.pyc`` — matched on the
  basename of any path component.
- A skill folder without a ``SKILL.md`` is skipped (defensive: avoids
  shipping Claude-Code orchestrator stubs that don't follow the
  Anthropic skill schema).
- Command files named ``AGENTS.md`` are skipped (cluster authoring docs,
  not invocable commands).
- A command slug that collides with an existing skill name is skipped —
  the real skill bundle wins, matching ``condense.generate_claude_commands``.
- Writes are atomic via tempfile → ``os.replace``.
- Idempotent: each ZIP gets a sibling ``<slug>.sha256`` recording
  the manifest digest. If the recomputed digest matches the recorded
  one, the existing ZIP is left untouched (unless ``force=True``).
"""
from __future__ import annotations

import hashlib
import os
import tempfile
import zipfile
from pathlib import Path
from typing import Iterable, Optional

#: Filenames or path components that are never included in a bundle.
_EXCLUDED_BASENAMES = frozenset({"__pycache__", ".DS_Store"})
_EXCLUDED_PREFIXES = (".git",)
_EXCLUDED_SUFFIXES = (".pyc", ".pyo")


def _is_excluded(rel_parts: tuple[str, ...]) -> bool:
    """Return True if any component matches the exclusion lists."""
    for part in rel_parts:
        if part in _EXCLUDED_BASENAMES:
            return True
        if part.startswith(_EXCLUDED_PREFIXES):
            return True
        if part.endswith(_EXCLUDED_SUFFIXES):
            return True
    return False


def _walk_skill_files(skill_dir: Path) -> list[tuple[Path, tuple[str, ...]]]:
    """Return ``[(abs_path, rel_parts), ...]`` for every file in the skill.

    Symlinks are followed (``os.walk(..., followlinks=True)``) so a
    bundle from a symlinked entry under ``.agent-src/skills/`` contains
    the actual target content, not a dangling symlink.
    """
    out: list[tuple[Path, tuple[str, ...]]] = []
    resolved = skill_dir.resolve()
    for root, dirs, files in os.walk(resolved, followlinks=True):
        root_path = Path(root)
        rel_root = root_path.relative_to(resolved)
        # Prune excluded dirs in-place so os.walk skips them.
        dirs[:] = [d for d in dirs if not _is_excluded((d,))]
        for fname in files:
            rel_parts = (*rel_root.parts, fname) if rel_root.parts else (fname,)
            if _is_excluded(rel_parts):
                continue
            out.append((root_path / fname, rel_parts))
    out.sort(key=lambda item: item[1])
    return out


def _manifest_digest(files: Iterable[tuple[Path, tuple[str, ...]]]) -> str:
    """Hash sorted (rel_path, content_sha256) pairs into one digest.

    Stable across runs as long as the input set + bytes are stable. Used
    as the idempotency token written to ``<skill>.sha256``.
    """
    h = hashlib.sha256()
    for abs_path, rel_parts in files:
        rel = "/".join(rel_parts)
        h.update(rel.encode("utf-8"))
        h.update(b"\x00")
        h.update(hashlib.sha256(abs_path.read_bytes()).digest())
        h.update(b"\x00")
    return h.hexdigest()


def _atomic_write_zip(
    zip_path: Path, files: list[tuple[Path, tuple[str, ...]]]
) -> None:
    """Write ``files`` into ``zip_path`` atomically (temp + rename)."""
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(
        prefix=f".{zip_path.stem}.", suffix=".zip.tmp", dir=str(zip_path.parent),
    )
    os.close(fd)
    tmp_path = Path(tmp_name)
    try:
        with zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for abs_path, rel_parts in files:
                zf.write(abs_path, arcname="/".join(rel_parts))
        os.replace(tmp_path, zip_path)
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


def build_skill_bundles(
    package_root: Path,
    dest_dir: Path,
    force: bool = False,
    curation: Optional[list[str]] = None,
) -> list[Path]:
    """Build per-skill ZIPs under ``dest_dir``.

    Returns the list of ZIP paths that were (re-)written this call. ZIPs
    skipped because their content digest matched the existing sidecar
    are not in the returned list (but remain on disk).

    ``curation`` optionally restricts the build to the given skill
    names; ``None`` bundles every skill folder containing ``SKILL.md``.
    """
    skills_root = package_root / ".agent-src" / "skills"
    if not skills_root.is_dir():
        return []
    dest_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for entry in sorted(skills_root.iterdir()):
        if not (entry.is_dir() or entry.is_symlink()):
            continue
        skill_name = entry.name
        if curation is not None and skill_name not in curation:
            continue
        skill_md = entry / "SKILL.md"
        if not skill_md.exists():
            continue
        files = _walk_skill_files(entry)
        if not files:
            continue
        digest = _manifest_digest(files)
        zip_path = dest_dir / f"{skill_name}.zip"
        digest_path = dest_dir / f"{skill_name}.sha256"
        recorded = digest_path.read_text(encoding="utf-8").strip() if digest_path.exists() else ""
        if not force and recorded == digest and zip_path.exists():
            continue
        _atomic_write_zip(zip_path, files)
        digest_path.write_text(digest + "\n", encoding="utf-8")
        written.append(zip_path)
    return written


def _command_slug(source_file: Path, commands_root: Path) -> str:
    """Return the flat slug for a command source file.

    Mirrors ``scripts/condense.py::_command_slug``: top-level commands
    keep their stem (``commit.md`` → ``commit``); nested commands flatten
    the relative path with ``-`` (``council/default.md`` →
    ``council-default``).
    """
    rel = source_file.relative_to(commands_root)
    return "-".join(rel.with_suffix("").parts)


def _iter_command_files(commands_root: Path) -> Iterable[Path]:
    """Yield every command ``.md`` file under ``commands_root`` (recursive).

    Skips ``AGENTS.md`` cluster authoring docs, matching
    ``scripts/condense.py::_iter_commands``.
    """
    for source_file in sorted(commands_root.rglob("*.md")):
        if source_file.name == "AGENTS.md":
            continue
        yield source_file


def build_command_bundles(
    package_root: Path,
    dest_dir: Path,
    force: bool = False,
    curation: Optional[list[str]] = None,
) -> list[Path]:
    """Build per-command ZIPs under ``dest_dir``.

    Each ZIP contains a single ``SKILL.md`` whose bytes are the source
    command ``.md`` file — same wrapping pattern that
    ``condense.generate_claude_commands`` uses for Claude Code via
    ``.claude/skills/<slug>/SKILL.md`` symlinks.

    Slugs that collide with an existing skill folder under
    ``<package_root>/.agent-src/skills/`` are skipped so the real skill
    bundle wins.

    Returns the list of ZIP paths that were (re-)written this call. ZIPs
    skipped because their content digest matched the existing sidecar
    are not in the returned list (but remain on disk).

    ``curation`` optionally restricts the build to the given command
    slugs; ``None`` bundles every command file.
    """
    commands_root = package_root / ".agent-src" / "commands"
    if not commands_root.is_dir():
        return []
    skills_root = package_root / ".agent-src" / "skills"
    skill_names: set[str] = set()
    if skills_root.is_dir():
        skill_names = {entry.name for entry in skills_root.iterdir() if entry.is_dir()}
    dest_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for source_file in _iter_command_files(commands_root):
        slug = _command_slug(source_file, commands_root)
        if slug in skill_names:
            continue
        if curation is not None and slug not in curation:
            continue
        files = [(source_file.resolve(), ("SKILL.md",))]
        digest = _manifest_digest(files)
        zip_path = dest_dir / f"{slug}.zip"
        digest_path = dest_dir / f"{slug}.sha256"
        recorded = digest_path.read_text(encoding="utf-8").strip() if digest_path.exists() else ""
        if not force and recorded == digest and zip_path.exists():
            continue
        _atomic_write_zip(zip_path, files)
        digest_path.write_text(digest + "\n", encoding="utf-8")
        written.append(zip_path)
    return written
