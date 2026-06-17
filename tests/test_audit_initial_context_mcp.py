"""Tests for the MCP tool-schema accounting in `scripts/audit_initial_context.py`
(road-to-mcp-token-accounting)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))

import audit_initial_context as aic  # noqa: E402


def _write_catalog(path: Path, tools: list[dict]) -> None:
    path.write_text(
        json.dumps({"schema_version": 1, "tools": tools}, separators=(",", ":")),
        encoding="utf-8",
    )


def test_measure_tool_schema_prices_only_client_facing_triple() -> None:
    """side_effect / implemented_on are catalog bookkeeping, not sent to the
    client — two tools differing only there must price identically."""
    base = {
        "name": "do_thing",
        "description": "Does a thing.",
        "input_schema": {"type": "object", "properties": {"x": {"type": "string"}}},
    }
    a = aic._measure_tool_schema({**base, "side_effect": "ro", "implemented_on": ["stdio"]})
    b = aic._measure_tool_schema({**base, "side_effect": "rw", "implemented_on": ["worker"]})
    assert a["tokens_gpt"] == b["tokens_gpt"]
    assert a["tokens_gpt"] > 0
    assert a["name"] == "do_thing"


def test_real_catalog_priced_per_server() -> None:
    """The shipped catalog prices into a single keyed server entry."""
    out = aic.mcp_tool_schemas()
    assert set(out) == {aic.MCP_SERVER_NAME}
    server = out[aic.MCP_SERVER_NAME]
    catalog = json.loads(aic.MCP_CATALOG.read_text(encoding="utf-8"))
    assert server["tool_count"] == len(catalog["tools"])
    assert server["tokens_gpt"] > 0
    assert server["chars"] > 0
    # per-tool list is sorted by descending GPT tokens
    toks = [t["tokens_gpt"] for t in server["tools"]]
    assert toks == sorted(toks, reverse=True)
    # aggregate equals the sum of the per-tool prices
    assert server["tokens_gpt"] == sum(t["tokens_gpt"] for t in server["tools"])
    assert isinstance(server["over_subscription"], bool)
    assert server["oversubscription_cap"] == aic.MCP_OVERSUBSCRIPTION_TOOL_CAP


def test_over_subscription_flag(tmp_path, monkeypatch) -> None:
    """Count-based heuristic flips when tool count exceeds the soft cap."""
    cat = tmp_path / "catalog.json"
    tools = [
        {"name": f"t{i}", "description": "d", "input_schema": {"type": "object"}}
        for i in range(3)
    ]
    _write_catalog(cat, tools)
    monkeypatch.setattr(aic, "MCP_CATALOG", cat)

    monkeypatch.setattr(aic, "MCP_OVERSUBSCRIPTION_TOOL_CAP", 5)
    assert aic.mcp_tool_schemas()[aic.MCP_SERVER_NAME]["over_subscription"] is False

    monkeypatch.setattr(aic, "MCP_OVERSUBSCRIPTION_TOOL_CAP", 2)
    assert aic.mcp_tool_schemas()[aic.MCP_SERVER_NAME]["over_subscription"] is True


def test_missing_catalog_returns_empty(tmp_path, monkeypatch) -> None:
    """Absent catalog → empty dict; the audit never hard-fails on MCP."""
    monkeypatch.setattr(aic, "MCP_CATALOG", tmp_path / "does-not-exist.json")
    assert aic.mcp_tool_schemas() == {}


def test_render_md_includes_mcp_section() -> None:
    md = aic.render_md(aic.build())
    assert "## MCP — tool-schema cost per server" in md
    assert f"`{aic.MCP_SERVER_NAME}`" in md
    assert "over-subscribed?" in md


def test_render_md_omits_mcp_section_when_absent(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(aic, "MCP_CATALOG", tmp_path / "missing.json")
    md = aic.render_md(aic.build())
    assert "## MCP — tool-schema cost per server" not in md


def test_budget_gate_passes_when_advisory() -> None:
    """mcp_schemas.gpt budget is advisory (None) → gate stays green."""
    assert aic.main(["--fail-if-over-budget"]) == 0
