"""Precedence contract for `resolve_config_path` (user-global-first).

The council config lives in the user-global namespace
(`~/.event4u/agent-config/.ai-council.yml`) by default; a project-local
`agents/settings/.ai-council.yml` overrides it when checked in; an explicit
`$AI_COUNCIL_CONFIG` overrides both. These tests pin the user-global root to
a tmp dir via `EVENT4U_CONFIG_HOME` so the developer's real config is never
read.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts._lib import user_global_paths  # noqa: E402
from scripts.ai_council.config import (  # noqa: E402
    COUNCIL_CONFIG_ENV,
    COUNCIL_CONFIG_RELNAME,
    COUNCIL_CONFIG_USER_GLOBAL_REL,
    resolve_config_path,
)


@pytest.fixture(autouse=True)
def _sandbox(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Pin the user-global root to a per-test tmp dir; clear the override."""
    global_root = tmp_path / "global"
    global_root.mkdir()
    monkeypatch.setenv(user_global_paths.EVENT4U_HOME_ENV, str(global_root))
    monkeypatch.delenv(COUNCIL_CONFIG_ENV, raising=False)
    return global_root


def _global_path(sandbox: Path) -> Path:
    """User-global config path under the sandboxed root (settings/.ai-council.yml)."""
    return sandbox / COUNCIL_CONFIG_USER_GLOBAL_REL


def _write_global(sandbox: Path) -> Path:
    p = _global_path(sandbox)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text("enabled: true\n", encoding="utf-8")
    return p


def _project(tmp_path: Path) -> Path:
    root = tmp_path / "proj"
    (root / "agents" / "settings").mkdir(parents=True)
    return root


def _write_project_config(project_root: Path) -> Path:
    p = project_root / "agents" / "settings" / COUNCIL_CONFIG_RELNAME
    p.write_text("enabled: true\n", encoding="utf-8")
    return p


def test_global_used_when_no_project_file(tmp_path: Path, _sandbox: Path) -> None:
    global_cfg = _write_global(_sandbox)
    project = _project(tmp_path)  # no project config written
    assert resolve_config_path(project) == global_cfg


def test_project_overrides_global(tmp_path: Path, _sandbox: Path) -> None:
    _write_global(_sandbox)
    project = _project(tmp_path)
    project_cfg = _write_project_config(project)
    assert resolve_config_path(project) == project_cfg


def test_env_override_wins(
    tmp_path: Path, _sandbox: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    _write_global(_sandbox)
    project = _project(tmp_path)
    _write_project_config(project)
    explicit = tmp_path / "custom" / "council.yml"
    explicit.parent.mkdir()
    explicit.write_text("enabled: true\n", encoding="utf-8")
    monkeypatch.setenv(COUNCIL_CONFIG_ENV, str(explicit))
    assert resolve_config_path(project) == explicit


def test_env_override_honoured_even_when_absent(
    tmp_path: Path, _sandbox: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    missing = tmp_path / "nope.yml"
    monkeypatch.setenv(COUNCIL_CONFIG_ENV, str(missing))
    assert resolve_config_path(_project(tmp_path)) == missing


def test_falls_back_to_global_write_target_when_nothing_exists(
    tmp_path: Path, _sandbox: Path,
) -> None:
    # Neither project nor global config exists → returns the global write
    # target (non-existent) so callers point "create it here" at global.
    result = resolve_config_path(_project(tmp_path))
    assert result == _global_path(_sandbox)
    assert not result.exists()
