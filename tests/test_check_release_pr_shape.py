"""Tests for scripts/check_release_pr_shape.py.

Covers the three fixtures named in road-to-optimized-ci-and-release-gates
Phase A Step 5:

* a real 3.3.0 release-PR diff (pass)
* a synthetic release-PR diff with a stray scripts/install.py change (fail)
* an empty diff (fail)

Plus two regression cases to lock the allowlist surface:

* pack-only diff (multiple packages) — pass
* nested file under packages/ (e.g. packages/core/installer/foo.ts) — fail
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import check_release_pr_shape as shape  # noqa: E402


def _check(files: list[str], capsys: pytest.CaptureFixture[str]) -> tuple[int, str]:
    code = shape.check(files)
    return code, capsys.readouterr().out


def test_real_330_release_pr_passes(capsys: pytest.CaptureFixture[str]) -> None:
    """PR #238 (3.3.0) shape — every file in the version-bump allowlist."""
    files = [
        "package.json",
        "CHANGELOG.md",
        ".claude-plugin/marketplace.json",
        "packages/core/pack.yaml",
        "packages/core/README.md",
        "packages/pack-finance-basic/pack.yaml",
        "packages/pack-finance-basic/README.md",
    ]
    code, out = _check(files, capsys)
    assert code == 0
    assert "SHAPE-CLEAN" in out
    for f in files:
        assert f"ok: {f}" in out


def test_stray_install_script_fails(capsys: pytest.CaptureFixture[str]) -> None:
    """Release-PR shape rejected when the diff carries an installer edit."""
    files = [
        "package.json",
        "CHANGELOG.md",
        "scripts/install.py",  # ← the stray
    ]
    code, out = _check(files, capsys)
    assert code == 1
    assert "OUT-OF-SHAPE: scripts/install.py" in out
    # The shape-clean files do NOT appear in stdout on failure — only the
    # offenders, so CI logs surface the precise reason without noise.
    assert "ok: package.json" not in out


def test_empty_diff_fails(capsys: pytest.CaptureFixture[str]) -> None:
    """Empty diff is fail-closed — release PR must touch at least one file."""
    code, out = _check([], capsys)
    assert code == 1
    assert "empty diff" in out


def test_pack_only_release_passes(capsys: pytest.CaptureFixture[str]) -> None:
    """Pack-only release bumps multiple packages/*/pack.yaml — still shape-clean."""
    files = [
        "package.json",
        "CHANGELOG.md",
        "packages/core/pack.yaml",
        "packages/pack-finance-basic/pack.yaml",
        "packages/pack-founder-strategy/pack.yaml",
    ]
    code, _ = _check(files, capsys)
    assert code == 0


def test_nested_package_file_fails(capsys: pytest.CaptureFixture[str]) -> None:
    """`packages/core/installer/foo.ts` must NOT match `packages/*/pack.yaml`."""
    files = [
        "package.json",
        "packages/core/installer/foo.ts",  # ← deeper than allowlist
    ]
    code, out = _check(files, capsys)
    assert code == 1
    assert "OUT-OF-SHAPE: packages/core/installer/foo.ts" in out


def test_marketplace_metadata_only_passes(capsys: pytest.CaptureFixture[str]) -> None:
    """A version bump that only touches marketplace.json is shape-clean."""
    code, _ = _check([".claude-plugin/marketplace.json"], capsys)
    assert code == 0


def test_changelog_only_passes(capsys: pytest.CaptureFixture[str]) -> None:
    """CHANGELOG-only diff (e.g. release-prep retag fixup) is shape-clean."""
    code, _ = _check(["CHANGELOG.md"], capsys)
    assert code == 0


def test_pack_readme_only_passes(capsys: pytest.CaptureFixture[str]) -> None:
    """Pack README updates are part of the release surface and shape-clean."""
    code, _ = _check(["packages/core/README.md"], capsys)
    assert code == 0


def test_matches_helper_rejects_unrelated_paths() -> None:
    """Spot-check the matcher: random project paths must not slip through."""
    assert not shape._matches("scripts/install.py")
    assert not shape._matches("tests/test_condense.py")
    assert not shape._matches(".github/workflows/tests.yml")
    assert not shape._matches("packages/core/installer/foo.ts")
    assert shape._matches("package.json")
    assert shape._matches("packages/core/pack.yaml")
    assert shape._matches("packages/core/README.md")
