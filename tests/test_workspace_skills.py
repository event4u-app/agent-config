"""Tests for ``src/cli/python/workspace_skills.py`` (ADR-066 skill pre-render)."""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = REPO_ROOT / "src" / "cli" / "python" / "workspace_skills.py"


def _load():
    spec = importlib.util.spec_from_file_location("workspace_skills", MODULE_PATH)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    sys.modules["workspace_skills"] = mod
    spec.loader.exec_module(mod)
    return mod


WS = _load()


@pytest.fixture
def fake_skills(tmp_path, monkeypatch):
    """Point SKILL_SOURCES at a temp skills root with one fixture skill."""
    root = tmp_path / "skills"
    (root / "demo-skill").mkdir(parents=True)
    (root / "demo-skill" / "SKILL.md").write_text(
        "---\nname: demo-skill\ndescription: \"Does a demo thing.\"\ntier: senior\n---\n\n"
        "# Demo Skill\n\nStep 1. Do the thing.\nStep 2. Verify it.\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(WS, "SKILL_SOURCES", [root])
    return WS


def test_resolve_found_strips_frontmatter(fake_skills):
    r = fake_skills.resolve("demo-skill")
    assert r["found"] is True
    assert r["name"] == "demo-skill"
    assert r["description"] == "Does a demo thing."
    assert "Step 1. Do the thing." in r["body"]
    assert "tier: senior" not in r["body"]          # frontmatter stripped


def test_resolve_missing_is_graceful(fake_skills):
    r = fake_skills.resolve("no-such-skill")
    assert r["found"] is False and "not found" in r["note"]


def test_resolve_rejects_traversal(fake_skills):
    for bad in ("../../etc/passwd", "../demo-skill", "a/b", "Demo-Skill", ""):
        r = fake_skills.resolve(bad)
        assert r["found"] is False                  # never escapes the root


def test_resolve_section_found(fake_skills):
    sec = fake_skills.resolve_section("demo-skill")
    assert "## Skill context: demo-skill" in sec
    assert "_Does a demo thing._" in sec
    assert "Step 1. Do the thing." in sec


def test_resolve_section_missing_is_note(fake_skills):
    sec = fake_skills.resolve_section("nope")
    assert "## Skill context" in sec
    assert "not found" in sec
    assert "Step 1" not in sec


def test_size_cap(fake_skills, tmp_path, monkeypatch):
    big = (tmp_path / "skills" / "big-skill")
    big.mkdir()
    (big / "SKILL.md").write_text("---\nname: big-skill\n---\n\n" + ("x" * 200_000),
                                  encoding="utf-8")
    monkeypatch.setattr(fake_skills, "MAX_BODY_BYTES", 1024)
    r = fake_skills.resolve("big-skill")
    assert r["found"] and "truncated" in r["body"] and len(r["body"]) < 2000


def test_cli_resolve_json_and_section(fake_skills, capsys):
    assert fake_skills.main(["resolve", "demo-skill", "--format", "json"]) == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload["found"] and payload["name"] == "demo-skill"
    assert fake_skills.main(["resolve", "demo-skill"]) == 0
    assert "## Skill context: demo-skill" in capsys.readouterr().out


def test_resolves_a_real_shipped_skill():
    """Against the actual repo skills root — proves the parents[3] root + the
    real SKILL.md frontmatter shape resolve (the bug the smoke test caught)."""
    r = WS.resolve("doc-coauthoring")
    assert r["found"] is True
    assert r["name"] == "doc-coauthoring"
    assert len(r["body"]) > 100
