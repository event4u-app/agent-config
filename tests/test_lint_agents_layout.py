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

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src" / "scripts"))

from lint_agents_layout import (  # noqa: E402
    ALLOWED_FLAT_FILES,
    CONSUMER_EXPECTED_ENTRIES,
    find_consumer_warnings,
    find_violations,
    is_source_repo,
)

REPO = Path(__file__).resolve().parent.parent
SCRIPT = REPO / "src" / "scripts" / "lint_agents_layout.py"


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


def test_cli_strict_flag_accepted_on_clean_consumer(tmp_path: Path) -> None:
    """--strict on a clean consumer shape (overrides/ + bridge marker) exits 0."""
    agents = tmp_path / "agents"
    (agents / "overrides").mkdir(parents=True)
    (agents / ".event4u-bridge.yml").write_text("schema: event4u-bridge/v1\n", encoding="utf-8")
    res = _run_cli(tmp_path, "--strict", "--quiet")
    assert res.returncode == 0, res.stdout + res.stderr


def test_real_repo_has_no_unknown_flat_files() -> None:
    """The production tree must have zero UNKNOWN flat files at agents/ root."""
    unknown = find_violations(REPO / "agents")
    assert unknown == [], "Unknown flat files at agents/ root:\n" + "\n".join(unknown)


# --- Phase 4.4 — consumer-shape warnings & source-repo detection -----

def test_bridge_marker_is_allowed_flat_file() -> None:
    """``.event4u-bridge.yml`` is whitelisted at agents/ root (Phase 4.2)."""
    assert ".event4u-bridge.yml" in ALLOWED_FLAT_FILES


def test_consumer_expected_entries_minimal_set() -> None:
    """Consumer-target shape: overrides/ + bridge marker + .gitkeep only."""
    assert CONSUMER_EXPECTED_ENTRIES == frozenset(
        {"overrides", ".event4u-bridge.yml", ".gitkeep"},
    )


def test_is_source_repo_detects_root_uncondensed(tmp_path: Path) -> None:
    (tmp_path / ".agent-src.uncondensed").mkdir()
    assert is_source_repo(tmp_path) is True


def test_is_source_repo_detects_root_condensed(tmp_path: Path) -> None:
    (tmp_path / ".agent-src").mkdir()
    assert is_source_repo(tmp_path) is True


def test_is_source_repo_detects_pack_uncondensed(tmp_path: Path) -> None:
    (tmp_path / "packages" / "core" / ".agent-src.uncondensed").mkdir(parents=True)
    assert is_source_repo(tmp_path) is True


def test_is_source_repo_false_in_clean_consumer(tmp_path: Path) -> None:
    (tmp_path / "agents" / "overrides").mkdir(parents=True)
    assert is_source_repo(tmp_path) is False


def test_consumer_warnings_silent_on_target_shape(tmp_path: Path) -> None:
    """Consumer target shape (overrides/ + bridge marker) — zero warnings."""
    agents = tmp_path / "agents"
    (agents / "overrides").mkdir(parents=True)
    (agents / ".event4u-bridge.yml").write_text("schema: event4u-bridge/v1\n", encoding="utf-8")
    assert find_consumer_warnings(agents) == []


def test_consumer_warnings_flag_legacy_dirs(tmp_path: Path) -> None:
    agents = tmp_path / "agents"
    (agents / "overrides").mkdir(parents=True)
    (agents / "runtime").mkdir()
    (agents / "evidence").mkdir()
    warnings = find_consumer_warnings(agents)
    joined = "\n".join(warnings)
    assert "runtime" in joined
    assert "evidence" in joined
    # overrides/ is expected — not in warnings.
    assert "overrides" not in joined.replace("agents/overrides/", "")


def test_consumer_warnings_skip_unknown_flat_files(tmp_path: Path) -> None:
    """UNKNOWN flat files are already errors — don't double-count as warnings."""
    agents = tmp_path / "agents"
    (agents / "overrides").mkdir(parents=True)
    (agents / "rogue.txt").write_text("x\n", encoding="utf-8")
    # No warning for rogue.txt (it's an UNKNOWN error elsewhere).
    warnings = find_consumer_warnings(agents)
    assert not any("rogue.txt" in w for w in warnings)


def test_cli_consumer_warnings_exit_zero(tmp_path: Path) -> None:
    """Consumer-mode warnings are soft — default exit code stays 0."""
    agents = tmp_path / "agents"
    (agents / "overrides").mkdir(parents=True)
    (agents / "runtime").mkdir()
    res = _run_cli(tmp_path)
    assert res.returncode == 0, res.stdout + res.stderr
    assert "consumer-shape warnings" in res.stdout
    # The hint points users at the unified `agent-config migrate` command
    # (see docs/contracts/migrate-command.md). The historical
    # `settings migrate` two-step was collapsed in road-to-one-migrate-command.
    assert "@event4u/agent-config migrate" in res.stdout


def test_cli_strict_flips_warnings_to_errors(tmp_path: Path) -> None:
    agents = tmp_path / "agents"
    (agents / "overrides").mkdir(parents=True)
    (agents / "runtime").mkdir()
    res = _run_cli(tmp_path, "--strict")
    assert res.returncode == 1
    assert "consumer-shape warnings" in res.stdout


def test_cli_no_warnings_in_source_repo(tmp_path: Path) -> None:
    """Maintainer source repo — full agents/ tree allowed, no warnings."""
    (tmp_path / ".agent-src").mkdir()
    agents = tmp_path / "agents"
    (agents / "overrides").mkdir(parents=True)
    (agents / "runtime").mkdir()
    (agents / "evidence").mkdir()
    res = _run_cli(tmp_path)
    assert res.returncode == 0, res.stdout + res.stderr
    assert "consumer-shape warnings" not in res.stdout
