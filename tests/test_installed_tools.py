"""Tests for ``scripts/_lib/installed_tools.py``.

Phase 3 of road-to-global-first-install (ADR-008). Covers the
project-scope manifest at ``agents/installed-tools.lock``:

- ``read_manifest`` returns ``None`` for a missing file.
- Schema round-trip (write → read).
- Append-on-init order preserved (not alphabetised).
- ``upsert_tool`` idempotent on (name, scope) match.
- ``upsert_tool`` raises ``ScopeMismatchError`` on scope change.
- ``--force`` rewrites the conflicting entry.
- Manual parser handles the canonical schema without ``pyyaml``.
- Env override (``AGENT_CONFIG_INSTALLED_TOOLS``) is honoured.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from _lib import installed_tools as it  # noqa: E402


def test_read_manifest_missing(tmp_path: Path) -> None:
    assert it.read_manifest(tmp_path / "absent.lock") is None


def test_write_and_round_trip(tmp_path: Path) -> None:
    target = tmp_path / "installed-tools.lock"
    tools = [
        {
            "name": "claude-code",
            "scope": "global",
            "bridge_marker": "~/.claude/PROJECT_MANAGED_BY_AGENT_CONFIG",
            "installed_at": "2026-05-12",
        },
        {
            "name": "windsurf",
            "scope": "project",
            "bridge_marker": ".windsurf/PROJECT_MANAGED_BY_AGENT_CONFIG",
            "installed_at": "2026-05-12",
        },
    ]
    it.write_manifest(target, "2.1.0", tools)
    assert target.is_file()
    data = it.read_manifest(target)
    assert data is not None
    assert data["schema_version"] == 1
    assert data["agent_config_version"] == "2.1.0"
    names = [t["name"] for t in data["tools"]]
    assert names == ["claude-code", "windsurf"]
    assert data["tools"][1]["scope"] == "project"


def test_install_order_preserved(tmp_path: Path) -> None:
    target = tmp_path / "installed-tools.lock"
    tools = [
        {"name": "windsurf", "scope": "project",
         "bridge_marker": ".windsurf/M", "installed_at": "2026-05-12"},
        {"name": "claude-code", "scope": "global",
         "bridge_marker": "~/.claude/M", "installed_at": "2026-05-12"},
    ]
    it.write_manifest(target, "2.1.0", tools)
    data = it.read_manifest(target)
    assert [t["name"] for t in data["tools"]] == ["windsurf", "claude-code"]


def test_upsert_appends_new(tmp_path: Path) -> None:
    existing: list = []
    result = it.upsert_tool(
        existing,
        name="cursor",
        scope="global",
        bridge_marker="~/.cursor/M",
        installed_at="2026-05-12",
    )
    assert len(result) == 1
    assert result[0]["name"] == "cursor"


def test_upsert_idempotent_on_match(tmp_path: Path) -> None:
    existing = [{
        "name": "cursor",
        "scope": "global",
        "bridge_marker": "~/.cursor/M",
        "installed_at": "2026-05-12",
    }]
    result = it.upsert_tool(
        existing,
        name="cursor",
        scope="global",
        bridge_marker="~/.cursor/M",
        installed_at="2099-01-01",  # would-be drift if not idempotent
    )
    # Same instance, original timestamp preserved.
    assert result[0]["installed_at"] == "2026-05-12"
    assert len(result) == 1


def test_upsert_scope_change_refuses(tmp_path: Path) -> None:
    existing = [{
        "name": "windsurf",
        "scope": "project",
        "bridge_marker": ".windsurf/M",
        "installed_at": "2026-05-12",
    }]
    with pytest.raises(it.ScopeMismatchError) as exc:
        it.upsert_tool(
            existing,
            name="windsurf",
            scope="global",
            bridge_marker="~/.codeium/windsurf/M",
            installed_at="2026-06-01",
        )
    assert exc.value.recorded_scope == "project"
    assert exc.value.new_scope == "global"


def test_upsert_force_rewrites_scope(tmp_path: Path) -> None:
    existing = [{
        "name": "windsurf",
        "scope": "project",
        "bridge_marker": ".windsurf/M",
        "installed_at": "2026-05-12",
    }]
    result = it.upsert_tool(
        existing,
        name="windsurf",
        scope="global",
        bridge_marker="~/.codeium/windsurf/M",
        installed_at="2026-06-01",
        force=True,
    )
    assert result[0]["scope"] == "global"
    assert result[0]["bridge_marker"] == "~/.codeium/windsurf/M"
    assert result[0]["installed_at"] == "2026-06-01"


def test_upsert_invalid_scope_raises(tmp_path: Path) -> None:
    with pytest.raises(ValueError):
        it.upsert_tool([], name="x", scope="user", bridge_marker="m")


def test_manifest_path_env_override(tmp_path: Path, monkeypatch) -> None:
    target = tmp_path / "custom.lock"
    monkeypatch.setenv("AGENT_CONFIG_INSTALLED_TOOLS", str(target))
    p = it.manifest_path(tmp_path)
    assert p == target


def test_manual_parser_handles_canonical_schema(tmp_path: Path) -> None:
    text = (
        'schema_version: 1\n'
        'agent_config_version: "2.1.0"\n'
        'tools:\n'
        '  - name: claude-code\n'
        '    scope: global\n'
        '    bridge_marker: ~/.claude/M\n'
        '    installed_at: "2026-05-12"\n'
    )
    target = tmp_path / "installed-tools.lock"
    target.write_text(text, encoding="utf-8")
    # Force the manual parser even when pyyaml is available: parse the
    # raw text directly.
    data = it._parse_manual(text)
    assert data["schema_version"] == 1
    assert data["agent_config_version"] == "2.1.0"
    assert data["tools"][0]["name"] == "claude-code"
    assert data["tools"][0]["scope"] == "global"
