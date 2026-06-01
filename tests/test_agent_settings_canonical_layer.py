"""Tests for the canonical project settings file under agents/settings/.

The project settings file's canonical home is
``agents/settings/.agent-settings.yml`` (the project's settings layer),
NOT the repo root. The repo-root ``.agent-settings.yml`` is read only as a
back-compat fallback. Precedence (deepest wins):

    legacy root .agent-settings.yml  <  agents/settings/.agent-settings.yml
                                     <  agents/settings/.agent-settings.local.yml
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


def _write_canonical(proj: Path, body: str) -> None:
    p = proj / "agents" / "settings" / ".agent-settings.yml"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(body, encoding="utf-8")


def _write_local(proj: Path, body: str) -> None:
    p = proj / "agents" / "settings" / ".agent-settings.local.yml"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(body, encoding="utf-8")


# --- cascade precedence -----------------------------------------------------

def test_canonical_overrides_legacy_root(tmp_path: Path) -> None:
    proj = _project(tmp_path)
    (proj / ".agent-settings.yml").write_text("zzz_test_key: legacy_root\n", encoding="utf-8")
    _write_canonical(proj, "zzz_test_key: canonical\n")

    merged = ags.load_agent_settings(cwd=proj, user_global_path=_no_global(tmp_path))
    assert merged["zzz_test_key"] == "canonical"


def test_local_overrides_canonical(tmp_path: Path) -> None:
    proj = _project(tmp_path)
    _write_canonical(proj, "zzz_test_key: canonical\n")
    _write_local(proj, "zzz_test_key: local\n")

    merged = ags.load_agent_settings(cwd=proj, user_global_path=_no_global(tmp_path))
    assert merged["zzz_test_key"] == "local"


def test_legacy_root_alone_still_works(tmp_path: Path) -> None:
    """Back-compat: installs predating the relocation keep working."""
    proj = _project(tmp_path)
    (proj / ".agent-settings.yml").write_text("zzz_test_key: legacy_root\n", encoding="utf-8")

    merged = ags.load_agent_settings(cwd=proj, user_global_path=_no_global(tmp_path))
    assert merged["zzz_test_key"] == "legacy_root"


def test_canonical_alone_works(tmp_path: Path) -> None:
    proj = _project(tmp_path)
    _write_canonical(proj, "zzz_test_key: canonical\n")

    merged = ags.load_agent_settings(cwd=proj, user_global_path=_no_global(tmp_path))
    assert merged["zzz_test_key"] == "canonical"


# --- path helpers -----------------------------------------------------------

def test_project_settings_path_prefers_canonical(tmp_path: Path) -> None:
    proj = _project(tmp_path)
    (proj / ".agent-settings.yml").write_text("a: 1\n", encoding="utf-8")
    _write_canonical(proj, "a: 1\n")
    assert ags.project_settings_path(proj) == proj / "agents" / "settings" / ".agent-settings.yml"


def test_project_settings_path_falls_back_to_legacy_root(tmp_path: Path) -> None:
    proj = _project(tmp_path)
    (proj / ".agent-settings.yml").write_text("a: 1\n", encoding="utf-8")
    assert ags.project_settings_path(proj) == proj / ".agent-settings.yml"


def test_project_settings_path_defaults_to_canonical_when_absent(tmp_path: Path) -> None:
    proj = _project(tmp_path)
    assert ags.project_settings_path(proj) == proj / "agents" / "settings" / ".agent-settings.yml"


def test_canonical_write_path_is_always_agents_settings(tmp_path: Path) -> None:
    proj = _project(tmp_path)
    # even with a legacy root file present, the write target stays canonical
    (proj / ".agent-settings.yml").write_text("a: 1\n", encoding="utf-8")
    assert ags.canonical_settings_write_path(proj) == proj / "agents" / "settings" / ".agent-settings.yml"
