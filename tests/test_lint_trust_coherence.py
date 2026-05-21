"""Tests for ``scripts/lint_trust_coherence.py``.

Covers the three Phase-5.4 invariants:

1. Packs declaring ``advisory``/``restricted`` artefacts ship a
   ``*safety-floor*`` rule.
2. Every artefact with ``trust.human_review_required: true`` carries
   the HRR banner marker in its compiled output under ``.agent-src/``.
3. Rules listed in ``router.json`` ``kernel[]`` declare
   ``trust.level: core``.

Strategy: build a self-contained fixture (manifest JSON + router JSON
+ compiled tree) under ``tmp_path`` and monkeypatch the module
constants so the lint walks the fixture, not the live repo.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import lint_trust_coherence as mod  # noqa: E402


_BANNER = mod._BANNER_MARKER


def _write_manifest(path: Path, artefacts, packs) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps({"artefacts": artefacts, "packs": packs}, indent=2),
        encoding="utf-8",
    )


def _write_router(path: Path, kernel: list[str]) -> None:
    path.write_text(json.dumps({"kernel": kernel}), encoding="utf-8")


def _write_compiled(root: Path, rel: str, body: str) -> None:
    target = root / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(body, encoding="utf-8")


@pytest.fixture
def fixture(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Set up a minimal fixture with one core rule, one HRR safety floor."""
    manifest = tmp_path / "dist" / "discovery" / "discovery-manifest.json"
    router = tmp_path / "router.json"
    compiled = tmp_path / ".agent-src"

    _write_manifest(
        manifest,
        artefacts=[
            {
                "category": "rule",
                "name": None,
                "path": "packages/core/.agent-src.uncompressed/rules/scope-control.md",
                "packs": ["engineering-base"],
                "trust": {
                    "level": "core",
                    "confidence": "high",
                    "human_review_required": False,
                },
            },
            {
                "category": "rule",
                "name": None,
                "path": "packages/pack-finance-basic/.agent-src.uncompressed/rules/finance-safety-floor.md",
                "packs": ["finance-basic"],
                "trust": {
                    "level": "advisory",
                    "confidence": "high",
                    "human_review_required": True,
                },
            },
        ],
        packs=[
            {
                "id": "finance-basic",
                "trust_summary": {"advisory": 1, "core": 0, "professional": 0},
            },
            {"id": "engineering-base", "trust_summary": {"core": 1}},
        ],
    )
    _write_router(router, ["scope-control"])
    _write_compiled(
        compiled,
        "rules/finance-safety-floor.md",
        f"{_BANNER}\n> HUMAN REVIEW REQUIRED · trust: advisory · owner: finance\n\n# Body\n",
    )
    _write_compiled(compiled, "rules/scope-control.md", "# scope-control\n")

    monkeypatch.setattr(mod, "ROOT", tmp_path)
    monkeypatch.setattr(mod, "MANIFEST", manifest)
    monkeypatch.setattr(mod, "ROUTER", router)
    monkeypatch.setattr(mod, "COMPILED_SRC", compiled)
    return tmp_path


def test_clean_fixture_passes(fixture):
    assert mod.main(["--quiet"]) == 0


def test_pack_missing_safety_floor_fails(fixture, capsys):
    manifest_path = fixture / "dist" / "discovery" / "discovery-manifest.json"
    data = json.loads(manifest_path.read_text("utf-8"))
    # Drop the safety-floor artefact entirely → finance-basic now has an
    # advisory artefact count in its summary but no floor rule.
    data["artefacts"] = [
        a for a in data["artefacts"] if "safety-floor" not in a["path"]
    ]
    manifest_path.write_text(json.dumps(data), encoding="utf-8")
    assert mod.main(["--quiet"]) == 1
    err = capsys.readouterr().err
    assert "pack `finance-basic`" in err
    assert "safety-floor" in err


def test_missing_banner_in_compiled_output_fails(fixture, capsys):
    compiled = fixture / ".agent-src" / "rules" / "finance-safety-floor.md"
    compiled.write_text("# finance-safety-floor (no banner)\n", encoding="utf-8")
    assert mod.main(["--quiet"]) == 1
    err = capsys.readouterr().err
    assert "missing the HRR banner" in err


def test_missing_compiled_output_fails(fixture, capsys):
    (fixture / ".agent-src" / "rules" / "finance-safety-floor.md").unlink()
    assert mod.main(["--quiet"]) == 1
    err = capsys.readouterr().err
    assert "compiled output" in err and "missing" in err


def test_kernel_rule_not_core_fails(fixture, capsys):
    manifest_path = fixture / "dist" / "discovery" / "discovery-manifest.json"
    data = json.loads(manifest_path.read_text("utf-8"))
    for a in data["artefacts"]:
        if a["path"].endswith("scope-control.md"):
            a["trust"]["level"] = "advisory"
    manifest_path.write_text(json.dumps(data), encoding="utf-8")
    assert mod.main(["--quiet"]) == 1
    err = capsys.readouterr().err
    assert "kernel rule `scope-control`" in err
    assert "trust.level=`advisory`" in err


def test_kernel_rule_missing_from_manifest_fails(fixture, capsys):
    router_path = fixture / "router.json"
    _write_router(router_path, ["scope-control", "nonexistent-rule"])
    assert mod.main(["--quiet"]) == 1
    err = capsys.readouterr().err
    assert "kernel rule `nonexistent-rule`" in err
    assert "no matching artefact" in err


def test_missing_manifest_raises_systemexit(tmp_path, monkeypatch):
    monkeypatch.setattr(mod, "MANIFEST", tmp_path / "nope.json")
    monkeypatch.setattr(mod, "ROUTER", tmp_path / "router.json")
    with pytest.raises(SystemExit):
        mod.main(["--quiet"])
