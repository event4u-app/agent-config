"""``agent-config refresh`` — idempotent re-install, no version change.

The same-version counterpart to ``agent-config upgrade`` (which fetches
the latest). Two scopes, exactly one required:

* ``--global`` — re-run the global install (``scripts/install --global``)
  so the global root + Claude plugin hooks are rewritten from the
  currently-installed package. Idempotent: a second run is a no-op diff.
* ``--project`` — refresh the **minimal** project surface ADR-020 permits
  for a consumer: the ``agents/.event4u-bridge.yml`` marker, an
  ``agents/overrides/`` scaffold, and the managed ``agents/`` block in
  ``.gitignore``. Writes **no** distributed content (no ``.augment/`` /
  ``.claude/`` / skills / hooks). No wizard.

Bare ``agent-config refresh`` (no scope flag) errors — never a silent
global default (council 2026-05-30).

Exit codes: ``0`` success · ``1`` a step failed / bad invocation.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path
from typing import Callable, Optional

PACKAGE_ROOT = Path(__file__).resolve().parents[3]

Runner = Callable[[list[str]], int]


def _default_runner(cmd: list[str]) -> int:
    try:
        return subprocess.run(cmd, check=False).returncode
    except OSError as exc:
        sys.stderr.write(f"agent-config refresh: cannot run {cmd[0]}: {exc}\n")
        return 1


def _refresh_global(runner: Runner, out, err) -> int:
    install_sh = PACKAGE_ROOT / "src" / "scripts" / "install"
    if not install_sh.is_file():
        print(f"❌  agent-config refresh: installer not found at {install_sh}",
              file=err)
        return 1
    print("→ refreshing global install (scripts/install --global)", file=out)
    rc = runner(["bash", str(install_sh), "--global"])
    if rc != 0:
        print(f"❌  agent-config refresh --global: install failed (exit {rc})",
              file=err)
        return 1
    print("✅  global install refreshed.", file=out)
    return 0


def _is_source_repo(project_root: Path) -> bool:
    """True when project_root is the agent-config package itself.

    ``_write_consumer_bridge_marker`` only guards on a root-level
    ``.agent-src.uncondensed/``, which the monorepo keeps under
    ``packages/*/`` instead — so the narrow guard misses here and would
    write a consumer marker into the maintainer tree. This broader check
    (condensed output, packaged source, or the package's own
    ``package.json`` name) makes ``refresh --project`` a no-op in any
    agent-config checkout. Consumers use dev-mode, not refresh.
    """
    if (project_root / "dist/agent-src").is_dir():
        return True
    if any((project_root / "packages").glob("*/.agent-src.uncondensed")):
        return True
    pkg = project_root / "package.json"
    if pkg.is_file():
        try:
            import json
            if json.loads(pkg.read_text(encoding="utf-8")).get("name") == \
                    "@event4u/agent-config":
                return True
        except (OSError, ValueError):
            pass
    return False


def _refresh_project(project_root: Path, out, err) -> int:
    # Imported lazily: scripts.install is large and only needed for --project.
    from scripts import install as installer
    from scripts._lib import cli_wrapper, installed_lock

    if _is_source_repo(project_root):
        print("ℹ️  refresh --project skipped: this is the agent-config package "
              "itself (or a checkout of it). Maintainers use "
              "AGENT_CONFIG_DEV_MODE=1, not a consumer refresh.", file=out)
        return 0

    version = installed_lock.current_package_version() or "0.0.0"
    marker = installer._write_consumer_bridge_marker(project_root, version)
    if marker is None:
        print("ℹ️  refresh --project skipped the bridge marker: this is the "
              "agent-config source repo (or AGENT_CONFIG_DEV_MODE=1). Nothing "
              "to scaffold in a maintainer checkout.", file=out)
        return 0

    print(f"✅  bridge marker: {marker}", file=out)

    overrides = project_root / "agents" / "overrides"
    overrides.mkdir(parents=True, exist_ok=True)
    keep = overrides / "README.md"
    if not keep.exists():
        keep.write_text(
            "# Project overrides\n\n"
            "Project-local overrides/extensions of shared skills, rules, and "
            "commands. The only project-side agent surface ADR-020 permits "
            "besides the bridge marker. See the `override-management` skill.\n",
            encoding="utf-8")
    print(f"✅  overrides scaffold: {overrides}", file=out)

    # Re-stamp the ``./agent-config`` wrapper from the canonical template so
    # an older, fallback-less wrapper cannot linger and break the hooks.
    wrapper = cli_wrapper.install_cli_wrapper(project_root)
    if wrapper is not None:
        print(f"✅  ./agent-config wrapper refreshed: {wrapper}", file=out)

    rc = _sync_gitignore(project_root, out, err)
    if rc != 0:
        return rc
    print("✅  refresh --project complete.", file=out)
    return 0


def _sync_gitignore(project_root: Path, out, err) -> int:
    try:
        from scripts import sync_gitignore
    except ImportError as exc:
        print(f"⚠️  refresh --project: gitignore sync unavailable ({exc})",
              file=err)
        return 0  # advisory — do not fail the refresh on a missing helper
    rc = sync_gitignore.main(["--path", str(project_root / ".gitignore")])
    if rc not in (0, None):
        print(f"⚠️  refresh --project: gitignore sync returned {rc}", file=err)
    else:
        print("✅  .gitignore agents/ block synced.", file=out)
    return 0


def main(
    argv: Optional[list[str]] = None,
    *,
    runner: Runner = _default_runner,
    project_root: Optional[Path] = None,
    out=sys.stdout,
    err=sys.stderr,
) -> int:
    parser = argparse.ArgumentParser(
        prog="agent-config refresh",
        description="Idempotent re-install (no version change). Requires a scope.",
    )
    parser.add_argument("--global", dest="is_global", action="store_true",
                        help="Re-run the global install (root + Claude plugin).")
    parser.add_argument("--project", dest="is_project", action="store_true",
                        help="Refresh the minimal project surface (bridge "
                             "marker, overrides scaffold, .gitignore).")
    args = parser.parse_args(argv)

    if not args.is_global and not args.is_project:
        print("❌  agent-config refresh: specify a scope — --global "
              "and/or --project (never a silent default).", file=err)
        return 1

    root = project_root or Path.cwd()
    rc = 0
    if args.is_global:
        rc = _refresh_global(runner, out, err) or rc
    if args.is_project and rc == 0:
        rc = _refresh_project(root, out, err) or rc
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
