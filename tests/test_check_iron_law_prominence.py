"""Tests for scripts/check_iron_law_prominence.py."""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location(
    "check_iron_law_prominence",
    ROOT / "scripts" / "check_iron_law_prominence.py",
)
assert SPEC and SPEC.loader
mod = importlib.util.module_from_spec(SPEC)
sys.modules["check_iron_law_prominence"] = mod
SPEC.loader.exec_module(mod)


def _write(tmp_path: Path, name: str, body: str) -> Path:
    p = tmp_path / name
    p.write_text(body, encoding="utf-8")
    return p


# --- clean cases -----------------------------------------------------------

def test_iron_law_first_h2_passes(tmp_path):
    p = _write(tmp_path, "good.md", (
        "# Title\n\n"
        "## The Iron Law\n\n"
        "RULE.\n\n"
        "## Other section\n"
    ))
    assert mod.scan_file(p) == []


def test_iron_law_second_h2_passes(tmp_path):
    p = _write(tmp_path, "good2.md", (
        "# Title\n\n"
        "## Setup context\n\n"
        "Why this matters.\n\n"
        "## Iron Law — never skip\n\n"
        "RULE.\n"
    ))
    assert mod.scan_file(p) == []


def test_no_iron_law_at_all_passes(tmp_path):
    p = _write(tmp_path, "no-iron.md", (
        "# Title\n\n"
        "## Section A\n\n"
        "## Section B\n"
    ))
    assert mod.scan_file(p) == []


def test_multiple_iron_laws_at_top_passes(tmp_path):
    p = _write(tmp_path, "multi.md", (
        "# Title\n\n"
        "## Iron Law 1 — Foo\n\n"
        "## Iron Law 2 — Bar\n\n"
        "## Other\n"
    ))
    assert mod.scan_file(p) == []


def test_iron_law_in_code_block_ignored(tmp_path):
    # A "## Iron Law" line inside a code fence must NOT be parsed as heading.
    p = _write(tmp_path, "fenced.md", (
        "# Title\n\n"
        "## Section A\n\n"
        "```\n## Iron Law (this is in code)\n```\n\n"
        "## Section B\n"
    ))
    assert mod.scan_file(p) == []


# --- violation cases -------------------------------------------------------

def test_iron_law_at_h3_fails(tmp_path):
    p = _write(tmp_path, "h3.md", (
        "# Title\n\n"
        "## Wrapper\n\n"
        "### The Iron Law — buried\n\n"
        "RULE.\n"
    ))
    violations = mod.scan_file(p)
    assert len(violations) == 1
    assert violations[0].kind == "deep_iron_law"
    assert "promote to H2" in violations[0].detail


def test_iron_law_buried_third_h2_fails(tmp_path):
    p = _write(tmp_path, "buried.md", (
        "# Title\n\n"
        "## Section A\n\n"
        "## Section B\n\n"
        "## Section C\n\n"
        "## The Iron Law\n\n"
        "RULE.\n"
    ))
    violations = mod.scan_file(p)
    assert len(violations) == 1
    assert violations[0].kind == "buried_iron_law"
    assert "first 2 H2 positions" in violations[0].detail


def test_h4_iron_law_also_fails(tmp_path):
    p = _write(tmp_path, "h4.md", (
        "# Title\n\n"
        "## Wrapper\n\n"
        "### Sub\n\n"
        "#### Iron Law — too deep\n\n"
        "RULE.\n"
    ))
    violations = mod.scan_file(p)
    assert len(violations) == 1
    assert violations[0].kind == "deep_iron_law"


# --- repository contract --------------------------------------------------

def test_shipped_rules_clean():
    """All currently shipped rules must pass — guards regressions."""
    rules_dir = ROOT / ".agent-src.uncompressed" / "rules"
    assert rules_dir.is_dir()
    all_violations: list = []
    for md in sorted(rules_dir.rglob("*.md")):
        all_violations.extend(mod.scan_file(md))
    assert all_violations == [], (
        "Shipped rules must keep Iron Laws at the top:\n  "
        + "\n  ".join(f"{v.file}:{v.line} — {v.detail}" for v in all_violations)
    )
