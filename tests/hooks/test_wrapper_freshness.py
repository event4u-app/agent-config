"""Tests for scripts/wrapper_freshness_hook.py — session_start self-heal.

Re-stamps a stale project-local ``./agent-config`` wrapper from the
canonical template. Never creates one, never touches the source repo,
always fail-open (exit 0).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from scripts import wrapper_freshness_hook as hook  # noqa: E402
from scripts._lib import cli_wrapper  # noqa: E402

_STALE = "#!/usr/bin/env bash\n# old fallback-less wrapper\nexit 127\n"


def _run(root: Path) -> int:
    return hook.main(["--root", str(root), "--platform", "claude"])


def test_refreshes_stale_wrapper(tmp_path: Path) -> None:
    (tmp_path / "package.json").write_text('{"name": "some-app"}')
    wrapper = tmp_path / "agent-config"
    wrapper.write_text(_STALE)
    assert _run(tmp_path) == 0
    body = wrapper.read_text(encoding="utf-8")
    assert "globally-installed" in body
    assert "old fallback-less wrapper" not in body


def test_does_not_create_wrapper(tmp_path: Path) -> None:
    (tmp_path / "package.json").write_text('{"name": "some-app"}')
    assert _run(tmp_path) == 0
    assert not (tmp_path / "agent-config").exists()


def test_noop_in_source_repo(tmp_path: Path) -> None:
    (tmp_path / ".agent-src").mkdir()  # source-repo signal
    wrapper = tmp_path / "agent-config"
    wrapper.write_text(_STALE)
    assert _run(tmp_path) == 0
    assert wrapper.read_text(encoding="utf-8") == _STALE


def test_noop_when_already_fresh(tmp_path: Path) -> None:
    (tmp_path / "package.json").write_text('{"name": "some-app"}')
    cli_wrapper.install_cli_wrapper(tmp_path)  # identical to template
    before = (tmp_path / "agent-config").read_text(encoding="utf-8")
    assert _run(tmp_path) == 0
    assert (tmp_path / "agent-config").read_text(encoding="utf-8") == before
