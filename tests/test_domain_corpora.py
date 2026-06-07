"""Eval locks for the cross-domain corpora (Phase 9): security / API /
DB-tuning / a11y. Each ships a valid manifest (owner + cadence + upstream
pin engine-enforced) and answers representative queries sanely.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILLS = REPO_ROOT / "src" / "skills"
sys.path.insert(0, str(SKILLS / "corpus-grounding" / "scripts"))

import decision_engine  # noqa: E402
import schema_validator  # noqa: E402

MANIFESTS = {
    "security": SKILLS / "threat-modeling" / "data" / "manifest.json",
    "api": SKILLS / "api-design" / "data" / "manifest.json",
    "db": SKILLS / "database" / "data" / "manifest.json",
    "a11y": SKILLS / "accessibility-auditor" / "data" / "manifest.json",
}


@pytest.fixture(scope="module")
def manifests() -> dict:
    return {k: schema_validator.load_manifest(p) for k, p in MANIFESTS.items()}


def test_every_corpus_declares_governance(manifests: dict) -> None:
    """Gate 2 / ADR-061 §6: owner + cadence + upstream pin per corpus."""
    for name, m in manifests.items():
        assert m["owner"], name
        assert m["refresh_cadence"], name
        up = m["upstream"]
        assert up["repo"] and up["sha"] and up["last_checked"], name


# ----------------------------------------------------------------- security
def test_security_grounding_routes_surface_to_threats(manifests: dict) -> None:
    g = decision_engine.ground(
        manifests["security"],
        "file upload endpoint accepting user images and url import",
    )
    assert g["category"] == "file-upload"
    threats = [g["selections"]["threats"]["best"]] + g["selections"]["threats"]["alternatives"]
    names = " ".join(str(t.get("Threat", "")) for t in threats if t)
    assert "SSRF" in names or "Malicious file" in names
    best = g["selections"]["threats"]["best"]
    # Every threat row carries controls + negative tests + a source ref.
    assert best["Required Controls"] and best["Negative Tests"]
    assert any(ref in best["Source Refs"] for ref in ("CWE", "ATT&CK", "OWASP"))


def test_security_tenancy_rows_cover_cross_tenant(manifests: dict) -> None:
    r = decision_engine.search_domain(
        manifests["security"], "cross tenant read unscoped query", "threats"
    )
    assert r["count"] >= 1
    assert "tenancy" in r["results"][0]["Surface Class"]


# ----------------------------------------------------------------- api
@pytest.mark.parametrize(
    ("query", "concern"),
    [
        ("paginate a large activity feed", "Pagination"),
        ("retry safe payment creation duplicate", "Idempotency"),
        ("error response format validation", "Error shape"),
        ("long running export job status", "Async operations"),
    ],
)
def test_api_corpus_answers_core_concerns(manifests: dict, query: str, concern: str) -> None:
    r = decision_engine.search_domain(manifests["api"], query)
    assert r["count"] >= 1
    tops = [row["Concern"] for row in r["results"]]
    assert concern in tops, f"{query!r} → {tops}"
    row = r["results"][tops.index(concern)]
    assert row["Recommended Pattern"] and row["Docs URL"].startswith("https://")


# ----------------------------------------------------------------- db
@pytest.mark.parametrize(
    ("query", "symptom_marker"),
    [
        ("OFFSET deep pagination slow", "deep offset"),
        ("hundreds of identical queries per request orm", "N+1"),
        ("deadlock on hot counter row", "contention"),
        ("LIKE contains wildcard search slow", "LIKE"),
    ],
)
def test_db_corpus_maps_symptom_to_strategy(manifests: dict, query: str, symptom_marker: str) -> None:
    r = decision_engine.search_domain(manifests["db"], query)
    assert r["count"] >= 1
    blob = " ".join(row["Symptom"] for row in r["results"])
    assert symptom_marker.lower() in blob.lower(), f"{query!r} → {blob}"
    assert r["results"][0]["Verification"]  # every row names its probe


# ----------------------------------------------------------------- a11y
@pytest.mark.parametrize(
    ("query", "component"),
    [
        ("modal dialog focus trap", "Modal dialog"),
        ("autocomplete search suggestions keyboard", "Combobox / autocomplete"),
        ("toast notification announce", "Toast / status message"),
        ("sortable data table headers", "Data table"),
    ],
)
def test_a11y_corpus_returns_apg_patterns(manifests: dict, query: str, component: str) -> None:
    r = decision_engine.search_domain(manifests["a11y"], query)
    assert r["count"] >= 1
    tops = [row["Component"] for row in r["results"]]
    assert component in tops, f"{query!r} → {tops}"
    row = r["results"][tops.index(component)]
    assert "w3.org" in row["Docs URL"]
    assert "WCAG" in row["WCAG Refs"] or row["WCAG Refs"].startswith(("1.", "2.", "3.", "4."))
