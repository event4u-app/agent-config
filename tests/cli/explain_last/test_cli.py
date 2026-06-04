"""CLI-surface coverage for ``agent-config explain last`` (Phase 4 #2).

Tests the gates that ride on the CLI dispatcher rather than on the trace
builder directly:

* disabled-by-settings short-circuit (Phase 2 exit gate),
* ``--quiet`` suppresses the trailing tip line (BLOCKING council fix),
* ``--json`` output validates against the ExplainTrace v1 schema,
* missing state exits ``1`` and the error path is rendered relative to
  ``--project-root`` (BLOCKING council fix — no ``/Users/<name>`` leak).
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from scripts._cli.cmd_explain import main as cmd_main

REPO_ROOT = Path(__file__).resolve().parents[2].parent
SCHEMA = REPO_ROOT / "docs" / "contracts" / "explain-trace.schema.json"


def _run_cli(project_root: Path, *extra: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable, "-m", "scripts._cli.cmd_explain",
            "last", "--project", str(project_root), *extra,
        ],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )


def test_disabled_by_settings_exits_zero(project_root: Path, copy_state) -> None:
    copy_state("work-state.success.json")
    (project_root / ".agent-settings.yml").write_text(
        "explain:\n  enable_last: false\n", encoding="utf-8",
    )
    proc = _run_cli(project_root)
    assert proc.returncode == 0
    assert "disabled by settings" in proc.stdout
    assert "explain.enable_last" in proc.stdout


def test_happy_path_renders_markdown_with_footer(
    project_root: Path, copy_state,
) -> None:
    copy_state("work-state.success.json")
    proc = _run_cli(project_root)
    assert proc.returncode == 0
    assert "# explain last" in proc.stdout
    assert "## Why this route?" in proc.stdout
    # Footer present unless --quiet.
    assert "tip:" in proc.stdout.lower() or "hint:" in proc.stdout.lower()


def test_quiet_flag_suppresses_tip_footer(
    project_root: Path, copy_state,
) -> None:
    """BLOCKING council fix — `--quiet | grep -iE '(tip|hint):'` is empty."""
    copy_state("work-state.success.json")
    proc = _run_cli(project_root, "--quiet")
    assert proc.returncode == 0
    lowered = proc.stdout.lower()
    assert "tip:" not in lowered
    assert "hint:" not in lowered


def test_json_output_validates_against_schema(
    project_root: Path, copy_state,
) -> None:
    copy_state("work-state.success.json")
    proc = _run_cli(project_root, "--json")
    assert proc.returncode == 0
    trace = json.loads(proc.stdout)
    assert trace["version"] == 1
    # Independent schema validation — the lint script is the contract.
    lint = subprocess.run(
        [sys.executable, str(REPO_ROOT / "src" / "scripts" / "lint_explain_trace.py"),
         "--stdin"],
        input=proc.stdout,
        cwd=REPO_ROOT, capture_output=True, text=True, check=False,
    )
    assert lint.returncode == 0, lint.stderr


def test_missing_state_exits_one_with_relative_path(
    project_root: Path,
) -> None:
    """BLOCKING council fix — error MUST NOT leak absolute path / username."""
    proc = _run_cli(project_root)
    assert proc.returncode == 1
    combined = proc.stdout + proc.stderr
    # Path is relative — no absolute path leak.
    assert str(project_root) not in combined
    # tmp_path on macOS starts with /var/folders or /private/var.
    assert "/var/folders" not in combined
    assert "/private/var" not in combined
    assert ".work-state.json" in combined


def test_missing_state_via_in_process_returns_one(
    project_root: Path,
) -> None:
    rc = cmd_main(["last", "--project", str(project_root)])
    assert rc == 1


def test_disabled_via_in_process_returns_zero(
    project_root: Path, copy_state, capsys: pytest.CaptureFixture[str],
) -> None:
    copy_state("work-state.success.json")
    (project_root / ".agent-settings.yml").write_text(
        "explain:\n  enable_last: false\n", encoding="utf-8",
    )
    rc = cmd_main(["last", "--project", str(project_root)])
    assert rc == 0
    captured = capsys.readouterr()
    assert "disabled by settings" in captured.out
