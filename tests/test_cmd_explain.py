"""Contract tests for ``scripts/_cli/cmd_explain.py`` (Step 15 Phase 1 #3).

Covers the three subjects (``config`` / ``rule`` / ``route``) and the
JSON / text surfaces. Uses ``tmp_path`` project roots with a synthetic
``router.json`` plus preset / profile seeds so the tests do not depend
on the repo-root state. The repo-root smoke check at the bottom asserts
the wired command resolves the *real* router without errors.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts._cli import cmd_explain  # noqa: E402


_ROUTER = {
    "schema_version": 1,
    "kernel": ["direct-answers", "no-cheap-questions"],
    "tier_1": [
        {
            "id": "architecture",
            "triggers": [
                {"keyword": "controller"},
                {"phrase": "structural decision"},
                {"path_prefix": ".augment/"},
            ],
            "routes_to": [],
        },
        {
            "id": "downstream-changes",
            "triggers": [{"keyword": "caller"}],
            "routes_to": ["skill:blast-radius-analyzer"],
        },
    ],
    "tier_2": [{"id": "skill-quality", "triggers": []}],
}


@pytest.fixture()
def project_root(tmp_path: Path) -> Path:
    dist_dir = tmp_path / "dist"
    dist_dir.mkdir(parents=True, exist_ok=True)
    (dist_dir / "router.json").write_text(json.dumps(_ROUTER), encoding="utf-8")
    presets_dir = tmp_path / ".agent-src.uncondensed" / "presets"
    presets_dir.mkdir(parents=True)
    (presets_dir / "balanced.yml").write_text(
        "preset:\n"
        "  id: balanced\n"
        "  cost: {daily_max_usd: 10.0, weekly_max_usd: 50.0,"
        " monthly_max_usd: 150.0}\n"
        "  autonomy: {default: auto}\n",
        encoding="utf-8",
    )
    profiles_dir = tmp_path / ".agent-src.uncondensed" / "profiles"
    profiles_dir.mkdir(parents=True)
    (profiles_dir / "developer.yml").write_text(
        "profile:\n  id: developer\n  preset: balanced\n",
        encoding="utf-8",
    )
    return tmp_path


def _run(argv: list[str]) -> int:
    return cmd_explain.main(argv)


def test_config_text_emits_profile_and_preset(
    project_root: Path, capsys: pytest.CaptureFixture[str],
) -> None:
    rc = _run(["config", "--project", str(project_root)])
    assert rc == 0
    out = capsys.readouterr().out
    assert "profile.id:" in out
    assert "preset.id:" in out


def test_config_json_payload_shape(
    project_root: Path, capsys: pytest.CaptureFixture[str],
) -> None:
    rc = _run(["config", "--project", str(project_root), "--json"])
    assert rc == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["project_root"] == str(project_root)
    assert set(payload["profile"]) >= {"id", "source", "preset_id"}
    assert set(payload["preset"]) >= {"id", "source", "overrides", "knobs"}
    assert set(payload["env"]) >= {
        "AGENT_CONFIG_PROFILE_ID", "AGENT_CONFIG_PRESET_ID",
    }


def test_rule_kernel_placement(
    project_root: Path, capsys: pytest.CaptureFixture[str],
) -> None:
    rc = _run(["rule", "direct-answers", "--project", str(project_root), "--json"])
    assert rc == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["tier"] == "kernel"
    assert payload["rule"] == "direct-answers"


def test_rule_tier_one_with_triggers(
    project_root: Path, capsys: pytest.CaptureFixture[str],
) -> None:
    rc = _run(["rule", "architecture", "--project", str(project_root), "--json"])
    assert rc == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["tier"] == "tier_1"
    assert len(payload["entry"]["triggers"]) == 3


def test_rule_unknown_returns_one(project_root: Path) -> None:
    rc = _run(["rule", "nope", "--project", str(project_root)])
    assert rc == 1


def test_route_keyword_match(
    project_root: Path, capsys: pytest.CaptureFixture[str],
) -> None:
    rc = _run(["route", "edit the controller", "--project", str(project_root), "--json"])
    assert rc == 0
    payload = json.loads(capsys.readouterr().out)
    ids = {m["id"] for m in payload["tier_1_matches"]}
    assert "architecture" in ids
    assert payload["kernel_always"] == _ROUTER["kernel"]


def test_route_path_prefix_match(
    project_root: Path, capsys: pytest.CaptureFixture[str],
) -> None:
    rc = _run(["route", "touch .augment/rules/foo.md", "--project", str(project_root), "--json"])
    assert rc == 0
    payload = json.loads(capsys.readouterr().out)
    assert any(m["reason"].startswith("path_prefix:") for m in payload["tier_1_matches"])


def test_route_no_match_returns_one(project_root: Path) -> None:
    rc = _run(["route", "totally unrelated text", "--project", str(project_root)])
    assert rc == 1


def test_subject_requires_target(project_root: Path) -> None:
    rc = _run(["rule", "--project", str(project_root)])
    assert rc == 2


def test_repo_root_smoke() -> None:
    rc = cmd_explain.main(["config", "--project", str(ROOT), "--json"])
    assert rc == 0
