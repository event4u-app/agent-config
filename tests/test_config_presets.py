"""Contract tests for ``scripts/config/presets.py``.

Covers the resolution chain documented in
:mod:`docs.contracts.config-presets`:

* All three seed YAMLs load and the schema fields are populated.
* Resolution chain: profile → user → env → runtime (last writer wins).
* Per-knob overrides via user settings, env vars, and runtime args.
* Unknown preset id raises :class:`PresetError`.
* Default fallback returns ``balanced`` when nothing else fires.
"""
from __future__ import annotations

from pathlib import Path

import pytest

from scripts.config import presets


REPO_ROOT = Path(__file__).resolve().parent.parent


def _seed_root() -> Path:
    return REPO_ROOT


def test_seed_set_complete() -> None:
    for preset_id in presets.SEED_PRESET_IDS:
        path = REPO_ROOT / presets.PRESETS_DIRNAME / f"{preset_id}.yml"
        assert path.exists(), f"missing seed preset: {path}"


@pytest.mark.parametrize("preset_id", presets.SEED_PRESET_IDS)
def test_each_seed_preset_resolves(preset_id: str) -> None:
    resolved = presets.resolve_preset(
        project_root=_seed_root(),
        runtime_id=preset_id,
    )
    assert resolved.id == preset_id
    assert resolved.source == presets.SOURCE_RUNTIME
    assert "autonomy" in resolved.knobs
    assert "cost" in resolved.knobs
    assert resolved.knobs["cost"]["daily_max_usd"] > 0


def test_default_when_nothing_specified() -> None:
    resolved = presets.resolve_preset(project_root=_seed_root())
    assert resolved.id == presets.DEFAULT_PRESET_ID
    assert resolved.source == presets.SOURCE_DEFAULT


def test_profile_preset_id_wins_over_default() -> None:
    resolved = presets.resolve_preset(
        project_root=_seed_root(),
        profile_preset_id="fast",
    )
    assert resolved.id == "fast"
    assert resolved.source == presets.SOURCE_PROFILE


def test_pack_wins_over_profile() -> None:
    resolved = presets.resolve_preset(
        project_root=_seed_root(),
        pack_preset_id="strict",
        profile_preset_id="fast",
    )
    assert resolved.id == "strict"
    assert resolved.source == presets.SOURCE_PACK


def test_user_settings_win_over_pack() -> None:
    resolved = presets.resolve_preset(
        project_root=_seed_root(),
        pack_preset_id="strict",
        profile_preset_id="fast",
        user_settings={"preset": {"id": "balanced"}},
    )
    assert resolved.id == "balanced"
    assert resolved.source == presets.SOURCE_USER


def test_env_wins_over_user(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(presets.PRESET_ID_ENV, "strict")
    resolved = presets.resolve_preset(
        project_root=_seed_root(),
        user_settings={"preset": {"id": "balanced"}},
    )
    assert resolved.id == "strict"
    assert resolved.source == presets.SOURCE_ENV


def test_runtime_wins_over_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(presets.PRESET_ID_ENV, "strict")
    resolved = presets.resolve_preset(
        project_root=_seed_root(),
        runtime_id="fast",
    )
    assert resolved.id == "fast"
    assert resolved.source == presets.SOURCE_RUNTIME


def test_unknown_preset_id_raises() -> None:
    with pytest.raises(presets.PresetError):
        presets.resolve_preset(
            project_root=_seed_root(),
            runtime_id="not_a_real_preset",
        )


def test_user_per_knob_override() -> None:
    resolved = presets.resolve_preset(
        project_root=_seed_root(),
        runtime_id="balanced",
        user_settings={
            "preset": {"cost": {"daily_max_usd": 7.50}},
        },
    )
    assert resolved.knobs["cost"]["daily_max_usd"] == 7.50
    assert "cost.daily_max_usd" in resolved.overrides
    # Untouched knobs keep their seed values.
    assert resolved.knobs["cost"]["weekly_max_usd"] == 50.00


def test_env_per_knob_override(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "AGENT_CONFIG_PRESET_COST_DAILY_MAX_USD", "3.50",
    )
    resolved = presets.resolve_preset(
        project_root=_seed_root(),
        runtime_id="balanced",
    )
    assert resolved.knobs["cost"]["daily_max_usd"] == 3.50
    assert "cost.daily_max_usd" in resolved.overrides


def test_runtime_per_knob_override() -> None:
    resolved = presets.resolve_preset(
        project_root=_seed_root(),
        runtime_id="balanced",
        runtime_overrides={("cost", "daily_max_usd"): 0.99},
    )
    assert resolved.knobs["cost"]["daily_max_usd"] == 0.99
    assert "cost.daily_max_usd" in resolved.overrides


def test_strict_blocks_more_risk_categories() -> None:
    strict = presets.resolve_preset(
        project_root=_seed_root(), runtime_id="strict",
    )
    fast = presets.resolve_preset(
        project_root=_seed_root(), runtime_id="fast",
    )
    assert len(strict.knobs["risk"]["block_on"]) > len(fast.knobs["risk"]["block_on"])


def test_fast_has_higher_daily_cap_than_strict() -> None:
    fast = presets.resolve_preset(
        project_root=_seed_root(), runtime_id="fast",
    )
    strict = presets.resolve_preset(
        project_root=_seed_root(), runtime_id="strict",
    )
    assert fast.knobs["cost"]["daily_max_usd"] > strict.knobs["cost"]["daily_max_usd"]
