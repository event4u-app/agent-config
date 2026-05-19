"""Shared fixtures for the ``agent-config explain last`` test suite.

Builds a synthetic project root in ``tmp_path`` with the same shape
the runtime resolvers expect: ``router.json``, a minimal preset, and a
minimal profile. The canonical ``.work-state.json`` fixtures under
``tests/fixtures/explain_last/`` are copied in by name on demand.
"""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2].parent
FIXTURES_DIR = REPO_ROOT / "tests" / "fixtures" / "explain_last"

sys.path.insert(0, str(REPO_ROOT))


_ROUTER = {
    "schema_version": 1,
    "kernel": ["direct-answers", "no-cheap-questions"],
    "tier_1": [
        {"id": "architecture", "triggers": [{"keyword": "controller"}]},
        {"id": "downstream-changes", "triggers": [{"keyword": "caller"}]},
    ],
    "tier_2": [],
}


def _seed_project(tmp_path: Path) -> Path:
    (tmp_path / "router.json").write_text(json.dumps(_ROUTER), encoding="utf-8")
    presets_dir = tmp_path / ".agent-src.uncompressed" / "presets"
    presets_dir.mkdir(parents=True)
    (presets_dir / "balanced.yml").write_text(
        "preset:\n"
        "  id: balanced\n"
        "  cost: {daily_max_usd: 10.0, weekly_max_usd: 50.0,"
        " monthly_max_usd: 150.0}\n"
        "  autonomy: {default: auto}\n",
        encoding="utf-8",
    )
    profiles_dir = tmp_path / ".agent-src.uncompressed" / "profiles"
    profiles_dir.mkdir(parents=True)
    (profiles_dir / "developer.yml").write_text(
        "profile:\n  id: developer\n  preset: balanced\n",
        encoding="utf-8",
    )
    return tmp_path


@pytest.fixture()
def project_root(tmp_path: Path) -> Path:
    """Seeded project root with router + preset + profile."""
    return _seed_project(tmp_path)


@pytest.fixture()
def copy_state(project_root: Path):
    """Copy a named fixture into ``<project_root>/.work-state.json``."""
    def _copy(fixture_name: str) -> Path:
        src = FIXTURES_DIR / fixture_name
        dst = project_root / ".work-state.json"
        shutil.copyfile(src, dst)
        return dst
    return _copy


@pytest.fixture()
def attach_council(project_root: Path):
    """Drop a council-responses.json next to the seeded state file.

    Places the sidecar under ``agents/council-sessions/<sess>/`` and
    aligns its mtime with the state file so the 1h windowing in
    :mod:`scripts._cli.explain_last.council` accepts it.
    """
    def _attach(state_file: Path, session_id: str = "sess-test") -> Path:
        sess_dir = project_root / "agents" / "council-sessions" / session_id
        sess_dir.mkdir(parents=True, exist_ok=True)
        src = FIXTURES_DIR / "council-responses.json"
        dst = sess_dir / "council-responses.json"
        shutil.copyfile(src, dst)
        # Sync mtime with the state file (1h window in council.py).
        stat = state_file.stat()
        import os
        os.utime(dst, (stat.st_atime, stat.st_mtime))
        return dst
    return _attach
