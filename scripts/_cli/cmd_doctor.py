"""``agent-config doctor`` — manifest ↔ filesystem drift report.

Phase 4 of road-to-multi-package-coexistence. Read-only sibling to
``prune``/``validate``: walks the project manifest and the on-disk
deploy roots, then produces four categories:

* ``missing``   — manifest entry has a ``path`` that is **not** on disk.
* ``modified``  — manifest entry records a ``sha256`` that does not
  match the current bytes on disk.
* ``foreign``   — file present under one of the ``deploy_roots`` that
  no manifest entry claims (potential neighbour-tool drift).
* ``tag-drift`` — manifest-claimed ``.md`` file carries a frontmatter
  ``package:`` value that disagrees with this package's identifier
  (P5.2). Hand-edited tags or accidental cross-package writes show up
  here; files without frontmatter are skipped (P5.1 contract).

Exit codes: ``0`` (clean) · ``1`` (drift) · ``2`` (error such as
"manifest missing"). Both human and ``--json`` output emit the four
category lists. Every entry carries a one-line ``fix`` hint (P4.3).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

from scripts._lib import installed_tools


class _Sentinel:
    """Tiny stand-in for a private sentinel value type."""

    __slots__ = ()


#: Returned by :func:`_read_inline_package_tag` when the file is out
#: of scope for tag-drift detection (no ``.md`` suffix, unreadable, or
#: no leading frontmatter block).
NO_FRONTMATTER = _Sentinel()


def _resolve_project_root(arg: str | None) -> Path:
    if arg:
        return Path(arg).expanduser().resolve()
    return Path.cwd().resolve()


def _resolve_path(project_root: Path, raw: str) -> Path:
    p = Path(raw).expanduser()
    if not p.is_absolute():
        p = project_root / p
    return p


def _sha256(path: Path) -> str | None:
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()
    except OSError:
        return None


#: Inline-tag identifier this package writes into deployed Markdown
#: frontmatter (P5.1). Kept in sync with ``install.PACKAGE_TAG_ID``;
#: duplicated here to keep ``cmd_doctor`` import-light (no pull on the
#: installer module from the CLI).
PACKAGE_TAG_ID = "event4u/agent-config"

_FRONTMATTER_PACKAGE_RE = re.compile(
    r"^package:\s*(.+?)\s*$", re.MULTILINE,
)


def _read_inline_package_tag(path: Path) -> str | None | _Sentinel:
    """Extract the inline ``package:`` value from a Markdown frontmatter.

    Returns ``NO_FRONTMATTER`` when ``path`` is not a Markdown file or
    has no leading ``---`` block (P5.1: those files are out of scope).
    Returns ``None`` when frontmatter is present but lacks a
    ``package:`` key. Returns the string value otherwise.
    """
    if path.suffix != ".md":
        return NO_FRONTMATTER
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return NO_FRONTMATTER
    if not (text.startswith("---\n") or text.startswith("---\r\n")):
        return NO_FRONTMATTER
    lines = text.splitlines()
    close_idx: int | None = None
    for i in range(1, len(lines)):
        if lines[i].rstrip() == "---":
            close_idx = i
            break
    if close_idx is None:
        return NO_FRONTMATTER
    block = "\n".join(lines[1:close_idx])
    m = _FRONTMATTER_PACKAGE_RE.search(block)
    if not m:
        return None
    return m.group(1).strip().strip("'\"")


def _fix_hint(category: str, kind: str | None) -> str:
    """Return a one-line remediation hint for the surfaced item."""
    if category == "missing":
        return "run `./agent-config sync` to re-install"
    if category == "modified":
        return "commit the local change, or re-install with --force"
    if category == "foreign":
        return (
            "identify owning tool, or run `./agent-config prune` "
            "if confirmed orphan"
        )
    if category == "tag-drift":
        return (
            "re-install with --force to restore the inline tag, "
            "or remove the file if it is no longer ours"
        )
    return ""


def _collect_manifest_entries(
    project_root: Path, manifest: dict[str, Any],
) -> tuple[
    list[tuple[str, Path, str, str | None]],   # (tool, abs_path, kind, sha)
    set[Path],                                  # resolved-known set
]:
    """Flatten v2 ``tools[].files[]`` into per-file records.

    Returns the records list and a set of resolved absolute paths so
    the foreign-file scan can skip anything the manifest claims.
    """
    records: list[tuple[str, Path, str, str | None]] = []
    known: set[Path] = set()
    for tool in manifest.get("tools") or []:
        if tool.get("scope") != "project":
            continue
        tool_id = str(tool.get("name", ""))
        for entry in tool.get("files") or []:
            raw = entry.get("path") or ""
            if not raw:
                continue
            kind = entry.get("kind") or ""
            target = _resolve_path(project_root, raw)
            try:
                resolved = target.resolve()
            except OSError:
                resolved = target
            records.append((tool_id, target, kind, entry.get("sha256")))
            known.add(resolved)
    return records, known


def _scan_foreign(
    project_root: Path,
    manifest: dict[str, Any],
    known: set[Path],
) -> list[Path]:
    """Walk every declared deploy root and surface unclaimed files.

    Only ``regular files`` under ``deploy_roots`` count; directories and
    symlinks are followed but the bookkeeping is on the resolved final
    path so a manifest claim via either path silences both surfaces.
    Falls back to :data:`installed_tools.DEFAULT_DEPLOY_ROOTS` when the
    manifest lacks an explicit ``deploy_roots`` list.
    """
    roots = manifest.get("deploy_roots") or list(
        installed_tools.DEFAULT_DEPLOY_ROOTS,
    )
    foreign: list[Path] = []
    seen: set[Path] = set()
    for root_rel in roots:
        root = _resolve_path(project_root, str(root_rel))
        if not root.exists() or not root.is_dir():
            continue
        for child in root.rglob("*"):
            if not child.is_file():
                continue
            try:
                resolved = child.resolve()
            except OSError:
                resolved = child
            if resolved in known or resolved in seen:
                continue
            seen.add(resolved)
            foreign.append(child)
    foreign.sort()
    return foreign


def _classify(
    records: list[tuple[str, Path, str, str | None]],
) -> tuple[
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
]:
    """Split manifest records into missing / modified / tag-drift lists.

    Tag-drift inspection (P5.2) is restricted to manifest entries that
    point at a present ``.md`` file with a frontmatter block. A file
    that has frontmatter but whose ``package:`` value disagrees with
    :data:`PACKAGE_TAG_ID` — or that has dropped the key entirely —
    surfaces here. Files without frontmatter are silently ignored per
    the P5.1 contract (we never synthesise frontmatter).
    """
    missing: list[dict[str, Any]] = []
    modified: list[dict[str, Any]] = []
    tag_drift: list[dict[str, Any]] = []
    for tool_id, target, kind, expected in records:
        if not target.exists():
            missing.append({
                "tool": tool_id, "path": str(target), "kind": kind,
                "fix": _fix_hint("missing", kind),
            })
            continue
        tag = _read_inline_package_tag(target)
        if not isinstance(tag, _Sentinel) and tag != PACKAGE_TAG_ID:
            tag_drift.append({
                "tool": tool_id, "path": str(target), "kind": kind,
                "expected": PACKAGE_TAG_ID,
                "found": "" if tag is None else tag,
                "fix": _fix_hint("tag-drift", kind),
            })
        if expected is None:
            continue
        actual = _sha256(target)
        if actual is None or actual == expected:
            continue
        modified.append({
            "tool": tool_id, "path": str(target), "kind": kind,
            "fix": _fix_hint("modified", kind),
        })
    return missing, modified, tag_drift


def _foreign_records(
    project_root: Path, foreign: list[Path],
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for p in foreign:
        try:
            rel = p.relative_to(project_root)
            path_str = str(rel)
        except ValueError:
            path_str = str(p)
        out.append({
            "tool": "",
            "path": path_str,
            "kind": "deployed",
            "fix": _fix_hint("foreign", "deployed"),
        })
    return out


def _emit_json(
    project_root: Path,
    missing: list[dict[str, Any]],
    modified: list[dict[str, Any]],
    foreign: list[dict[str, Any]],
    tag_drift: list[dict[str, Any]],
) -> None:
    print(json.dumps({
        "project_root": str(project_root),
        "missing": missing,
        "modified": modified,
        "foreign": foreign,
        "tag_drift": tag_drift,
    }, indent=2))


def _emit_text(
    project_root: Path,
    missing: list[dict[str, Any]],
    modified: list[dict[str, Any]],
    foreign: list[dict[str, Any]],
    tag_drift: list[dict[str, Any]],
) -> None:
    total = len(missing) + len(modified) + len(foreign) + len(tag_drift)
    if total == 0:
        print(f"✅  doctor: manifest matches filesystem under {project_root}")
        return
    print(f"⚠️   doctor: {total} drift item(s) under {project_root}")
    for label, items in (
        ("missing", missing),
        ("modified", modified),
        ("foreign", foreign),
        ("tag-drift", tag_drift),
    ):
        if not items:
            continue
        print(f"\n  {label} ({len(items)}):")
        for it in items:
            tool = it["tool"] or "?"
            print(f"    · [{tool}] {it['path']}")
            if label == "tag-drift":
                found = it.get("found") or "(missing)"
                expected = it.get("expected", PACKAGE_TAG_ID)
                print(f"        expected: {expected}")
                print(f"        found:    {found}")
            print(f"        fix: {it['fix']}")


def _parse(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="agent-config doctor",
        description=(
            "Read-only manifest ↔ filesystem drift report. Surfaces "
            "missing, modified, foreign, and tag-drift files."
        ),
    )
    parser.add_argument("--project", default=None,
                        help="project root (default: cwd)")
    parser.add_argument("--json", action="store_true",
                        help="emit a JSON report instead of human text")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    opts = _parse(list(argv) if argv is not None else sys.argv[1:])
    project_root = _resolve_project_root(opts.project)
    manifest_pth = installed_tools.manifest_path(project_root)
    manifest = installed_tools.read_manifest(manifest_pth)
    if manifest is None:
        print(f"❌  doctor: no project lockfile at {manifest_pth}",
              file=sys.stderr)
        print("    run `./agent-config init` to create one",
              file=sys.stderr)
        return 2

    records, known = _collect_manifest_entries(project_root, manifest)
    missing, modified, tag_drift = _classify(records)
    foreign = _foreign_records(
        project_root, _scan_foreign(project_root, manifest, known),
    )

    if opts.json:
        _emit_json(project_root, missing, modified, foreign, tag_drift)
    else:
        _emit_text(project_root, missing, modified, foreign, tag_drift)

    return 1 if (missing or modified or foreign or tag_drift) else 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
