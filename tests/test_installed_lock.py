"""Tests for ``scripts/_lib/installed_lock.py`` and the global-install
lifecycle that depends on it.

Phase 1.7 of road-to-global-first-install.md. Covers:

- ``read_lockfile`` on missing file / malformed file.
- ``write_lockfile`` atomic write, tool de-duplication + sort, schema.
- ``check_version`` match / mismatch / no-lockfile semantics.
- ``current_package_version`` reads the package's own ``package.json``.
- ``LOCKFILE_ENV`` override redirects the lockfile location.
- ``install.install_global`` round-trip: fresh write, merge on re-run,
  refusal on version mismatch (exit 1), ``--force`` override.
- ``cmd_update._refresh_global_lockfile``: no-op when absent, refresh
  when present, idempotent on same version.
"""
from __future__ import annotations

import io
import os
import sys
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

from scripts._cli import cmd_update  # noqa: E402
from scripts._lib import installed_lock  # noqa: E402

import install  # noqa: E402  # top-level import (scripts/install.py)


# --- installed_lock module ---


def test_read_lockfile_missing_returns_none(tmp_path: Path) -> None:
    assert installed_lock.read_lockfile(tmp_path / "absent.lock") is None


def test_write_lockfile_renders_expected_schema(tmp_path: Path) -> None:
    target = tmp_path / "installed.lock"
    written = installed_lock.write_lockfile(
        "2.1.0", ["cursor", "claude-code", "cursor"], path=target
    )
    assert written == target
    text = target.read_text(encoding="utf-8")
    assert text.startswith("schema_version: 1\n")
    assert 'agent_config_version: "2.1.0"\n' in text
    assert "installed_at:" in text
    # tools de-duplicated and sorted
    assert "  - claude-code\n" in text
    assert "  - cursor\n" in text
    assert text.count("- cursor") == 1


def test_read_lockfile_round_trip(tmp_path: Path) -> None:
    target = tmp_path / "installed.lock"
    installed_lock.write_lockfile("2.0.5", ["aider", "codex"], path=target)
    data = installed_lock.read_lockfile(target)
    assert data is not None
    assert data["schema_version"] == 1
    assert data["agent_config_version"] == "2.0.5"
    assert data["tools"] == ["aider", "codex"]


def test_read_lockfile_tolerates_garbage(tmp_path: Path) -> None:
    target = tmp_path / "installed.lock"
    target.write_text("this is not yaml\nrandom junk\n", encoding="utf-8")
    data = installed_lock.read_lockfile(target)
    assert data == {"tools": []}


def test_check_version_no_lockfile(tmp_path: Path) -> None:
    ok, recorded = installed_lock.check_version("2.1.0", path=tmp_path / "absent.lock")
    assert ok is True
    assert recorded is None


def test_check_version_match(tmp_path: Path) -> None:
    target = tmp_path / "installed.lock"
    installed_lock.write_lockfile("2.1.0", ["cursor"], path=target)
    ok, recorded = installed_lock.check_version("2.1.0", path=target)
    assert ok is True
    assert recorded == "2.1.0"


def test_check_version_mismatch(tmp_path: Path) -> None:
    target = tmp_path / "installed.lock"
    installed_lock.write_lockfile("2.0.5", ["cursor"], path=target)
    ok, recorded = installed_lock.check_version("2.1.0", path=target)
    assert ok is False
    assert recorded == "2.0.5"


def test_current_package_version_reads_package_json() -> None:
    version = installed_lock.current_package_version()
    # package.json must carry a non-empty semver-shaped string
    assert version != "0.0.0"
    assert version.count(".") >= 1


def test_lockfile_env_override(tmp_path: Path, monkeypatch) -> None:
    custom = tmp_path / "custom.lock"
    monkeypatch.setenv("AGENT_CONFIG_INSTALLED_LOCK", str(custom))
    assert installed_lock.lockfile_path() == custom


# --- install.install_global integration ---


@pytest.fixture
def isolated_lock(tmp_path, monkeypatch):
    target = tmp_path / "installed.lock"
    monkeypatch.setenv("AGENT_CONFIG_INSTALLED_LOCK", str(target))
    install.QUIET = True
    yield target
    install.QUIET = False


def _silent_install_global(tools, *, force=False) -> int:
    buf = io.StringIO()
    with redirect_stdout(buf), redirect_stderr(buf):
        return install.install_global(set(tools), force)


def test_install_global_writes_lockfile(isolated_lock: Path) -> None:
    rc = _silent_install_global(["claude-code"])
    assert rc == 0
    assert isolated_lock.exists()
    data = installed_lock.read_lockfile(isolated_lock)
    assert data is not None
    assert data["tools"] == ["claude-code"]


def test_install_global_merges_tools_on_rerun(isolated_lock: Path) -> None:
    _silent_install_global(["claude-code"])
    _silent_install_global(["cursor"])
    data = installed_lock.read_lockfile(isolated_lock)
    assert data is not None
    assert data["tools"] == ["claude-code", "cursor"]


def test_install_global_refuses_on_version_mismatch(isolated_lock: Path) -> None:
    # seed a lockfile with a stale version
    installed_lock.write_lockfile("99.0.0", ["cursor"], path=isolated_lock)
    rc = _silent_install_global(["claude-code"])
    assert rc == 1
    # lockfile untouched on refusal
    data = installed_lock.read_lockfile(isolated_lock)
    assert data is not None
    assert data["agent_config_version"] == "99.0.0"


def test_install_global_force_overrides_mismatch(isolated_lock: Path) -> None:
    installed_lock.write_lockfile("99.0.0", ["cursor"], path=isolated_lock)
    rc = _silent_install_global(["claude-code"], force=True)
    assert rc == 0
    data = installed_lock.read_lockfile(isolated_lock)
    assert data is not None
    assert data["agent_config_version"] == installed_lock.current_package_version()
    # force still merges existing tools
    assert "claude-code" in data["tools"]
    assert "cursor" in data["tools"]


# --- cmd_update._refresh_global_lockfile ---


def test_refresh_global_lockfile_noop_when_absent(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("AGENT_CONFIG_INSTALLED_LOCK", str(tmp_path / "absent.lock"))
    buf = io.StringIO()
    cmd_update._refresh_global_lockfile("2.1.0", out=buf)
    assert not (tmp_path / "absent.lock").exists()
    assert buf.getvalue() == ""


def test_refresh_global_lockfile_writes_new_version(tmp_path, monkeypatch) -> None:
    target = tmp_path / "installed.lock"
    monkeypatch.setenv("AGENT_CONFIG_INSTALLED_LOCK", str(target))
    installed_lock.write_lockfile("2.0.5", ["cursor", "aider"], path=target)
    buf = io.StringIO()
    cmd_update._refresh_global_lockfile("2.1.0", out=buf)
    data = installed_lock.read_lockfile(target)
    assert data is not None
    assert data["agent_config_version"] == "2.1.0"
    # tools preserved
    assert data["tools"] == ["aider", "cursor"]
    assert "Refreshed global lockfile" in buf.getvalue()


def test_refresh_global_lockfile_idempotent_on_same_version(
    tmp_path, monkeypatch
) -> None:
    target = tmp_path / "installed.lock"
    monkeypatch.setenv("AGENT_CONFIG_INSTALLED_LOCK", str(target))
    installed_lock.write_lockfile("2.1.0", ["cursor"], path=target)
    before = target.read_text(encoding="utf-8")
    buf = io.StringIO()
    cmd_update._refresh_global_lockfile("2.1.0", out=buf)
    after = target.read_text(encoding="utf-8")
    assert before == after
    assert "already records 2.1.0" in buf.getvalue()
