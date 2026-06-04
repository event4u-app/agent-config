"""Install / refresh the consumer-facing ``./agent-config`` wrapper.

Python counterpart to ``install_cli_wrapper`` in ``scripts/install.sh``.
The wrapper is gitignored and meant to be regenerated on every install,
but the normal update cadence (``upgrade``, ``refresh --project``) never
re-ran the bash installer — so an older, fallback-less wrapper could
linger in a consumer project and break every Claude hook (the hook
resolves the master CLI *through* this wrapper). These helpers let the
update commands re-stamp the wrapper from the canonical template.

The template is the single source of truth (``templates/agent-config-wrapper.sh``);
the installer copies it verbatim with no substitution, so refreshing is a
plain copy + ``chmod``.
"""
from __future__ import annotations

import shutil
from pathlib import Path
from typing import Optional

# scripts/_lib/cli_wrapper.py → parents[2] is the package root.
_PACKAGE_ROOT = Path(__file__).resolve().parents[3]
_TEMPLATE = _PACKAGE_ROOT / "templates" / "agent-config-wrapper.sh"


def template_path() -> Path:
    """Absolute path to the canonical wrapper template."""
    return _TEMPLATE


def _target(project_root: Path) -> Path:
    return Path(project_root) / "agent-config"


def needs_refresh(project_root: Path) -> bool:
    """True when the project wrapper is missing or differs from the template.

    Returns ``False`` when the template itself is unavailable (corrupt /
    maintainer-only checkout) — there is nothing to refresh *to*.
    """
    if not _TEMPLATE.is_file():
        return False
    target = _target(project_root)
    if not target.is_file():
        return True
    try:
        return target.read_text(encoding="utf-8") != _TEMPLATE.read_text(
            encoding="utf-8")
    except OSError:
        return True


def install_cli_wrapper(project_root: Path) -> Optional[Path]:
    """Copy the canonical wrapper template to ``<project_root>/agent-config``.

    Returns the written target path, or ``None`` when the template is
    missing (corrupt package / maintainer checkout without templates).
    """
    if not _TEMPLATE.is_file():
        return None
    target = _target(project_root)
    shutil.copyfile(_TEMPLATE, target)
    target.chmod(0o755)
    return target
