"""Phase C — probe_skill_registration.py coverage.

Synthetic fixtures stand in for the six tool surfaces so each duplicate /
drift shape is exercised in isolation without touching the host machine's
real install state.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
PROBE = REPO_ROOT / "scripts" / "probe_skill_registration.py"

sys.path.insert(0, str(REPO_ROOT))
from scripts.probe_skill_registration import run_probe  # noqa: E402


def _write_skill(root: Path, tool_dir: str, skill_id: str, description: str, *, fmt: str = "skill_md") -> None:
    if fmt == "skill_md":
        path = root / tool_dir / skill_id / "SKILL.md"
    elif fmt == "mdc":
        path = root / tool_dir / f"{skill_id}.mdc"
    elif fmt == "md":
        path = root / tool_dir / f"{skill_id}.md"
    elif fmt == "single":
        path = root / tool_dir / "copilot-instructions.md"
    else:
        raise ValueError(fmt)
    path.parent.mkdir(parents=True, exist_ok=True)
    fm = "---\n" + f"name: {skill_id}\n" + f'description: "{description}"\n' + "---\n# body\n"
    path.write_text(fm, encoding="utf-8")


def _write_pkgjson(root: Path, version: str) -> None:
    (root / "package.json").write_text(json.dumps({"version": version}), encoding="utf-8")


def test_no_findings_when_only_one_scope(tmp_path: Path) -> None:
    """Project-only install with no user-global twin → no DUPLICATE / DRIFT."""
    project = tmp_path / "project"
    project.mkdir()
    _write_pkgjson(project, "3.3.0")
    _write_skill(project, ".claude/skills", "alpha", "First skill")
    result = run_probe(home=tmp_path / "empty-home", project=project)
    assert len(result.registrations) == 1
    assert result.duplicates == {}
    assert result.drift == {}


def test_same_skill_in_both_scopes_flags_duplicate(tmp_path: Path) -> None:
    home = tmp_path / "home"
    project = tmp_path / "project"
    home.mkdir()
    project.mkdir()
    _write_pkgjson(home, "3.3.0")
    _write_pkgjson(project, "3.3.0")
    _write_skill(home, ".claude/skills", "alpha", "Same description")
    _write_skill(project, ".claude/skills", "alpha", "Same description")
    result = run_probe(home=home, project=project)
    assert "claude:alpha" in result.duplicates, result.to_dict()
    # Same hash + version → DUPLICATE but NOT DRIFT.
    assert "claude:alpha" not in result.drift


def test_same_skill_different_descriptions_flags_drift(tmp_path: Path) -> None:
    home = tmp_path / "home"
    project = tmp_path / "project"
    home.mkdir()
    project.mkdir()
    _write_pkgjson(home, "3.3.0")
    _write_pkgjson(project, "3.3.0")
    _write_skill(home, ".claude/skills", "copilot-config", "Stale description from older install")
    _write_skill(project, ".claude/skills", "copilot-config", "Fresh description from current install")
    result = run_probe(home=home, project=project)
    assert "claude:copilot-config" in result.duplicates
    assert "claude:copilot-config" in result.drift, "drift must fire when description hashes differ"


def test_same_skill_different_versions_flags_drift(tmp_path: Path) -> None:
    home = tmp_path / "home"
    project = tmp_path / "project"
    home.mkdir()
    project.mkdir()
    _write_pkgjson(home, "2.9.0")
    _write_pkgjson(project, "3.3.0")
    _write_skill(home, ".claude/skills", "alpha", "Same description")
    _write_skill(project, ".claude/skills", "alpha", "Same description")
    result = run_probe(home=home, project=project)
    assert "claude:alpha" in result.drift, "drift must fire when versions differ"


def test_plugin_manifest_is_separate_source(tmp_path: Path) -> None:
    """The manifest entries register under scope='*-plugin' — duplicate vs filesystem."""
    project = tmp_path / "project"
    project.mkdir()
    _write_pkgjson(project, "3.3.0")
    _write_skill(project, ".claude/skills", "alpha", "From filesystem")
    manifest = project / ".claude-plugin" / "marketplace.json"
    manifest.parent.mkdir(parents=True)
    manifest.write_text(json.dumps({
        "plugins": [{
            "name": "agent-config",
            "skills": ["./.claude/skills/alpha"],
        }],
    }), encoding="utf-8")
    result = run_probe(home=tmp_path / "empty-home", project=project)
    assert "claude:alpha" in result.duplicates, "filesystem + manifest entries must register as DUPLICATE"


def test_cursor_cline_windsurf_copilot_readers(tmp_path: Path) -> None:
    """Each non-Claude/Augment tool produces a registration row."""
    project = tmp_path / "project"
    project.mkdir()
    _write_pkgjson(project, "3.3.0")
    _write_skill(project, ".cursor/rules", "rule-one", "Cursor rule", fmt="mdc")
    _write_skill(project, ".clinerules", "rule-two", "Cline rule", fmt="md")
    _write_skill(project, ".windsurf/rules", "rule-three", "Windsurf rule", fmt="md")
    _write_skill(project, ".github", "copilot-instructions", "n/a", fmt="single")
    result = run_probe(home=tmp_path / "empty-home", project=project)
    tools = {r.tool for r in result.registrations}
    assert {"cursor", "cline", "windsurf", "copilot"}.issubset(tools)


def test_cli_strict_exits_non_zero_on_findings(tmp_path: Path) -> None:
    home = tmp_path / "home"
    project = tmp_path / "project"
    home.mkdir()
    project.mkdir()
    _write_pkgjson(home, "3.3.0")
    _write_pkgjson(project, "3.3.0")
    _write_skill(home, ".claude/skills", "alpha", "Stale")
    _write_skill(project, ".claude/skills", "alpha", "Fresh")
    result = subprocess.run(
        ["python3", str(PROBE), "--strict", "--home", str(home), "--project", str(project), "--format=json"],
        capture_output=True, text=True, check=False,
    )
    assert result.returncode == 2, f"strict mode should exit 2 on drift, got {result.returncode}\n{result.stdout}\n{result.stderr}"


def test_cli_default_exits_zero_even_with_findings(tmp_path: Path) -> None:
    home = tmp_path / "home"
    project = tmp_path / "project"
    home.mkdir()
    project.mkdir()
    _write_pkgjson(home, "3.3.0")
    _write_pkgjson(project, "3.3.0")
    _write_skill(home, ".claude/skills", "alpha", "Stale")
    _write_skill(project, ".claude/skills", "alpha", "Fresh")
    result = subprocess.run(
        ["python3", str(PROBE), "--home", str(home), "--project", str(project)],
        capture_output=True, text=True, check=False,
    )
    assert result.returncode == 0, "non-strict mode should be informational (exit 0)"
    assert "DRIFT" in result.stdout
