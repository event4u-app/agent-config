"""Tests for ``agent-config doctor --trace-root`` + ``--context`` (Step 8 P2)."""
from __future__ import annotations

import io
import json
import os
from contextlib import redirect_stdout
from pathlib import Path

import pytest

from scripts._cli import cmd_doctor
from scripts._lib import agent_settings as ags


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(ags.PROJECT_ROOT_ENV, raising=False)
    monkeypatch.delenv(ags.ROOT_OVERRIDE_ENV, raising=False)


def _run(argv: list[str]) -> tuple[int, str]:
    buf = io.StringIO()
    with redirect_stdout(buf):
        rc = cmd_doctor.main(argv)
    return rc, buf.getvalue()


# --- --trace-root ----------------------------------------------------------

def test_trace_root_text_shows_anchor_hit(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    (tmp_path / ".git").mkdir()
    deep = tmp_path / "a" / "b"
    deep.mkdir(parents=True)
    monkeypatch.chdir(deep)
    rc, out = _run(["--trace-root"])
    assert rc == 0
    assert "resolved root" in out
    assert "git" in out
    assert str(tmp_path.resolve()) in out


def test_trace_root_json_shape(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    (tmp_path / ".git").mkdir()
    monkeypatch.chdir(tmp_path)
    rc, out = _run(["--trace-root", "--json"])
    assert rc == 0
    payload = json.loads(out)
    assert payload["resolved_root"] == str(tmp_path.resolve())
    assert payload["anchor"] == ags.ANCHOR_GIT
    assert isinstance(payload["trace"], list)
    assert payload["trace"], "trace must list at least one ancestor"
    first = payload["trace"][0]
    assert {"ancestor", "pass", "hit", "reason"} <= set(first.keys())


def test_trace_root_no_anchor_warns(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(tmp_path)
    rc, out = _run(["--trace-root"])
    assert rc == 0
    # No anchor found anywhere up the chain — render a warning + null root.
    assert "no anchor" in out or "n/a" in out


# --- --context -------------------------------------------------------------

def test_context_text_renders_full_block(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    (tmp_path / ".git").mkdir()
    (tmp_path / ".agent-settings.yml").write_text("version: 1\n")
    monkeypatch.chdir(tmp_path)
    rc, out = _run(["--context"])
    assert rc == 0
    assert "project_root" in out
    assert "install_mode" in out
    assert str(tmp_path.resolve()) in out


def test_context_json_payload(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    (tmp_path / ".git").mkdir()
    monkeypatch.chdir(tmp_path)
    rc, out = _run(["--context", "--json"])
    assert rc == 0
    payload = json.loads(out)
    assert payload["project_root"] == str(tmp_path.resolve())
    assert payload["install_mode"] in ("minimal", "full")
    assert payload["install_mode_source"] in ("marker-file", "heuristic")
    assert "settings_layers" in payload
    assert "wrapper" in payload


def test_context_install_mode_marker_wins(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    (tmp_path / ".git").mkdir()
    state = tmp_path / "agents" / ".agent-state"
    state.mkdir(parents=True)
    (state / "install-mode.txt").write_text("minimal\n")
    monkeypatch.chdir(tmp_path)
    rc, out = _run(["--context", "--json"])
    assert rc == 0
    payload = json.loads(out)
    assert payload["install_mode"] == "minimal"
    assert payload["install_mode_source"] == "marker-file"


def test_context_install_mode_heuristic_full(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    (tmp_path / ".git").mkdir()
    (tmp_path / "AGENTS.md").write_text("# AGENTS\n")
    gh = tmp_path / ".github"
    gh.mkdir()
    (gh / "copilot-instructions.md").write_text("# copilot\n")
    monkeypatch.chdir(tmp_path)
    rc, out = _run(["--context", "--json"])
    assert rc == 0
    payload = json.loads(out)
    assert payload["install_mode"] == "full"
    assert payload["install_mode_source"] == "heuristic"


def test_context_install_mode_heuristic_minimal(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    (tmp_path / ".git").mkdir()
    monkeypatch.chdir(tmp_path)
    rc, out = _run(["--context", "--json"])
    assert rc == 0
    payload = json.loads(out)
    assert payload["install_mode"] == "minimal"
    assert payload["install_mode_source"] == "heuristic"


def test_context_origin_root_flag(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    (tmp_path / ".git").mkdir()
    monkeypatch.setenv(ags.PROJECT_ROOT_ENV, str(tmp_path))
    monkeypatch.setenv(ags.ROOT_OVERRIDE_ENV, "1")
    monkeypatch.chdir(tmp_path)
    rc, out = _run(["--context", "--json"])
    assert rc == 0
    payload = json.loads(out)
    assert payload["origin"] == ags.ORIGIN_ROOT_FLAG
    assert payload["root_override"] is True


def test_context_invalid_project_exits_2(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(tmp_path)
    rc, _out = _run(["--context", "--project", str(tmp_path / "missing")])
    assert rc == 2
