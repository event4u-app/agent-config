"""Tests for ``scripts/_lib/user_global_paths.py``.

Phase 1.2 of road-to-event4u-namespace-and-claude-desktop.md. Covers
the helper's resolution contract: default root, env-var override,
read-fallback semantics across new + legacy paths, write-target
discipline (writers never land in legacy), and absolute-path rejection.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

from scripts._lib import user_global_paths  # noqa: E402


# --- event4u_root ---


def test_event4u_root_defaults_to_dot_event4u(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(user_global_paths.EVENT4U_HOME_ENV, raising=False)
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: Path("/home/test")))
    assert user_global_paths.event4u_root() == Path("/home/test/.event4u/agent-config")


def test_event4u_root_honours_env_override(tmp_path: Path) -> None:
    custom = tmp_path / "custom-root"
    env = {user_global_paths.EVENT4U_HOME_ENV: str(custom)}
    assert user_global_paths.event4u_root(env=env) == custom


def test_event4u_root_env_expands_tilde() -> None:
    env = {user_global_paths.EVENT4U_HOME_ENV: "~/elsewhere"}
    result = user_global_paths.event4u_root(env=env)
    assert result == Path.home() / "elsewhere"


# --- legacy_xdg_root ---


def test_legacy_xdg_root_is_dot_config_agent_config(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: Path("/home/test")))
    assert user_global_paths.legacy_xdg_root() == Path(
        "/home/test/.config/agent-config"
    )


# --- resolve_with_fallback ---


def test_resolve_prefers_new_path_when_present(tmp_path: Path) -> None:
    new_root = tmp_path / ".event4u" / "agent-config"
    new_root.mkdir(parents=True)
    (new_root / "settings.yml").write_text("new=1", encoding="utf-8")
    env = {user_global_paths.EVENT4U_HOME_ENV: str(new_root)}
    resolved = user_global_paths.resolve_with_fallback("settings.yml", env=env)
    assert resolved == new_root / "settings.yml"


def test_resolve_falls_back_to_legacy_when_new_missing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: tmp_path))
    legacy_root = tmp_path / ".config" / "agent-config"
    legacy_root.mkdir(parents=True)
    (legacy_root / "settings.yml").write_text("legacy=1", encoding="utf-8")
    # New root explicit but empty.
    new_root = tmp_path / ".event4u" / "agent-config"
    env = {user_global_paths.EVENT4U_HOME_ENV: str(new_root)}
    resolved = user_global_paths.resolve_with_fallback("settings.yml", env=env)
    assert resolved == legacy_root / "settings.yml"


def test_resolve_returns_none_when_both_missing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: tmp_path))
    new_root = tmp_path / ".event4u" / "agent-config"
    env = {user_global_paths.EVENT4U_HOME_ENV: str(new_root)}
    assert user_global_paths.resolve_with_fallback("absent.yml", env=env) is None


def test_resolve_rejects_absolute_paths() -> None:
    with pytest.raises(ValueError):
        user_global_paths.resolve_with_fallback("/etc/passwd")


def test_resolve_handles_nested_relative(tmp_path: Path) -> None:
    new_root = tmp_path / "root"
    nested = new_root / "agents" / "global"
    nested.mkdir(parents=True)
    env = {user_global_paths.EVENT4U_HOME_ENV: str(new_root)}
    resolved = user_global_paths.resolve_with_fallback("agents/global", env=env)
    assert resolved == nested


# --- write_target ---


def test_write_target_always_lands_in_new_root(tmp_path: Path) -> None:
    custom = tmp_path / "root"
    env = {user_global_paths.EVENT4U_HOME_ENV: str(custom)}
    assert user_global_paths.write_target("installed.lock", env=env) == (
        custom / "installed.lock"
    )


def test_write_target_does_not_create_parent(tmp_path: Path) -> None:
    custom = tmp_path / "absent-root"
    env = {user_global_paths.EVENT4U_HOME_ENV: str(custom)}
    target = user_global_paths.write_target("foo.yml", env=env)
    assert not target.parent.exists()  # helper is pure
    assert target == custom / "foo.yml"


def test_write_target_rejects_absolute_paths() -> None:
    with pytest.raises(ValueError):
        user_global_paths.write_target("/etc/anything")
