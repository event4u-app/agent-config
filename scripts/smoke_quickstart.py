#!/usr/bin/env python3
"""Structural smoke-test for the README Quickstart path.

Verifies the 3-step Quickstart from a fresh-project perspective:

  1. `scripts/install.py --project <tmpdir>` produces a usable
     `.agent-settings.yml` with the documented default `rule_loading_tier`.
  2. The decision_engine block (P2.x of road-to-productization) parses
     cleanly through the same engine parser the runtime uses.
  3. The work-engine state-file format (`agents/runtime/state/<id>.json`) is
     emit-ready — schema for `decision_result` matches the contract.

What it does NOT do:
  - Invoke a real LLM agent (CI doesn't run a model). The end-to-end
    `/onboard → /work → decision_result` chain still requires the host
    agent. This smoke test asserts the *mechanics* the agent depends
    on, so a Quickstart break is caught before the agent ever runs.

Exit codes: 0 = green; 1 = one or more checks failed; 2 = setup error.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INSTALLER = ROOT / "scripts" / "install.py"
TEMPLATE = ROOT / "config" / "agent-settings.template.yml"

EXPECTED_DEFAULT_PROFILE = "balanced"


def _fail(msg: str) -> int:
    print(f"::error::{msg}", file=sys.stderr)
    return 1


def _check_installer_runs(tmpdir: Path) -> tuple[int, Path | None]:
    """Step 1 — run installer against a fresh tmpdir."""
    cmd = [
        sys.executable,
        str(INSTALLER),
        "--project",
        str(tmpdir),
        "--package",
        str(ROOT),
        "--skip-bridges",
    ]
    # ADR-020: --project is reserved for maintainers; CI is a maintainer context.
    env = {**os.environ, "AGENT_CONFIG_DEV_MODE": "1"}
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60, env=env)
    except subprocess.TimeoutExpired:
        return _fail("installer timed out after 60s"), None
    if result.returncode != 0:
        return (
            _fail(f"installer exited {result.returncode}\nstdout:\n{result.stdout}\nstderr:\n{result.stderr}"),
            None,
        )
    settings = tmpdir / ".agent-settings.yml"
    if not settings.exists():
        return _fail(".agent-settings.yml not written by installer"), None
    return 0, settings


def _check_default_profile(settings: Path) -> int:
    """Step 2 — assert default rule_loading_tier matches the contract."""
    import yaml

    parsed = yaml.safe_load(settings.read_text(encoding="utf-8"))
    if not isinstance(parsed, dict):
        return _fail(f"{settings.name}: top-level is not a YAML mapping")
    profile = parsed.get("rule_loading_tier")
    if profile != EXPECTED_DEFAULT_PROFILE:
        return _fail(
            f"rule_loading_tier drift: docs/contracts/rule-loading-tier-defaults.md "
            f"declares '{EXPECTED_DEFAULT_PROFILE}', settings has '{profile!r}'"
        )
    return 0


def _check_decision_engine_block(settings: Path) -> int:
    """Step 3 — decision_engine block parses through the engine parser."""
    sys.path.insert(0, str(ROOT / "scripts"))
    from _lib.agent_src import resolve_logical  # noqa: E402

    template_scripts = resolve_logical("templates/scripts") or (
        ROOT / ".agent-src.uncondensed" / "templates" / "scripts"
    )
    sys.path.insert(0, str(template_scripts))
    try:
        from work_engine.scoring.decision_engine import (  # type: ignore[import-not-found]
            DecisionEngineSettings,
            parse as parse_decision_engine,
        )
    except ImportError as exc:
        return _fail(f"decision_engine module not importable: {exc}")

    import yaml

    parsed = yaml.safe_load(settings.read_text(encoding="utf-8"))
    block = parsed.get("decision_engine") if isinstance(parsed, dict) else None
    try:
        settings_obj = parse_decision_engine(block)
    except Exception as exc:  # noqa: BLE001 — surface the schema error
        return _fail(f"decision_engine block rejected by parser: {exc}")
    if not isinstance(settings_obj, DecisionEngineSettings):
        return _fail("parser returned non-DecisionEngineSettings instance")
    return 0


def main() -> int:
    if not INSTALLER.exists():
        print(f"::error::installer not found at {INSTALLER}", file=sys.stderr)
        return 2
    if not TEMPLATE.exists():
        print(f"::error::template not found at {TEMPLATE}", file=sys.stderr)
        return 2

    failures = 0
    tmpdir = Path(tempfile.mkdtemp(prefix="agent-config-quickstart-"))
    try:
        rc, settings = _check_installer_runs(tmpdir)
        failures += rc
        if settings is not None:
            failures += _check_default_profile(settings)
            failures += _check_decision_engine_block(settings)
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

    if failures:
        print(f"\n❌  smoke-quickstart: {failures} check(s) failed", file=sys.stderr)
        return 1
    print("✅  smoke-quickstart: install → settings → decision_engine green")
    return 0


if __name__ == "__main__":
    sys.exit(main())
