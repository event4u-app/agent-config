"""Tests for the MCP config renderer."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import mcp_render


REPO_ROOT = Path(__file__).resolve().parent.parent
FIXTURES = REPO_ROOT / "tests" / "fixtures" / "mcp"


def _write_source(tmp_path: Path, name: str = "mcp.json") -> Path:
    """Copy a fixture source file into tmp_path and return its path."""
    src = tmp_path / name
    src.write_text((FIXTURES / "source-valid.json").read_text(encoding="utf-8"), encoding="utf-8")
    return src


def test_substitute_replaces_env_var(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MY_TOKEN", "secret-value")
    missing: list[tuple[str, str]] = []
    result = mcp_render.substitute("Bearer ${env:MY_TOKEN}", "x", missing)
    assert result == "Bearer secret-value"
    assert missing == []


def test_substitute_collects_missing_without_raising() -> None:
    missing: list[tuple[str, str]] = []
    result = mcp_render.substitute("${env:NOT_SET_XYZ}", "servers.a.env.TOKEN", missing)
    assert result == "${env:NOT_SET_XYZ}"
    assert missing == [("NOT_SET_XYZ", "servers.a.env.TOKEN")]


def test_substitute_recurses_into_dict_and_list(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("X", "1")
    missing: list[tuple[str, str]] = []
    result = mcp_render.substitute(
        {"a": ["${env:X}", {"b": "${env:X}"}]}, "servers", missing
    )
    assert result == {"a": ["1", {"b": "1"}]}
    assert missing == []


def test_load_source_rejects_missing_file(tmp_path: Path) -> None:
    with pytest.raises(SystemExit, match="not found"):
        mcp_render.load_source(tmp_path / "missing.json")


def test_load_source_rejects_invalid_json(tmp_path: Path) -> None:
    (tmp_path / "bad.json").write_text("{ not valid", encoding="utf-8")
    with pytest.raises(SystemExit, match="Invalid JSON"):
        mcp_render.load_source(tmp_path / "bad.json")


def test_load_source_rejects_missing_servers_key(tmp_path: Path) -> None:
    (tmp_path / "s.json").write_text('{"foo": {}}', encoding="utf-8")
    with pytest.raises(SystemExit, match="top-level 'servers'"):
        mcp_render.load_source(tmp_path / "s.json")


def test_render_maps_servers_to_mcpServers(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GH_TOKEN", "ghp_xxx")
    monkeypatch.setenv("JIRA_TOKEN", "jira_yyy")
    data = json.loads((FIXTURES / "source-valid.json").read_text(encoding="utf-8"))
    rendered, missing = mcp_render.render(data)
    assert missing == []
    assert "mcpServers" in rendered
    assert "servers" not in rendered
    expected = json.loads((FIXTURES / "golden.json").read_text(encoding="utf-8"))
    assert rendered == expected


def test_render_missing_vars_produce_named_report() -> None:
    data = json.loads((FIXTURES / "source-valid.json").read_text(encoding="utf-8"))
    _rendered, missing = mcp_render.render(data)
    names = sorted({n for n, _ in missing})
    assert names == ["GH_TOKEN", "JIRA_TOKEN"]
    report = mcp_render.format_missing_report(missing)
    assert "GH_TOKEN" in report and "JIRA_TOKEN" in report
    assert "servers.github.env.GITHUB_PERSONAL_ACCESS_TOKEN" in report
    assert "servers.jira.env.JIRA_TOKEN" in report


def test_cli_render_writes_targets(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("GH_TOKEN", "ghp_xxx")
    monkeypatch.setenv("JIRA_TOKEN", "jira_yyy")
    source = _write_source(tmp_path)
    monkeypatch.setattr(mcp_render, "IN_PROJECT_TARGETS", {
        "cursor": tmp_path / ".cursor" / "mcp.json",
        "windsurf": tmp_path / ".windsurf" / "mcp.json",
    })
    monkeypatch.setattr(mcp_render, "CLAUDE_DESKTOP_TARGET", tmp_path / "claude" / "config.json")
    rc = mcp_render.main(["--source", str(source)])
    assert rc == 0
    golden = (FIXTURES / "golden.json").read_text(encoding="utf-8")
    expected = json.dumps(json.loads(golden), indent=2, sort_keys=True) + "\n"
    assert (tmp_path / ".cursor" / "mcp.json").read_text(encoding="utf-8") == expected
    assert (tmp_path / ".windsurf" / "mcp.json").read_text(encoding="utf-8") == expected
    assert not (tmp_path / "claude" / "config.json").exists()


def test_cli_render_includes_claude_desktop_when_opted_in(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("GH_TOKEN", "ghp_xxx")
    monkeypatch.setenv("JIRA_TOKEN", "jira_yyy")
    source = _write_source(tmp_path)
    monkeypatch.setattr(mcp_render, "IN_PROJECT_TARGETS", {
        "cursor": tmp_path / ".cursor" / "mcp.json",
    })
    monkeypatch.setattr(mcp_render, "CLAUDE_DESKTOP_TARGET", tmp_path / "claude" / "config.json")
    rc = mcp_render.main(["--source", str(source), "--claude-desktop"])
    assert rc == 0
    assert (tmp_path / "claude" / "config.json").exists()


def test_cli_render_fails_loud_and_writes_nothing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.delenv("GH_TOKEN", raising=False)
    monkeypatch.delenv("JIRA_TOKEN", raising=False)
    source = _write_source(tmp_path)
    monkeypatch.setattr(mcp_render, "IN_PROJECT_TARGETS", {"cursor": tmp_path / ".cursor" / "mcp.json"})
    rc = mcp_render.main(["--source", str(source)])
    assert rc == 1
    err = capsys.readouterr().err
    assert "GH_TOKEN" in err and "JIRA_TOKEN" in err
    assert not (tmp_path / ".cursor").exists()


def test_cli_render_is_idempotent(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GH_TOKEN", "ghp_xxx")
    monkeypatch.setenv("JIRA_TOKEN", "jira_yyy")
    source = _write_source(tmp_path)
    target = tmp_path / ".cursor" / "mcp.json"
    monkeypatch.setattr(mcp_render, "IN_PROJECT_TARGETS", {"cursor": target})
    monkeypatch.setattr(mcp_render, "CLAUDE_DESKTOP_TARGET", tmp_path / "unused.json")
    assert mcp_render.main(["--source", str(source)]) == 0
    first = target.read_text(encoding="utf-8")
    assert mcp_render.main(["--source", str(source)]) == 0
    assert target.read_text(encoding="utf-8") == first
    assert mcp_render.main(["--source", str(source), "--check"]) == 0


def test_cli_check_detects_stale_output(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GH_TOKEN", "ghp_xxx")
    monkeypatch.setenv("JIRA_TOKEN", "jira_yyy")
    source = _write_source(tmp_path)
    target = tmp_path / ".cursor" / "mcp.json"
    monkeypatch.setattr(mcp_render, "IN_PROJECT_TARGETS", {"cursor": target})
    monkeypatch.setattr(mcp_render, "CLAUDE_DESKTOP_TARGET", tmp_path / "unused.json")
    target.parent.mkdir()
    target.write_text("{}\n", encoding="utf-8")
    assert mcp_render.main(["--source", str(source), "--check"]) == 1
