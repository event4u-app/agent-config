"""``agent-config uninstall`` — remove bridge markers (Phase 4.1).

Removes the per-tool bridge marker files this package created (the
files listed in ``PROJECT_BRIDGE_MARKERS`` for project scope, the
lockfile entries for global scope). User-deployed content in
``~/.claude/skills/`` etc. is left in place — uninstall removes the
*link* between the project and agent-config, not the content the user
may still want. Use ``--purge`` to also delete the deployed content
directories (opt-in, destructive).

Idempotent: removing an already-absent marker is a no-op success.
Refuses to operate on a non-empty drift unless ``--force`` is passed.
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path
from typing import Iterable

from scripts._lib import installed_lock, installed_tools
from scripts.install import PROJECT_BRIDGE_MARKERS, USER_SCOPE_PATHS


def _resolve_project_root(arg: str | None) -> Path:
    if arg:
        return Path(arg).expanduser().resolve()
    return Path.cwd().resolve()


def _filter_tools(all_tools: Iterable[str], requested: str | None) -> list[str]:
    pool = list(all_tools)
    if not requested or requested.strip() == "all":
        return pool
    wanted = {t.strip() for t in requested.split(",") if t.strip()}
    return [t for t in pool if t in wanted]


def _remove_project_marker(project_root: Path, tool: str, *, dry_run: bool) -> tuple[str, bool]:
    rel = PROJECT_BRIDGE_MARKERS.get(tool)
    if not rel:
        return (f"{tool}: no project marker registered (skipped)", False)
    target = project_root / rel
    if not target.exists():
        return (f"{tool}: {rel} already absent", False)
    if dry_run:
        return (f"{tool}: would remove {rel}", True)
    try:
        target.unlink()
        return (f"{tool}: removed {rel}", True)
    except OSError as exc:
        return (f"{tool}: ❌ failed to remove {rel} ({exc})", False)


def _remove_global_content(tool: str, *, dry_run: bool, purge: bool) -> tuple[str, bool]:
    anchor = USER_SCOPE_PATHS.get(tool)
    if not anchor:
        return (f"{tool}: no global anchor registered (skipped)", False)
    target = Path(anchor).expanduser()
    if not target.exists():
        return (f"{tool}: {anchor} already absent", False)
    if not purge:
        return (f"{tool}: {anchor} preserved (pass --purge to delete)", False)
    if dry_run:
        return (f"{tool}: would purge {anchor}", True)
    try:
        if target.is_dir():
            shutil.rmtree(target)
        else:
            target.unlink()
        return (f"{tool}: purged {anchor}", True)
    except OSError as exc:
        return (f"{tool}: ❌ failed to purge {anchor} ({exc})", False)


def _parse(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="agent-config uninstall",
        description=(
            "Remove agent-config bridge markers (project) or lockfile "
            "entries (global). Idempotent. Pass --purge to also delete "
            "deployed content directories."
        ),
    )
    parser.add_argument("--global", dest="global_mode", action="store_true",
                        help="operate on user-scope lockfile (~/.config/agent-config/installed.lock)")
    parser.add_argument("--tools", default=None,
                        help="comma-separated tool IDs to uninstall (default: all in lockfile)")
    parser.add_argument("--project", default=None, help="project root (default: cwd)")
    parser.add_argument("--dry-run", action="store_true",
                        help="show what would be removed; make no changes")
    parser.add_argument("--purge", action="store_true",
                        help="also delete deployed content under user-scope anchors (destructive)")
    parser.add_argument("--force", action="store_true",
                        help="proceed even if lockfile is absent (uninstall by tool list)")
    return parser.parse_args(argv)


def _uninstall_project(opts: argparse.Namespace) -> int:
    project_root = _resolve_project_root(opts.project)
    manifest_path = installed_tools.manifest_path(project_root)
    manifest = installed_tools.read_manifest(manifest_path)
    if manifest is None and not opts.force:
        print(f"❌  no project lockfile at {manifest_path}", file=sys.stderr)
        print("    pass --force to uninstall by --tools=<list> without manifest", file=sys.stderr)
        return 1
    pool = [e.get("name", "") for e in (manifest.get("tools", []) if manifest else [])]
    if not pool and opts.tools:
        pool = [t.strip() for t in opts.tools.split(",") if t.strip()]
    tools = _filter_tools(pool, opts.tools)
    if not tools:
        print("ℹ️   no tools to uninstall")
        return 0
    print(f"{'[dry-run] ' if opts.dry_run else ''}uninstalling {len(tools)} tool(s) from {project_root}:")
    removed_names: list[str] = []
    for tool in tools:
        line, removed = _remove_project_marker(project_root, tool, dry_run=opts.dry_run)
        print(f"  · {line}")
        if removed and not opts.dry_run:
            removed_names.append(tool)
    if removed_names and manifest is not None and not opts.dry_run:
        manifest["tools"] = [e for e in manifest.get("tools", []) if e.get("name") not in removed_names]
        installed_tools.write_manifest(manifest_path, manifest)
        print(f"✅  manifest updated ({len(removed_names)} entries removed)")
    return 0


def _uninstall_global(opts: argparse.Namespace) -> int:
    lock_path = installed_lock.lockfile_path()
    lock = installed_lock.read_lockfile(lock_path)
    if lock is None and not opts.force:
        print(f"❌  no global lockfile at {lock_path}", file=sys.stderr)
        return 1
    pool = list(lock.get("tools", []) if lock else [])
    if not pool and opts.tools:
        pool = [t.strip() for t in opts.tools.split(",") if t.strip()]
    tools = _filter_tools(pool, opts.tools)
    if not tools:
        print("ℹ️   no tools to uninstall")
        return 0
    print(f"{'[dry-run] ' if opts.dry_run else ''}uninstalling {len(tools)} tool(s) from global scope:")
    removed_names: list[str] = []
    for tool in tools:
        line, removed = _remove_global_content(tool, dry_run=opts.dry_run, purge=opts.purge)
        print(f"  · {line}")
        if removed and not opts.dry_run:
            removed_names.append(tool)
    if lock is not None and not opts.dry_run:
        remaining = [t for t in lock.get("tools", []) if t not in tools]
        if remaining:
            installed_lock.write_lockfile(remaining, version=lock.get("agent_config_version", ""))
            print(f"✅  lockfile updated ({len(tools)} entries removed, {len(remaining)} kept)")
        else:
            try:
                lock_path.unlink()
                print(f"✅  lockfile deleted ({lock_path})")
            except OSError as exc:
                print(f"⚠️   could not delete lockfile: {exc}")
    return 0


def main(argv: list[str] | None = None) -> int:
    opts = _parse(list(argv) if argv is not None else sys.argv[1:])
    if opts.global_mode:
        return _uninstall_global(opts)
    return _uninstall_project(opts)


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
