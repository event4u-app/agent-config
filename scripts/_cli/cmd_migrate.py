"""``agent-config migrate`` — one-shot migration off legacy install paths.

P3.5/P3.6 of road-to-portable-runtime-and-update-check.md. Migrates a
consumer project from the legacy composer / npm install paths onto
the ``npx``-only runtime described in ``docs/architecture.md``.

Steps performed (idempotent):

1. Detect legacy install signals (composer.json entry, package.json
   devDependency, in-project symlinks pointing at vendor/ or
   node_modules/).
2. Remove the package entry from composer.json / package.json
   in-place, preserving sibling keys + formatting.
3. Delete agent-config managed symlinks that point inside the legacy
   install dirs. User-added links elsewhere are preserved with a
   warning.
4. Write a fresh ``.agent-settings.yml`` (only if missing) with
   ``agent_config_version`` pinned to the running version.
5. Update the consumer's ``.gitignore`` block (legacy paths out, new
   project-scope entries in).
6. Print a summary so the developer can review + commit.

Re-runs on an already-migrated repo emit ``already migrated`` and
exit 0.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Iterable, Optional

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
    "agents/council-responses/\n"
    "agents/council-sessions/\n"
)


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


def _write_settings(project: Path, version: str) -> bool:
    settings = project / ".agent-settings.yml"
    if settings.exists():
        return False
    body = (
        "# .agent-settings.yml — generated by `agent-config migrate`.\n"
        "# See docs/customization.md for the full key reference.\n"
        f'agent_config_version: "{version}"\n'
    )
    settings.write_text(body, encoding="utf-8")
    try:
        settings.chmod(0o644)
    except OSError:
        pass
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


def _detect_already_migrated(project: Path) -> bool:
    """A repo counts as migrated when no legacy signal remains."""
    if _detect_npm(project / "package.json"):
        return False
    if _detect_composer(project / "composer.json"):
        return False
    for name in MANAGED_SYMLINKS:
        if _classify_symlink(project / name) == "legacy":
            return False
    return True


def main(
    argv: Optional[list[str]] = None,
    *,
    cwd: Optional[Path] = None,
    version: Optional[str] = None,
    out=sys.stdout,
    err=sys.stderr,  # noqa: ARG001 — reserved for future error paths
) -> int:
    parser = argparse.ArgumentParser(
        prog="agent-config migrate",
        description="One-shot migration off legacy composer / npm install paths.",
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Detect only; do not write any files.")
    args = parser.parse_args(argv)

    # Phase 3 — honor AGENT_CONFIG_PROJECT_ROOT + anchor walk so
    # ``agent-config migrate`` invoked from a subdir still targets the
    # real project root. ``cwd`` kwarg is preserved for test injection.
    project, _ = resolve_project_root(None, cwd=cwd)
    version = version or _detect_installed_version()

    if _detect_already_migrated(project):
        print("✅  already migrated — nothing to do.", file=out)
        return 0

    if args.dry_run:
        print("ℹ️  legacy install detected — re-run without --dry-run to migrate.", file=out)
        return 0

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
    if _write_settings(project, version):
        summary.append(f".agent-settings.yml written (pinned to {version})")
    if _update_gitignore(project):
        summary.append(".gitignore agent-config block refreshed")

    print("✅  migration complete:", file=out)
    for line in summary:
        print(f"    - {line}", file=out)
    print("\n    Next: review the diff and commit.", file=out)
    return 0


def _detect_installed_version() -> str:
    pkg_json = Path(__file__).resolve().parents[2] / "package.json"
    try:
        data = json.loads(pkg_json.read_text(encoding="utf-8"))
        version = data.get("version")
        if isinstance(version, str) and version.strip():
            return version.strip()
    except (OSError, ValueError, json.JSONDecodeError):
        pass
    return "0.0.0"


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
