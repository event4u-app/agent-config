"""Phase B Step 5 — scripts/cleanup_other_scope.sh smoke tests.

Asserts the safety contract:

- without ``--confirm`` no file is removed (dry-run is the default);
- with ``--confirm`` and a ``--project`` pointer the listed targets vanish;
- ``--tools`` narrows the deletion set;
- files outside the configured roots are never touched (regression hook
  for the non-destructive-by-default rule).
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
CLEANUP_SH = REPO_ROOT / "src" / "scripts" / "cleanup_other_scope.sh"


def _scaffold_scope_tree(root: Path) -> dict[str, Path]:
    """Create a fake scope tree the cleanup script knows about."""
    paths = {
        "claude_skills":     root / ".claude" / "skills" / "demo" / "SKILL.md",
        "claude_rules":      root / ".claude" / "rules" / "demo.md",
        "claude_marketplace": root / ".claude-plugin" / "marketplace.json",
        "augment_root":      root / ".augment" / "rules" / "demo.md",
        "augment_plugin":    root / ".augment-plugin" / "plugin.json",
        "cursor_rules":      root / ".cursor" / "rules" / "demo.mdc",
        "clinerules":        root / ".clinerules" / "demo.md",
        "windsurf_rules":    root / ".windsurf" / "rules" / "demo.md",
        "windsurfrules":     root / ".windsurfrules",
        "copilot_md":        root / ".github" / "copilot-instructions.md",
    }
    for p in paths.values():
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text("placeholder")
    # Bystander file outside the configured roots — must survive every run.
    bystander = root / "agents" / "user-stuff.md"
    bystander.parent.mkdir(parents=True, exist_ok=True)
    bystander.write_text("important")
    paths["bystander"] = bystander
    return paths


def _run(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["bash", str(CLEANUP_SH), *args],
        capture_output=True, text=True, check=False,
    )


def test_dry_run_default_removes_nothing(tmp_path: Path) -> None:
    paths = _scaffold_scope_tree(tmp_path)
    result = _run(["--project", str(tmp_path)])
    assert result.returncode == 0, result.stderr
    assert "DRY RUN" in result.stdout
    for name, path in paths.items():
        assert path.exists(), f"{name} should survive dry-run"


def test_confirm_removes_targets(tmp_path: Path) -> None:
    paths = _scaffold_scope_tree(tmp_path)
    result = _run(["--confirm", "--project", str(tmp_path)])
    assert result.returncode == 0, result.stderr
    # Targets vanish.
    for name in (
        "claude_skills", "claude_rules", "claude_marketplace",
        "augment_root", "augment_plugin", "cursor_rules", "clinerules",
        "windsurf_rules", "windsurfrules", "copilot_md",
    ):
        # claude_skills is a file inside .claude/skills/<demo>/, parent dir gets removed
        assert not paths[name].exists(), f"{name} should be removed (was {paths[name]})"
    # Bystander survives — proof we didn't blow away the whole project root.
    assert paths["bystander"].exists()


def test_tools_filter_scopes_deletion(tmp_path: Path) -> None:
    paths = _scaffold_scope_tree(tmp_path)
    result = _run(["--confirm", "--project", str(tmp_path), "--tools=claude-code"])
    assert result.returncode == 0, result.stderr
    # Claude paths removed.
    assert not paths["claude_skills"].exists()
    assert not paths["claude_rules"].exists()
    assert not paths["claude_marketplace"].exists()
    # All other tools untouched.
    for name in (
        "augment_root", "augment_plugin", "cursor_rules", "clinerules",
        "windsurf_rules", "windsurfrules", "copilot_md", "bystander",
    ):
        assert paths[name].exists(), f"{name} should NOT have been removed under --tools=claude-code"


def test_refuses_without_project_pointer_when_not_user(tmp_path: Path) -> None:
    """--project requires a path argument."""
    result = _run(["--confirm", "--project"])
    assert result.returncode != 0
    assert "requires" in result.stderr.lower() or "Unknown argument" in result.stderr
