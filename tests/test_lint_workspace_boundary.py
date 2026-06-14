#!/usr/bin/env python3
"""Tests for scripts/lint_workspace_boundary.py (ADR-095).

Run: python3 -m pytest tests/test_lint_workspace_boundary.py -q
"""
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "src" / "scripts"))

import lint_workspace_boundary as L  # noqa: E402


def test_real_workspace_surface_holds():
    """The shipped workspace surface must pass — day-one state is zero
    violations (ADR-095 survey)."""
    assert L.main(["--quiet"]) == 0


def test_intra_workspace_and_stdlib_allowed():
    for ok in ("workspace_skills", "workspace_secrets", "secrets", "yaml",
               "keyring", "cryptography.hazmat", "packaging", "json", "csv"):
        assert L._forbidden_reason(ok) is None, ok


def test_forbidden_domains_flagged():
    assert L._forbidden_reason("condense")
    assert L._forbidden_reason("skill_linter")
    assert L._forbidden_reason("build_discovery_manifest")
    assert L._forbidden_reason("profiles")
    assert L._forbidden_reason("ai_video.adapters")
    assert L._forbidden_reason("mcp")


def test_check_file_flags_forbidden_import(tmp_path):
    mod = tmp_path / "workspace_demo.py"
    mod.write_text("import condense\nimport workspace_secrets\n", encoding="utf-8")
    violations = L.check_file(mod)
    assert len(violations) == 1
    assert "condense" in violations[0]
    assert "not-owned domain" in violations[0]


def test_boundary_exception_pragma_allows(tmp_path):
    mod = tmp_path / "workspace_demo.py"
    mod.write_text(
        "import condense  # boundary-exception: one-off hand-off render\n",
        encoding="utf-8",
    )
    assert L.check_file(mod) == []


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))
