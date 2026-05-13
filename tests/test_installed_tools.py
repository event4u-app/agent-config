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
    assert data["schema_version"] == it.SCHEMA_VERSION
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



# ---------------------------------------------------------------------------
# Schema v2 (P1.1, road-to-multi-package-coexistence)
# ---------------------------------------------------------------------------


def test_schema_version_is_two() -> None:
    assert it.SCHEMA_VERSION == 2
    assert 1 in it.SCHEMA_VERSIONS_SUPPORTED
    assert 2 in it.SCHEMA_VERSIONS_SUPPORTED


def test_v2_round_trip_with_files_and_merged_keys(tmp_path: Path) -> None:
    target = tmp_path / "installed-tools.lock"
    tools = [
        {
            "name": "claude-code",
            "scope": "global",
            "bridge_marker": "~/.claude/M",
            "installed_at": "2026-05-12",
            "files": [
                {"path": ".augment/rules/r1.md", "kind": "deployed",
                 "sha256": "a" * 64},
                {"path": ".cursorrules", "kind": "bridge",
                 "sha256": "b" * 64},
            ],
            "merged_keys": [
                {"file": ".mcp.json",
                 "json_pointer": "/mcpServers/agent-config"},
            ],
        },
    ]
    it.write_manifest(
        target, "2.2.0", tools,
        deploy_roots=[".augment/rules", ".cursor/rules"],
    )
    data = it.read_manifest(target)
    assert data is not None
    assert data["schema_version"] == 2
    assert data["deploy_roots"] == [".augment/rules", ".cursor/rules"]
    tool = data["tools"][0]
    assert tool["name"] == "claude-code"
    assert len(tool["files"]) == 2
    assert tool["files"][0]["path"] == ".augment/rules/r1.md"
    assert tool["files"][0]["kind"] == "deployed"
    assert tool["files"][0]["sha256"] == "a" * 64
    assert tool["merged_keys"][0]["file"] == ".mcp.json"
    assert tool["merged_keys"][0]["json_pointer"] == "/mcpServers/agent-config"


def test_v2_omits_optional_fields_when_absent(tmp_path: Path) -> None:
    """v2 writer must not emit empty deploy_roots / files / merged_keys."""
    target = tmp_path / "installed-tools.lock"
    tools = [{
        "name": "windsurf", "scope": "project",
        "bridge_marker": ".windsurf/M", "installed_at": "2026-05-12",
    }]
    it.write_manifest(target, "2.2.0", tools)
    text = target.read_text(encoding="utf-8")
    assert "deploy_roots" not in text
    assert "files:" not in text
    assert "merged_keys" not in text


def test_v2_file_kinds_constant() -> None:
    assert it.FILE_KINDS == frozenset({"bridge", "deployed", "marker"})


def test_v2_default_deploy_roots_constant() -> None:
    assert ".augment/rules" in it.DEFAULT_DEPLOY_ROOTS
    assert ".cursor/rules" in it.DEFAULT_DEPLOY_ROOTS
    assert ".claude/skills" in it.DEFAULT_DEPLOY_ROOTS


def test_manual_parser_skips_v2_nested_fields() -> None:
    """Manual parser degrades gracefully on v2 without raising."""
    text = (
        'schema_version: 2\n'
        'agent_config_version: "2.2.0"\n'
        'deploy_roots:\n'
        '  - .augment/rules\n'
        '  - .cursor/rules\n'
        'tools:\n'
        '  - name: claude-code\n'
        '    scope: global\n'
        '    bridge_marker: ~/.claude/M\n'
        '    installed_at: "2026-05-12"\n'
        '    files:\n'
        '      - path: .augment/rules/r1.md\n'
        '        kind: deployed\n'
        '        sha256: "aaa"\n'
        '    merged_keys:\n'
        '      - file: .mcp.json\n'
        '        json_pointer: "/mcpServers/x"\n'
        '  - name: windsurf\n'
        '    scope: project\n'
        '    bridge_marker: .windsurf/M\n'
        '    installed_at: "2026-05-12"\n'
    )
    data = it._parse_manual(text)
    assert data["schema_version"] == 2
    assert len(data["tools"]) == 2
    assert data["tools"][0]["name"] == "claude-code"
    assert data["tools"][1]["name"] == "windsurf"
    # Nested fields silently dropped on the manual path.
    assert "files" not in data["tools"][0]
    assert "merged_keys" not in data["tools"][0]


def test_v1_manifest_still_readable_via_pyyaml(tmp_path: Path) -> None:
    """v1 reader tolerance — pyyaml-backed read of legacy schema works."""
    target = tmp_path / "installed-tools.lock"
    target.write_text(
        'schema_version: 1\n'
        'agent_config_version: "2.1.0"\n'
        'tools:\n'
        '  - name: claude-code\n'
        '    scope: global\n'
        '    bridge_marker: ~/.claude/M\n'
        '    installed_at: "2026-05-12"\n',
        encoding="utf-8",
    )
    data = it.read_manifest(target)
    assert data is not None
    assert data["schema_version"] == 1
    assert data["tools"][0]["name"] == "claude-code"


def test_read_manifest_normalises_v2_shape(tmp_path: Path) -> None:
    """v1 reader returns v2-shaped dict so callers iterate uniformly (P1.2)."""
    target = tmp_path / "installed-tools.lock"
    target.write_text(
        'schema_version: 1\n'
        'agent_config_version: "2.1.0"\n'
        'tools:\n'
        '  - name: claude-code\n'
        '    scope: global\n'
        '    bridge_marker: ~/.claude/M\n'
        '    installed_at: "2026-05-12"\n',
        encoding="utf-8",
    )
    data = it.read_manifest(target)
    assert data is not None
    assert data["deploy_roots"] == []
    assert data["tools"][0]["files"] == []
    assert data["tools"][0]["merged_keys"] == []


def test_v2_writer_sorts_files_and_merged_keys_deterministically(
    tmp_path: Path,
) -> None:
    """P1.3 — same input, different order → byte-identical output."""
    target_a = tmp_path / "a.lock"
    target_b = tmp_path / "b.lock"

    tools_unordered = [{
        "name": "claude-code", "scope": "global",
        "bridge_marker": "~/.claude/M", "installed_at": "2026-05-12",
        "files": [
            {"path": ".augment/rules/z.md", "kind": "deployed", "sha256": "z" * 64},
            {"path": ".augment/rules/a.md", "kind": "deployed", "sha256": "a" * 64},
            {"path": ".augment/rules/m.md", "kind": "deployed", "sha256": "m" * 64},
        ],
        "merged_keys": [
            {"file": ".mcp.json", "json_pointer": "/mcpServers/z"},
            {"file": ".mcp.json", "json_pointer": "/mcpServers/a"},
            {"file": ".claude/settings.json", "json_pointer": "/hooks/x"},
        ],
    }]
    tools_reordered = [{
        "name": "claude-code", "scope": "global",
        "bridge_marker": "~/.claude/M", "installed_at": "2026-05-12",
        "files": list(reversed(tools_unordered[0]["files"])),
        "merged_keys": list(reversed(tools_unordered[0]["merged_keys"])),
    }]
    it.write_manifest(target_a, "2.2.0", tools_unordered)
    it.write_manifest(target_b, "2.2.0", tools_reordered)
    assert target_a.read_text() == target_b.read_text()


def test_v2_writer_golden_file_shape(tmp_path: Path) -> None:
    """P1.3 — pin the canonical v2 wire format byte-for-byte."""
    target = tmp_path / "installed-tools.lock"
    tools = [{
        "name": "claude-code",
        "scope": "global",
        "bridge_marker": "~/.claude/PROJECT_MANAGED_BY_AGENT_CONFIG",
        "installed_at": "2026-05-12",
        "files": [
            {"path": ".augment/rules/r1.md", "kind": "deployed",
             "sha256": "a" * 64},
            {"path": ".cursorrules", "kind": "bridge", "sha256": None},
        ],
        "merged_keys": [
            {"file": ".mcp.json",
             "json_pointer": "/mcpServers/agent-config"},
        ],
    }]
    it.write_manifest(
        target, "2.2.0", tools,
        deploy_roots=[".augment/rules", ".cursor/rules"],
    )
    expected = (
        'schema_version: 2\n'
        'agent_config_version: "2.2.0"\n'
        'deploy_roots:\n'
        '  - .augment/rules\n'
        '  - .cursor/rules\n'
        'tools:\n'
        '  - name: claude-code\n'
        '    scope: global\n'
        '    bridge_marker: ~/.claude/PROJECT_MANAGED_BY_AGENT_CONFIG\n'
        '    installed_at: "2026-05-12"\n'
        '    files:\n'
        '      - path: .augment/rules/r1.md\n'
        '        kind: deployed\n'
        f'        sha256: "{"a" * 64}"\n'
        '      - path: .cursorrules\n'
        '        kind: bridge\n'
        '        sha256: null\n'
        '    merged_keys:\n'
        '      - file: .mcp.json\n'
        '        json_pointer: "/mcpServers/agent-config"\n'
    )
    assert target.read_text(encoding="utf-8") == expected


def test_read_manifest_empty_tools_safe(tmp_path: Path) -> None:
    """``tools:`` with no entries parses to None → must normalise to []."""
    target = tmp_path / "installed-tools.lock"
    target.write_text(
        'schema_version: 2\n'
        'agent_config_version: "2.2.0"\n'
        'tools:\n',
        encoding="utf-8",
    )
    data = it.read_manifest(target)
    assert data is not None
    assert data["tools"] == []
    assert data["deploy_roots"] == []



def test_upsert_tool_records_files_on_first_write() -> None:
    """P1.4 — files/merged_keys flow onto a fresh entry."""
    files = [{"path": ".cursorrules", "kind": "bridge", "sha256": None}]
    merged = [{"file": ".mcp.json", "json_pointer": "/mcpServers/x"}]
    result = it.upsert_tool(
        [], name="cursor", scope="project",
        bridge_marker=".cursorrules", installed_at="2026-05-12",
        files=files, merged_keys=merged,
    )
    assert result[0]["files"] == files
    assert result[0]["merged_keys"] == merged


def test_upsert_tool_refreshes_files_on_idempotent_path() -> None:
    """P1.4 — re-install with new files replaces the inventory."""
    existing = [{
        "name": "cursor", "scope": "project",
        "bridge_marker": ".cursorrules", "installed_at": "2026-05-01",
        "files": [{"path": "old", "kind": "bridge", "sha256": None}],
    }]
    new_files = [
        {"path": ".cursorrules", "kind": "bridge", "sha256": None},
    ]
    result = it.upsert_tool(
        existing, name="cursor", scope="project",
        bridge_marker=".cursorrules", installed_at="2026-05-12",
        files=new_files,
    )
    # Installed-at preserved on idempotent path; files refreshed.
    assert result[0]["installed_at"] == "2026-05-01"
    assert result[0]["files"] == new_files


def test_upsert_tool_preserves_prior_files_when_arg_omitted() -> None:
    """P1.4 — pure no-op (no files arg) keeps the previous inventory."""
    prior_files = [{"path": ".cursorrules", "kind": "bridge", "sha256": None}]
    existing = [{
        "name": "cursor", "scope": "project",
        "bridge_marker": ".cursorrules", "installed_at": "2026-05-01",
        "files": prior_files,
    }]
    result = it.upsert_tool(
        existing, name="cursor", scope="project",
        bridge_marker=".cursorrules",
    )
    assert result[0]["files"] == prior_files
