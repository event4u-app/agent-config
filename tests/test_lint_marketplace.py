"""Tests for the Claude Code Plugin Marketplace linter."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parent.parent / "scripts" / "lint_marketplace.py"


def run_linter(cwd: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(SCRIPT)],
        cwd=cwd,
        capture_output=True,
        text=True,
    )


@pytest.fixture
def valid_repo(tmp_path: Path) -> Path:
    """A minimal repo layout that should pass the linter."""
    (tmp_path / "package.json").write_text(json.dumps({
        "name": "@event4u/agent-config",
        "version": "1.4.0",
    }))
    skill_dir = tmp_path / ".claude" / "skills" / "demo-skill"
    skill_dir.mkdir(parents=True)
    (skill_dir / "SKILL.md").write_text("---\nname: demo-skill\ndescription: Demo.\n---\n")

    plugin_dir = tmp_path / ".claude-plugin"
    plugin_dir.mkdir()
    (plugin_dir / "marketplace.json").write_text(json.dumps({
        "name": "event4u-agent-config",
        "owner": {"name": "event4u", "email": "dev@event4u.app"},
        "metadata": {"description": "Test.", "version": "1.4.0"},
        "plugins": [{
            "name": "agent-config",
            "description": "Test bundle.",
            "source": "./",
            "strict": False,
            "skills": ["./.claude/skills/demo-skill"],
        }],
    }))
    return tmp_path


def write_marketplace(repo: Path, payload: dict) -> None:
    (repo / ".claude-plugin" / "marketplace.json").write_text(json.dumps(payload))


def test_valid_repo_passes(valid_repo: Path) -> None:
    result = run_linter(valid_repo)
    assert result.returncode == 0, result.stdout
    assert "No issues" in result.stdout


def test_missing_marketplace_file_fails(tmp_path: Path) -> None:
    (tmp_path / "package.json").write_text(json.dumps({"name": "x", "version": "1.0.0"}))
    result = run_linter(tmp_path)
    assert result.returncode == 1


def test_invalid_json_fails(valid_repo: Path) -> None:
    (valid_repo / ".claude-plugin" / "marketplace.json").write_text("{ not json")
    result = run_linter(valid_repo)
    assert result.returncode == 1
    assert "not valid JSON" in result.stdout


def test_missing_required_top_level_field(valid_repo: Path) -> None:
    write_marketplace(valid_repo, {
        "name": "x",
        "owner": {"name": "e", "email": "e@x"},
        # metadata missing
        "plugins": [],
    })
    result = run_linter(valid_repo)
    assert result.returncode == 1
    assert "metadata" in result.stdout


def test_version_mismatch_with_package_json(valid_repo: Path) -> None:
    payload = json.loads((valid_repo / ".claude-plugin" / "marketplace.json").read_text())
    payload["metadata"]["version"] = "9.9.9"
    write_marketplace(valid_repo, payload)
    result = run_linter(valid_repo)
    assert result.returncode == 1
    assert "package.json" in result.stdout


def test_nonexistent_skill_path_fails(valid_repo: Path) -> None:
    payload = json.loads((valid_repo / ".claude-plugin" / "marketplace.json").read_text())
    payload["plugins"][0]["skills"].append("./.claude/skills/nope")
    write_marketplace(valid_repo, payload)
    result = run_linter(valid_repo)
    assert result.returncode == 1
    assert "nope" in result.stdout


def test_skill_dir_without_skill_md_fails(valid_repo: Path) -> None:
    broken = valid_repo / ".claude" / "skills" / "broken-skill"
    broken.mkdir()
    payload = json.loads((valid_repo / ".claude-plugin" / "marketplace.json").read_text())
    payload["plugins"][0]["skills"].append("./.claude/skills/broken-skill")
    write_marketplace(valid_repo, payload)
    result = run_linter(valid_repo)
    assert result.returncode == 1
    assert "SKILL.md" in result.stdout


def test_duplicate_skill_path_fails(valid_repo: Path) -> None:
    payload = json.loads((valid_repo / ".claude-plugin" / "marketplace.json").read_text())
    payload["plugins"][0]["skills"].append("./.claude/skills/demo-skill")
    write_marketplace(valid_repo, payload)
    result = run_linter(valid_repo)
    assert result.returncode == 1
    assert "duplicate" in result.stdout


def test_empty_plugins_array_fails(valid_repo: Path) -> None:
    payload = json.loads((valid_repo / ".claude-plugin" / "marketplace.json").read_text())
    payload["plugins"] = []
    write_marketplace(valid_repo, payload)
    result = run_linter(valid_repo)
    assert result.returncode == 1
    assert "non-empty" in result.stdout


def test_owner_missing_email_fails(valid_repo: Path) -> None:
    payload = json.loads((valid_repo / ".claude-plugin" / "marketplace.json").read_text())
    del payload["owner"]["email"]
    write_marketplace(valid_repo, payload)
    result = run_linter(valid_repo)
    assert result.returncode == 1
    assert "email" in result.stdout


def test_skill_on_disk_not_listed_in_marketplace_fails(valid_repo: Path) -> None:
    """Reverse drift detection: skill exists on disk but is missing from manifest."""
    drifted = valid_repo / ".claude" / "skills" / "drifted-skill"
    drifted.mkdir()
    (drifted / "SKILL.md").write_text("---\nname: drifted-skill\ndescription: Drift.\n---\n")
    # marketplace.json is unchanged (still lists only demo-skill)
    result = run_linter(valid_repo)
    assert result.returncode == 1
    assert "drifted-skill" in result.stdout
    assert "not listed" in result.stdout


def test_completeness_check_ignores_dirs_without_skill_md(valid_repo: Path) -> None:
    """A directory without SKILL.md is not a skill — must not trigger drift."""
    (valid_repo / ".claude" / "skills" / "_template").mkdir()
    # No SKILL.md inside; should be ignored by the reverse-check
    result = run_linter(valid_repo)
    assert result.returncode == 0, result.stdout
    assert "No issues" in result.stdout


def test_completeness_check_ignores_loose_files(valid_repo: Path) -> None:
    """Files (not dirs) under .claude/skills/ must not trigger drift."""
    (valid_repo / ".claude" / "skills" / "README.md").write_text("# index")
    result = run_linter(valid_repo)
    assert result.returncode == 0, result.stdout
