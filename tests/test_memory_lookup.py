"""Tests for scripts/memory_lookup.py — file-based retrieval fallback."""

from __future__ import annotations

import json
import os
import sys
import textwrap
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src" / "scripts"))
import memory_lookup  # noqa: E402


def _chdir(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.chdir(tmp_path)
    # Ensure the module picks up the new cwd-based paths.
    monkeypatch.setattr(memory_lookup, "MEMORY_ROOT",
                        Path("agents/memory"))
    monkeypatch.setattr(memory_lookup, "INTAKE_ROOT",
                        Path("agents/memory/intake"))
    monkeypatch.setattr(memory_lookup, "KNOWLEDGE_ROOT",
                        Path("agents/memory/knowledge"))


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(textwrap.dedent(content), encoding="utf-8")


def test_no_memory_dir_returns_empty(tmp_path, monkeypatch):
    _chdir(monkeypatch, tmp_path)
    assert memory_lookup.retrieve(["ownership"], ["anything"]) == []


def test_curated_single_file_layout(tmp_path, monkeypatch):
    _chdir(monkeypatch, tmp_path)
    _write(tmp_path / "agents/memory/ownership.yml", """
        version: 1
        entries:
          - id: own-1
            status: active
            confidence: high
            source: ["docs/teams.md"]
            owner: team-payments
            last_validated: 2026-01-01
            review_after_days: 180
            path: "app/Http/Controllers/Billing/**"
    """)
    hits = memory_lookup.retrieve(["ownership"], ["billing"], limit=5)
    assert len(hits) == 1
    assert hits[0].id == "own-1"
    assert hits[0].source == "curated"
    assert hits[0].score > 0


def test_content_addressed_layout(tmp_path, monkeypatch):
    _chdir(monkeypatch, tmp_path)
    _write(tmp_path / "agents/memory/domain-invariants/abc123.yml", """
        id: di-1
        status: active
        confidence: high
        source: ["docs/domain.md"]
        owner: team-x
        last_validated: 2026-01-01
        review_after_days: 180
        rule: "invoice total equals sum of line items"
        feature: "billing"
    """)
    hits = memory_lookup.retrieve(["domain-invariants"], ["billing"])
    assert len(hits) == 1
    assert hits[0].id == "di-1"
    assert hits[0].source == "curated"


def test_intake_jsonl_basic(tmp_path, monkeypatch):
    _chdir(monkeypatch, tmp_path)
    intake = tmp_path / "agents/memory/intake/learnings.jsonl"
    intake.parent.mkdir(parents=True)
    intake.write_text(
        json.dumps({"id": "i-1", "entry_type": "historical-patterns",
                    "path": "app/Http/Foo.php", "body": "off-by-one"}) + "\n"
    )
    hits = memory_lookup.retrieve(["historical-patterns"], ["foo.php"])
    assert len(hits) == 1
    assert hits[0].source == "intake"
    # Intake entries are discounted vs curated.
    assert hits[0].score > 0 and hits[0].score < 0.9


def test_intake_supersede_chain(tmp_path, monkeypatch):
    _chdir(monkeypatch, tmp_path)
    intake = tmp_path / "agents/memory/intake/learnings.jsonl"
    intake.parent.mkdir(parents=True)
    intake.write_text("\n".join([
        json.dumps({"id": "i-1", "entry_type": "incident-learnings",
                    "path": "queue", "body": "old"}),
        json.dumps({"id": "i-2", "entry_type": "incident-learnings",
                    "path": "queue", "body": "new"}),
        json.dumps({"type": "supersede", "supersedes": "i-1"}),
    ]) + "\n")
    hits = memory_lookup.retrieve(["incident-learnings"], ["queue"])
    ids = [h.id for h in hits]
    assert "i-2" in ids
    assert "i-1" not in ids, "superseded entries must not be returned"


def test_unknown_type_is_ignored(tmp_path, monkeypatch):
    _chdir(monkeypatch, tmp_path)
    _write(tmp_path / "agents/memory/ownership.yml", """
        version: 1
        entries:
          - id: own-1
            path: "x"
    """)
    # Mixed types — the unknown one is silently skipped.
    hits = memory_lookup.retrieve(["ownership", "not-a-type"], ["x"])
    assert len(hits) == 1
    assert hits[0].type == "ownership"


def test_limit_applied(tmp_path, monkeypatch):
    _chdir(monkeypatch, tmp_path)
    entries = "\n".join(
        f"  - id: own-{i}\n    path: \"src/{i}\"" for i in range(10)
    )
    _write(tmp_path / "agents/memory/ownership.yml",
           f"version: 1\nentries:\n{entries}\n")
    hits = memory_lookup.retrieve(["ownership"], ["src/"], limit=3)
    assert len(hits) == 3


# ---------------------------------------------------------------------------
# Knowledge namespace (Phase 2 — local-knowledge-ingestion contract)
# ---------------------------------------------------------------------------


def _write_knowledge_ingest(
    tmp_path: Path,
    ingest_id: str,
    source: str,
    chunks: list[str],
    pinned: bool = False,
) -> Path:
    ingest_dir = tmp_path / "agents/memory/knowledge" / ingest_id
    chunks_dir = ingest_dir / "chunks"
    chunks_dir.mkdir(parents=True, exist_ok=True)
    manifest = {
        "ingest_id": ingest_id,
        "source": source,
        "created_at": "2026-05-25T00:00:00Z",
        "last_touched": "2026-05-25T00:00:00Z",
        "documents": 1,
        "chunks": len(chunks),
        "bytes_stored": sum(len(c) for c in chunks),
        "redacted": True,
        "pinned": pinned,
        "pii_redacted": {},
        "secrets_redacted": 0,
        "skipped": [],
        "files": [],
        "contains_redactions": False,
    }
    (ingest_dir / "manifest.json").write_text(
        json.dumps(manifest), encoding="utf-8"
    )
    for i, body in enumerate(chunks):
        (chunks_dir / f"{i:04d}.md").write_text(body, encoding="utf-8")
    return ingest_dir


def test_knowledge_retrieval_returns_chunks(tmp_path, monkeypatch):
    _chdir(monkeypatch, tmp_path)
    _write_knowledge_ingest(
        tmp_path,
        ingest_id="018f4a1b-0000-7000-8000-000000000001",
        source="/Users/maintainer/clients/acme/brief.pdf",
        chunks=["Acme pricing model uses tiered SaaS billing."],
    )
    hits = memory_lookup.retrieve(["knowledge"], ["acme"], limit=5)
    assert len(hits) == 1
    assert hits[0].type == "knowledge"
    assert hits[0].source == "knowledge"
    assert hits[0].entry["source_kind"] == "knowledge"
    assert hits[0].score > 0


def test_knowledge_retrieval_returns_empty_when_no_root(tmp_path, monkeypatch):
    _chdir(monkeypatch, tmp_path)
    assert memory_lookup.retrieve(["knowledge"], ["anything"]) == []


def test_knowledge_pinned_chunks_rank_higher(tmp_path, monkeypatch):
    _chdir(monkeypatch, tmp_path)
    _write_knowledge_ingest(
        tmp_path,
        ingest_id="018f4a1b-0000-7000-8000-000000000002",
        source="docs/normal.md",
        chunks=["acme normal content"],
        pinned=False,
    )
    _write_knowledge_ingest(
        tmp_path,
        ingest_id="018f4a1b-0000-7000-8000-000000000003",
        source="docs/pinned.md",
        chunks=["acme pinned content"],
        pinned=True,
    )
    hits = memory_lookup.retrieve(["knowledge"], ["acme"], limit=5)
    assert len(hits) == 2
    pinned_hit = next(h for h in hits if h.entry["pinned"])
    normal_hit = next(h for h in hits if not h.entry["pinned"])
    assert pinned_hit.score >= normal_hit.score


def test_knowledge_v1_envelope_maps_to_repo(tmp_path, monkeypatch):
    _chdir(monkeypatch, tmp_path)
    _write_knowledge_ingest(
        tmp_path,
        ingest_id="018f4a1b-0000-7000-8000-000000000004",
        source="docs/spec.md",
        chunks=["billing rules and edge cases"],
    )
    envelope = memory_lookup.retrieve_v1(
        ["knowledge"], ["billing"], limit=5
    )
    assert envelope["status"] == "ok"
    assert envelope["slices"]["knowledge"]["status"] == "ok"
    assert envelope["slices"]["knowledge"]["count"] >= 1
    knowledge_entries = [
        e for e in envelope["entries"] if e["type"] == "knowledge"
    ]
    assert len(knowledge_entries) == 1
    # All file-backed entries project to source "repo".
    assert knowledge_entries[0]["source"] == "repo"
    # Body carries the source_kind tag so the host model can
    # distinguish user-ingested knowledge from curated repo entries.
    assert knowledge_entries[0]["body"]["source_kind"] == "knowledge"


def test_knowledge_skips_dir_without_manifest(tmp_path, monkeypatch):
    _chdir(monkeypatch, tmp_path)
    # Stray directory without manifest.json or chunks — must not crash.
    stray = tmp_path / "agents/memory/knowledge/stray-dir"
    stray.mkdir(parents=True)
    (stray / "random.txt").write_text("noise", encoding="utf-8")
    hits = memory_lookup.retrieve(["knowledge"], ["noise"])
    assert hits == []


# ---------------------------------------------------------------------------
# Supersession / staleness tests (Phase 1 — analysis-workbench)
# ---------------------------------------------------------------------------

def _write_ownership_yaml(tmp_path, entries: list[dict]) -> None:
    """Write a single-file curated ownership YAML."""
    import yaml  # type: ignore
    mdir = tmp_path / "agents/memory"
    mdir.mkdir(parents=True, exist_ok=True)
    (mdir / "ownership.yml").write_text(
        yaml.dump({"version": 1, "entries": entries}),
        encoding="utf-8",
    )


def test_superseded_entry_excluded_from_retrieve(tmp_path, monkeypatch):
    """retrieve() must not return curated entries with status=superseded."""
    _chdir(monkeypatch, tmp_path)
    _write_ownership_yaml(tmp_path, [
        {
            "id": "own-active",
            "status": "active",
            "path": "app/Http/Controllers/Billing/**",
            "owner": "team-payments",
        },
        {
            "id": "own-superseded",
            "status": "superseded",
            "path": "app/Http/Controllers/Billing/**",
            "owner": "team-payments",
        },
    ])
    hits = memory_lookup.retrieve(["ownership"], ["billing"])
    hit_ids = [h.id for h in hits]
    assert "own-active" in hit_ids
    assert "own-superseded" not in hit_ids


def test_stale_entry_excluded_from_retrieve_appears_in_skipped(tmp_path, monkeypatch):
    """Stale entries must be absent from retrieve() results but present in
    retrieve_with_meta()["skipped"] with reason="stale"."""
    import datetime as _dt
    _chdir(monkeypatch, tmp_path)
    today = _dt.date(2026, 6, 15)
    # Entry validated 200 days ago, review_after_days=90 → STALE
    stale_date = today - _dt.timedelta(days=200)
    _write_ownership_yaml(tmp_path, [
        {
            "id": "own-stale",
            "status": "active",
            "path": "app/Http/Controllers/Billing/**",
            "owner": "team-payments",
            "last_validated": str(stale_date),
            "review_after_days": 90,
        },
        {
            "id": "own-fresh",
            "status": "active",
            "path": "app/Http/Controllers/Billing/**",
            "owner": "team-payments",
            "last_validated": str(today),
            "review_after_days": 90,
        },
    ])
    # retrieve() must not include the stale entry
    hits = memory_lookup.retrieve(["ownership"], ["billing"])
    hit_ids = [h.id for h in hits]
    assert "own-stale" not in hit_ids
    assert "own-fresh" in hit_ids

    # retrieve_with_meta() must list the stale entry in skipped
    result = memory_lookup.retrieve_with_meta(
        ["ownership"], ["billing"], _today=today
    )
    skipped_ids = {s["id"] for s in result["skipped"]}
    skipped_reasons = {s["id"]: s["reason"] for s in result["skipped"]}
    assert "own-stale" in skipped_ids
    assert skipped_reasons["own-stale"] == "stale"
    result_ids = [h.id for h in result["results"]]
    assert "own-fresh" in result_ids


def test_find_duplicate_returns_match_above_threshold_none_below(tmp_path, monkeypatch):
    """find_duplicate returns a Hit when score >= threshold, None otherwise."""
    _chdir(monkeypatch, tmp_path)
    _write_ownership_yaml(tmp_path, [
        {
            "id": "own-billing",
            "status": "active",
            "path": "app/Http/Controllers/Billing/**",
            "owner": "team-payments",
        },
    ])
    # Key that matches → score should be high enough for default threshold 0.6
    hit = memory_lookup.find_duplicate(["ownership"], ["billing"])
    assert hit is not None
    assert hit.id == "own-billing"

    # Key with no relation to the entry → score below threshold
    no_hit = memory_lookup.find_duplicate(["ownership"], ["unrelated-xyz-qwerty"])
    assert no_hit is None
