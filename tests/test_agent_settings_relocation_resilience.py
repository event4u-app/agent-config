"""Pre-flight: the settings loader survives a settings-file relocation.

Closes acceptance criterion 3 of
``road-to-6.0.x-workspace-structural-cleanup`` and Step 5 of its Phase 2:

    ``_lib/agent_settings.py`` survives a settings-file relocation — the loader
    resolves the NEW path with the OLD/default location absent, and degrades to
    defaults (never bricks) when the file is gone entirely.

Per ADR-053 the maintainer ``agents/`` workspace stays put (the collision is
conceptual), so no file is actually moved in the repo. This test is the
standing proof that the loader is *relocation-safe by construction*: it resolves
the project root from ``AGENT_CONFIG_PROJECT_ROOT`` / the anchor walk and reads
settings via a cascade, so a settings file living at an arbitrary root — with the
repo's own default location absent from that tree — still loads. That is the
guarantee the deferred Step 5 demanded before any future move could ship.
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from scripts._lib import agent_settings as ags  # noqa: E402

SENTINEL_KEY = "zzz_relocation_sentinel"


def _no_global(tmp_path: Path) -> Path:
    return tmp_path / "no-such-global.yml"


def _make_relocated_root(tmp_path: Path, body: str) -> Path:
    """A fresh project root at an arbitrary location carrying agents/settings/."""
    root = tmp_path / "relocated-elsewhere"
    (root / ".git").mkdir(parents=True)
    settings = root / "agents" / "settings" / ".agent-settings.yml"
    settings.parent.mkdir(parents=True, exist_ok=True)
    settings.write_text(body, encoding="utf-8")
    return root


def test_loader_resolves_settings_at_relocated_root(tmp_path: Path) -> None:
    """NEW path present, default/old location absent → settings still load."""
    root = _make_relocated_root(tmp_path, f"{SENTINEL_KEY}: relocated\n")

    merged = ags.load_agent_settings(cwd=root, user_global_path=_no_global(tmp_path))

    assert merged[SENTINEL_KEY] == "relocated"


def test_loader_resolves_via_env_project_root(tmp_path: Path, monkeypatch) -> None:
    """resolve-from-env: AGENT_CONFIG_PROJECT_ROOT points the loader at the new root."""
    root = _make_relocated_root(tmp_path, f"{SENTINEL_KEY}: via_env\n")

    monkeypatch.setenv(ags.PROJECT_ROOT_ENV, str(root))
    resolved, origin = ags.resolve_project_root(None, cwd=tmp_path)

    assert resolved == root
    assert origin == ags.ORIGIN_ENV

    merged = ags.load_agent_settings(cwd=resolved, user_global_path=_no_global(tmp_path))
    assert merged[SENTINEL_KEY] == "via_env"


def test_loader_resolves_via_root_override_flag(tmp_path: Path, monkeypatch) -> None:
    """--root channel (ROOT_OVERRIDE=1) wins and points at the relocated root."""
    root = _make_relocated_root(tmp_path, f"{SENTINEL_KEY}: via_flag\n")

    monkeypatch.setenv(ags.ROOT_OVERRIDE_ENV, "1")
    monkeypatch.setenv(ags.PROJECT_ROOT_ENV, str(root))
    resolved, origin = ags.resolve_project_root(None, cwd=tmp_path)

    assert resolved == root
    assert origin == ags.ORIGIN_ROOT_FLAG


def test_loader_degrades_to_defaults_when_settings_absent(tmp_path: Path) -> None:
    """OLD path gone, no settings anywhere → defaults, never a brick/raise."""
    bare = tmp_path / "bare-root"
    (bare / ".git").mkdir(parents=True)

    merged = ags.load_agent_settings(cwd=bare, user_global_path=_no_global(tmp_path))

    assert isinstance(merged, dict)
    assert SENTINEL_KEY not in merged


def test_relocation_then_old_absent_is_clean(tmp_path: Path) -> None:
    """End-to-end: load from NEW root, then prove the OLD default tree is absent.

    Mirrors the move sequence the deferred Step 5 worried about — read the NEW
    location while the OLD one no longer exists — without bricking.
    """
    root = _make_relocated_root(tmp_path, f"{SENTINEL_KEY}: post_move\n")
    old_default = root / ".agent-settings.yml"
    assert not old_default.exists()  # legacy root location never created

    merged = ags.load_agent_settings(cwd=root, user_global_path=_no_global(tmp_path))
    assert merged[SENTINEL_KEY] == "post_move"
