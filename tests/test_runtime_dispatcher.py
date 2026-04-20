"""Tests for the runtime dispatcher."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from runtime_registry import SkillRuntime
from runtime_dispatcher import dispatch

REPO_ROOT = Path(__file__).resolve().parent.parent
DISPATCHER = REPO_ROOT / "scripts" / "runtime_dispatcher.py"


def _skill(name: str, exec_type: str = "manual", handler: str = "none",
           safety_mode: Optional[str] = None, allowed_tools: Optional[List[str]] = None) -> SkillRuntime:
    return SkillRuntime(
        name=name, path=f"/skills/{name}/SKILL.md", description=f"Test {name}",
        execution_type=exec_type, handler=handler, timeout_seconds=30,
        safety_mode=safety_mode, allowed_tools=allowed_tools or [],
    )


def test_dispatch_not_found() -> None:
    result = dispatch("nonexistent", [])
    assert result.request.status == "not_found"
    assert not result.request.is_ready


def test_dispatch_manual_blocked() -> None:
    registry = [_skill("manual-skill", "manual")]
    result = dispatch("manual-skill", registry)
    assert result.request.status == "blocked"
    assert "Manual" in (result.request.reason or "")


def test_dispatch_assisted_ready() -> None:
    registry = [_skill("assist", "assisted", "internal")]
    result = dispatch("assist", registry)
    assert result.request.status == "ready"
    assert result.request.is_ready
    assert result.request.execution_type == "assisted"
    assert any("confirmation" in w.lower() for w in result.warnings)


def test_dispatch_automated_ready() -> None:
    registry = [_skill("auto", "automated", "shell", "strict", [])]
    result = dispatch("auto", registry)
    assert result.request.status == "ready"
    assert result.request.is_ready
    assert result.request.execution_type == "automated"


def test_dispatch_automated_no_handler_blocked() -> None:
    registry = [_skill("bad-auto", "automated", "none", "strict", [])]
    result = dispatch("bad-auto", registry)
    assert result.request.status == "blocked"
    assert "handler" in (result.request.reason or "").lower()


def test_dispatch_automated_no_safety_blocked() -> None:
    registry = [_skill("bad-safety", "automated", "shell", None, [])]
    result = dispatch("bad-safety", registry)
    assert result.request.status == "blocked"
    assert "safety_mode" in (result.request.reason or "").lower()


def test_dispatch_automated_with_tools() -> None:
    registry = [_skill("tooled", "automated", "internal", "strict", ["github", "jira"])]
    result = dispatch("tooled", registry)
    assert result.request.is_ready
    assert result.request.allowed_tools == ["github", "jira"]


def test_dispatch_returns_correct_timeout() -> None:
    skill = SkillRuntime(
        name="timed", path="/test", description="",
        execution_type="assisted", handler="shell",
        timeout_seconds=120, safety_mode=None, allowed_tools=[],
    )
    result = dispatch("timed", [skill])
    assert result.request.timeout_seconds == 120


def test_run_writes_output_json(tmp_path: Path) -> None:
    """`dispatcher run --output FILE` persists ExecutionResult as JSON."""
    out = tmp_path / "runs" / "lint-skills.json"
    result = subprocess.run(
        [
            sys.executable, str(DISPATCHER), "run",
            "--skill", "lint-skills",
            "--root", str(REPO_ROOT),
            "--output", str(out),
            "--format", "json",
        ],
        cwd=REPO_ROOT, capture_output=True, text=True, timeout=300,
    )
    # Exit code may be 0 or 1 depending on skill result; both are acceptable.
    assert result.returncode in (0, 1), result.stderr
    assert out.is_file(), f"expected {out} to exist"
    data = json.loads(out.read_text(encoding="utf-8"))
    assert data["skill_name"] == "lint-skills"
    assert "status" in data
    assert "exit_code" in data
    assert "duration_ms" in data
