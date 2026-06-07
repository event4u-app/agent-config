"""Engine suite for the shared corpus-grounding layer (Step 1.5).

Covers: BM25 ranking · structured filtering · retriever registry ·
domain detection · manifest schema validation · decision-rule evaluation ·
grounded-output generation (confidence + evidence-gap invariants) ·
persistence opt-in.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
ENGINE = REPO_ROOT / "src" / "skills" / "corpus-grounding" / "scripts"
sys.path.insert(0, str(ENGINE))

import bm25_search  # noqa: E402
import decision_engine  # noqa: E402
import schema_validator  # noqa: E402


# ------------------------------------------------------------------ fixtures
def _write_corpus(tmp_path: Path) -> Path:
    """A small two-domain corpus with a reasoning map."""
    (tmp_path / "styles.csv").write_text(
        "Style Category,Keywords,Best For,Effects\n"
        "Minimalism,clean whitespace professional saas,Business tools,Subtle fades\n"
        "Glassmorphism,frosted translucent dashboard data,Data-heavy dashboards,Blur layers\n"
        "Brutalism,raw bold statement experimental,Portfolios,Hard shadows\n",
        encoding="utf-8",
    )
    (tmp_path / "products.csv").write_text(
        "Product Type,Keywords,Recommendation\n"
        "Fintech Dashboard,fintech banking finance dashboard,Trust-first design\n"
        "Gaming Platform,gaming esports neon arcade,Energy-first design\n",
        encoding="utf-8",
    )
    (tmp_path / "reasoning.csv").write_text(
        'No,UI_Category,Recommended_Pattern,Style_Priority,Decision_Rules,Anti_Patterns,Severity\n'
        '1,Fintech Dashboard,Data Grid + KPIs,Minimalism + Glassmorphism,'
        '"{""if_data_heavy"": ""add-glassmorphism"", ""if_consumer_facing"": ""soften-palette""}",'
        'Neon colors + Playful mascots,HIGH\n',
        encoding="utf-8",
    )
    (tmp_path / "stacks").mkdir()
    (tmp_path / "stacks" / "react.csv").write_text(
        "Category,Guideline,Description,Do,Don't,Severity\n"
        "Performance,Memoize expensive lists,Large lists rerender,Use memo,Inline lambdas,HIGH\n",
        encoding="utf-8",
    )
    manifest = {
        "manifest_version": 1,
        "domain": "test-design",
        "tier": "conditional-grounding",
        "retriever": "bm25",
        "default_domain": "style",
        "domains": {
            "style": {
                "file": "styles.csv",
                "search_cols": ["Style Category", "Keywords", "Best For"],
                "output_cols": ["Style Category", "Best For", "Effects"],
                "max_results": 3,
            },
            "product": {
                "file": "products.csv",
                "search_cols": ["Product Type", "Keywords"],
                "output_cols": ["Product Type", "Recommendation"],
                "max_results": 1,
            },
        },
        "detect": {
            "style": ["minimalism", "glassmorphism", "style"],
            "product": ["fintech", "gaming", "dashboard"],
        },
        "stacks": {"react": "stacks/react.csv"},
        "stack_cols": {
            "search_cols": ["Category", "Guideline", "Description"],
            "output_cols": ["Category", "Guideline", "Do", "Don't", "Severity"],
        },
        "reasoning": {
            "file": "reasoning.csv",
            "category_domain": "product",
            "category_column": "Product Type",
            "match_column": "UI_Category",
            "rules_column": "Decision_Rules",
            "priority_column": "Style_Priority",
            "priority_domain": "style",
            "name_columns": {"style": "Style Category"},
            "plan": {"style": 3, "product": 1},
        },
        "owner": "test-owner",
        "refresh_cadence": "quarterly",
        "upstream": {"repo": "local", "sha": "0", "last_checked": "2026-06-07"},
    }
    mpath = tmp_path / "manifest.json"
    mpath.write_text(json.dumps(manifest), encoding="utf-8")
    return mpath


@pytest.fixture()
def manifest(tmp_path: Path) -> dict:
    return schema_validator.load_manifest(_write_corpus(tmp_path))


# ------------------------------------------------------------------ BM25
def test_bm25_ranks_relevant_doc_first() -> None:
    bm25 = bm25_search.BM25()
    docs = [
        "frosted translucent dashboard data layers",
        "clean whitespace professional minimal",
        "raw bold experimental statement",
    ]
    bm25.fit(docs)
    ranked = bm25.score("translucent dashboard")
    assert ranked[0][0] == 0
    assert ranked[0][1] > 0


def test_bm25_tokenizer_drops_short_and_punctuation() -> None:
    assert bm25_search.BM25.tokenize("A B, the-cat! is on") == ["the", "cat"]


def test_bm25_empty_corpus_is_safe() -> None:
    bm25 = bm25_search.BM25()
    bm25.fit([])
    assert bm25.score("anything") == []


# ------------------------------------------------------------------ filters
def test_structured_filter_narrows_before_ranking(tmp_path: Path) -> None:
    mpath = _write_corpus(tmp_path)
    m = schema_validator.load_manifest(mpath)
    result = decision_engine.search_domain(
        m, "dashboard", "style", filters={"Best For": "Portfolios"}
    )
    names = [r["Style Category"] for r in result["results"]]
    assert names in ([], ["Brutalism"])  # never the unfiltered top hit
    assert result["filtered_from"] == 3


def test_filter_list_values_are_ored() -> None:
    rows = [{"Severity": "HIGH"}, {"Severity": "LOW"}, {"Severity": "MEDIUM"}]
    out = bm25_search.apply_filters(rows, {"Severity": ["high", "medium"]})
    assert [r["Severity"] for r in out] == ["HIGH", "MEDIUM"]


def test_unknown_retriever_raises(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="Unknown retriever"):
        bm25_search.search_rows(
            tmp_path / "x.csv", ["a"], ["a"], "q", retriever="embeddings"
        )


# ------------------------------------------------------------------ detection
def test_detect_domain_routes_by_keyword(manifest: dict) -> None:
    assert decision_engine.detect_domain(manifest, "glassmorphism please") == "style"
    assert decision_engine.detect_domain(manifest, "a fintech thing") == "product"


def test_detect_domain_falls_back_to_default(manifest: dict) -> None:
    assert decision_engine.detect_domain(manifest, "zzz unrelated") == "style"


# ------------------------------------------------------------------ schema
def test_manifest_validation_catches_violations() -> None:
    errors = schema_validator.validate_manifest(
        {
            "manifest_version": 1,
            "domain": "x",
            "tier": "lookup-only",
            "domains": {"a": {"file": "a.csv", "search_cols": ["c"], "output_cols": ["c"]}},
            "reasoning": {"file": "r.csv", "match_column": "m", "plan": {"a": 1}},
        }
    )
    joined = " ".join(errors)
    assert "lookup-only" in joined  # reasoning illegal on lookup-only
    assert "owner" in joined  # provenance discipline (ADR-061 §6)


def test_manifest_rejects_path_escapes(manifest: dict) -> None:
    with pytest.raises(schema_validator.ManifestError, match="manifest-relative"):
        schema_validator.resolve_data_path(manifest, "../outside.csv")
    with pytest.raises(schema_validator.ManifestError, match="manifest-relative"):
        schema_validator.resolve_data_path(manifest, "/etc/passwd")


def test_load_manifest_raises_on_unknown_plan_domain(tmp_path: Path) -> None:
    mpath = _write_corpus(tmp_path)
    data = json.loads(mpath.read_text())
    data["reasoning"]["plan"]["nope"] = 1
    mpath.write_text(json.dumps(data))
    with pytest.raises(schema_validator.ManifestError, match="unknown domain"):
        schema_validator.load_manifest(mpath)


# ------------------------------------------------------------------ rules
def test_evaluate_rules_matches_query_tokens() -> None:
    rules = {"if_data_heavy": "add-glassmorphism", "if_consumer_facing": "soften"}
    out = decision_engine.evaluate_rules(rules, "a very data heavy admin tool")
    assert out["matched"] == {"if_data_heavy": "add-glassmorphism"}
    assert "if_consumer_facing" in out["unmatched"]


def test_evaluate_rules_matches_context_flags() -> None:
    rules = {"if_consumer_facing": "soften"}
    out = decision_engine.evaluate_rules(rules, "irrelevant", {"consumer_facing": True})
    assert out["matched"] == {"if_consumer_facing": "soften"}


# ------------------------------------------------------------------ grounding
def test_ground_produces_contract_shape(manifest: dict) -> None:
    grounded = decision_engine.ground(manifest, "fintech dashboard data heavy")
    assert grounded["category"] == "Fintech Dashboard"
    assert grounded["rules_evaluation"]["matched"] == {
        "if_data_heavy": "add-glassmorphism"
    }
    # priority re-ranking: Style_Priority names Minimalism first
    assert grounded["selections"]["style"]["best"]["Style Category"] == "Minimalism"
    # contract invariants
    assert grounded["confidence"]["label"] in ("high", "medium", "low")
    assert isinstance(grounded["evidence_gap"], list) and grounded["evidence_gap"]


def test_ground_reports_evidence_gap_on_category_miss(manifest: dict) -> None:
    grounded = decision_engine.ground(manifest, "zzz qqq xxyzzy")
    assert grounded["category"] == "General"
    assert any("falls back" in g or "default category" in g for g in grounded["evidence_gap"])
    assert grounded["confidence"]["label"] == "low"


def test_ground_refuses_lookup_only_manifests(manifest: dict) -> None:
    manifest = dict(manifest)
    manifest.pop("reasoning")
    with pytest.raises(schema_validator.ManifestError, match="lookup-only|no reasoning"):
        decision_engine.ground(manifest, "q")


# ------------------------------------------------------------------ stack axis
def test_stack_search(manifest: dict) -> None:
    result = decision_engine.search_stack(manifest, "memoize list rerender", "react")
    assert result["count"] == 1
    assert result["results"][0]["Severity"] == "HIGH"
    result = decision_engine.search_stack(manifest, "q", "vue")
    assert "Unknown stack" in result["error"]


# ------------------------------------------------------------------ persist
def test_persist_is_opt_in_and_contained(manifest: dict, tmp_path: Path) -> None:
    grounded = decision_engine.ground(manifest, "fintech dashboard")
    out = tmp_path / "consumer-project"
    info = decision_engine.persist_grounding(grounded, out, "My App", page="settings")
    master = out / "design-system" / "my-app" / "MASTER.md"
    page = out / "design-system" / "my-app" / "pages" / "settings.md"
    assert master.exists() and page.exists()
    assert set(info["created_files"]) == {str(master), str(page)}
    text = master.read_text()
    assert "Evidence gap" in text and "Confidence" in text.replace("**", "")
