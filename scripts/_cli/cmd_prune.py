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

Schema v2 (P2.1): when the manifest carries per-tool ``files[]``
inventories, prune enumerates them in addition to the legacy
``PROJECT_BRIDGE_MARKERS`` disk scan. Files whose owning tool has
``status: uninstalling`` (forward-compat for P2.2 two-phase uninstall)
are surfaced as orphans even when the tool entry still exists. Manifests
without ``files[]`` fall back to the v1 disk-scan path unchanged.

Drift detection (P2.3): orphaned files with a recorded ``sha256`` are
hashed before deletion. A mismatch flags the file as **modified** —
prune surfaces the path and skips removal so user / neighbour-tool
edits to deployed content survive the prune sweep. Files without a
recorded hash (bridges) skip the check and prune normally.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

from scripts._lib import installed_tools
from scripts.install import PROJECT_BRIDGE_MARKERS


def _resolve_project_root(arg: str | None) -> Path:
    if arg:
        return Path(arg).expanduser().resolve()
    return Path.cwd().resolve()


def _load_manifest(project_root: Path, *, force_empty: bool
                   ) -> tuple[dict | None, set[str] | None]:
    """Return ``(manifest, declared)``.

    ``declared`` is the set of project-scope tool names whose entry is
    healthy (``status`` absent or ``installed``). When the manifest is
    missing, returns ``(None, set())`` if ``force_empty`` else
    ``(None, None)``.
    """
    manifest_path = installed_tools.manifest_path(project_root)
    manifest = installed_tools.read_manifest(manifest_path)
    if manifest is None:
        if force_empty:
            return None, set()
        return None, None
    tools = manifest.get("tools") or []
    declared = {
        str(e.get("name", ""))
        for e in tools
        if e.get("name")
        and e.get("scope") == "project"
        and e.get("status", "installed") == "installed"
    }
    return manifest, declared


def _resolve_path(project_root: Path, raw: str) -> Path:
    """Expand a manifest path (repo-relative or absolute / ``~``-prefixed)."""
    p = Path(raw).expanduser()
    if not p.is_absolute():
        p = project_root / p
    return p


def _sha256(path: Path) -> str | None:
    """Hex SHA-256 of ``path`` content, or ``None`` if unreadable.

    Mirrors :func:`scripts.install._sha256_of_file` without taking the
    import dependency on the installer module beyond what already
    exists. Drift detection (P2.3) calls this for every orphan with a
    recorded hash.
    """
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()
    except OSError:
        return None


def _orphaned(project_root: Path, manifest: dict | None, declared: set[str]
              ) -> list[tuple[str, Path, str | None, str | None]]:
    """Return ``[(tool_id, target_path, kind, expected_sha256), …]``.

    ``kind`` is ``"bridge"`` / ``"marker"`` / ``"deployed"`` for v2
    entries, ``None`` for the legacy disk scan (which has no manifest
    context). ``expected_sha256`` is the hash recorded at install time
    and is used by the drift detector (P2.3); ``None`` skips the check.

    Two sources:

    1. Disk scan via ``PROJECT_BRIDGE_MARKERS`` — catches legacy / v1
       installs and unmanaged drift not recorded in ``files[]``.
    2. Manifest-driven scan via per-tool ``files[]`` (v2 only) —
       surfaces files whose owning tool has ``status: uninstalling``
       (P2.2 crash recovery) or whose ``kind`` is ``bridge`` /
       ``marker`` / ``deployed`` and the tool is no longer declared.

    Paths already collected by the disk scan are deduplicated so the
    same orphan never appears twice.
    """
    out: list[tuple[str, Path, str | None, str | None]] = []
    seen: set[Path] = set()

    for tool_id, rel in PROJECT_BRIDGE_MARKERS.items():
        if tool_id in declared:
            continue
        target = project_root / rel
        if not target.exists():
            continue
        out.append((tool_id, target, None, None))
        seen.add(target.resolve())

    if manifest is None:
        return out

    for tool in manifest.get("tools") or []:
        if tool.get("scope") != "project":
            continue
        files = tool.get("files") or []
        if not files:
            continue
        tool_id = str(tool.get("name", ""))
        status = tool.get("status", "installed")
        if status == "installed" and tool_id in declared:
            continue
        for entry in files:
            kind = entry.get("kind")
            if kind not in ("bridge", "marker", "deployed"):
                continue
            raw = entry.get("path") or ""
            if not raw:
                continue
            target = _resolve_path(project_root, raw)
            try:
                resolved = target.resolve()
            except OSError:
                resolved = target
            if resolved in seen or not target.exists():
                continue
            out.append((tool_id, target, kind, entry.get("sha256")))
            seen.add(resolved)
    return out


def _classify(target: Path, expected_sha: str | None
              ) -> tuple[str, str | None]:
    """Return ``(state, actual_sha)`` for a prune candidate.

    States:

    * ``"orphan"`` — safe to delete (hash matches or no hash recorded).
    * ``"modified"`` — recorded hash differs from disk; skip deletion.

    A missing recorded hash short-circuits to ``"orphan"`` because
    bridges are content-less by design and would otherwise spuriously
    flag as modified after every install.
    """
    if expected_sha is None:
        return "orphan", None
    actual = _sha256(target)
    if actual is None or actual != expected_sha:
        return "modified", actual
    return "orphan", actual


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


def _emit_text(
    project_root: Path,
    candidates: list,
    results: list[tuple[str, Path, str, bool, str]],
    *,
    dry_run: bool,
) -> None:
    prefix = "[dry-run] " if dry_run else ""
    if not candidates:
        print(f"✅  {prefix}no orphaned bridges in {project_root}")
        return
    modified = [r for r in results if r[2] == "modified"]
    orphans = [r for r in results if r[2] == "orphan"]
    print(
        f"{prefix}{len(orphans)} orphaned, {len(modified)} modified "
        f"bridge(s) under {project_root}:"
    )
    for tool_id, target, state, ok, msg in results:
        rel = target.relative_to(project_root) if target.is_absolute() else target
        if state == "modified":
            print(f"  ⚠  {tool_id}: modified — skipped {rel}")
            continue
        mark = "·" if ok else "!"
        print(f"  {mark} {tool_id}: {msg} {rel}")


def _emit_json(
    project_root: Path,
    results: list[tuple[str, Path, str, bool, str]],
    *,
    dry_run: bool,
) -> None:
    payload = {
        "project_root": str(project_root),
        "dry_run": dry_run,
        "orphans": [
            {
                "tool": tool_id,
                "path": str(target.relative_to(project_root)
                            if target.is_absolute() else target),
                "state": state,
                "ok": ok,
                "status": msg,
            }
            for tool_id, target, state, ok, msg in results
        ],
    }
    print(json.dumps(payload, indent=2))


def main(argv: list[str] | None = None) -> int:
    opts = _parse(list(argv) if argv is not None else sys.argv[1:])
    project_root = _resolve_project_root(opts.project)
    manifest, declared = _load_manifest(project_root, force_empty=opts.all_missing_lock)
    if declared is None:
        manifest_path = installed_tools.manifest_path(project_root)
        print(f"❌  no project lockfile at {manifest_path}", file=sys.stderr)
        print("    pass --all-missing-lock to prune every known marker (destructive)",
              file=sys.stderr)
        return 1
    candidates = _orphaned(project_root, manifest, declared)
    results: list[tuple[str, Path, str, bool, str]] = []
    for tool_id, target, _kind, expected_sha in candidates:
        state, _actual = _classify(target, expected_sha)
        if state == "modified":
            # Drift — leave the file alone, surface in output.
            results.append((tool_id, target, state, True, "skipped (modified)"))
            continue
        ok, msg = _remove(target, dry_run=opts.dry_run)
        results.append((tool_id, target, state, ok, msg))
    if opts.json:
        _emit_json(project_root, results, dry_run=opts.dry_run)
    else:
        _emit_text(project_root, candidates, results, dry_run=opts.dry_run)
    failed = [r for r in results if not r[2]]
    return 1 if failed else 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
