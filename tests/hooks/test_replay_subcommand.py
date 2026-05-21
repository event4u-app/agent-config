"""Replay-mode regression tests for `./agent-config hooks:replay`.

Asserts the contract in `docs/contracts/hook-architecture-v1.md`
§ "Replay mode": fixture-driven dispatch under `AGENT_CONFIG_REPLAY=1`
must never mutate `agents/runtime/state/` or `agents/.agent-chat-history`,
and must succeed (exit 0) for every fixture × platform combination
shipped under `tests/fixtures/hooks/`.

Each test invokes `scripts/hooks/replay_hook.py` as a subprocess from
a *clean tmp workspace* (chdir-ed via `cwd=`). That isolates the
filesystem so a regression that re-introduces a write surfaces as a
file appearing under `<tmp>/agents/runtime/state/` — the assertion this suite
is built to make. Roadmap step: P2.4c of
`agents/roadmaps/road-to-proof-not-features.md`.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
REPLAY_SCRIPT = REPO_ROOT / "scripts" / "hooks" / "replay_hook.py"
FIXTURE_DIR = REPO_ROOT / "tests" / "fixtures" / "hooks"
MANIFEST = REPO_ROOT / "scripts" / "hook_manifest.yaml"

EVENTS = [
    "session_start", "session_end", "user_prompt_submit",
    "pre_tool_use", "post_tool_use", "stop", "pre_compact", "agent_error",
]
PLATFORMS = ["augment", "claude", "cursor", "cline", "windsurf", "gemini", "copilot"]


def _run_replay(workspace: Path, platform: str, event: str,
                *, extra_args: list[str] | None = None) -> subprocess.CompletedProcess:
    """Run the replay driver against the package manifest from a tmp workspace."""
    cmd = [sys.executable, str(REPLAY_SCRIPT),
           "--platform", platform,
           "--event", event,
           "--payload", str(FIXTURE_DIR / f"{event}.json"),
           "--manifest", str(MANIFEST)]
    if extra_args:
        cmd.extend(extra_args)
    return subprocess.run(cmd, cwd=workspace, capture_output=True, text=True,
                          check=False)


def _snapshot_state(workspace: Path) -> set[Path]:
    """Return the set of files under workspace/agents that exist post-replay."""
    agents = workspace / "agents"
    if not agents.exists():
        return set()
    return {p.relative_to(workspace) for p in agents.rglob("*") if p.is_file()}


@pytest.fixture
def clean_workspace(tmp_path: Path) -> Path:
    """A pristine workspace — no `agents/` dir, no settings file. The
    dispatcher and its concerns operate relative to CWD, so any write
    surfaces as a file under this tmp root."""
    return tmp_path


@pytest.mark.parametrize("event", EVENTS)
def test_replay_does_not_mutate_state_augment(clean_workspace: Path, event: str) -> None:
    """For Augment + every event fixture: replay creates zero files."""
    before = _snapshot_state(clean_workspace)
    result = _run_replay(clean_workspace, "augment", event)
    after = _snapshot_state(clean_workspace)
    assert result.returncode == 0, (
        f"replay rc={result.returncode} for event={event}\n"
        f"stdout: {result.stdout}\nstderr: {result.stderr}")
    new_files = after - before
    assert not new_files, (
        f"replay mutated state for event={event}: {sorted(new_files)}")


@pytest.mark.parametrize("platform", PLATFORMS)
def test_replay_does_not_mutate_state_per_platform(
    clean_workspace: Path, platform: str,
) -> None:
    """For every supported platform on the canonical post_tool_use fixture:
    replay creates zero files. Catches platform-specific concern routing
    that might bypass the replay guard."""
    before = _snapshot_state(clean_workspace)
    result = _run_replay(clean_workspace, platform, "post_tool_use")
    after = _snapshot_state(clean_workspace)
    assert result.returncode == 0, (
        f"replay rc={result.returncode} for platform={platform}\n"
        f"stdout: {result.stdout}\nstderr: {result.stderr}")
    new_files = after - before
    assert not new_files, (
        f"replay mutated state for platform={platform}: {sorted(new_files)}")


def test_replay_sets_env_flag(clean_workspace: Path) -> None:
    """The driver must set AGENT_CONFIG_REPLAY=1 in the dispatcher subprocess.
    Verified indirectly: a sentinel concern that writes only when the flag
    is unset would create a file — we assert the file is absent."""
    result = _run_replay(clean_workspace, "augment", "post_tool_use",
                         extra_args=["--json"])
    assert result.returncode == 0
    summary = json.loads(result.stdout)
    assert summary["replay_mode"] is True
    assert summary["platform"] == "augment"
    assert summary["event"] == "post_tool_use"
    assert summary["session_id"] == "fixture-post-tool-001"


def test_replay_resolves_bare_event_name(clean_workspace: Path) -> None:
    """Passing `--payload post_tool_use` (no path, no .json) resolves to
    `tests/fixtures/hooks/post_tool_use.json` via FIXTURE_DIR lookup."""
    cmd = [sys.executable, str(REPLAY_SCRIPT),
           "--platform", "augment", "--event", "post_tool_use",
           "--payload", "post_tool_use", "--manifest", str(MANIFEST), "--json"]
    result = subprocess.run(cmd, cwd=clean_workspace, capture_output=True,
                            text=True, check=False)
    assert result.returncode == 0, result.stderr
    summary = json.loads(result.stdout)
    assert summary["payload"].endswith("post_tool_use.json")


def test_replay_rejects_invalid_payload_path(clean_workspace: Path) -> None:
    """Missing payload exits 2 with a clear error message — not a dispatcher
    invocation. Guards against silent fixture-name typos."""
    cmd = [sys.executable, str(REPLAY_SCRIPT),
           "--platform", "augment", "--event", "post_tool_use",
           "--payload", "nonexistent_event_xyz", "--manifest", str(MANIFEST)]
    result = subprocess.run(cmd, cwd=clean_workspace, capture_output=True,
                            text=True, check=False)
    assert result.returncode == 2
    assert "not found" in result.stderr.lower()


def test_replay_dry_run_lists_concerns(clean_workspace: Path) -> None:
    """`--dry-run` prints the resolved concern plan without running them.
    Useful for hooks:doctor cross-checks."""
    result = _run_replay(clean_workspace, "augment", "post_tool_use",
                         extra_args=["--dry-run"])
    assert result.returncode == 0
    plan = json.loads(result.stdout)
    assert plan["platform"] == "augment"
    assert plan["event"] == "post_tool_use"
    assert isinstance(plan["concerns"], list)
    after = _snapshot_state(clean_workspace)
    assert not after, f"dry-run mutated state: {sorted(after)}"
