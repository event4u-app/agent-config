"""``agent-config settings:migrate`` — lift project-local settings into the global store.

Phase 2.4 of ``agents/roadmaps/road-to-global-only-install.md``. Copies
an existing project-local ``.agent-settings.yml`` / ``.agent-user.yml``
into ``~/.event4u/agent-config/`` so the global-only consumer surface
(ADR-020) can take over. Read-only on the source — the destructive
``move`` step is owned by the unified ``agent-config migrate`` command
(see ``docs/contracts/migrate-command.md``).

Idempotent — refuses to overwrite a non-empty global file without
``--force``. ``--dry-run`` lists intended copies; zero writes; exit 0.

Exit codes:

* ``0`` — success or no-op (nothing to migrate / already migrated).
* ``1`` — at least one global file is non-empty and ``--force`` was
  not passed, or a source file failed YAML parse.
"""
from __future__ import annotations

import argparse
import os
import shutil
import sys
from pathlib import Path
from typing import Optional


def _import_install():
    """Lazy import so ``--help`` works without the package on sys.path."""
    here = Path(__file__).resolve().parents[2]
    if str(here) not in sys.path:
        sys.path.insert(0, str(here))
    from scripts import install as install_mod  # noqa: PLC0415
    return install_mod


def _is_non_empty_yaml(path: Path) -> bool:
    """Return True when the file exists and has non-whitespace content."""
    if not path.is_file():
        return False
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return False
    return text.strip() != ""


def _parse_yaml_or_fail(path: Path, out) -> bool:
    """Soft-parse a YAML file; print the error and return False on failure."""
    try:
        import yaml  # type: ignore[import-not-found]
    except ImportError:
        return True  # No PyYAML — defer the validation to the consumer.
    try:
        text = path.read_text(encoding="utf-8")
        yaml.safe_load(text)
        return True
    except (OSError, yaml.YAMLError) as exc:
        print(f"❌  {path}: cannot parse as YAML: {exc}", file=out)
        return False


def _copy(src: Path, dst: Path, *, dry_run: bool, out) -> str:
    """Copy `src` to `dst` with mode 0600. Returns a one-line summary."""
    if dry_run:
        return f"would copy {src} → {dst}"
    dst.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    shutil.copy2(src, dst)
    try:
        os.chmod(dst, 0o600)
    except OSError:
        pass
    return f"copied {src} → {dst}"


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        prog="agent-config settings:migrate",
        description=(
            "Lift project-local .agent-settings.yml / .agent-user.yml into "
            "~/.event4u/agent-config/ (the global-only consumer surface)."
        ),
    )
    parser.add_argument("--from", dest="from_dir", default=None,
                        help="project root to read from (default: cwd)")
    parser.add_argument("--force", action="store_true",
                        help="overwrite a non-empty global file")
    parser.add_argument("--dry-run", action="store_true",
                        help="list intended copies; zero writes; exit 0")
    opts = parser.parse_args(argv)

    install_mod = _import_install()
    project = Path(opts.from_dir).resolve() if opts.from_dir else Path.cwd()

    # Source candidates — typed subdir wins over the legacy flat path.
    src_settings = project / "settings" / install_mod.SETTINGS_FILE
    if not src_settings.is_file():
        src_settings = project / install_mod.SETTINGS_FILE
    src_user = project / "settings" / ".agent-user.yml"
    if not src_user.is_file():
        src_user = project / ".agent-user.yml"

    dst_settings = install_mod.GLOBAL_AGENT_SETTINGS_PATH
    dst_user = install_mod.GLOBAL_USER_SETTINGS_PATH

    plan: list[tuple[Path, Path]] = []
    skipped: list[str] = []

    for src, dst, label in (
        (src_settings, dst_settings, "settings"),
        (src_user, dst_user, "user"),
    ):
        if not src.is_file():
            skipped.append(f"{label}: source absent ({src})")
            continue
        if _is_non_empty_yaml(dst) and not opts.force:
            print(f"❌  {dst} is non-empty — pass --force to overwrite.",
                  file=sys.stderr)
            return 1
        if not _parse_yaml_or_fail(src, sys.stderr):
            return 1
        plan.append((src, dst))

    if not plan:
        print("✅  nothing to migrate — no project-local settings detected.")
        for line in skipped:
            print(f"    - {line}")
        return 0

    summary: list[str] = []
    for src, dst in plan:
        summary.append(_copy(src, dst, dry_run=opts.dry_run, out=sys.stdout))

    verb = "would migrate" if opts.dry_run else "migrated"
    print(f"✅  {verb} {len(plan)} file(s):")
    for line in summary:
        print(f"    - {line}")
    for line in skipped:
        print(f"    - {line}")
    if opts.dry_run:
        print("\n    Re-run without --dry-run to apply.")
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
