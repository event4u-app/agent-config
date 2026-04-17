#!/usr/bin/env python3
"""
Runtime Dispatcher — resolves execution type and produces execution requests.

Responsibilities:
- Resolve execution type for a given skill
- Block unsupported automated execution
- Produce structured execution request objects
- Enforce safety policies

No real execution happens — this is a scaffold for future phases.

Usage:
    python3 scripts/runtime_dispatcher.py --skill SKILL_NAME [--root ROOT] [--format text|json]
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))
from runtime_registry import SkillRuntime, build_registry


@dataclass
class ExecutionRequest:
    """Structured execution request produced by the dispatcher."""
    skill_name: str
    execution_type: str
    handler: str
    timeout_seconds: int
    safety_mode: Optional[str]
    allowed_tools: List[str]
    status: str  # "ready", "blocked", "not_found"
    reason: Optional[str]

    @property
    def is_ready(self) -> bool:
        return self.status == "ready"


@dataclass
class DispatchResult:
    """Result of dispatching a skill for execution."""
    request: ExecutionRequest
    warnings: List[str]


def dispatch(skill_name: str, registry: List[SkillRuntime]) -> DispatchResult:
    """Resolve and validate a skill for execution."""
    warnings: List[str] = []

    # Find skill in registry
    matches = [s for s in registry if s.name == skill_name]
    if not matches:
        return DispatchResult(
            request=ExecutionRequest(
                skill_name=skill_name,
                execution_type="unknown",
                handler="none",
                timeout_seconds=0,
                safety_mode=None,
                allowed_tools=[],
                status="not_found",
                reason=f"Skill '{skill_name}' not found in runtime registry",
            ),
            warnings=[],
        )

    skill = matches[0]

    # Manual skills cannot be dispatched
    if skill.execution_type == "manual":
        return DispatchResult(
            request=ExecutionRequest(
                skill_name=skill.name,
                execution_type=skill.execution_type,
                handler=skill.handler,
                timeout_seconds=skill.timeout_seconds,
                safety_mode=skill.safety_mode,
                allowed_tools=skill.allowed_tools,
                status="blocked",
                reason="Manual skills cannot be dispatched for execution",
            ),
            warnings=[],
        )

    # Automated skills must pass safety checks
    if skill.is_automated:
        if skill.handler == "none":
            return DispatchResult(
                request=ExecutionRequest(
                    skill_name=skill.name,
                    execution_type=skill.execution_type,
                    handler=skill.handler,
                    timeout_seconds=skill.timeout_seconds,
                    safety_mode=skill.safety_mode,
                    allowed_tools=skill.allowed_tools,
                    status="blocked",
                    reason="Automated skill has no handler",
                ),
                warnings=[],
            )
        if skill.safety_mode != "strict":
            return DispatchResult(
                request=ExecutionRequest(
                    skill_name=skill.name,
                    execution_type=skill.execution_type,
                    handler=skill.handler,
                    timeout_seconds=skill.timeout_seconds,
                    safety_mode=skill.safety_mode,
                    allowed_tools=skill.allowed_tools,
                    status="blocked",
                    reason="Automated skill requires safety_mode: strict",
                ),
                warnings=[],
            )

    # Assisted/automated skill is ready
    if skill.execution_type == "assisted":
        warnings.append("Assisted execution requires human confirmation before action")

    return DispatchResult(
        request=ExecutionRequest(
            skill_name=skill.name,
            execution_type=skill.execution_type,
            handler=skill.handler,
            timeout_seconds=skill.timeout_seconds,
            safety_mode=skill.safety_mode,
            allowed_tools=skill.allowed_tools,
            status="ready",
            reason=None,
        ),
        warnings=warnings,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Runtime Dispatcher — resolve skill execution")
    parser.add_argument("--skill", required=True, help="Skill name to dispatch")
    parser.add_argument("--root", type=Path, default=Path("."), help="Repository root")
    parser.add_argument("--format", choices=["text", "json"], default="text")
    args = parser.parse_args()

    registry = build_registry(args.root)
    result = dispatch(args.skill, registry)

    if args.format == "json":
        print(json.dumps(asdict(result), indent=2))
    else:
        req = result.request
        print(f"Skill: {req.skill_name}")
        print(f"Status: {req.status}")
        if req.reason:
            print(f"Reason: {req.reason}")
        if req.is_ready:
            print(f"Type: {req.execution_type}")
            print(f"Handler: {req.handler}")
            print(f"Timeout: {req.timeout_seconds}s")
            tools = ", ".join(req.allowed_tools) if req.allowed_tools else "none"
            print(f"Tools: {tools}")
        for w in result.warnings:
            print(f"WARNING: {w}")

    return 0 if result.request.is_ready or result.request.status == "blocked" else 1


if __name__ == "__main__":
    sys.exit(main())
