"""Tests for scripts/_lib/cli_wrapper.py — project wrapper re-stamping.

The helper copies the canonical ``templates/agent-config-wrapper.sh`` to a
project root so the update commands can refresh an older, fallback-less
``./agent-config`` wrapper.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts._lib import cli_wrapper  # noqa: E402


def test_template_path_points_at_canonical_template() -> None:
    tpl = cli_wrapper.template_path()
    assert tpl.name == "agent-config-wrapper.sh"
    assert tpl.is_file()
    assert "globally-installed" in tpl.read_text(encoding="utf-8")


def test_needs_refresh_true_when_missing(tmp_path: Path) -> None:
    assert cli_wrapper.needs_refresh(tmp_path) is True


def test_needs_refresh_true_when_differs(tmp_path: Path) -> None:
    (tmp_path / "agent-config").write_text("#!/usr/bin/env bash\nexit 127\n")
    assert cli_wrapper.needs_refresh(tmp_path) is True


def test_needs_refresh_false_when_identical(tmp_path: Path) -> None:
    cli_wrapper.install_cli_wrapper(tmp_path)
    assert cli_wrapper.needs_refresh(tmp_path) is False


def test_install_cli_wrapper_writes_executable_template(tmp_path: Path) -> None:
    target = cli_wrapper.install_cli_wrapper(tmp_path)
    assert target == tmp_path / "agent-config"
    assert target.is_file()
    body = target.read_text(encoding="utf-8")
    assert body == cli_wrapper.template_path().read_text(encoding="utf-8")
    assert target.stat().st_mode & 0o111  # executable bit set
