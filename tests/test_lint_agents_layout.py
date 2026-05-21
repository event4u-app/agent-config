"""Tests for ``scripts/lint_agents_layout.py``.

Covers the two categories the linter enforces at ``agents/`` root:

  - ALLOWED — whitelisted flat files pass silently.
  - UNKNOWN — anything else fails.

The LEGACY tier was removed once ``agents/runtime/`` became volatile and
gitignored; volatile files no longer appear at ``agents/`` root in a clean
tree. Durable records live under typed subdirs (``decisions/``,
``evidence/``, ``settings/``, …).

Plus a regression test against the real repo so the production tree
stays green (no UNKNOWN files).
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from lint_agents_layout import (  # noqa: E402
    ALLOWED_FLAT_FILES,
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
    unknown = find_violations(agents)
    assert unknown == []


def test_unknown_file_fails(tmp_path: Path) -> None:
    agents = tmp_path / "agents"
    _seed(agents, ["scratch.txt"])
    unknown = find_violations(agents)
    assert len(unknown) == 1
    assert "scratch.txt" in unknown[0]
    assert "not in agents/ whitelist" in unknown[0]


def test_chat_history_at_agents_root_is_unknown(tmp_path: Path) -> None:
    """Volatile runtime files at agents/ root are now UNKNOWN — they
    belong under agents/runtime/ and are gitignored there.
    """
    agents = tmp_path / "agents"
    _seed(agents, [".agent-chat-history"])
    unknown = find_violations(agents)
    assert len(unknown) == 1
    assert ".agent-chat-history" in unknown[0]


def test_mixed_allowed_and_unknown(tmp_path: Path) -> None:
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
    unknown = find_violations(agents)
    # Three UNKNOWN: chat-history, budget-history, rogue.md.
    assert len(unknown) == 3
    flat = "\n".join(unknown)
    assert "rogue.md" in flat
    assert ".agent-chat-history" in flat
    assert ".augment-budget-history.jsonl" in flat


def test_subdirectories_ignored(tmp_path: Path) -> None:
    agents = tmp_path / "agents"
    sub = agents / "runtime"
    sub.mkdir(parents=True)
    (sub / "anything.txt").write_text("x\n", encoding="utf-8")
    unknown = find_violations(agents)
    assert unknown == []


def test_missing_root_is_silent(tmp_path: Path) -> None:
    unknown = find_violations(tmp_path / "does-not-exist")
    assert unknown == []


def _run_cli(cwd: Path, *flags: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *flags],
        cwd=cwd,
        capture_output=True,
        text=True,
        check=False,
    )


def test_cli_fails_on_unknown(tmp_path: Path) -> None:
    agents = tmp_path / "agents"
    _seed(agents, ["mystery.txt"])
    res = _run_cli(tmp_path, "--quiet")
    assert res.returncode == 1
    assert "mystery.txt" in res.stdout


def test_cli_strict_flag_accepted_for_backcompat(tmp_path: Path) -> None:
    """--strict is a no-op now; the linter still accepts it without error."""
    agents = tmp_path / "agents"
    _seed(agents, sorted(ALLOWED_FLAT_FILES))
    res = _run_cli(tmp_path, "--strict", "--quiet")
    assert res.returncode == 0, res.stdout + res.stderr


def test_real_repo_has_no_unknown_flat_files() -> None:
    """The production tree must have zero UNKNOWN flat files at agents/ root."""
    unknown = find_violations(REPO / "agents")
    assert unknown == [], "Unknown flat files at agents/ root:\n" + "\n".join(unknown)
