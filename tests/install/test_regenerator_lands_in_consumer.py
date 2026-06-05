"""Unit test for the regenerator-into-consumer install helper.

Phase 3 Step 4 of `road-to-hooks-actually-fire-in-consumers`.

The helper (`scripts/_lib/install_regenerator.py`) is consumed by
`scripts/install.py`'s full-install path AND by
`scripts/_dispatch.bash::cmd_hooks_install --regen`. This test
exercises the helper directly against a temp consumer root.
"""
from __future__ import annotations

import importlib.util
import os
import stat
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
MODULE_PATH = REPO_ROOT / "src" / "scripts" / "_lib" / "install_regenerator.py"


def _load():
    spec = importlib.util.spec_from_file_location("install_regenerator", MODULE_PATH)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules["install_regenerator"] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def helper():
    return _load()


def test_install_regenerator_writes_canonical_path(helper, tmp_path):
    ok, msg = helper.install_regenerator(REPO_ROOT, tmp_path)
    assert ok, msg
    target = tmp_path / ".augment" / "scripts" / "update_roadmap_progress.py"
    assert target.is_file()
    assert os.access(target, os.X_OK), "regenerator must be executable"


def test_install_regenerator_idempotent(helper, tmp_path):
    ok1, msg1 = helper.install_regenerator(REPO_ROOT, tmp_path)
    assert ok1
    ok2, msg2 = helper.install_regenerator(REPO_ROOT, tmp_path)
    assert ok2
    assert "already current" in msg2


def test_install_regenerator_content_matches_source(helper, tmp_path):
    helper.install_regenerator(REPO_ROOT, tmp_path)
    target = tmp_path / ".augment" / "scripts" / "update_roadmap_progress.py"
    source = helper.package_source(REPO_ROOT)
    assert source is not None
    assert target.read_bytes() == source.read_bytes()


def test_is_installed_false_on_empty_consumer(helper, tmp_path):
    assert helper.is_installed(tmp_path) is False


def test_is_installed_true_after_install(helper, tmp_path):
    helper.install_regenerator(REPO_ROOT, tmp_path)
    assert helper.is_installed(tmp_path) is True


def test_consumer_target_path_is_canonical(helper, tmp_path):
    target = helper.consumer_target(tmp_path)
    assert target == tmp_path / ".augment" / "scripts" / "update_roadmap_progress.py"


def test_package_source_returns_existing_file(helper):
    source = helper.package_source(REPO_ROOT)
    assert source is not None
    assert source.is_file()
    # Must be one of the known canonical locations.
    assert any(
        marker in str(source)
        for marker in (
            # 6.0.x (ADR-051): uncondensed source container relocated to src/agent-src/.
            "src/agent-src/scripts",
            "packages/core/.agent-src.uncondensed",
            ".agent-src/scripts",
            ".augment/scripts",
        )
    )


def test_install_regenerator_missing_source(helper, tmp_path):
    """When the package root has no regenerator, helper reports cleanly."""
    fake_pkg = tmp_path / "fake-package"
    fake_pkg.mkdir()
    consumer = tmp_path / "consumer"
    ok, msg = helper.install_regenerator(fake_pkg, consumer)
    assert ok is False
    assert "regenerator source not found" in msg
