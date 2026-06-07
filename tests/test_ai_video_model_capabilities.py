"""Multiplexer model-capabilities manifest tests.

The ``fal`` and ``replicate`` multiplexer adapters reach many video
models through one provider API; the per-model capability manifest at
``scripts/ai-video/lib/model-capabilities/<adapter>.json`` is the single
source of truth the music pipeline plans against. These tests pin:

1. Schema shape — every model entry carries ``min_duration``,
   ``max_duration``, ``audio_sync``, ``aspect`` (the roadmap-mandated
   fields) plus the ``verified`` trust flag.
2. Coherence — ``min_duration <= max_duration``; aspects are
   ``W:H``-shaped strings; modeled cost is a non-negative number.
3. Trust discipline — entries without a captured smoke trace MUST be
   ``verified: false`` (no entry may claim verification while the
   adapter ships without any smoke trace under
   ``agents/reference/ai-video/smoke-traces/``).
4. Adapter integration — ``capability`` lists the manifest's models and
   ``capability --model <id>`` answers with the entry, mapping
   ``audio_sync`` onto the contract's ``audio`` flag.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
LIB_DIR = REPO_ROOT / "src" / "scripts" / "ai-video" / "lib"
MANIFEST_DIR = LIB_DIR / "model-capabilities"
ADAPTER_DIR = REPO_ROOT / "src" / "scripts" / "ai-video" / "adapters"
SMOKE_TRACE_DIR = REPO_ROOT / "agents" / "reference" / "ai-video" / "smoke-traces"

MANIFESTS = sorted(MANIFEST_DIR.glob("*.json"))
ASPECT_RE = re.compile(r"^\d+:\d+$")
REQUIRED_FIELDS = {"min_duration", "max_duration", "audio_sync", "aspect", "verified"}


def _load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def test_manifest_directory_is_populated() -> None:
    """Both multiplexers ship a manifest; an empty glob would let every
    parametrized test below silently pass."""
    names = {p.stem for p in MANIFESTS}
    assert {"fal", "replicate"} <= names, (
        f"expected fal + replicate manifests under {MANIFEST_DIR}, got {names}"
    )


@pytest.mark.parametrize("manifest", MANIFESTS, ids=lambda p: p.stem)
def test_manifest_schema_shape(manifest: Path) -> None:
    data = _load(manifest)
    assert data.get("schema") == 1, f"{manifest.name}: schema must be 1"
    assert data.get("adapter") == manifest.stem, (
        f"{manifest.name}: adapter field must match filename"
    )
    models = data.get("models")
    assert isinstance(models, dict) and models, (
        f"{manifest.name}: models must be a non-empty object"
    )
    for model_id, entry in models.items():
        missing = REQUIRED_FIELDS - entry.keys()
        assert not missing, f"{manifest.name}:{model_id}: missing {sorted(missing)}"


@pytest.mark.parametrize("manifest", MANIFESTS, ids=lambda p: p.stem)
def test_manifest_values_are_coherent(manifest: Path) -> None:
    for model_id, entry in _load(manifest)["models"].items():
        ctx = f"{manifest.name}:{model_id}"
        lo, hi = entry["min_duration"], entry["max_duration"]
        assert isinstance(lo, (int, float)) and isinstance(hi, (int, float)), (
            f"{ctx}: durations must be numbers"
        )
        assert 0 < lo <= hi, f"{ctx}: need 0 < min_duration <= max_duration"
        assert isinstance(entry["audio_sync"], bool), f"{ctx}: audio_sync must be bool"
        aspects = entry["aspect"]
        assert isinstance(aspects, list) and aspects, f"{ctx}: aspect must be a non-empty list"
        for a in aspects:
            assert isinstance(a, str) and ASPECT_RE.match(a), (
                f"{ctx}: aspect {a!r} is not W:H-shaped"
            )
        cost = entry.get("cost_per_second_usd")
        if cost is not None:
            assert isinstance(cost, (int, float)) and not isinstance(cost, bool), (
                f"{ctx}: cost_per_second_usd must be a number"
            )
            assert cost >= 0, f"{ctx}: cost_per_second_usd must be non-negative"


@pytest.mark.parametrize("manifest", MANIFESTS, ids=lambda p: p.stem)
def test_unsmoked_models_stay_unverified(manifest: Path) -> None:
    """``verified: true`` requires a captured smoke trace for the adapter.
    While ``agents/reference/ai-video/smoke-traces/`` has no trace for
    this adapter, every manifest entry MUST be ``verified: false`` —
    documented-best-effort numbers may never masquerade as validated.
    """
    adapter = manifest.stem
    has_trace = SMOKE_TRACE_DIR.is_dir() and any(
        adapter in p.name for p in SMOKE_TRACE_DIR.iterdir()
    )
    if has_trace:
        pytest.skip(f"{adapter}: smoke trace exists; verified entries are legitimate")
    for model_id, entry in _load(manifest)["models"].items():
        assert entry["verified"] is False, (
            f"{manifest.name}:{model_id}: verified must stay false until a "
            f"smoke trace for {adapter!r} lands under {SMOKE_TRACE_DIR}"
        )


# ---------------------------------------------------------------------------
# Adapter integration — capability subcommand answers from the manifest
# ---------------------------------------------------------------------------

pytestmark_bash = pytest.mark.skipif(
    shutil.which("bash") is None or shutil.which("jq") is None,
    reason="capability lookup requires bash + jq",
)


def _run_adapter(adapter: str, *argv: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(  # noqa: S603 — fixed args, no shell.
        ["bash", str(ADAPTER_DIR / f"{adapter}.sh"), *argv],
        capture_output=True,
        text=True,
        timeout=15,
        env={"PATH": "/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin", "AIV_DRYRUN": "true"},
        check=False,
    )


@pytestmark_bash
@pytest.mark.parametrize("adapter", ["fal", "replicate"])
def test_capability_lists_manifest_models(adapter: str) -> None:
    result = _run_adapter(adapter, "capability")
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["audio"] == "per-model"
    manifest_models = set(_load(MANIFEST_DIR / f"{adapter}.json")["models"])
    assert set(payload.get("models", [])) == manifest_models


@pytestmark_bash
@pytest.mark.parametrize("adapter", ["fal", "replicate"])
def test_capability_model_lookup_maps_audio_and_flags_unverified(adapter: str) -> None:
    manifest = _load(MANIFEST_DIR / f"{adapter}.json")["models"]
    model_id, entry = next(iter(manifest.items()))
    result = _run_adapter(adapter, "capability", "--model", model_id)
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    expected_audio = "native" if entry["audio_sync"] else "none"
    assert payload["audio"] == expected_audio
    assert payload["model"] == model_id
    assert payload["verified"] is entry["verified"]
    if entry["verified"] is False:
        assert "UNVERIFIED" in result.stderr, (
            f"{adapter}: unverified model lookup must warn loudly on stderr"
        )


@pytestmark_bash
@pytest.mark.parametrize("adapter", ["fal", "replicate"])
def test_capability_unknown_model_fails_closed(adapter: str) -> None:
    result = _run_adapter(adapter, "capability", "--model", "nope/does-not-exist")
    assert result.returncode != 0, "unknown model must not return fabricated capabilities"
    assert "not in manifest" in result.stderr
