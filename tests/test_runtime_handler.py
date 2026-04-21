"""Tests for the runtime handler and the dispatcher's `run` integration."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from runtime_registry import SkillRuntime, build_registry
from runtime_handler import (
    DEFAULT_ENV_ALLOWLIST,
    ExecutionResult,
    HandlerError,
    _build_env,
    execute_shell,
)
from runtime_dispatcher import run


REPO_ROOT = Path(__file__).resolve().parent.parent


def _skill(command, handler="shell", timeout=30, name="probe") -> SkillRuntime:
    return SkillRuntime(
        name=name, path="test", description="",
        execution_type="assisted", handler=handler,
        timeout_seconds=timeout, safety_mode=None, allowed_tools=[],
        command=command,
    )


# ── Unit tests: handler in isolation ─────────────────────────────────────

def test_execute_shell_success(tmp_path: Path) -> None:
    skill = _skill(["python3", "-c", "print('ok')"])
    result = execute_shell(skill, tmp_path)
    assert result.status == "success"
    assert result.exit_code == 0
    assert "ok" in result.stdout
    assert result.duration_ms >= 0
    assert result.timed_out is False
    assert result.cwd == str(tmp_path.resolve())


def test_execute_shell_non_zero_is_failure(tmp_path: Path) -> None:
    skill = _skill(["python3", "-c", "import sys; sys.exit(3)"])
    result = execute_shell(skill, tmp_path)
    assert result.status == "failure"
    assert result.exit_code == 3
    assert result.is_success is False


def test_execute_shell_captures_stderr(tmp_path: Path) -> None:
    skill = _skill(["python3", "-c", "import sys; sys.stderr.write('boom'); sys.exit(1)"])
    result = execute_shell(skill, tmp_path)
    assert result.status == "failure"
    assert "boom" in result.stderr


def test_execute_shell_timeout(tmp_path: Path) -> None:
    skill = _skill(["python3", "-c", "import time; time.sleep(5)"], timeout=1)
    result = execute_shell(skill, tmp_path)
    assert result.status == "timeout"
    assert result.timed_out is True
    assert result.exit_code == -1
    assert "Timed out" in (result.error or "")


def test_execute_shell_command_not_found(tmp_path: Path) -> None:
    skill = _skill(["this-binary-does-not-exist-xyz"])
    result = execute_shell(skill, tmp_path)
    assert result.status == "error"
    assert result.exit_code == -1
    assert "not found" in (result.error or "").lower()


def test_execute_shell_rejects_empty_command(tmp_path: Path) -> None:
    skill = _skill([])
    with pytest.raises(HandlerError, match="no 'command' declared"):
        execute_shell(skill, tmp_path)


def test_execute_shell_rejects_non_runtime_handler(tmp_path: Path) -> None:
    skill = _skill(["true"], handler="internal")
    with pytest.raises(HandlerError, match="not a real-execution handler"):
        execute_shell(skill, tmp_path)


def test_build_env_scrubs_secrets(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PATH", "/usr/bin")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "leak-me")
    monkeypatch.setenv("GITHUB_TOKEN", "leak-me-too")
    env = _build_env(DEFAULT_ENV_ALLOWLIST)
    assert env["PATH"] == "/usr/bin"
    assert "AWS_SECRET_ACCESS_KEY" not in env
    assert "GITHUB_TOKEN" not in env


# ── E2E: pilot skills executed through the dispatcher ────────────────────

def test_dispatcher_run_lint_skills_pilot() -> None:
    registry = build_registry(REPO_ROOT)
    names = {s.name for s in registry}
    assert "lint-skills" in names, "pilot skill missing from registry"

    result = run("lint-skills", registry, REPO_ROOT)
    assert isinstance(result, ExecutionResult)
    assert result.skill_name == "lint-skills"
    assert result.handler == "shell"
    assert result.command == ["python3", "scripts/skill_linter.py", "--all"]
    assert result.exit_code in (0, 1)  # 1 = warnings only, still a real result
    assert result.duration_ms > 0
    assert "Summary:" in result.stdout


def test_dispatcher_run_check_refs_pilot() -> None:
    registry = build_registry(REPO_ROOT)
    names = {s.name for s in registry}
    assert "check-refs" in names, "pilot skill missing from registry"

    result = run("check-refs", registry, REPO_ROOT)
    assert isinstance(result, ExecutionResult)
    assert result.skill_name == "check-refs"
    assert result.handler == "shell"
    assert result.exit_code in (0, 1)
    assert result.duration_ms > 0


def test_dispatcher_run_raises_on_unready_skill() -> None:
    registry = [SkillRuntime(
        name="manual", path="t", description="",
        execution_type="manual", handler="none",
        timeout_seconds=30, safety_mode=None, allowed_tools=[], command=[],
    )]
    with pytest.raises(HandlerError, match="not ready"):
        run("manual", registry, REPO_ROOT)
