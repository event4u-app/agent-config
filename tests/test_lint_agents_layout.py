"""Tests for ``scripts/lint_agents_layout.py``.

Covers the three categories the linter enforces at ``agents/`` root:

  - ALLOWED   — whitelisted flat files pass silently.
  - LEGACY    — scheduled-for-migration files warn (non-strict) or
                fail (strict).
  - UNKNOWN   — anything else fails.

Plus a regression test against the real repo so the production tree
stays green for the ALLOWED + LEGACY mix (no UNKNOWN files).
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from lint_agents_layout import (  # noqa: E402
    ALLOWED_FLAT_FILES,
    LEGACY_FLAT_FILES,
    find_violations,
)

REPO = Path(__file__).resolve().parent.parent
SCRIPT = REPO / "scripts" / "lint_agents_layout.py"


def _seed(root: Path, names: list[str]) -> None:
    root.mkdir(parents=True, exist_ok=True)
    for name in names:
        (root / name).write_text("x\n", encoding="utf-8")


def test_allowed_only_passes(tmp_path: Path) -> None:
    agents = tmp_path / "agents"
    _seed(agents, sorted(ALLOWED_FLAT_FILES))
    unknown, legacy = find_violations(agents)
    assert unknown == []
    assert legacy == []


def test_legacy_files_warn(tmp_path: Path) -> None:
    agents = tmp_path / "agents"
    _seed(agents, [".agent-chat-history"])
    unknown, legacy = find_violations(agents)
    assert unknown == []
    assert len(legacy) == 1
    assert ".agent-chat-history" in legacy[0]
    assert "legacy flat file" in legacy[0]


def test_unknown_file_fails(tmp_path: Path) -> None:
    agents = tmp_path / "agents"
    _seed(agents, ["scratch.txt"])
    unknown, legacy = find_violations(agents)
    assert len(unknown) == 1
    assert "scratch.txt" in unknown[0]
    assert "not in agents/ whitelist" in unknown[0]
    assert legacy == []


def test_mixed_allowed_legacy_unknown(tmp_path: Path) -> None:
    agents = tmp_path / "agents"
    _seed(
        agents,
        [
            "index.md",
            "roadmaps-progress.md",
            ".agent-chat-history",
            ".augment-budget-history.jsonl",
            "rogue.md",
        ],
    )
    unknown, legacy = find_violations(agents)
    assert len(unknown) == 1
    assert "rogue.md" in unknown[0]
    assert len(legacy) == 2


def test_subdirectories_ignored(tmp_path: Path) -> None:
    agents = tmp_path / "agents"
    sub = agents / "runtime"
    sub.mkdir(parents=True)
    (sub / "anything.txt").write_text("x\n", encoding="utf-8")
    unknown, legacy = find_violations(agents)
    assert unknown == []
    assert legacy == []


def test_missing_root_is_silent(tmp_path: Path) -> None:
    unknown, legacy = find_violations(tmp_path / "does-not-exist")
    assert unknown == []
    assert legacy == []


def _run_cli(cwd: Path, *flags: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *flags],
        cwd=cwd,
        capture_output=True,
        text=True,
        check=False,
    )


def test_cli_strict_promotes_legacy_to_error(tmp_path: Path) -> None:
    agents = tmp_path / "agents"
    _seed(agents, [".agent-chat-history"])
    res = _run_cli(tmp_path, "--strict", "--quiet")
    assert res.returncode == 1, res.stdout + res.stderr


def test_cli_normal_passes_with_legacy(tmp_path: Path) -> None:
    agents = tmp_path / "agents"
    _seed(agents, [".agent-chat-history"])
    res = _run_cli(tmp_path, "--quiet")
    assert res.returncode == 0, res.stdout + res.stderr


def test_cli_fails_on_unknown(tmp_path: Path) -> None:
    agents = tmp_path / "agents"
    _seed(agents, ["mystery.txt"])
    res = _run_cli(tmp_path, "--quiet")
    assert res.returncode == 1
    assert "mystery.txt" in res.stdout


def test_real_repo_has_no_unknown_flat_files() -> None:
    """The production tree must have zero UNKNOWN flat files at agents/ root.

    LEGACY files are tolerated until their scheduled migration; UNKNOWN
    is the hard-fail bar this lint defends.
    """
    unknown, _legacy = find_violations(REPO / "agents")
    assert unknown == [], "Unknown flat files at agents/ root:\n" + "\n".join(unknown)


def test_legacy_targets_documented() -> None:
    """Every LEGACY entry must point to a target path / rationale."""
    for name, target in LEGACY_FLAT_FILES.items():
        assert target.strip(), f"LEGACY {name!r} has empty target"
        assert "/" in target, (
            f"LEGACY {name!r} target should reference a path: {target!r}"
        )
