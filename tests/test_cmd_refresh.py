"""Tests for scripts/_cli/cmd_refresh.py — idempotent re-install command.

`--global` delegates to scripts/install (a fake runner records it);
`--project` writes only the ADR-020-permitted minimal surface and
no-ops in an agent-config checkout.
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts._cli import cmd_refresh  # noqa: E402


class _Recorder:
    def __init__(self, rc: int = 0) -> None:
        self.calls: list[list[str]] = []
        self.rc = rc

    def __call__(self, cmd: list[str]) -> int:
        self.calls.append(cmd)
        return self.rc


def test_refresh_requires_a_scope() -> None:
    err = io.StringIO()
    rc = cmd_refresh.main([], runner=_Recorder(), err=err)
    assert rc == 1
    assert "specify a scope" in err.getvalue()


def test_refresh_global_delegates_to_installer() -> None:
    rec = _Recorder()
    out = io.StringIO()
    rc = cmd_refresh.main(["--global"], runner=rec, out=out)
    assert rc == 0
    assert rec.calls and rec.calls[0][0] == "bash"
    assert rec.calls[0][-1] == "--global"


def test_refresh_global_propagates_install_failure() -> None:
    rec = _Recorder(rc=2)
    out, err = io.StringIO(), io.StringIO()
    rc = cmd_refresh.main(["--global"], runner=rec, out=out, err=err)
    assert rc == 1
    assert "install failed" in err.getvalue()


def test_refresh_project_noops_in_source_repo(tmp_path: Path) -> None:
    (tmp_path / ".agent-src").mkdir()  # marks an agent-config checkout
    out = io.StringIO()
    rc = cmd_refresh.main(["--project"], project_root=tmp_path, out=out)
    assert rc == 0
    assert "skipped" in out.getvalue()
    assert not (tmp_path / "agents" / ".event4u-bridge.yml").exists()


def test_refresh_project_scaffolds_consumer_surface(tmp_path: Path) -> None:
    """A clean consumer dir gets the bridge marker, overrides scaffold, and
    a synced .gitignore — and nothing else (no .augment/ / .claude/)."""
    out = io.StringIO()
    rc = cmd_refresh.main(["--project"], project_root=tmp_path, out=out)
    assert rc == 0
    assert (tmp_path / "agents" / ".event4u-bridge.yml").is_file()
    assert (tmp_path / "agents" / "overrides" / "README.md").is_file()
    assert (tmp_path / ".gitignore").is_file()
    # The consumer-facing wrapper is re-stamped from the canonical template
    # so an older, fallback-less wrapper cannot linger and break the hooks.
    wrapper = tmp_path / "agent-config"
    assert wrapper.is_file()
    assert "globally-installed" in wrapper.read_text(encoding="utf-8")
    # ADR-020: no distributed content written into the repo.
    assert not (tmp_path / ".augment").exists()
    assert not (tmp_path / ".claude").exists()


def test_is_source_repo_detects_package_json(tmp_path: Path) -> None:
    (tmp_path / "package.json").write_text('{"name": "@event4u/agent-config"}')
    assert cmd_refresh._is_source_repo(tmp_path) is True


def test_is_source_repo_false_for_consumer(tmp_path: Path) -> None:
    (tmp_path / "package.json").write_text('{"name": "some-app"}')
    assert cmd_refresh._is_source_repo(tmp_path) is False
