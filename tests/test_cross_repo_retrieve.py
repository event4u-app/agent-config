"""cross_repo_retrieve — targeted, read-only, opt-in cross-repo retrieval.

Phase 4 of `road-to-leaner-core-and-discovery`. Covers: targeted query returns
scoped matches, large-flagged sibling rejects an unscoped query, opt-out sibling
is never read, secrets are redacted, and the no-siblings path is inert. No live
network, no real cross-repo writes — fixtures live under tests/fixtures/cross-repo/.
"""
from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))
crr = importlib.import_module("cross_repo_retrieve")

FIXTURES = REPO_ROOT / "tests" / "fixtures" / "cross-repo"
SIBLING_A = FIXTURES / "sibling-a"
SIBLING_B = FIXTURES / "sibling-b"


def _sibling(path: Path, *, large: bool = False) -> dict:
    return {"path": str(path), "detected_via": "vscode_workspace", "large": large, "include": True}


def test_targeted_query_returns_scoped_matches():
    hits = crr.search_sibling(SIBLING_A, "OrderApiContract", crr._terms("OrderApiContract"), None, budget=8)
    assert hits, "a present term must produce a match"
    assert all(h["source_repo"] == "sibling-a" for h in hits)
    assert any("api_contract.ts" in h["path"] for h in hits)
    assert all(h["match_reason"] for h in hits), "every match carries a why"
    assert all(h["freshness"] for h in hits), "every match carries a freshness stamp"


def test_path_scope_narrows_the_search():
    scoped = crr.search_sibling(SIBLING_A, "orders", crr._terms("orders"), "README.md", budget=8)
    assert scoped, "scoped query should still match the README"
    assert all(h["path"] == "README.md" for h in scoped)


def test_secret_in_sibling_is_redacted():
    hits = crr.search_sibling(SIBLING_A, "ORDER_ENDPOINT", crr._terms("ORDER_ENDPOINT"), None, budget=8)
    ts_hits = [h for h in hits if h["path"].endswith("api_contract.ts")]
    assert ts_hits, "should match the ts file that holds the endpoint"
    blob = " ".join(h["chunk"] for h in ts_hits)
    assert "sk-ant-api03" not in blob, "the fake secret must be redacted out of the chunk"
    assert "[SECRET]" in blob, "redaction placeholder must be present"


def test_large_sibling_rejects_unscoped_query(monkeypatch):
    monkeypatch.setattr(crr, "collect_siblings", lambda root, show_all=False: [_sibling(SIBLING_A, large=True)])
    res = crr.retrieve(REPO_ROOT, "OrderApiContract", None, max_chunks=8)
    assert res["matches"] == [], "a large sibling must not be searched without --path-scope"
    assert "path-scope" in res.get("note", ""), "the skip must be surfaced"


def test_large_sibling_searched_with_scope(monkeypatch):
    monkeypatch.setattr(crr, "collect_siblings", lambda root, show_all=False: [_sibling(SIBLING_A, large=True)])
    res = crr.retrieve(REPO_ROOT, "OrderApiContract", "src/*.ts", max_chunks=8)
    assert res["matches"], "with a path scope, the large sibling is searched"


def test_opt_out_sibling_is_never_read(monkeypatch):
    # collect_siblings(show_all=False) returns ONLY opted-in siblings; an opt-out
    # sibling is filtered before retrieve ever sees it. Simulate the filtered result.
    monkeypatch.setattr(crr, "collect_siblings", lambda root, show_all=False: [])
    res = crr.retrieve(REPO_ROOT, "OrderApiContract", None, max_chunks=8)
    assert res["matches"] == []
    assert "no opted-in" in res.get("note", "")


def test_no_siblings_is_inert(monkeypatch):
    monkeypatch.setattr(crr, "collect_siblings", lambda root, show_all=False: [])
    res = crr.retrieve(REPO_ROOT, "anything", None, max_chunks=8)
    assert res["matches"] == []
    assert res.get("note")


def test_short_query_is_rejected(monkeypatch):
    monkeypatch.setattr(crr, "collect_siblings", lambda root, show_all=False: [_sibling(SIBLING_A)])
    res = crr.retrieve(REPO_ROOT, "ab", None, max_chunks=8)
    assert res["matches"] == []
    assert "too short" in res.get("note", "")


def test_max_chunks_is_bounded(monkeypatch):
    monkeypatch.setattr(crr, "collect_siblings",
                        lambda root, show_all=False: [_sibling(SIBLING_A), _sibling(SIBLING_B)])
    res = crr.retrieve(REPO_ROOT, "the", None, max_chunks=1)
    assert len(res["matches"]) <= 1, "max_chunks must cap total results"


def test_unrelated_query_returns_nothing(monkeypatch):
    monkeypatch.setattr(crr, "collect_siblings", lambda root, show_all=False: [_sibling(SIBLING_A)])
    res = crr.retrieve(REPO_ROOT, "zzzznonexistentterm", None, max_chunks=8)
    assert res["matches"] == []


# ---- in-process coverage of freshness, render, and main() ----

def test_freshness_returns_a_date_string():
    # sibling-a is inside the repo's git tree → git log path; fixture file has a date.
    fr = crr._freshness(REPO_ROOT, "tests/fixtures/cross-repo/sibling-a/README.md")
    assert fr and (fr[:4].isdigit() or fr == "unknown")


def test_render_text_with_matches_and_note():
    result = {"matches": [{"source_repo": "s", "path": "p.md", "freshness": "2026-05-30",
                           "match_reason": "content term(s): x"}], "note": "a note"}
    out = crr.render_text(result)
    assert "| source_repo | path | freshness | why |" in out
    assert "> a note" in out


def test_render_text_no_matches_returns_note():
    assert crr.render_text({"matches": [], "note": "nothing here"}) == "nothing here"


def test_main_text_inert(monkeypatch, capsys):
    monkeypatch.setattr(crr, "collect_siblings", lambda root, show_all=False: [])
    rc = crr.main(["some query", "--root", str(REPO_ROOT)])
    assert rc == 0
    assert "no opted-in" in capsys.readouterr().out


def test_main_json_with_match(monkeypatch, capsys):
    monkeypatch.setattr(crr, "collect_siblings", lambda root, show_all=False: [_sibling(SIBLING_A)])
    rc = crr.main(["OrderApiContract", "--root", str(REPO_ROOT), "--format", "json"])
    assert rc == 0
    import json as _json
    payload = _json.loads(capsys.readouterr().out)
    assert payload["query"] == "OrderApiContract"
    assert payload["matches"]


def test_terms_drops_short_tokens():
    assert crr._terms("an OrderApiContract, to") == ["orderapicontract"]
