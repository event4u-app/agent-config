#!/usr/bin/env python3
"""
Runtime Dispatcher — resolves execution type and drives real handler execution.

Two modes:

- resolve (default): produce a structured execution request, enforce safety,
  return dispatch metadata. No side effects.
- run: dispatch the skill, then hand it to the matching runtime handler to
  actually execute. Returns a typed ExecutionResult.

Usage:
    python3 scripts/runtime_dispatcher.py --skill NAME [--format text|json]
    python3 scripts/runtime_dispatcher.py resolve --skill NAME
    python3 scripts/runtime_dispatcher.py run --skill NAME [--cwd PATH] [--output FILE]

`run --output FILE` persists the ExecutionResult as JSON to FILE. CI uses
this to feed `scripts/ci_summary.py`.
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
from runtime_handler import ExecutionResult, HandlerError, execute_shell


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


def run(skill_name: str, registry: List[SkillRuntime], cwd: Path) -> ExecutionResult:
    """Dispatch and execute a skill. Raises HandlerError on structural issues."""
    dispatch_result = dispatch(skill_name, registry)
    req = dispatch_result.request
    if not req.is_ready:
        raise HandlerError(
            f"Skill '{skill_name}' is not ready to run: "
            f"{req.status} — {req.reason or 'no reason given'}"
        )

    skill = next(s for s in registry if s.name == skill_name)
    if skill.handler in {"shell", "php", "node"}:
        return execute_shell(skill, cwd)
    raise HandlerError(
        f"Handler '{skill.handler}' has no executor yet — "
        f"only 'shell' is implemented in this phase"
    )


def _print_dispatch(result: DispatchResult, fmt: str) -> None:
    if fmt == "json":
        print(json.dumps(asdict(result), indent=2))
        return
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


def _print_execution(result: ExecutionResult, fmt: str) -> None:
    if fmt == "json":
        print(json.dumps(asdict(result), indent=2))
        return
    print(f"Skill: {result.skill_name}")
    print(f"Handler: {result.handler}")
    print(f"Command: {' '.join(result.command)}")
    print(f"Cwd: {result.cwd}")
    print(f"Status: {result.status}")
    print(f"Exit code: {result.exit_code}")
    print(f"Duration: {result.duration_ms}ms")
    if result.error:
        print(f"Error: {result.error}")
    if result.stdout:
        print("--- stdout ---")
        print(result.stdout.rstrip())
    if result.stderr:
        print("--- stderr ---")
        print(result.stderr.rstrip())


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Runtime Dispatcher — resolve or run skill execution")
    sub = parser.add_subparsers(dest="action")

    # Legacy flat flags retained for backward compatibility.
    parser.add_argument("--skill", help="Skill name to dispatch")
    parser.add_argument("--root", type=Path, default=Path("."), help="Repository root")
    parser.add_argument("--format", choices=["text", "json"], default="text")

    resolve_p = sub.add_parser("resolve", help="Resolve skill and return dispatch metadata (no execution)")
    resolve_p.add_argument("--skill", required=True)
    resolve_p.add_argument("--root", type=Path, default=Path("."))
    resolve_p.add_argument("--format", choices=["text", "json"], default="text")

    run_p = sub.add_parser("run", help="Dispatch and execute the skill via its handler")
    run_p.add_argument("--skill", required=True)
    run_p.add_argument("--root", type=Path, default=Path("."))
    run_p.add_argument("--cwd", type=Path, default=None, help="Working directory (default: --root)")
    run_p.add_argument("--format", choices=["text", "json"], default="text")
    run_p.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Persist ExecutionResult as JSON to this path (parents created)",
    )
    return parser


def main() -> int:
    parser = _build_parser()
    args = parser.parse_args()

    action = args.action or "resolve"
    if action == "resolve" and not args.skill:
        parser.error("--skill is required for resolve")

    registry = build_registry(args.root)

    if action == "run":
        cwd = args.cwd if args.cwd is not None else args.root
        try:
            result = run(args.skill, registry, cwd)
        except HandlerError as exc:
            print(f"HandlerError: {exc}", file=sys.stderr)
            return 2
        _print_execution(result, args.format)
        output = getattr(args, "output", None)
        if output is not None:
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(json.dumps(asdict(result), indent=2) + "\n", encoding="utf-8")
        return 0 if result.is_success else 1

    result = dispatch(args.skill, registry)
    _print_dispatch(result, args.format)
    return 0 if result.request.is_ready or result.request.status == "blocked" else 1


if __name__ == "__main__":
    sys.exit(main())
