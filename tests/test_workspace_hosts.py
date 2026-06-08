"""Tests for ``src/cli/python/workspace_hosts.py`` (ADR-068 host-tier detect).

Includes the contract-consistency check that keeps
``docs/contracts/host-agent-protocol.md`` canonical (ADR-068 H1): the code map
must agree with the contract's inventory table on every host's tier.
"""
from __future__ import annotations

import importlib.util
import json
import re
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = REPO_ROOT / "src" / "cli" / "python" / "workspace_hosts.py"
CONTRACT = REPO_ROOT / "docs" / "contracts" / "host-agent-protocol.md"


def _load():
    spec = importlib.util.spec_from_file_location("workspace_hosts", MODULE_PATH)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    sys.modules["workspace_hosts"] = mod
    spec.loader.exec_module(mod)
    return mod


WH = _load()

# Map code keys → the vendor name as it appears in the contract table row.
_CONTRACT_LABEL = {
    "claude-code": "Claude Code", "codex": "Codex", "gemini": "Gemini",
    "augment": "Augment", "cursor": "Cursor", "cline": "Cline", "windsurf": "Windsurf",
}


def test_inventory_matches_contract_tiers():
    """Every HOST_INVENTORY tier must match the contract's inventory table —
    so the human-readable contract stays the source of truth (ADR-068 H1)."""
    text = CONTRACT.read_text(encoding="utf-8")
    rows = [ln for ln in text.splitlines() if ln.startswith("|") and "Tier" in ln]
    for host, entry in WH.HOST_INVENTORY.items():
        label = _CONTRACT_LABEL[host]
        row = next((r for r in rows if label in r), None)
        assert row is not None, f"{host}: no contract row for {label!r}"
        m = re.search(r"Tier\s*([13])", row)
        assert m is not None, f"{host}: no tier in contract row"
        assert int(m.group(1)) == entry["tier"], (
            f"{host}: code tier {entry['tier']} != contract tier {m.group(1)}")


def test_tier3_host_is_handoff(_=None):
    r = WH.detect("augment")
    assert r["known"] and r["inventory_tier"] == 3
    assert r["effective_tier"] == 3 and r["mode"] == "handoff"
    assert r["cli_present"] is False


def test_tier1_with_cli_present_is_drive_pending():
    r = WH.detect("claude-code", which=lambda c: "/usr/local/bin/" + c)
    assert r["effective_tier"] == 1 and r["mode"] == "tier1-drive-pending"
    assert r["cli_present"] is True


def test_tier1_with_cli_absent_demotes_to_handoff():
    # Fail-closed: a Tier-1 host whose CLI is not on PATH → Tier 3 (inbox).
    r = WH.detect("codex", which=lambda c: None)
    assert r["inventory_tier"] == 1
    assert r["effective_tier"] == 3 and r["mode"] == "handoff"


def test_unknown_host_fails_soft_to_tier3():
    r = WH.detect("local")
    assert r["known"] is False
    assert r["effective_tier"] == 3 and r["mode"] == "handoff"


def test_detect_never_spawns(monkeypatch):
    # Detection must be side-effect-free: it only probes PATH, never runs a CLI.
    import subprocess
    def _boom(*a, **k):
        raise AssertionError("detect must not spawn a process")
    monkeypatch.setattr(subprocess, "run", _boom)
    monkeypatch.setattr(subprocess, "Popen", _boom)
    WH.detect("claude-code")
    WH.detect("augment")


def test_cli_detect_exit_codes(capsys):
    assert WH.main(["detect", "augment"]) == 0          # known → 0
    json.loads(capsys.readouterr().out)
    assert WH.main(["detect", "totally-unknown"]) == 1  # unknown → fail-loud exit 1


def test_cli_list_json(capsys):
    assert WH.main(["list", "--json"]) == 0
    rows = json.loads(capsys.readouterr().out)
    assert {r["host"] for r in rows} == set(WH.HOST_INVENTORY)
