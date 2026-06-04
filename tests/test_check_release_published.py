"""Tests for scripts/check_release_published.py — the release-published drift gate."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src" / "scripts"))
import check_release_published as c  # noqa: E402


@pytest.fixture()
def stub(monkeypatch):
    def _apply(*, version, tagged, npm_latest=None, on_main=True, name="@event4u/agent-config"):
        monkeypatch.setattr(c, "_package_version", lambda: version)
        monkeypatch.setattr(c, "_package_name", lambda: name)
        monkeypatch.setattr(c, "_tag_exists", lambda t: tagged)
        monkeypatch.setattr(c, "_on_main", lambda: on_main)
        monkeypatch.setattr(c, "_npm_latest", lambda pkg: npm_latest)
    return _apply


def test_pass_when_tagged(stub) -> None:
    stub(version="5.8.0", tagged=True)
    assert c.main(["--strict"]) == 0


def test_strict_fails_when_untagged(stub) -> None:
    stub(version="5.8.0", tagged=False)
    assert c.main(["--strict"]) == 1


def test_warn_only_never_fails(stub) -> None:
    stub(version="5.8.0", tagged=False)
    assert c.main([]) == 0  # default mode is informational


def test_npm_lag_fails_strict(stub) -> None:
    stub(version="5.8.0", tagged=True, npm_latest="5.7.0")
    assert c.main(["--strict", "--check-npm"]) == 1


def test_npm_in_sync_passes(stub) -> None:
    stub(version="5.8.0", tagged=True, npm_latest="5.8.0")
    assert c.main(["--strict", "--check-npm"]) == 0


def test_npm_unreadable_is_warned_not_failed(stub) -> None:
    stub(version="5.8.0", tagged=True, npm_latest=None)
    # tag ok + npm unreadable → no hard failure
    assert c.main(["--strict", "--check-npm"]) == 0


def test_require_main_noops_off_main(stub) -> None:
    stub(version="5.8.0", tagged=False, on_main=False)
    assert c.main(["--strict", "--require-main"]) == 0  # skipped off main


def test_require_main_enforces_on_main(stub) -> None:
    stub(version="5.8.0", tagged=False, on_main=True)
    assert c.main(["--strict", "--require-main"]) == 1


def test_non_semver_version_errors(stub) -> None:
    stub(version="not-a-version", tagged=True)
    assert c.main(["--strict"]) == 3
