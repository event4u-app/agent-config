"""Retrieval conformance fixture for the repo-vs-operational conflict rule.

Covers the four cases documented in
`agents/roadmaps/road-to-memory-self-consumption.md` §
"Conflict rule: repo vs. operational":

1. Same `id`, both sides present → repo wins, operational shadowed
2. Repo `status: deprecated`, operational `status: active` → deprecated
   wins (operational cannot revive a retired entry)
3. Same logical key, different `id`s → both returned, repo ranks higher
4. Repo has no entry, operational has one → operational returned with
   `source: "operational"`
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.memory_lookup import (  # noqa: E402
    Hit,
    RetrievalResult,
    _apply_conflict_rule,
    retrieve,
)


def _repo(eid: str, status: str = "active", score: float = 0.8,
          source: str = "curated", path: str = "agents/memory/ownership/repo.yml") -> Hit:
    return Hit(
        id=eid, type="ownership", source=source, path=path,
        score=score, entry={"id": eid, "status": status, "path": "app/Foo.php"},
    )


def _op(eid: str, status: str = "active", score: float = 0.8) -> Hit:
    return Hit(
        id=eid, type="ownership", source="operational",
        path="operational://agent-memory",
        score=score, entry={"id": eid, "status": status, "path": "app/Foo.php"},
    )


# ── Case 1 ──────────────────────────────────────────────────────────────

def test_case_1_same_id_repo_wins_and_operational_shadowed():
    repo = [_repo("own-foo", status="active")]
    ops = [_op("own-foo", status="active")]
    merged, shadows = _apply_conflict_rule(repo, ops)

    assert [h.id for h in merged] == ["own-foo"], \
        "repo entry must be returned"
    assert all(h.source != "operational" for h in merged), \
        "operational entry with same id must be suppressed"
    assert len(shadows) == 1, "exactly one shadow recorded"
    assert shadows[0].id == "own-foo"
    assert shadows[0].reason == "same-id"


# ── Case 2 ──────────────────────────────────────────────────────────────

def test_case_2_repo_deprecated_blocks_operational_active():
    repo = [_repo("own-bar", status="deprecated")]
    ops = [_op("own-bar", status="active")]
    merged, shadows = _apply_conflict_rule(repo, ops)

    assert len(merged) == 1
    assert merged[0].entry["status"] == "deprecated", \
        "deprecated repo entry wins over active operational"
    assert merged[0].source in {"curated", "intake"}
    assert len(shadows) == 1
    assert shadows[0].reason == "repo-deprecated", \
        "shadow must record the reason so curators can audit revival attempts"


# ── Case 3 ──────────────────────────────────────────────────────────────

def test_case_3_different_ids_on_same_logical_key_both_returned():
    repo = [_repo("own-baz-v1", status="active", score=0.8)]
    ops = [_op("own-baz-v2", status="active", score=0.85)]
    merged, shadows = _apply_conflict_rule(repo, ops)

    ids = sorted(h.id for h in merged)
    assert ids == ["own-baz-v1", "own-baz-v2"], \
        "both distinct ids must be preserved"
    assert shadows == [], "no shadow when ids differ"


# ── Case 4 ──────────────────────────────────────────────────────────────

def test_case_4_repo_empty_operational_returned():
    merged, shadows = _apply_conflict_rule([], [_op("own-qux")])

    assert len(merged) == 1
    assert merged[0].source == "operational"
    assert shadows == []


# ── End-to-end through retrieve() with operational provider ─────────────

def test_retrieve_with_operational_provider_and_shadows():
    """The public retrieve() API threads the provider and exposes shadows."""
    def provider(types, keys):
        return [_op("own-foo"), _op("own-brand-new")]

    # With no repo entries on disk for a synthetic id the curated path
    # returns empty — we inject one via the provider to exercise the
    # shadow + new-entry flow together.
    result = retrieve(
        types=["ownership"],
        keys=["app/Foo"],
        limit=10,
        operational_provider=provider,
        with_shadows=True,
    )
    assert isinstance(result, RetrievalResult)
    # Neither id exists as a repo entry in this repo's agents/memory, so
    # both operational hits come through — no shadows.
    assert {h.id for h in result.hits} >= {"own-foo", "own-brand-new"}
    assert result.shadows == []


def test_retrieve_default_return_type_stays_list_hit():
    """Backward compat: callers without with_shadows get list[Hit]."""
    result = retrieve(types=["ownership"], keys=["nonexistent-key"], limit=1)
    assert isinstance(result, list)
