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

Schema v2 (P2.2): when the manifest carries per-tool ``files[]`` and
``merged_keys[]`` inventories, uninstall walks them instead of the
hardcoded ``PROJECT_BRIDGE_MARKERS`` map. JSON merges are subtracted
key-by-key so neighbour packages' contributions to the same shared
file (e.g. ``.cursor/hooks.json``) survive. Bridge files that are JSON
documents are deleted only when subtraction left them empty; if a
sibling tool still owns keys there, the file stays.

Two-phase commit: the tool entry is rewritten with ``status:
"uninstalling"`` before any deletion, deletions / subtractions run,
then the entry is removed on success. A crash between the two phases
leaves the manifest in a state ``cmd_prune`` recognises (the orphaned
``files[]`` of an ``uninstalling`` tool resurface for cleanup).
Manifests without ``files[]`` fall back to the legacy v1 path
unchanged.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable

from scripts._lib import fs_atomic, installed_lock, installed_tools
from scripts._lib.json_pointers import subtract_pointers
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


# ---------------------------------------------------------------------------
# Schema v2 helpers (P2.2 — manifest-driven uninstall)
# ---------------------------------------------------------------------------


def _is_v2_entry(entry: dict[str, Any]) -> bool:
    """Whether ``entry`` carries v2 per-tool inventories.

    A tool entry counts as v2 when at least one of ``files[]`` or
    ``merged_keys[]`` is non-empty. Tools written by older installers
    have neither and fall through to the legacy ``PROJECT_BRIDGE_MARKERS``
    path so a manifest written by a v1 ``init`` stays uninstallable.
    """
    return bool(entry.get("files")) or bool(entry.get("merged_keys"))


def _resolve_recorded_path(project_root: Path, recorded: str) -> Path:
    """Resolve a manifest-recorded path against the project root.

    ``files[].path`` and ``merged_keys[].file`` are written as absolute
    paths by the installer (user-scope content lives outside the
    project tree) but a relative path is accepted for portability and
    resolved against ``project_root``. Returns the absolute path.
    """
    p = Path(recorded)
    if p.is_absolute():
        return p
    return (project_root / p).resolve()


def _set_tool_status(
    manifest_path: Path,
    version: str,
    tools: list[dict[str, Any]],
    name: str,
    status: str,
    *,
    deploy_roots: list[str] | None,
) -> list[dict[str, Any]]:
    """Persist ``status`` on the named tool entry and return the new list.

    Two-phase commit anchor (P2.2): writing ``status: uninstalling``
    before any deletion gives ``cmd_prune`` a stable signal to clean
    up after a crash mid-uninstall.
    """
    new_tools: list[dict[str, Any]] = []
    for entry in tools:
        if entry.get("name") == name:
            entry = {**entry, "status": status}
        new_tools.append(entry)
    installed_tools.write_manifest(
        manifest_path, version, new_tools, deploy_roots=deploy_roots,
    )
    return new_tools


def _subtract_merged_keys(
    entry: dict[str, Any],
    project_root: Path,
    *,
    dry_run: bool,
) -> tuple[list[str], set[str], set[str]]:
    """Subtract this tool's ``merged_keys`` from every referenced JSON file.

    Returns ``(warnings, emptied_files, touched_files)``:

    * ``touched_files`` — absolute path strings of every JSON file this
      tool recorded merge contributions for (regardless of subtraction
      outcome). Used by :func:`_delete_tool_files` to decide whether a
      JSON bridge is shared (touched + non-empty) or owned solely
      (untouched → delete with the rest).
    * ``emptied_files`` — subset of ``touched_files`` whose document is
      now ``{}`` after subtraction. Foreign keys from neighbour
      packages are preserved by :func:`subtract_pointers`.
    """
    warnings: list[str] = []
    emptied: set[str] = set()
    touched: set[str] = set()
    merged_keys = entry.get("merged_keys") or []
    if not merged_keys:
        return warnings, emptied, touched
    by_file: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in merged_keys:
        by_file[record["file"]].append(record)
    for file_label, records in by_file.items():
        target = _resolve_recorded_path(project_root, file_label)
        touched.add(str(target))
        if not target.exists():
            warnings.append(
                f"{file_label}: absent — skipping {len(records)} pointer(s)"
            )
            continue
        try:
            doc = json.loads(target.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            warnings.append(f"{file_label}: unparseable JSON ({exc}); skipped")
            continue
        if not isinstance(doc, dict):
            warnings.append(f"{file_label}: not a JSON object; skipped")
            continue
        new_doc, sub_warnings = subtract_pointers(doc, records)
        for w in sub_warnings:
            warnings.append(
                f"{file_label}{w['pointer']}: {w['reason']}"
            )
        if dry_run:
            if not new_doc:
                emptied.add(str(target))
            continue
        if new_doc:
            fs_atomic.write_atomic(
                target, json.dumps(new_doc, indent=2) + "\n",
            )
        else:
            emptied.add(str(target))
    return warnings, emptied, touched


def _delete_tool_files(
    entry: dict[str, Any],
    project_root: Path,
    *,
    dry_run: bool,
    purge: bool,
    emptied_files: set[str],
    touched_files: set[str],
) -> tuple[list[str], list[str]]:
    """Delete ``files[]`` entries by kind; honour --purge for deployed.

    ``touched_files`` is the set of JSON paths this tool recorded
    ``merged_keys`` against. A JSON bridge is preserved only when it
    was touched (shared with neighbour tools) AND subtraction left
    foreign keys behind. Untouched JSON bridges are owned solely by
    this tool and removed with the rest.
    """
    deleted: list[str] = []
    skipped: list[str] = []
    for record in entry.get("files") or []:
        path = _resolve_recorded_path(project_root, record["path"])
        kind = record.get("kind")
        label = str(path)
        if kind == "bridge":
            # Shared JSON bridges with foreign keys are kept; otherwise
            # the tool owns the file outright and we remove it.
            is_shared_json = (
                path.exists()
                and path.suffix == ".json"
                and label in touched_files
                and label not in emptied_files
            )
            if is_shared_json:
                skipped.append(f"bridge {label}: foreign keys preserved")
                continue
            if not path.exists():
                skipped.append(f"bridge {label}: already absent")
                continue
            if dry_run:
                deleted.append(f"would remove bridge {label}")
                continue
            try:
                path.unlink()
                deleted.append(f"removed bridge {label}")
            except OSError as exc:
                skipped.append(f"bridge {label}: ❌ {exc}")
        elif kind == "marker":
            if not path.exists():
                skipped.append(f"marker {label}: already absent")
                continue
            if dry_run:
                deleted.append(f"would remove marker {label}")
                continue
            try:
                path.unlink()
                deleted.append(f"removed marker {label}")
            except OSError as exc:
                skipped.append(f"marker {label}: ❌ {exc}")
        elif kind == "deployed":
            if not purge:
                skipped.append(f"deployed {label}: preserved (pass --purge)")
                continue
            if not path.exists():
                skipped.append(f"deployed {label}: already absent")
                continue
            if dry_run:
                deleted.append(f"would purge deployed {label}")
                continue
            try:
                if path.is_dir():
                    shutil.rmtree(path)
                else:
                    path.unlink()
                deleted.append(f"purged deployed {label}")
            except OSError as exc:
                skipped.append(f"deployed {label}: ❌ {exc}")
        else:
            skipped.append(f"{label}: unknown kind={kind!r}")
    return deleted, skipped


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
                        help="operate on user-scope lockfile (~/.event4u/agent-config/installed.lock; legacy ~/.config/agent-config/installed.lock read as fallback)")
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

    # --force path without a manifest falls straight to the legacy
    # bridge-marker map; v2 inventories are not available off-manifest.
    if manifest is None:
        for tool in tools:
            line, _ = _remove_project_marker(project_root, tool, dry_run=opts.dry_run)
            print(f"  · {line}")
        return 0

    version = manifest.get("agent_config_version", "")
    deploy_roots = manifest.get("deploy_roots") or None
    tool_entries = list(manifest.get("tools", []))
    removed_names: list[str] = []

    for tool in tools:
        entry = next((e for e in tool_entries if e.get("name") == tool), None)
        if entry is None:
            # Tool requested but not in the manifest — legacy marker fallback.
            line, removed = _remove_project_marker(
                project_root, tool, dry_run=opts.dry_run,
            )
            print(f"  · {line}")
            if removed and not opts.dry_run:
                removed_names.append(tool)
            continue

        if not _is_v2_entry(entry):
            # v1 entry — keep the legacy single-marker behaviour.
            line, removed = _remove_project_marker(
                project_root, tool, dry_run=opts.dry_run,
            )
            print(f"  · {line}")
            if removed and not opts.dry_run:
                removed_names.append(tool)
            continue

        files_n = len(entry.get("files") or [])
        merges_n = len(entry.get("merged_keys") or [])
        print(
            f"  · {tool}: v2 uninstall "
            f"({files_n} file(s), {merges_n} merge pointer(s))"
        )

        # Phase 1: flag the entry as uninstalling so a crash here is
        # recoverable by ``cmd_prune`` (P2.1).
        if not opts.dry_run:
            tool_entries = _set_tool_status(
                manifest_path, version, tool_entries, tool, "uninstalling",
                deploy_roots=deploy_roots,
            )
            entry = next(
                (e for e in tool_entries if e.get("name") == tool), entry,
            )

        # Phase 2: subtract this tool's JSON merge contributions.
        warnings, emptied, touched = _subtract_merged_keys(
            entry, project_root, dry_run=opts.dry_run,
        )
        for w in warnings:
            print(f"      ⚠️  {w}")

        # Phase 3: delete files[] entries — bridge files are kept when
        # subtraction left foreign keys behind.
        deleted, skipped = _delete_tool_files(
            entry, project_root,
            dry_run=opts.dry_run, purge=opts.purge,
            emptied_files=emptied,
            touched_files=touched,
        )
        for d in deleted:
            print(f"      ✓  {d}")
        for s in skipped:
            print(f"      ↷  {s}")

        if not opts.dry_run:
            removed_names.append(tool)

    # Phase 4: drop uninstalled entries; persist the manifest atomically.
    if removed_names and not opts.dry_run:
        remaining = [
            e for e in tool_entries if e.get("name") not in removed_names
        ]
        installed_tools.write_manifest(
            manifest_path, version, remaining, deploy_roots=deploy_roots,
        )
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
