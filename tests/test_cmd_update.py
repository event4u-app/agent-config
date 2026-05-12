"""Tests for ``scripts/_cli/cmd_update``.

Phase 3 of road-to-portable-runtime-and-update-check (P3.4). Covers:

- ``--check`` is read-only (no writes; prints latest).
- Default write picks the deepest cascade file carrying the pin, falls
  back to repo-root when no file carries it.
- Comments and surrounding lines are preserved on rewrite.
- ``--to <version>`` honours an explicit pin (with downgrade allowed),
  and rejects a version that fails the registry-existence check.
- Registry-error tolerance: a fetch failure on default-mode exits non-
  zero without writing.
- State-file refresh (``last_check_utc``, ``installed_version``) lands
  via the injected fetcher path.
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts._cli import cmd_update  # noqa: E402


def _make_project(tmp_path: Path, pin_line: str | None) -> Path:
    """Create a fake project with a ``.git`` root + optional pin line."""
    (tmp_path / ".git").mkdir()
    content = "# header comment\nschema_version: 1\n"
    if pin_line is not None:
        content += pin_line + "\n"
    content += "other_key: value\n"
    (tmp_path / ".agent-settings.yml").write_text(content, encoding="utf-8")
    return tmp_path


def _stub_warmer(_version):
    return None


def _run(argv, cwd, *, installed="1.41.2", fetcher=lambda: "1.42.0",
         version_checker=lambda _v: True, state_path=None, out=None, err=None):
    out = out or io.StringIO()
    err = err or io.StringIO()
    rc = cmd_update.main(
        argv,
        cwd=cwd,
        installed_version=installed,
        fetcher=fetcher,
        version_checker=version_checker,
        cache_warmer=_stub_warmer,
        state_path=state_path or (cwd / "state.json"),
        out=out,
        err=err,
    )
    return rc, out.getvalue(), err.getvalue()


def test_check_is_readonly_and_reports_available(tmp_path):
    project = _make_project(tmp_path, 'agent_config_version: "1.41.0"')
    before = (project / ".agent-settings.yml").read_text(encoding="utf-8")
    rc, stdout, _ = _run(["--check"], project)
    assert rc == 0
    assert "1.42.0 available" in stdout
    assert (project / ".agent-settings.yml").read_text(encoding="utf-8") == before


def test_check_reports_up_to_date(tmp_path):
    project = _make_project(tmp_path, 'agent_config_version: "1.42.0"')
    rc, stdout, _ = _run(["--check"], project, installed="1.42.0")
    assert rc == 0
    assert "up to date" in stdout


def test_default_writes_latest_and_preserves_comments(tmp_path):
    project = _make_project(tmp_path, 'agent_config_version: "1.41.0"')
    rc, stdout, _ = _run([], project)
    assert rc == 0
    written = (project / ".agent-settings.yml").read_text(encoding="utf-8")
    assert 'agent_config_version: "1.42.0"' in written
    assert written.startswith("# header comment")
    assert "other_key: value" in written
    assert "Pinned" in stdout


def test_default_skips_unchanged_pin(tmp_path):
    project = _make_project(tmp_path, 'agent_config_version: "1.42.0"')
    rc, stdout, _ = _run([], project, fetcher=lambda: "1.42.0")
    assert rc == 0
    assert "already pins" in stdout


def test_to_flag_downgrades(tmp_path):
    project = _make_project(tmp_path, 'agent_config_version: "1.42.0"')
    rc, stdout, _ = _run(["--to", "1.40.0"], project)
    assert rc == 0
    written = (project / ".agent-settings.yml").read_text(encoding="utf-8")
    assert 'agent_config_version: "1.40.0"' in written
    assert "Pinned" in stdout


def test_to_flag_rejects_missing_version(tmp_path):
    project = _make_project(tmp_path, 'agent_config_version: "1.42.0"')
    rc, _stdout, stderr = _run(
        ["--to", "99.99.99"],
        project,
        version_checker=lambda _v: False,
    )
    assert rc == 1
    assert "not found on the npm registry" in stderr
    assert 'agent_config_version: "1.42.0"' in (project / ".agent-settings.yml").read_text(encoding="utf-8")


def test_default_handles_registry_fetch_failure(tmp_path):
    project = _make_project(tmp_path, 'agent_config_version: "1.41.0"')
    rc, _stdout, stderr = _run([], project, fetcher=lambda: None)
    assert rc == 1
    assert "failed to fetch latest" in stderr
    assert 'agent_config_version: "1.41.0"' in (project / ".agent-settings.yml").read_text(encoding="utf-8")


def test_no_pin_file_falls_back_to_repo_root(tmp_path):
    project = _make_project(tmp_path, None)  # no pin line at all
    rc, _stdout, _ = _run([], project)
    assert rc == 0
    written = (project / ".agent-settings.yml").read_text(encoding="utf-8")
    assert 'agent_config_version: "1.42.0"' in written
    # Existing keys preserved.
    assert "schema_version: 1" in written


def test_no_settings_file_creates_one(tmp_path):
    (tmp_path / ".git").mkdir()
    rc, _stdout, _ = _run([], tmp_path)
    assert rc == 0
    assert (tmp_path / ".agent-settings.yml").read_text(encoding="utf-8").strip() == \
        'agent_config_version: "1.42.0"'


def test_state_file_refreshed_on_write(tmp_path):
    project = _make_project(tmp_path, 'agent_config_version: "1.41.0"')
    state_path = project / "state.json"
    rc, _stdout, _ = _run([], project, state_path=state_path)
    assert rc == 0
    import json
    payload = json.loads(state_path.read_text(encoding="utf-8"))
    assert payload["installed_version"] == "1.42.0"
    assert payload["last_seen_version"] == "1.42.0"
    assert "last_check_utc" in payload
