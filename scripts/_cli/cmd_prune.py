"""``agent-config prune`` — remove orphaned project bridge markers.

Sibling to ``uninstall``: where ``uninstall`` removes bridges for an
explicit tool list, ``prune`` removes every bridge marker present on
disk that is **not** declared in ``agents/installed-tools.lock``. Mirrors
the ``npm prune`` / ``cargo prune`` convention — the lockfile is the
source of truth; anything else is drift.

Scope: project only. Global pruning would touch user anchor dirs
(``~/.claude/``, ``~/.cursor/``…) that may contain unrelated user
content; the safer surface there is ``uninstall --global --purge``.

Hard Floor: refuses to operate without a lockfile (would otherwise
delete every bridge it finds). Pass ``--all-missing-lock`` to opt into
that behaviour explicitly.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from scripts._lib import installed_tools
from scripts.install import PROJECT_BRIDGE_MARKERS


def _resolve_project_root(arg: str | None) -> Path:
    if arg:
        return Path(arg).expanduser().resolve()
    return Path.cwd().resolve()


def _declared_tools(project_root: Path, *, force_empty: bool) -> set[str] | None:
    manifest_path = installed_tools.manifest_path(project_root)
    manifest = installed_tools.read_manifest(manifest_path)
    if manifest is None:
        if force_empty:
            return set()
        return None
    tools = manifest.get("tools") or []
    return {
        str(e.get("name", ""))
        for e in tools
        if e.get("name") and e.get("scope") == "project"
    }


def _orphaned(project_root: Path, declared: set[str]) -> list[tuple[str, Path]]:
    """Return [(tool_id, marker_path), …] for every on-disk marker not in ``declared``."""
    out: list[tuple[str, Path]] = []
    for tool_id, rel in PROJECT_BRIDGE_MARKERS.items():
        if tool_id in declared:
            continue
        target = project_root / rel
        if target.exists():
            out.append((tool_id, target))
    return out


def _remove(target: Path, *, dry_run: bool) -> tuple[bool, str]:
    if dry_run:
        return True, "would remove"
    try:
        target.unlink()
        return True, "removed"
    except IsADirectoryError:
        return False, "❌ is a directory (refusing — use uninstall --purge)"
    except OSError as exc:
        return False, f"❌ failed ({exc})"


def _parse(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="agent-config prune",
        description=(
            "Remove project bridge markers not declared in "
            "agents/installed-tools.lock. Mirrors `npm prune`."
        ),
    )
    parser.add_argument("--project", default=None, help="project root (default: cwd)")
    parser.add_argument("--dry-run", action="store_true",
                        help="show what would be removed; make no changes")
    parser.add_argument("--json", action="store_true",
                        help="emit a JSON report instead of human text")
    parser.add_argument("--all-missing-lock", action="store_true",
                        help="treat a missing lockfile as 'no tools declared' "
                             "and prune every known marker (destructive)")
    return parser.parse_args(argv)


def _emit_text(project_root: Path, orphans: list[tuple[str, Path]],
               results: list[tuple[str, Path, bool, str]], *, dry_run: bool) -> None:
    prefix = "[dry-run] " if dry_run else ""
    if not orphans:
        print(f"✅  {prefix}no orphaned bridges in {project_root}")
        return
    print(f"{prefix}{len(orphans)} orphaned bridge(s) under {project_root}:")
    for tool_id, target, ok, msg in results:
        rel = target.relative_to(project_root) if target.is_absolute() else target
        mark = "·" if ok else "!"
        print(f"  {mark} {tool_id}: {msg} {rel}")


def _emit_json(project_root: Path,
               results: list[tuple[str, Path, bool, str]], *, dry_run: bool) -> None:
    payload = {
        "project_root": str(project_root),
        "dry_run": dry_run,
        "orphans": [
            {
                "tool": tool_id,
                "path": str(target.relative_to(project_root)
                            if target.is_absolute() else target),
                "ok": ok,
                "status": msg,
            }
            for tool_id, target, ok, msg in results
        ],
    }
    print(json.dumps(payload, indent=2))


def main(argv: list[str] | None = None) -> int:
    opts = _parse(list(argv) if argv is not None else sys.argv[1:])
    project_root = _resolve_project_root(opts.project)
    declared = _declared_tools(project_root, force_empty=opts.all_missing_lock)
    if declared is None:
        manifest_path = installed_tools.manifest_path(project_root)
        print(f"❌  no project lockfile at {manifest_path}", file=sys.stderr)
        print("    pass --all-missing-lock to prune every known marker (destructive)",
              file=sys.stderr)
        return 1
    orphans = _orphaned(project_root, declared)
    results: list[tuple[str, Path, bool, str]] = []
    for tool_id, target in orphans:
        ok, msg = _remove(target, dry_run=opts.dry_run)
        results.append((tool_id, target, ok, msg))
    if opts.json:
        _emit_json(project_root, results, dry_run=opts.dry_run)
    else:
        _emit_text(project_root, orphans, results, dry_run=opts.dry_run)
    failed = [r for r in results if not r[2]]
    return 1 if failed else 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
