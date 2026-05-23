"""``agent-config migrate-to-global`` — one-shot legacy → global migration.

Phase 5.1 + 5.3 + 5.5 of ``agents/roadmaps/road-to-global-only-install.md``.
Lifts a v2.x global-default consumer onto the v2.x global-only surface
(ADR-020).

**Order (per A2)**: ``copy → verify → move → bridge`` — never the inverse.

1. **Gate** — run ``scripts/lint_global_paths.py`` first; any finding aborts
   before a single byte is written. Once ``.legacy-pre-global-only/`` is on
   disk, a perms leak cannot be un-written.
2. **Detect** — project-local YAML settings (``.agent-settings.yml``,
   ``.agent-user.yml``, optionally under ``settings/``) and tool-scope
   leftover directories (``.augment/``, ``.claude/``, ``.cursor/``).
3. **Copy** YAML values into ``~/.event4u/agent-config/``. Refuses to
   overwrite a non-empty global file without ``--force``.
4. **Verify** every global copy round-trip parses and has mode ``0600``.
5. **Move** legacy originals into ``.legacy-pre-global-only/<stamp>/``
   alongside a ``manifest.json`` recording every file moved and every
   global file this migration created (used by ``--rollback``).
6. **Bridge** — write ``agents/.event4u-bridge.yml`` last.
7. **Summary** — single block: copied / verified / moved / skipped per file.

``--dry-run`` lists the plan without touching disk; exit 0.
``--rollback`` reads the latest snapshot manifest and reverses the
migration byte-identically (Phase 5.5 / A3).
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# Filenames detected at the project root (Phase 5.1 step 1).
LEGACY_YAML_FILES: tuple[str, ...] = (".agent-settings.yml", ".agent-user.yml")
LEGACY_TOOL_DIRS: tuple[str, ...] = (".augment", ".claude", ".cursor")
SNAPSHOT_DIRNAME = ".legacy-pre-global-only"
MANIFEST_NAME = "manifest.json"


def _import_install():
    here = Path(__file__).resolve().parents[2]
    if str(here) not in sys.path:
        sys.path.insert(0, str(here))
    from scripts import install as install_mod  # noqa: PLC0415
    return install_mod


def _import_lint_global_paths():
    here = Path(__file__).resolve().parents[2]
    if str(here) not in sys.path:
        sys.path.insert(0, str(here))
    from scripts import lint_global_paths as lgp  # noqa: PLC0415
    return lgp


def _resolve_installed_version(install_mod) -> str:
    """Return the current package version via the install module's lock helper."""
    try:
        lock_mod = install_mod._load_installed_lock_module()
        return lock_mod.current_package_version()
    except Exception:  # noqa: BLE001 — best-effort version resolution.
        return "unknown"


def _consumer_bridge_marker_abs(project: Path, install_mod) -> Path:
    """Resolve ``agents/.event4u-bridge.yml`` for ``project``."""
    relpath = install_mod.CONSUMER_BRIDGE_MARKER_RELPATH
    return project / relpath


def _is_non_empty(path: Path) -> bool:
    try:
        return path.is_file() and path.read_text(encoding="utf-8").strip() != ""
    except OSError:
        return False


def _parse_yaml(path: Path) -> tuple[bool, str]:
    try:
        import yaml  # type: ignore[import-not-found]
    except ImportError:
        return True, ""  # No PyYAML available — defer validation.
    try:
        text = path.read_text(encoding="utf-8")
        yaml.safe_load(text)
        return True, ""
    except (OSError, Exception) as exc:  # noqa: BLE001 — argparse-style error.
        return False, str(exc)


def _stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _resolve_yaml_sources(project: Path, install_mod) -> dict[str, Path]:
    """Map ``.agent-settings.yml`` / ``.agent-user.yml`` to their on-disk
    source — typed ``settings/`` subdir wins over the legacy flat path."""
    out: dict[str, Path] = {}
    for name in LEGACY_YAML_FILES:
        candidate_typed = project / "settings" / name
        candidate_flat = project / name
        if candidate_typed.is_file():
            out[name] = candidate_typed
        elif candidate_flat.is_file():
            out[name] = candidate_flat
    return out


def _yaml_destination(install_mod, name: str) -> Path:
    if name == ".agent-settings.yml":
        return install_mod.GLOBAL_AGENT_SETTINGS_PATH
    if name == ".agent-user.yml":
        return install_mod.GLOBAL_USER_SETTINGS_PATH
    raise ValueError(f"unknown YAML target: {name}")


def _copy_yaml(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    shutil.copy2(src, dst)
    try:
        os.chmod(dst, 0o600)
    except OSError:
        pass


def _verify_yaml(path: Path) -> tuple[bool, str]:
    """Verify the global YAML copy: exists, parses, mode ``0600``."""
    if not path.is_file():
        return False, f"missing after copy: {path}"
    ok, err = _parse_yaml(path)
    if not ok:
        return False, f"reparse failed: {err}"
    try:
        mode = path.stat().st_mode & 0o777
    except OSError as exc:
        return False, f"stat failed: {exc}"
    if mode != 0o600:
        return False, f"mode {oct(mode)} (expected 0o600)"
    return True, ""


def _move_into_snapshot(src: Path, snapshot_root: Path, project: Path) -> Path:
    """Move ``src`` under ``snapshot_root`` preserving project-relative layout.
    Returns the new path inside the snapshot."""
    rel = src.relative_to(project)
    dst = snapshot_root / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(src), str(dst))
    return dst



def _run_perms_gate(out) -> int:
    """Run the Phase 5.0 entry-gate; return ``lint`` exit code."""
    lgp = _import_lint_global_paths()
    return lgp.lint(lgp.DEFAULT_POLICY, quiet=True)


def _build_plan(project: Path, install_mod) -> dict:
    """Return a plan describing every detected legacy artefact."""
    yaml_sources = _resolve_yaml_sources(project, install_mod)
    yaml_plan: list[dict] = []
    for name, src in yaml_sources.items():
        dst = _yaml_destination(install_mod, name)
        yaml_plan.append({
            "name": name,
            "src": str(src),
            "dst": str(dst),
            "global_existed_non_empty": _is_non_empty(dst),
        })
    dir_plan: list[dict] = []
    for name in LEGACY_TOOL_DIRS:
        p = project / name
        if p.is_dir() and not p.is_symlink():
            dir_plan.append({"name": name, "src": str(p)})
    return {"yaml": yaml_plan, "dirs": dir_plan}


def _format_plan(plan: dict, dry_run: bool, out) -> None:
    n_yaml = len(plan["yaml"])
    n_dirs = len(plan["dirs"])
    if n_yaml + n_dirs == 0:
        print("✅  nothing to migrate — no legacy artefacts detected.", file=out)
        return
    verb = "would migrate" if dry_run else "migrating"
    print(f"📦  {verb} {n_yaml} YAML file(s) + {n_dirs} directory(ies):", file=out)
    for entry in plan["yaml"]:
        flag = "  (would overwrite)" if entry["global_existed_non_empty"] else ""
        print(f"    - copy  {entry['src']} → {entry['dst']}{flag}", file=out)
    for entry in plan["dirs"]:
        print(f"    - move  {entry['src']} → snapshot", file=out)


def _do_migrate(project: Path, force: bool, install_mod, out) -> int:
    plan = _build_plan(project, install_mod)
    if not plan["yaml"] and not plan["dirs"]:
        print("✅  nothing to migrate — no legacy artefacts detected.", file=out)
        return 0

    for entry in plan["yaml"]:
        if entry["global_existed_non_empty"] and not force:
            print(f"❌  {entry['dst']} is non-empty — pass --force to overwrite.",
                  file=sys.stderr)
            return 1

    for entry in plan["yaml"]:
        ok, err = _parse_yaml(Path(entry["src"]))
        if not ok:
            print(f"❌  {entry['src']}: cannot parse as YAML: {err}",
                  file=sys.stderr)
            return 1

    # COPY
    copied: list[tuple[Path, Path]] = []
    for entry in plan["yaml"]:
        src, dst = Path(entry["src"]), Path(entry["dst"])
        _copy_yaml(src, dst)
        copied.append((src, dst))

    # VERIFY
    for _src, dst in copied:
        ok, err = _verify_yaml(dst)
        if not ok:
            print(f"❌  verify failed for {dst}: {err}", file=sys.stderr)
            print("    aborting migration — local originals untouched.",
                  file=sys.stderr)
            return 1

    # MOVE — only after verify passes.
    snapshot_root = project / SNAPSHOT_DIRNAME / _stamp()
    snapshot_root.mkdir(parents=True, exist_ok=True)
    moved_yaml: list[tuple[str, str]] = []
    moved_dirs: list[tuple[str, str]] = []
    for entry in plan["yaml"]:
        src = Path(entry["src"])
        if src.is_file():
            dst_snap = _move_into_snapshot(src, snapshot_root, project)
            moved_yaml.append((str(src), str(dst_snap)))
    for entry in plan["dirs"]:
        src = Path(entry["src"])
        if src.is_dir():
            dst_snap = _move_into_snapshot(src, snapshot_root, project)
            moved_dirs.append((str(src), str(dst_snap)))

    manifest = {
        "schema": "event4u-migrate-snapshot/v1",
        "stamp": _stamp(),
        "project_root": str(project),
        "global_root": str(install_mod.GLOBAL_ROOT),
        "moved_yaml": moved_yaml,
        "moved_dirs": moved_dirs,
        "global_copies": [str(dst) for _src, dst in copied],
    }
    (snapshot_root / MANIFEST_NAME).write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8",
    )

    # BRIDGE (last)
    version = _resolve_installed_version(install_mod)
    marker = install_mod._write_consumer_bridge_marker(project, version)

    print(f"✅  migrated — snapshot at {snapshot_root}", file=out)
    for src, dst in copied:
        print(f"    - copied  {src} → {dst}", file=out)
    for src, dst in moved_yaml:
        print(f"    - moved   {src} → {dst}", file=out)
    for src, dst in moved_dirs:
        print(f"    - moved   {src} → {dst}", file=out)
    if marker is not None:
        print(f"    - bridge  {marker}", file=out)
    return 0



def _find_latest_snapshot(project: Path) -> Optional[Path]:
    root = project / SNAPSHOT_DIRNAME
    if not root.is_dir():
        return None
    stamps = sorted(
        (p for p in root.iterdir() if p.is_dir() and (p / MANIFEST_NAME).is_file()),
        key=lambda p: p.name,
    )
    return stamps[-1] if stamps else None


def _do_rollback(project: Path, dry_run: bool, install_mod, out) -> int:
    snapshot = _find_latest_snapshot(project)
    if snapshot is None:
        print(f"❌  no snapshot under {project / SNAPSHOT_DIRNAME} — nothing to roll back.",
              file=sys.stderr)
        return 1
    try:
        manifest = json.loads((snapshot / MANIFEST_NAME).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"❌  cannot read manifest {snapshot / MANIFEST_NAME}: {exc}",
              file=sys.stderr)
        return 1

    moved_yaml = manifest.get("moved_yaml", [])
    moved_dirs = manifest.get("moved_dirs", [])
    global_copies = manifest.get("global_copies", [])

    if dry_run:
        print(f"🔁  would roll back from {snapshot}", file=out)
        for original, snap in moved_yaml + moved_dirs:
            print(f"    - restore {snap} → {original}", file=out)
        for path in global_copies:
            print(f"    - delete  {path}", file=out)
        print(f"    - remove  {_consumer_bridge_marker_abs(project, install_mod)}", file=out)
        return 0

    # Pre-flight: every restore target must be vacant.
    for original, _snap in moved_yaml + moved_dirs:
        if Path(original).exists():
            print(f"❌  restore target already exists: {original}", file=sys.stderr)
            print("    aborting — manual cleanup required.", file=sys.stderr)
            return 1

    # Restore moved originals.
    for original, snap in moved_yaml + moved_dirs:
        src, dst = Path(snap), Path(original)
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(dst))

    # Delete global copies this migration created.
    for path in global_copies:
        p = Path(path)
        try:
            if p.is_file():
                p.unlink()
        except OSError as exc:
            print(f"⚠️   could not delete {p}: {exc}", file=sys.stderr)

    # Drop the bridge marker.
    marker = _consumer_bridge_marker_abs(project, install_mod)
    try:
        if marker.is_file():
            marker.unlink()
    except OSError as exc:
        print(f"⚠️   could not remove bridge marker {marker}: {exc}", file=sys.stderr)

    # Archive the consumed snapshot directory so a second rollback cleanly
    # surfaces "no snapshot found" rather than re-restoring stale data.
    consumed = snapshot.with_name(snapshot.name + ".consumed")
    try:
        snapshot.rename(consumed)
    except OSError:
        pass

    print(f"✅  rolled back — originals restored, global copies removed.", file=out)
    return 0


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        prog="agent-config migrate-to-global",
        description="Lift legacy project-local config into ~/.event4u/agent-config/.",
    )
    parser.add_argument(
        "--from", dest="project", type=Path, default=Path.cwd(),
        help="Project root to migrate (default: cwd).",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Print the plan without touching disk.",
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Overwrite non-empty global files.",
    )
    parser.add_argument(
        "--rollback", action="store_true",
        help="Reverse the latest snapshot under .legacy-pre-global-only/.",
    )
    parser.add_argument(
        "--skip-perms-gate", action="store_true",
        help="Skip the Phase 5.0 permissions audit (NOT recommended).",
    )
    args = parser.parse_args(argv)

    project = args.project.resolve()
    if not project.is_dir():
        print(f"❌  not a directory: {project}", file=sys.stderr)
        return 2

    install_mod = _import_install()
    out = sys.stdout

    if args.rollback:
        return _do_rollback(project, args.dry_run, install_mod, out)

    if not args.skip_perms_gate:
        rc = _run_perms_gate(out)
        if rc != 0:
            print("❌  permissions audit failed — refusing to migrate.", file=sys.stderr)
            print("    run `agent-config doctor` (or `python3 scripts/lint_global_paths.py`) for details.",
                  file=sys.stderr)
            return rc

    if args.dry_run:
        plan = _build_plan(project, install_mod)
        _format_plan(plan, dry_run=True, out=out)
        return 0

    return _do_migrate(project, args.force, install_mod, out)


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
