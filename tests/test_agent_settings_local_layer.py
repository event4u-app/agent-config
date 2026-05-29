"""Tests for the gitignored agents/settings/.agent-settings.local.yml layer (Phase 2).

The local override is a SINGLE project-level file under agents/settings/ (not
the repo root, not per-directory). It is appended as the deepest cascade layer
so it wins over every committed .agent-settings.yml.
"""

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


def _write_local(proj: Path, body: str) -> None:
    local = proj / "agents" / "settings" / ".agent-settings.local.yml"
    local.parent.mkdir(parents=True, exist_ok=True)
    local.write_text(body, encoding="utf-8")


def test_local_overrides_committed_root(tmp_path: Path) -> None:
    proj = _project(tmp_path)
    (proj / ".agent-settings.yml").write_text("zzz_test_key: committed\n", encoding="utf-8")
    _write_local(proj, "zzz_test_key: local\n")

    merged = ags.load_agent_settings(cwd=proj, user_global_path=_no_global(tmp_path))
    assert merged["zzz_test_key"] == "local"


def test_local_overrides_nested_committed(tmp_path: Path) -> None:
    # The single agents/settings local file wins over a deeper committed file.
    proj = _project(tmp_path)
    (proj / ".agent-settings.yml").write_text("zzz_test_key: root\n", encoding="utf-8")
    sub = proj / "sub"
    sub.mkdir()
    (sub / ".agent-settings.yml").write_text("zzz_test_key: nested\n", encoding="utf-8")
    _write_local(proj, "zzz_test_key: local\n")

    merged = ags.load_agent_settings(cwd=sub, user_global_path=_no_global(tmp_path))
    assert merged["zzz_test_key"] == "local"


def test_absence_of_local_leaves_committed(tmp_path: Path) -> None:
    proj = _project(tmp_path)
    (proj / ".agent-settings.yml").write_text("zzz_test_key: committed\n", encoding="utf-8")
    merged = ags.load_agent_settings(cwd=proj, user_global_path=_no_global(tmp_path))
    assert merged["zzz_test_key"] == "committed"


def test_local_deep_merges_nested_dict(tmp_path: Path) -> None:
    proj = _project(tmp_path)
    (proj / ".agent-settings.yml").write_text(
        "zzz_block:\n  a: 1\n  b: 2\n", encoding="utf-8"
    )
    _write_local(proj, "zzz_block:\n  b: 99\n")
    merged = ags.load_agent_settings(cwd=proj, user_global_path=_no_global(tmp_path))
    assert merged["zzz_block"] == {"a": 1, "b": 99}


def test_local_settings_path_helper() -> None:
    assert ags._local_settings_path(Path("/x")) == Path(
        "/x/agents/settings/.agent-settings.local.yml"
    )
