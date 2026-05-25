"""Contract tests for ``scripts/apply_modules_config.py``.

Phase E Step 5 of road-to-configurable-modules — the persistence
helper invoked by the GUI wizard's ``/finish`` handler. Covers the
three load-bearing properties: comment preservation, idempotent
re-application, and bootstrap from the bundled template when the
team file is missing.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPT = REPO_ROOT / "scripts" / "apply_modules_config.py"
TEMPLATE = REPO_ROOT / "packages" / "core" / ".agent-src.uncompressed" / "templates" / "agents" / "agent-project-settings.example.yml"


def _run(project: Path, payload: dict[str, object] | None, *, decline: bool = False) -> subprocess.CompletedProcess[str]:
    args: list[str] = [sys.executable, str(SCRIPT), "--project", str(project)]
    if decline:
        args.append("--decline")
        return subprocess.run(args, capture_output=True, text=True, check=False)
    payload_path = project / "_payload.json"
    payload_path.write_text(json.dumps(payload or {}), encoding="utf-8")
    args.extend(["--input-file", str(payload_path)])
    return subprocess.run(args, capture_output=True, text=True, check=False)


def _seed_team_file(project: Path) -> Path:
    target = project / ".agent-project-settings.yml"
    shutil.copyfile(TEMPLATE, target)
    return target


# --- happy path -----------------------------------------------------------


def test_patches_modules_block_with_full_payload(tmp_path: Path) -> None:
    team = _seed_team_file(tmp_path)
    proc = _run(tmp_path, {
        "enabled": True,
        "root_paths": ["app/Modules"],
        "namespace_template": "App\\Modules\\{ModuleName}\\App",
        "agent_folder": "agents",
        "skip_dirs": [".module-template", ".example"],
    })
    assert proc.returncode == 0, proc.stderr
    text = team.read_text(encoding="utf-8")
    assert "  enabled: true" in text
    assert "  root_paths: [\"app/Modules\"]" in text
    assert '  namespace_template: "App\\\\Modules\\\\{ModuleName}\\\\App"' in text


def test_preserves_comments_and_surrounding_blocks(tmp_path: Path) -> None:
    team = _seed_team_file(tmp_path)
    before = team.read_text(encoding="utf-8")
    # capture every comment line from the modules: block — they must
    # survive byte-for-byte through the patch.
    comments_before = [ln for ln in before.splitlines() if ln.strip().startswith("#")]
    _run(tmp_path, {"enabled": True, "root_paths": ["src"]})
    after = team.read_text(encoding="utf-8")
    comments_after = [ln for ln in after.splitlines() if ln.strip().startswith("#")]
    assert comments_before == comments_after
    # schema_version and the trailing sections still present.
    assert "schema_version: 1" in after


def test_idempotent_under_repeat_application(tmp_path: Path) -> None:
    _seed_team_file(tmp_path)
    payload = {
        "enabled": True,
        "root_paths": ["packages"],
        "namespace_template": "",
        "agent_folder": "agents",
        "skip_dirs": [".module-template", ".example"],
    }
    _run(tmp_path, payload)
    first = (tmp_path / ".agent-project-settings.yml").read_text(encoding="utf-8")
    _run(tmp_path, payload)
    second = (tmp_path / ".agent-project-settings.yml").read_text(encoding="utf-8")
    assert first == second


# --- decline / bootstrap / error paths -------------------------------------


def test_decline_writes_nothing_when_team_file_missing(tmp_path: Path) -> None:
    proc = _run(tmp_path, payload=None, decline=True)
    assert proc.returncode == 0
    assert not (tmp_path / ".agent-project-settings.yml").exists()


def test_decline_leaves_existing_team_file_untouched(tmp_path: Path) -> None:
    team = _seed_team_file(tmp_path)
    before = team.read_text(encoding="utf-8")
    proc = _run(tmp_path, payload=None, decline=True)
    assert proc.returncode == 0
    assert team.read_text(encoding="utf-8") == before


def test_bootstraps_team_file_from_bundled_template(tmp_path: Path) -> None:
    target = tmp_path / ".agent-project-settings.yml"
    assert not target.exists()
    proc = _run(tmp_path, {"enabled": True, "root_paths": ["src"]})
    assert proc.returncode == 0, proc.stderr
    assert target.is_file()
    text = target.read_text(encoding="utf-8")
    assert "schema_version: 1" in text
    assert "  enabled: true" in text


def test_rejects_invalid_payload_shape(tmp_path: Path) -> None:
    _seed_team_file(tmp_path)
    # root_paths must be a list — passing a string is a contract error.
    proc = _run(tmp_path, {"enabled": True, "root_paths": "app/Modules"})
    assert proc.returncode == 2
    assert "root_paths" in proc.stderr


def test_empty_root_paths_renders_as_empty_flow_list(tmp_path: Path) -> None:
    team = _seed_team_file(tmp_path)
    _run(tmp_path, {"enabled": False, "root_paths": []})
    text = team.read_text(encoding="utf-8")
    assert "  root_paths: []" in text


def test_emits_team_file_path_on_stdout(tmp_path: Path) -> None:
    _seed_team_file(tmp_path)
    proc = _run(tmp_path, {"enabled": True, "root_paths": ["src"]})
    assert proc.returncode == 0
    assert proc.stdout.strip() == str(tmp_path / ".agent-project-settings.yml")


def test_unreachable_project_root_errors_with_exit_2(tmp_path: Path) -> None:
    # Write the payload into a sibling location so the helper's
    # project-root check fires before payload-load — exercising the
    # error path we care about.
    payload_path = tmp_path / "_payload.json"
    payload_path.write_text(json.dumps({"enabled": True, "root_paths": ["src"]}), encoding="utf-8")
    missing = tmp_path / "does-not-exist"
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), "--project", str(missing), "--input-file", str(payload_path)],
        capture_output=True, text=True, check=False,
    )
    assert proc.returncode == 2
    assert "project root" in proc.stderr
