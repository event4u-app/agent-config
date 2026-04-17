"""Tests for the runtime execution engine."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from runtime_registry import SkillRuntime
from runtime_execute import (
    ExecutionProposal,
    check_environment,
    build_safety_notes,
    build_verification_requirements,
    prepare_execution,
)


def _skill(name: str, exec_type: str = "assisted", handler: str = "internal",
           safety_mode: Optional[str] = None, allowed_tools: Optional[List[str]] = None,
           timeout: int = 30) -> SkillRuntime:
    return SkillRuntime(
        name=name, path=f"/skills/{name}/SKILL.md", description=f"Test {name}",
        execution_type=exec_type, handler=handler, timeout_seconds=timeout,
        safety_mode=safety_mode, allowed_tools=allowed_tools or [],
    )


def test_prepare_assisted_produces_proposal() -> None:
    skill = _skill("assist", "assisted", "internal")
    proposal = prepare_execution("assist", [skill])
    assert proposal.is_proposed
    assert proposal.requires_confirmation
    assert proposal.execution_type == "assisted"


def test_prepare_automated_produces_proposal() -> None:
    skill = _skill("auto", "automated", "shell", "strict", [])
    proposal = prepare_execution("auto", [skill])
    assert proposal.is_proposed
    assert not proposal.requires_confirmation
    assert proposal.execution_type == "automated"


def test_prepare_manual_blocked() -> None:
    skill = _skill("manual", "manual", "none")
    proposal = prepare_execution("manual", [skill])
    assert proposal.status == "blocked"
    assert not proposal.is_proposed


def test_prepare_not_found() -> None:
    proposal = prepare_execution("nonexistent", [])
    assert proposal.status == "blocked"
    assert "not found" in (proposal.reason or "").lower()


def test_prepare_unsafe_automated_blocked() -> None:
    skill = _skill("unsafe", "automated", "none", "strict", [])
    proposal = prepare_execution("unsafe", [skill])
    assert proposal.status == "blocked"


def test_check_environment_shell() -> None:
    skill = _skill("shell-skill", "assisted", "shell")
    checks = check_environment(skill)
    assert len(checks) == 1
    assert checks[0].name == "bash"
    # bash should be available on most systems
    assert checks[0].available is True


def test_check_environment_internal() -> None:
    skill = _skill("internal-skill", "assisted", "internal")
    checks = check_environment(skill)
    assert len(checks) == 0


def test_safety_notes_assisted() -> None:
    skill = _skill("assist", "assisted", "internal")
    notes = build_safety_notes(skill)
    assert any("confirmation" in n.lower() for n in notes)


def test_safety_notes_automated_strict() -> None:
    skill = _skill("auto", "automated", "shell", "strict", [])
    notes = build_safety_notes(skill)
    assert any("strict" in n.lower() for n in notes)


def test_safety_notes_with_tools() -> None:
    skill = _skill("tooled", "assisted", "internal", allowed_tools=["github", "jira"])
    notes = build_safety_notes(skill)
    assert any("github" in n.lower() for n in notes)


def test_verification_requirements_shell() -> None:
    skill = _skill("shell", "assisted", "shell")
    reqs = build_verification_requirements(skill)
    assert any("exit code" in r.lower() for r in reqs)


def test_verification_requirements_php() -> None:
    skill = _skill("php", "assisted", "php")
    reqs = build_verification_requirements(skill)
    assert any("php" in r.lower() for r in reqs)


def test_verification_always_has_output_check() -> None:
    skill = _skill("any", "assisted", "internal")
    reqs = build_verification_requirements(skill)
    assert any("output format" in r.lower() for r in reqs)


def test_proposal_with_tools_includes_tool_verification() -> None:
    skill = _skill("tooled", "automated", "internal", "strict", ["github"])
    proposal = prepare_execution("tooled", [skill])
    assert proposal.is_proposed
    assert any("github" in r.lower() for r in proposal.verification_requirements)
