"""Eval fixtures for the adopted design-knowledge corpus (Step 2.5).

Representative queries against the REAL corpus + manifest — locks search
quality (sane design-system output) and the corpus-adoption decisions
(no draft.csv, no google-fonts.csv, provenance pinned).
"""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILL = REPO_ROOT / "src" / "skills" / "design-intelligence"
ENGINE = REPO_ROOT / "src" / "skills" / "corpus-grounding" / "scripts"
sys.path.insert(0, str(ENGINE))

import decision_engine  # noqa: E402
import schema_validator  # noqa: E402


@pytest.fixture(scope="module")
def manifest() -> dict:
    return schema_validator.load_manifest(SKILL / "data" / "manifest.json")


# ------------------------------------------------------------- adoption shape
def test_adopted_files_match_council_decision() -> None:
    data = SKILL / "data"
    expected = {
        "ui-reasoning.csv", "products.csv", "colors.csv", "styles.csv",
        "typography.csv", "charts.csv", "landing.csv", "icons.csv",
        "ux-guidelines.csv", "react-performance.csv", "app-interface.csv",
    }
    present = {p.name for p in data.glob("*.csv")}
    assert expected <= present
    # Council fork B2 + dead-backup skip (ADR-061 §8).
    assert "google-fonts.csv" not in present
    assert "draft.csv" not in present


def test_manifest_provenance_is_pinned(manifest: dict) -> None:
    up = manifest["upstream"]
    assert up["sha"] == "b7e3af80f6e331f6fb456667b82b12cade7c9d35"
    assert manifest["owner"] and manifest["refresh_cadence"]


def test_corpus_carries_no_project_identifiers() -> None:
    """Portability pass (Step 2.2): generic design knowledge only."""
    forbidden = ("event4u", "galawork", "agent-config", "mathiasberg")
    for csv_path in SKILL.glob("data/**/*.csv"):
        blob = csv_path.read_text(encoding="utf-8", errors="replace").lower()
        for marker in forbidden:
            assert marker not in blob, f"{csv_path.name} leaks {marker!r}"


# ------------------------------------------------------------- search quality
@pytest.mark.parametrize(
    ("query", "domain", "column", "expect_any"),
    [
        ("fintech SaaS dashboard", "product", "Product Type", ("fintech", "saas", "dashboard")),
        ("luxury e-commerce", "color", "Product Type", ("luxury", "e-commerce", "ecommerce")),
        ("hero section with pricing and cta", "landing", "Pattern Name", ("pricing", "cta", "hero")),
        ("glassmorphism frosted dashboard", "style", "Style Category", ("glass",)),
        ("trend over time comparison", "chart", "Best Chart Type", ("line", "bar", "area")),
    ],
)
def test_representative_queries_return_sane_rows(
    manifest: dict, query: str, domain: str, column: str, expect_any: tuple
) -> None:
    result = decision_engine.search_domain(manifest, query, domain)
    assert result["count"] >= 1, f"no hits for {query!r} in {domain}"
    top = str(result["results"][0].get(column, "")).lower()
    assert any(marker in top for marker in expect_any), (
        f"{query!r} → top {column}={top!r}, expected one of {expect_any}"
    )


def test_auto_domain_detection_routes_sensibly(manifest: dict) -> None:
    assert decision_engine.detect_domain(manifest, "semantic color tokens") == "color"
    assert decision_engine.detect_domain(manifest, "react rerender memo") == "react"
    assert decision_engine.detect_domain(manifest, "icon set for navigation") in ("icons", "ux")


def test_grounded_design_system_is_sane(manifest: dict) -> None:
    grounded = decision_engine.ground(manifest, "fintech SaaS dashboard")
    assert "fintech" in grounded["category"].lower() or "saas" in grounded["category"].lower()
    sel = grounded["selections"]
    # Color tokens come back as hex values (WCAG-adjusted shadcn-style set).
    primary = (sel["color"]["best"] or {}).get("Primary", "")
    assert primary.startswith("#"), f"expected hex primary, got {primary!r}"
    # Typography proposes a real pairing.
    assert (sel["typography"]["best"] or {}).get("Heading Font")
    # Contract invariants.
    assert grounded["confidence"]["label"] in ("high", "medium", "low")
    assert isinstance(grounded["evidence_gap"], list)


def test_reasoning_rules_parse_for_every_row() -> None:
    """All 161 ui-reasoning Decision_Rules cells must be valid JSON."""
    rows = list(csv.DictReader(open(SKILL / "data" / "ui-reasoning.csv", encoding="utf-8")))
    assert len(rows) >= 150
    bad = []
    for row in rows:
        cell = row.get("Decision_Rules", "") or "{}"
        try:
            json.loads(cell)
        except json.JSONDecodeError:
            bad.append(row.get("UI_Category"))
    assert not bad, f"non-JSON Decision_Rules for: {bad[:5]}"
