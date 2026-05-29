"""Tests for the gitignored .agent-settings.local.yml cascade layer (Phase 2)."""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from scripts._lib import agent_settings as ags  # noqa: E402


def _project(tmp_path: Path) -> Path:
    (tmp_path / ".git").mkdir()
    return tmp_path


def _no_global(tmp_path: Path) -> Path:
    return tmp_path / "no-such-global.yml"


def test_local_overrides_committed_root(tmp_path: Path) -> None:
    proj = _project(tmp_path)
    (proj / ".agent-settings.yml").write_text("zzz_test_key: committed\n", encoding="utf-8")
    (proj / ".agent-settings.local.yml").write_text("zzz_test_key: local\n", encoding="utf-8")

    merged = ags.load_agent_settings(cwd=proj, user_global_path=_no_global(tmp_path))
    assert merged["zzz_test_key"] == "local"


def test_nested_local_overrides_root_local(tmp_path: Path) -> None:
    proj = _project(tmp_path)
    (proj / ".agent-settings.yml").write_text("zzz_test_key: committed\n", encoding="utf-8")
    (proj / ".agent-settings.local.yml").write_text("zzz_test_key: root_local\n", encoding="utf-8")
    sub = proj / "sub"
    sub.mkdir()
    (sub / ".agent-settings.local.yml").write_text("zzz_test_key: sub_local\n", encoding="utf-8")

    merged = ags.load_agent_settings(cwd=sub, user_global_path=_no_global(tmp_path))
    assert merged["zzz_test_key"] == "sub_local"


def test_absence_of_local_leaves_committed(tmp_path: Path) -> None:
    proj = _project(tmp_path)
    (proj / ".agent-settings.yml").write_text("zzz_test_key: committed\n", encoding="utf-8")
    # no .local.yml present
    merged = ags.load_agent_settings(cwd=proj, user_global_path=_no_global(tmp_path))
    assert merged["zzz_test_key"] == "committed"


def test_local_deep_merges_nested_dict(tmp_path: Path) -> None:
    proj = _project(tmp_path)
    (proj / ".agent-settings.yml").write_text(
        "zzz_block:\n  a: 1\n  b: 2\n", encoding="utf-8"
    )
    (proj / ".agent-settings.local.yml").write_text(
        "zzz_block:\n  b: 99\n", encoding="utf-8"
    )
    merged = ags.load_agent_settings(cwd=proj, user_global_path=_no_global(tmp_path))
    # deep-merge: a survives, b overridden
    assert merged["zzz_block"] == {"a": 1, "b": 99}


def test_with_local_helper() -> None:
    paths = ags._with_local(Path("/x/.agent-settings.yml"))
    assert paths == [
        Path("/x/.agent-settings.yml"),
        Path("/x/.agent-settings.local.yml"),
    ]
