"""Sparse-lip-sync budget — machine-readable, test-locked.

Council convergence (2026-06-06): lip-sync is a separate post-process
adapter kept SPARSE — singing lip-sync is genuinely hard. The budget is
codified machine-readable in
``scripts/ai-video/lib/model-capabilities/syncso.json`` under
``lipsync_budget`` (council 2026-06-07, Q5a: manifest JSON, not prose),
and the orchestrator (``/video:from-song`` Step 8) enforces it BEFORE
any submit. These tests lock the budget's shape and its enforcement
wiring so neither can silently disappear.
"""
from __future__ import annotations

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MANIFEST = (
    REPO_ROOT / "src" / "scripts" / "ai-video" / "lib"
    / "model-capabilities" / "syncso.json"
)
FROM_SONG = (
    REPO_ROOT / "src" / "domains" / "ai-video" / "video"
    / "from-song" / "command.md"
)
CONTRACT = (
    REPO_ROOT / "src" / "scripts" / "media" / "lib" / "adapter-contract.md"
)


def _budget() -> dict:
    return json.loads(MANIFEST.read_text(encoding="utf-8"))["lipsync_budget"]


def test_budget_block_exists_with_required_keys() -> None:
    budget = _budget()
    for key in (
        "max_segments_per_song",
        "max_segment_seconds",
        "frontal_close_up_only",
        "cost_gate",
    ):
        assert key in budget, f"lipsync_budget missing {key!r}"


def test_budget_values_are_sane_and_sparse() -> None:
    budget = _budget()
    max_segments = budget["max_segments_per_song"]
    assert isinstance(max_segments, int) and 1 <= max_segments <= 10, (
        "max_segments_per_song must be a small positive int — the budget "
        "exists to keep lip-sync SPARSE; double digits defeats it"
    )
    max_seconds = budget["max_segment_seconds"]
    assert isinstance(max_seconds, (int, float)) and 0 < max_seconds <= 60, (
        "max_segment_seconds must be a positive number within the model's "
        "renderable envelope"
    )
    assert budget["frontal_close_up_only"] is True, (
        "frontal_close_up_only is the quality floor — flipping it off needs "
        "a captured smoke trace showing off-angle singing holds up"
    )
    assert budget["cost_gate"] is True, (
        "lip-sync segments must stay itemized in the unified preview"
    )


def test_budget_stays_inside_model_envelope() -> None:
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    budget = data["lipsync_budget"]
    for model_id, entry in data["models"].items():
        assert budget["max_segment_seconds"] <= entry["max_duration"], (
            f"{model_id}: max_segment_seconds exceeds the model's "
            f"max_duration — the budget would plan unrenderable segments"
        )


def test_orchestrator_enforces_budget_before_submit() -> None:
    """The from-song command must wire the budget as ENFORCED constraints
    (halt on violation), not advisory prose."""
    text = FROM_SONG.read_text(encoding="utf-8")
    assert "lipsync_budget" in text, (
        "from-song must read lipsync_budget from the syncso manifest"
    )
    for needle in (
        "max_segments_per_song",
        "max_segment_seconds",
        "frontal_close_up_only",
    ):
        assert needle in text, f"from-song must enforce {needle}"
    assert "before" in text.lower() and "submit" in text.lower(), (
        "budget enforcement must happen before any lip-sync submit"
    )


def test_contract_documents_lipsync_kind() -> None:
    text = CONTRACT.read_text(encoding="utf-8")
    assert 'kind="lipsync"' in text, (
        "adapter-contract.md must document the lipsync stdin shape"
    )
    assert "lipsync_budget" in text, (
        "adapter-contract.md must point at the machine-readable budget"
    )
