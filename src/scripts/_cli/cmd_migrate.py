"""``agent-config migrate`` — one-shot, opinionated migration off every
legacy install / state shape.

Contract: ``docs/contracts/migrate-command.md``.

Source roadmap: ``agents/roadmaps/road-to-one-migrate-command.md``. The
unified command collapses the legacy ``migrate``, ``migrate-state``,
and ``migrate-to-global`` triplet into a single, opinionated entry
point. The only flag is ``--dry-run`` (preview vs. apply).

Apply order (fixed; foundation-first):

1. Strip ``@event4u/agent-config`` from ``package.json``
   (``dependencies`` / ``devDependencies``).
2. Strip ``event4u/agent-config`` from ``composer.json``
   (``require`` / ``require-dev``).
3. Delete managed symlinks (``.augment``, ``.claude``, ``.cursor``,
   ``.clinerules``, ``.windsurfrules``) whose target points into a
   legacy install dir (``vendor/`` or ``node_modules/``). Preserve
   user-managed symlinks pointing elsewhere with a warning.
4. Migrate ``.implement-ticket-state.json`` → ``.work-state.json`` if
   a v0 payload is present (the v0 source is renamed ``.bak``).
5. Hard-delete legacy project-local config:
   ``.agent-settings.yml``, ``.agent-user.yml``,
   ``settings/.agent-settings.yml``, ``settings/.agent-user.yml``.
   Remove the ``settings/`` directory if it becomes empty.
6. Remove the empty ``agent-config/`` shell directory at the project
   root, if present and empty.
7. Refresh the ``.gitignore`` agent-config managed block to the
   canonical shape.

Re-runs on a fully-migrated repo emit ``already migrated`` and exit 0
without touching the filesystem. ``--dry-run`` runs the same
detection and prints what would change without mutating disk.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Optional

from scripts._lib.agent_settings import resolve_project_root

PACKAGE_NAME_NPM = "@event4u/agent-config"
PACKAGE_NAME_COMPOSER = "event4u/agent-config"
LEGACY_DIRS = ("vendor", "node_modules")
MANAGED_SYMLINKS = (
    ".augment",
    ".claude",
    ".cursor",
    ".clinerules",
    ".windsurfrules",
)
GITIGNORE_BLOCK_START = "# >>> event4u/agent-config (managed) >>>"
GITIGNORE_BLOCK_END = "# <<< event4u/agent-config (managed) <<<"
GITIGNORE_NEW_BODY = (
    ".agent-settings.yml\n"
    "agents/sessions/\n"
    "agents/runtime/council/responses/\n"
    "agents/runtime/council/sessions/\n"
)
LEGACY_SETTINGS_FILES = (".agent-settings.yml", ".agent-user.yml")
LEGACY_STATE_FILENAME = ".implement-ticket-state.json"
LEGACY_STATE_V1_FILENAME = ".work-state.json"
LEGACY_AGENT_CONFIG_SHELL = "agent-config"


# ---------- detection ----------

def _detect_npm(pkg_json: Path) -> bool:
    if not pkg_json.is_file():
        return False
    try:
        data = json.loads(pkg_json.read_text(encoding="utf-8"))
    except (OSError, ValueError, json.JSONDecodeError):
        return False
    for key in ("dependencies", "devDependencies"):
        section = data.get(key) or {}
        if isinstance(section, dict) and PACKAGE_NAME_NPM in section:
            return True
    return False


def _detect_composer(composer_json: Path) -> bool:
    if not composer_json.is_file():
        return False
    try:
        data = json.loads(composer_json.read_text(encoding="utf-8"))
    except (OSError, ValueError, json.JSONDecodeError):
        return False
    for key in ("require", "require-dev"):
        section = data.get(key) or {}
        if isinstance(section, dict) and PACKAGE_NAME_COMPOSER in section:
            return True
    return False


def _classify_symlink(link: Path) -> Optional[str]:
    """Return 'legacy' if the link points into vendor/ or node_modules/, 'user' otherwise."""
    if not link.is_symlink():
        return None
    try:
        target = Path(link.readlink()) if hasattr(link, "readlink") else Path(link.resolve())
    except OSError:
        return None
    target_str = str(target)
    if any(seg in target_str.split("/") for seg in LEGACY_DIRS):
        return "legacy"
    return "user"


def _detect_legacy_state(project: Path) -> bool:
    """A v0 state file is present at the project root."""
    return (project / LEGACY_STATE_FILENAME).is_file()


def _detect_legacy_settings(project: Path) -> list[Path]:
    """Return the list of legacy settings files present, in deletion order."""
    found: list[Path] = []
    for name in LEGACY_SETTINGS_FILES:
        flat = project / name
        if flat.is_file():
            found.append(flat)
        typed = project / "settings" / name
        if typed.is_file():
            found.append(typed)
    return found


def _detect_empty_shell(project: Path) -> bool:
    """An empty ``agent-config/`` directory at the project root."""
    shell = project / LEGACY_AGENT_CONFIG_SHELL
    if not shell.is_dir() or shell.is_symlink():
        return False
    try:
        return not any(shell.iterdir())
    except OSError:
        return False


def _detect_already_migrated(project: Path) -> bool:
    """A repo counts as migrated when no legacy signal remains."""
    if _detect_npm(project / "package.json"):
        return False
    if _detect_composer(project / "composer.json"):
        return False
    for name in MANAGED_SYMLINKS:
        if _classify_symlink(project / name) == "legacy":
            return False
    if _detect_legacy_state(project):
        return False
    if _detect_legacy_settings(project):
        return False
    if _detect_empty_shell(project):
        return False
    return True


# ---------- apply primitives ----------

def _strip_npm_entry(pkg_json: Path) -> bool:
    try:
        data = json.loads(pkg_json.read_text(encoding="utf-8"))
    except (OSError, ValueError, json.JSONDecodeError):
        return False
    changed = False
    for key in ("dependencies", "devDependencies"):
        section = data.get(key)
        if isinstance(section, dict) and PACKAGE_NAME_NPM in section:
            del section[PACKAGE_NAME_NPM]
            changed = True
            if not section:
                del data[key]
    if changed:
        pkg_json.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return changed


def _strip_composer_entry(composer_json: Path) -> bool:
    try:
        data = json.loads(composer_json.read_text(encoding="utf-8"))
    except (OSError, ValueError, json.JSONDecodeError):
        return False
    changed = False
    for key in ("require", "require-dev"):
        section = data.get(key)
        if isinstance(section, dict) and PACKAGE_NAME_COMPOSER in section:
            del section[PACKAGE_NAME_COMPOSER]
            changed = True
            if not section:
                del data[key]
    if changed:
        composer_json.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return changed


def _purge_legacy_symlinks(project: Path) -> tuple[list[str], list[str]]:
    removed: list[str] = []
    preserved: list[str] = []
    for name in MANAGED_SYMLINKS:
        link = project / name
        kind = _classify_symlink(link)
        if kind == "legacy":
            try:
                link.unlink()
                removed.append(name)
            except OSError:
                preserved.append(name)
        elif kind == "user":
            preserved.append(name)
    return removed, preserved


def _migrate_state_file(project: Path) -> Optional[str]:
    """Migrate ``.implement-ticket-state.json`` if v0; return a summary line or None.

    Raises on conversion error so the caller can surface a non-zero exit.
    """
    source = project / LEGACY_STATE_FILENAME
    if not source.is_file():
        return None
    target = project / LEGACY_STATE_V1_FILENAME
    if target.exists():
        # Migration already happened; just clean up the v0 source.
        try:
            source.unlink()
            return f"removed stale {LEGACY_STATE_FILENAME} (v1 already present)"
        except OSError:
            return None
    migrator = _load_state_migrator()
    if migrator is None:
        return None
    migrator.migrate_file(source, destination=target, backup=True)
    return f"migrated {LEGACY_STATE_FILENAME} → {LEGACY_STATE_V1_FILENAME}"


def _load_state_migrator():
    """Import the v0→v1 state migrator from the shipped engine."""
    pkg_root = Path(__file__).resolve().parents[2]
    engine_root = pkg_root / ".agent-src" / "templates" / "scripts"
    if not (engine_root / "work_engine" / "migration").is_dir():
        return None
    if str(engine_root) not in sys.path:
        sys.path.insert(0, str(engine_root))
    try:
        from work_engine.migration import v0_to_v1  # noqa: PLC0415
    except ImportError:
        return None
    return v0_to_v1


def _delete_legacy_settings(project: Path) -> list[str]:
    """Hard-delete every legacy settings file under ``project``.

    Returns the list of relative paths actually removed. Removes the
    ``settings/`` directory itself if it becomes empty after the YAML
    sweep.
    """
    removed: list[str] = []
    for path in _detect_legacy_settings(project):
        try:
            path.unlink()
            removed.append(str(path.relative_to(project)))
        except OSError:
            continue
    settings_dir = project / "settings"
    if settings_dir.is_dir() and not settings_dir.is_symlink():
        try:
            if not any(settings_dir.iterdir()):
                settings_dir.rmdir()
                removed.append("settings/")
        except OSError:
            pass
    return removed


def _remove_empty_shell(project: Path) -> bool:
    shell = project / LEGACY_AGENT_CONFIG_SHELL
    if not _detect_empty_shell(project):
        return False
    try:
        shell.rmdir()
    except OSError:
        return False
    return True


def _update_gitignore(project: Path) -> bool:
    gitignore = project / ".gitignore"
    block = (
        f"{GITIGNORE_BLOCK_START}\n"
        f"{GITIGNORE_NEW_BODY}"
        f"{GITIGNORE_BLOCK_END}\n"
    )
    if not gitignore.exists():
        gitignore.write_text(block, encoding="utf-8")
        return True

    text = gitignore.read_text(encoding="utf-8")
    pattern = re.compile(
        re.escape(GITIGNORE_BLOCK_START) + r".*?" + re.escape(GITIGNORE_BLOCK_END) + r"\n?",
        re.DOTALL,
    )
    if pattern.search(text):
        new_text = pattern.sub(block, text)
    else:
        new_text = text
        if new_text and not new_text.endswith("\n"):
            new_text += "\n"
        new_text += block
    if new_text == text:
        return False
    gitignore.write_text(new_text, encoding="utf-8")
    return True


# ---------- plan + apply ----------

def _build_plan(project: Path) -> dict:
    """Return a dict describing every detected legacy signal."""
    return {
        "npm": _detect_npm(project / "package.json"),
        "composer": _detect_composer(project / "composer.json"),
        "symlinks_legacy": [
            name for name in MANAGED_SYMLINKS
            if _classify_symlink(project / name) == "legacy"
        ],
        "symlinks_user": [
            name for name in MANAGED_SYMLINKS
            if _classify_symlink(project / name) == "user"
        ],
        "state_file": (project / LEGACY_STATE_FILENAME).is_file(),
        "settings_files": [
            str(p.relative_to(project)) for p in _detect_legacy_settings(project)
        ],
        "empty_shell": _detect_empty_shell(project),
    }


def _format_dry_run(plan: dict, out) -> None:
    lines: list[str] = []
    if plan["npm"]:
        lines.append(f"would remove {PACKAGE_NAME_NPM} from package.json")
    if plan["composer"]:
        lines.append(f"would remove {PACKAGE_NAME_COMPOSER} from composer.json")
    for name in plan["symlinks_legacy"]:
        lines.append(f"would remove legacy symlink {name}")
    for name in plan["symlinks_user"]:
        lines.append(f"would preserve user-managed {name} (review manually)")
    if plan["state_file"]:
        lines.append(
            f"would migrate {LEGACY_STATE_FILENAME} → {LEGACY_STATE_V1_FILENAME}"
        )
    for rel in plan["settings_files"]:
        lines.append(f"would delete legacy config {rel}")
    if plan["empty_shell"]:
        lines.append(f"would remove empty {LEGACY_AGENT_CONFIG_SHELL}/ shell")
    lines.append("would refresh .gitignore agent-config block")
    print("ℹ️  legacy install detected — re-run without --dry-run to migrate:", file=out)
    for line in lines:
        print(f"    - {line}", file=out)


def _apply(project: Path, out) -> int:
    summary: list[str] = []
    if _strip_npm_entry(project / "package.json"):
        summary.append(f"removed {PACKAGE_NAME_NPM} from package.json")
    if _strip_composer_entry(project / "composer.json"):
        summary.append(f"removed {PACKAGE_NAME_COMPOSER} from composer.json")
    removed_links, preserved_links = _purge_legacy_symlinks(project)
    for name in removed_links:
        summary.append(f"removed legacy symlink {name}")
    for name in preserved_links:
        summary.append(f"preserved user-managed {name} (review manually)")
    try:
        state_summary = _migrate_state_file(project)
    except Exception as exc:  # noqa: BLE001 — surface as exit-1.
        print(f"❌  state migration failed: {exc}", file=sys.stderr)
        return 1
    if state_summary:
        summary.append(state_summary)
    for rel in _delete_legacy_settings(project):
        summary.append(f"deleted legacy config {rel}")
    if _remove_empty_shell(project):
        summary.append(f"removed empty {LEGACY_AGENT_CONFIG_SHELL}/ shell")
    if _update_gitignore(project):
        summary.append(".gitignore agent-config block refreshed")

    print("✅  migration complete:", file=out)
    for line in summary:
        print(f"    - {line}", file=out)
    print("\n    Next: review the diff and commit.", file=out)
    return 0


def main(
    argv: Optional[list[str]] = None,
    *,
    cwd: Optional[Path] = None,
    version: Optional[str] = None,  # noqa: ARG001 — accepted for test compat; unused.
    out=sys.stdout,
    err=sys.stderr,  # noqa: ARG001 — reserved for future error paths.
) -> int:
    parser = argparse.ArgumentParser(
        prog="agent-config migrate",
        description=(
            "One-shot, opinionated migration off legacy install / state shapes. "
            "Removes composer / npm package entries, deletes legacy symlinks + "
            "project-local config, migrates the v0 work-engine state file, and "
            "refreshes the .gitignore block. The wizard recreates fresh config."
        ),
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Detect only; print the plan without writing any files.",
    )
    args = parser.parse_args(argv)

    project, _ = resolve_project_root(None, cwd=cwd)

    if _detect_already_migrated(project):
        print("✅  already migrated — nothing to do.", file=out)
        return 0

    if args.dry_run:
        plan = _build_plan(project)
        _format_dry_run(plan, out=out)
        return 0

    return _apply(project, out=out)


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
