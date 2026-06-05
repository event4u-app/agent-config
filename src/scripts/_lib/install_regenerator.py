"""Provision the roadmap-progress regenerator into a consumer.

Phase 3 of `road-to-hooks-actually-fire-in-consumers`.

The roadmap-progress hook (`scripts/roadmap_progress_hook.py`)
searches three locations for `update_roadmap_progress.py`. Only the
**canonical** location is reliable in marketplace-install consumers:
`.augment/scripts/update_roadmap_progress.py`. This helper pins the
contract and copies the script idempotently.

Canonical paths:

| Side | Path |
|---|---|
| Source-of-truth (package) | `packages/core/.agent-src.uncondensed/scripts/update_roadmap_progress.py` |
| Package self-use (dogfooding) | `.agent-src/scripts/update_roadmap_progress.py` (and `.augment/scripts/update_roadmap_progress.py` after `task sync`) |
| Consumer install target | `<consumer_root>/.augment/scripts/update_roadmap_progress.py` |

Used by:
  - `scripts/install.py`'s init / full-install path.
  - `scripts/_dispatch.bash::cmd_hooks_install --regen`.

Contract: idempotent; preserves executable bit; never blocks.
"""
from __future__ import annotations

import shutil
import stat
import sys
from pathlib import Path
from typing import Optional


REGENERATOR_REL = "scripts/update_roadmap_progress.py"
"""Path of the script relative to the package's source-of-truth tree."""

CONSUMER_REGENERATOR_REL = ".augment/scripts/update_roadmap_progress.py"
"""Canonical destination path inside a consumer repo."""


def package_source(package_root: Path) -> Optional[Path]:
    """Resolve the package-side source-of-truth for the regenerator.

    Searches the package layout in priority order:
      1. `packages/core/.agent-src.uncondensed/scripts/update_roadmap_progress.py`
      2. `.agent-src/scripts/update_roadmap_progress.py` (condensed projection)
      3. `.augment/scripts/update_roadmap_progress.py` (tool projection)

    Returns the first existing file, or None if none exist (which is
    a misconfigured package and should be a hard error at the call
    site).
    """
    candidates = [
        # 6.0.x (ADR-051): uncondensed source container moved to src/agent-src/.
        package_root / "src" / "agent-src" / REGENERATOR_REL,
        # Back-compat: pre-collapse packages/core/ layout.
        package_root / "packages" / "core" / ".agent-src.uncondensed" / REGENERATOR_REL,
        package_root / ".agent-src" / REGENERATOR_REL,
        package_root / ".augment" / REGENERATOR_REL,
    ]
    for c in candidates:
        if c.is_file():
            return c
    return None


def consumer_target(consumer_root: Path) -> Path:
    """Canonical destination path inside the consumer repo."""
    return consumer_root / CONSUMER_REGENERATOR_REL


def install_regenerator(package_root: Path, consumer_root: Path) -> tuple[bool, str]:
    """Copy the regenerator into the consumer. Idempotent.

    Returns (success, message). `success=False` means the call site
    should surface the message; the helper never raises.
    """
    source = package_source(package_root)
    if source is None:
        return (
            False,
            "regenerator source not found in package "
            "(searched src/agent-src/, packages/core/.agent-src.uncondensed/, "
            ".agent-src/, .augment/)",
        )
    target = consumer_target(consumer_root)
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        # Idempotent: skip the copy if content is byte-identical.
        if target.exists() and target.read_bytes() == source.read_bytes():
            return (True, f"regenerator already current at {target}")
        shutil.copyfile(source, target)
        # Preserve executable bit so the hook can subprocess-call it.
        mode = target.stat().st_mode
        target.chmod(
            mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH
        )
        return (True, f"regenerator installed at {target}")
    except OSError as exc:
        return (False, f"failed to install regenerator: {exc}")


def is_installed(consumer_root: Path) -> bool:
    """Quick boolean — does the canonical regenerator exist + is executable?"""
    target = consumer_target(consumer_root)
    if not target.is_file():
        return False
    import os
    return os.access(target, os.X_OK)


def main() -> int:
    """CLI entry point — `python3 -m scripts._lib.install_regenerator <consumer-root>`."""
    if len(sys.argv) < 2:
        print(
            "usage: install_regenerator.py <consumer_root> [<package_root>]",
            file=sys.stderr,
        )
        return 2
    consumer_root = Path(sys.argv[1]).resolve()
    package_root = (
        Path(sys.argv[2]).resolve()
        # __file__ = src/scripts/_lib/install_regenerator.py → package root is
        # four levels up (_lib → scripts → src → root) since 6.0.0-D.
        if len(sys.argv) > 2
        else Path(__file__).resolve().parents[3]
    )
    ok, msg = install_regenerator(package_root, consumer_root)
    print(msg)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
