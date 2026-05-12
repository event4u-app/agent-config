"""``agent-config sync`` — replay the installed-tools manifest (ADR-008).

Phase 3.3 of road-to-global-first-install.md. Reads
``agents/installed-tools.lock``, then re-runs the bridge install for every
tool whose ``bridge_marker`` is missing on disk. Tools whose marker already
exists are skipped — the typical clone-and-sync flow is therefore idempotent
on the second invocation.

Sync never edits the manifest itself; ``init`` is the only writer. Sync only
calls the installer with ``--scope`` / ``--tools`` derived from the manifest
entries, so the manifest is the single source of truth.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Iterable

from scripts._lib import installed_tools
from scripts.install import main as install_main


def _marker_exists(project_root: Path, bridge_marker: str, scope: str) -> bool:
    if not bridge_marker:
        return True  # substrate-only entries (rare); treat as present
    if scope == "global":
        target = Path(bridge_marker).expanduser()
    else:
        # Project-scope: relative to the project root unless absolute.
        candidate = Path(bridge_marker)
        target = candidate if candidate.is_absolute() else (project_root / candidate)
    return target.exists()


def _group_by_scope(
    entries: Iterable[dict],
    project_root: Path,
) -> tuple[dict[str, list[str]], list[tuple[str, str]]]:
    """Return ({scope: [tool_names]}, [(name, marker_path)]) for missing tools.

    The second list is the human-readable summary of what will be replayed.
    """
    missing: dict[str, list[str]] = {"project": [], "global": []}
    surfaced: list[tuple[str, str]] = []
    for entry in entries:
        name = str(entry.get("name", "")).strip()
        scope = str(entry.get("scope", "")).strip()
        bridge_marker = str(entry.get("bridge_marker", "")).strip()
        if not name or scope not in ("project", "global"):
            continue
        if _marker_exists(project_root, bridge_marker, scope):
            continue
        missing[scope].append(name)
        surfaced.append((name, bridge_marker))
    return missing, surfaced


def _run_install(scope: str, tools: list[str], project_root: Path, *, force: bool, dry_run: bool) -> int:
    if not tools:
        return 0
    argv = [f"--scope={scope}", f"--tools={','.join(sorted(set(tools)))}"]
    if scope == "project":
        argv += [f"--project={project_root}", "--no-smoke"]
    if force:
        argv.append("--force")
    if dry_run:
        argv.append("--skip-bridges")
    return install_main(argv)


def _parse(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="agent-config sync",
        description=(
            "Replay agents/installed-tools.lock — re-installs any tool whose "
            "bridge marker is missing locally. Idempotent."
        ),
    )
    parser.add_argument(
        "--project",
        default=None,
        help="Override the project root (defaults to PROJECT_ROOT or cwd).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the planned replay set without touching bridges.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Forwarded to the installer (overwrites existing bridge files).",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress non-essential output.",
    )
    return parser.parse_args(argv)


def _emit(quiet: bool, msg: str) -> None:
    if not quiet:
        print(msg)


def main(argv: list[str]) -> int:
    opts = _parse(argv)
    project_root = Path(
        opts.project or os.environ.get("PROJECT_ROOT") or os.getcwd()
    ).resolve()
    manifest = installed_tools.manifest_path(project_root)
    data = installed_tools.read_manifest(manifest)

    if data is None:
        _emit(opts.quiet, f"❌  No manifest found at {manifest}")
        _emit(opts.quiet, "    Run `./agent-config init --tools=<id>` to create one.")
        return 1

    entries = list(data.get("tools") or [])
    if not entries:
        _emit(opts.quiet, f"ℹ️  Manifest is empty: {manifest}")
        return 0

    missing, surfaced = _group_by_scope(entries, project_root)
    total_missing = sum(len(v) for v in missing.values())
    total_present = len(entries) - total_missing

    _emit(opts.quiet, f"Manifest:  {manifest}")
    _emit(opts.quiet, f"Tools:     {len(entries)} listed, {total_present} present, {total_missing} missing")
    if total_missing == 0:
        _emit(opts.quiet, "✅  All bridges already installed. Nothing to do.")
        return 0

    for name, marker in surfaced:
        _emit(opts.quiet, f"  • {name:<15} → {marker} (missing)")

    if opts.dry_run:
        _emit(opts.quiet, "")
        _emit(opts.quiet, "Dry-run: no bridges written.")
        return 0

    _emit(opts.quiet, "")
    for scope in ("project", "global"):
        tools = missing[scope]
        if not tools:
            continue
        _emit(opts.quiet, f"Replaying scope={scope}: {', '.join(sorted(tools))}")
        rc = _run_install(scope, tools, project_root, force=opts.force, dry_run=False)
        if rc != 0:
            _emit(opts.quiet, f"❌  Installer failed for scope={scope} (rc={rc}); aborting.")
            return rc

    _emit(opts.quiet, "")
    _emit(opts.quiet, "✅  Sync complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
