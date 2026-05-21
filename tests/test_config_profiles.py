"""Contract tests for ``scripts/config/profiles.py``.

Covers the resolution chain documented in
:mod:`docs.contracts.profile-system`:

* No settings file → ``developer`` default loaded from disk.
* Settings file present but no ``profile:`` block → warning state.
* ``profile.id`` in settings → user-settings source.
* ``AGENT_CONFIG_PROFILE_ID`` env → env source.
* ``runtime_id`` arg → runtime source, overrides env and user.
* Unknown profile id raises :class:`ProfileError`.
* All six seed YAMLs load and parse.
"""
from __future__ import annotations

from pathlib import Path

import pytest

from scripts.config import profiles


REPO_ROOT = Path(__file__).resolve().parent.parent


def _seed_root() -> Path:
    return REPO_ROOT


def test_seed_set_complete() -> None:
    for profile_id in profiles.SEED_PROFILE_IDS:
        path = profiles._profile_file(REPO_ROOT, profile_id)
        assert path.exists(), f"missing seed profile: {path}"


@pytest.mark.parametrize("profile_id", profiles.SEED_PROFILE_IDS)
def test_each_seed_profile_resolves(profile_id: str) -> None:
    resolved = profiles.resolve_profile(
        project_root=_seed_root(),
        runtime_id=profile_id,
    )
    assert resolved.id == profile_id
    assert resolved.source == profiles.SOURCE_RUNTIME
    assert resolved.preset_id in {"fast", "balanced", "strict"}
    assert resolved.audience.get("label")


def test_no_settings_returns_developer_default(tmp_path: Path) -> None:
    # tmp_path has no .agent-settings.yml and no profiles dir → fallback
    # to default id, but YAML is missing so the dataclass is empty
    # apart from id and source.
    resolved = profiles.resolve_profile(project_root=tmp_path)
    assert resolved.id == profiles.DEFAULT_PROFILE_ID
    assert resolved.source == profiles.SOURCE_DEFAULT


def test_settings_present_without_profile_block_warns(tmp_path: Path) -> None:
    (tmp_path / ".agent-settings.yml").write_text("name: matze\n", encoding="utf-8")
    resolved = profiles.resolve_profile(
        project_root=tmp_path,
        user_settings={"name": "matze"},
    )
    assert resolved.id == profiles.DEFAULT_PROFILE_ID
    assert resolved.source == profiles.SOURCE_MISSING
    assert resolved.warning is not None
    assert "/onboard" in resolved.warning


def test_user_settings_wins_over_pack(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(profiles.PROFILE_ID_ENV, raising=False)
    resolved = profiles.resolve_profile(
        project_root=_seed_root(),
        user_settings={"profile": {"id": "finance"}},
        pack_profile_id="developer",
    )
    assert resolved.id == "finance"
    assert resolved.source == profiles.SOURCE_USER


def test_env_wins_over_user(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(profiles.PROFILE_ID_ENV, "ops")
    resolved = profiles.resolve_profile(
        project_root=_seed_root(),
        user_settings={"profile": {"id": "developer"}},
    )
    assert resolved.id == "ops"
    assert resolved.source == profiles.SOURCE_ENV


def test_runtime_wins_over_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(profiles.PROFILE_ID_ENV, "ops")
    resolved = profiles.resolve_profile(
        project_root=_seed_root(),
        user_settings={"profile": {"id": "developer"}},
        runtime_id="agency",
    )
    assert resolved.id == "agency"
    assert resolved.source == profiles.SOURCE_RUNTIME


def test_unknown_profile_id_raises(tmp_path: Path) -> None:
    with pytest.raises(profiles.ProfileError):
        profiles.resolve_profile(
            project_root=tmp_path,
            runtime_id="not_a_real_profile",
        )


def test_developer_seed_shape() -> None:
    resolved = profiles.resolve_profile(
        project_root=_seed_root(),
        runtime_id="developer",
    )
    assert resolved.preset_id == "balanced"
    assert "reviewer" in resolved.personas
    assert "work" in resolved.commands_hint
    assert resolved.audience["readme_anchor"] == "developer"
    assert resolved.docs_first_pointer is not None


def test_founder_seed_uses_fast_preset() -> None:
    resolved = profiles.resolve_profile(
        project_root=_seed_root(),
        runtime_id="founder",
    )
    assert resolved.preset_id == "fast"


def test_strict_default_profiles() -> None:
    for profile_id in ("agency", "finance", "ops"):
        resolved = profiles.resolve_profile(
            project_root=_seed_root(),
            runtime_id=profile_id,
        )
        assert resolved.preset_id == "strict", profile_id
