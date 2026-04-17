#!/usr/bin/env python3
"""
Runtime Execute — produces execution proposals for assisted/automated skills.

For assisted execution:
- Prepares exact command or action plan
- Validates environment assumptions
- Returns execution proposal (does NOT execute)

For automated execution:
- Same as assisted but marked as auto-executable
- Safety checks enforced before producing proposal

Usage:
    python3 scripts/runtime_execute.py --skill SKILL_NAME [--root ROOT] [--format text|json]
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))
from runtime_registry import SkillRuntime, build_registry
from runtime_dispatcher import dispatch, DispatchResult


# Handler → required binary mapping
HANDLER_REQUIREMENTS: Dict[str, List[str]] = {
    "shell": ["bash"],
    "php": ["php"],
    "node": ["node"],
    "internal": [],
    "none": [],
}


@dataclass
class EnvironmentCheck:
    """Result of checking a single environment requirement."""
    name: str
    required: bool
    available: bool
    detail: str


@dataclass
class ExecutionProposal:
    """Structured proposal for skill execution."""
    skill_name: str
    execution_type: str
    handler: str
    status: str  # "proposed", "blocked", "error"
    environment_checks: List[EnvironmentCheck]
    allowed_tools: List[str]
    safety_notes: List[str]
    verification_requirements: List[str]
    reason: Optional[str] = None

    @property
    def is_proposed(self) -> bool:
        return self.status == "proposed"

    @property
    def requires_confirmation(self) -> bool:
        return self.execution_type == "assisted"


def check_environment(skill: SkillRuntime) -> List[EnvironmentCheck]:
    """Check if the environment supports the skill's handler requirements."""
    checks: List[EnvironmentCheck] = []
    required_binaries = HANDLER_REQUIREMENTS.get(skill.handler, [])

    for binary in required_binaries:
        available = shutil.which(binary) is not None
        checks.append(EnvironmentCheck(
            name=binary,
            required=True,
            available=available,
            detail=f"Binary '{binary}' {'found' if available else 'NOT found'} in PATH",
        ))

    return checks


def build_safety_notes(skill: SkillRuntime) -> List[str]:
    """Generate safety notes based on skill configuration."""
    notes: List[str] = []
    if skill.execution_type == "assisted":
        notes.append("Requires human confirmation before any action is taken")
    if skill.execution_type == "automated":
        notes.append("Will execute automatically — verify safety_mode is strict")
    if skill.safety_mode == "strict":
        notes.append("Safety mode: strict — all safety checks enforced")
    if skill.allowed_tools:
        notes.append(f"Tool access: {', '.join(skill.allowed_tools)}")
    else:
        notes.append("No external tool access declared")
    if skill.timeout_seconds > 0:
        notes.append(f"Timeout: {skill.timeout_seconds}s")
    return notes


def build_verification_requirements(skill: SkillRuntime) -> List[str]:
    """Generate verification requirements for the execution."""
    reqs: List[str] = []
    if skill.handler == "shell":
        reqs.append("Verify command exit code is 0")
        reqs.append("Check stdout/stderr for error indicators")
    if skill.handler == "php":
        reqs.append("Verify PHP process exit code")
        reqs.append("Check for PHP fatal errors in output")
    if skill.handler == "node":
        reqs.append("Verify Node.js process exit code")
    if skill.allowed_tools:
        reqs.append(f"Verify tool responses from: {', '.join(skill.allowed_tools)}")
    reqs.append("Compare result against skill's expected output format")
    return reqs


def prepare_execution(skill_name: str, registry: List[SkillRuntime]) -> ExecutionProposal:
    """Prepare an execution proposal for a skill."""
    # First, dispatch to check if execution is allowed
    result = dispatch(skill_name, registry)

    if not result.request.is_ready:
        return ExecutionProposal(
            skill_name=skill_name,
            execution_type=result.request.execution_type,
            handler=result.request.handler,
            status="blocked",
            environment_checks=[],
            allowed_tools=[],
            safety_notes=[],
            verification_requirements=[],
            reason=result.request.reason,
        )

    # Find the skill
    skill = next(s for s in registry if s.name == skill_name)

    # Check environment
    env_checks = check_environment(skill)
    env_failures = [c for c in env_checks if c.required and not c.available]

    if env_failures:
        missing = ", ".join(c.name for c in env_failures)
        return ExecutionProposal(
            skill_name=skill.name,
            execution_type=skill.execution_type,
            handler=skill.handler,
            status="error",
            environment_checks=env_checks,
            allowed_tools=skill.allowed_tools,
            safety_notes=build_safety_notes(skill),
            verification_requirements=[],
            reason=f"Missing required binaries: {missing}",
        )

    return ExecutionProposal(
        skill_name=skill.name,
        execution_type=skill.execution_type,
        handler=skill.handler,
        status="proposed",
        environment_checks=env_checks,
        allowed_tools=skill.allowed_tools,
        safety_notes=build_safety_notes(skill),
        verification_requirements=build_verification_requirements(skill),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Runtime Execute — prepare execution proposals")
    parser.add_argument("--skill", required=True, help="Skill name")
    parser.add_argument("--root", type=Path, default=Path("."), help="Repository root")
    parser.add_argument("--format", choices=["text", "json"], default="text")
    args = parser.parse_args()

    registry = build_registry(args.root)
    proposal = prepare_execution(args.skill, registry)

    if args.format == "json":
        print(json.dumps(asdict(proposal), indent=2))
    else:
        print(f"Skill: {proposal.skill_name}")
        print(f"Status: {proposal.status}")
        if proposal.reason:
            print(f"Reason: {proposal.reason}")
        if proposal.is_proposed:
            print(f"Type: {proposal.execution_type}")
            print(f"Handler: {proposal.handler}")
            if proposal.requires_confirmation:
                print("⚠️  Requires human confirmation")
            print("\nSafety notes:")
            for note in proposal.safety_notes:
                print(f"  - {note}")
            print("\nVerification requirements:")
            for req in proposal.verification_requirements:
                print(f"  - {req}")
            if proposal.environment_checks:
                print("\nEnvironment:")
                for check in proposal.environment_checks:
                    status = "✅" if check.available else "❌"
                    print(f"  {status} {check.detail}")

    return 0 if proposal.is_proposed else 1


if __name__ == "__main__":
    sys.exit(main())
