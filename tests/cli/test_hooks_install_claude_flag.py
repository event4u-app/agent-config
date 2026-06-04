"""Smoke test for `agent-config hooks:install --claude` / `--lifecycle` / `--regen`.

Phase 4 Step 5 of `road-to-hooks-actually-fire-in-consumers`.

Drives the wrapper end-to-end against a temp consumer dir. Covers:
  - `--claude` writes .claude/settings.json with plugin enabled.
  - `--claude` creates the ./agent-config symlink.
  - `--lifecycle` alias produces the identical result.
  - `--claude --regen` together produces both surfaces in one call.
  - Idempotent re-run.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parent.parent.parent
AGENT_CONFIG = REPO_ROOT / "src" / "scripts" / "agent-config"


def _run_in_consumer(consumer: Path, *args: str) -> subprocess.CompletedProcess:
    """Invoke `./agent-config hooks:install ...` with consumer as CWD."""
    return subprocess.run(
        [str(AGENT_CONFIG), "hooks:install", *args],
        cwd=str(consumer),
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )


@pytest.fixture
def consumer(tmp_path):
    """A clean consumer-shape directory."""
    return tmp_path


def test_claude_writes_settings_json(consumer):
    result = _run_in_consumer(consumer, "--claude")
    assert result.returncode == 0, f"stderr: {result.stderr}\nstdout: {result.stdout}"
    settings = consumer / ".claude" / "settings.json"
    assert settings.is_file()
    data = json.loads(settings.read_text())
    assert data["enabledPlugins"]["agent-config@event4u-agent-config"] is True


def test_claude_creates_agent_config_symlink(consumer):
    result = _run_in_consumer(consumer, "--claude")
    assert result.returncode == 0
    link = consumer / "agent-config"
    assert link.is_symlink()
    target = os.readlink(link)
    assert "src/scripts/agent-config" in target


def test_lifecycle_alias_identical_to_claude(consumer):
    """--lifecycle must produce the same artifacts as --claude."""
    result = _run_in_consumer(consumer, "--lifecycle")
    assert result.returncode == 0
    assert (consumer / ".claude" / "settings.json").is_file()
    assert (consumer / "agent-config").is_symlink()


def test_claude_idempotent(consumer):
    """Re-running --claude should be a no-op (still exit 0)."""
    r1 = _run_in_consumer(consumer, "--claude")
    assert r1.returncode == 0
    r2 = _run_in_consumer(consumer, "--claude")
    assert r2.returncode == 0
    assert "already current" in r2.stdout


def test_regen_provisions_regenerator(consumer):
    result = _run_in_consumer(consumer, "--regen")
    assert result.returncode == 0, f"stderr: {result.stderr}\nstdout: {result.stdout}"
    regen = consumer / ".augment" / "scripts" / "update_roadmap_progress.py"
    assert regen.is_file()
    assert os.access(regen, os.X_OK)


def test_claude_and_regen_together(consumer):
    """Both flags in one invocation produce both surfaces."""
    result = _run_in_consumer(consumer, "--claude", "--regen")
    assert result.returncode == 0
    assert (consumer / ".claude" / "settings.json").is_file()
    assert (consumer / "agent-config").is_symlink()
    assert (consumer / ".augment" / "scripts" / "update_roadmap_progress.py").is_file()


def test_claude_merges_into_existing_settings(consumer):
    """--claude must NOT clobber existing keys in settings.json."""
    settings_dir = consumer / ".claude"
    settings_dir.mkdir()
    (settings_dir / "settings.json").write_text(json.dumps({
        "permissions": {"allowedTools": ["Read"]},
        "enabledPlugins": {"some-other-plugin": True},
    }))
    result = _run_in_consumer(consumer, "--claude")
    assert result.returncode == 0
    data = json.loads((settings_dir / "settings.json").read_text())
    # Both pre-existing keys preserved
    assert data["permissions"]["allowedTools"] == ["Read"]
    assert data["enabledPlugins"]["some-other-plugin"] is True
    # New key added
    assert data["enabledPlugins"]["agent-config@event4u-agent-config"] is True
