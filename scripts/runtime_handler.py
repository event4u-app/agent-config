#!/usr/bin/env python3
"""
Runtime Handler — executes a skill's declared command and captures the result.

This is the first real execution path in the runtime layer. It consumes a
SkillRuntime (from the registry), runs its `command` argv through the
appropriate handler, and returns a typed ExecutionResult.

Responsibilities:
- Shell-out safely: no shell=True, argv form only
- Enforce timeout (SkillRuntime.timeout_seconds)
- Capture stdout, stderr, exit code, wall-clock duration
- Scrub environment to an allowlist
- Resolve working directory relative to repository root

Out of scope (remain in scaffold layers for now):
- php/node handlers beyond running their binaries
- tool registry integration
- streaming output
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))
from runtime_registry import SkillRuntime


# Environment variables that are always forwarded to the child process.
# Kept deliberately narrow — no credentials, no shell config, no auth tokens.
DEFAULT_ENV_ALLOWLIST: tuple[str, ...] = (
    "PATH",
    "HOME",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "TZ",
    "TMPDIR",
    "PYTHONPATH",
    "PYTHONDONTWRITEBYTECODE",
)


@dataclass
class ExecutionResult:
    """Typed result of a real command execution."""
    skill_name: str
    handler: str
    command: List[str]
    cwd: str
    exit_code: int
    stdout: str
    stderr: str
    duration_ms: int
    status: str  # "success" | "failure" | "timeout" | "error"
    timed_out: bool = False
    error: Optional[str] = None
    artifacts: List[str] = field(default_factory=list)

    @property
    def is_success(self) -> bool:
        return self.status == "success"


class HandlerError(Exception):
    """Raised when a handler cannot execute for structural reasons."""


def _build_env(allowlist: tuple[str, ...]) -> Dict[str, str]:
    """Build a scrubbed environment dict from the allowlist."""
    env: Dict[str, str] = {}
    for key in allowlist:
        value = os.environ.get(key)
        if value is not None:
            env[key] = value
    # Guarantee a minimum PATH so subprocess can find binaries.
    env.setdefault("PATH", "/usr/local/bin:/usr/bin:/bin")
    return env


def execute_shell(
    skill: SkillRuntime,
    cwd: Path,
    env_allowlist: tuple[str, ...] = DEFAULT_ENV_ALLOWLIST,
) -> ExecutionResult:
    """Run a skill's command as a subprocess and capture the result."""
    if not skill.command:
        raise HandlerError(
            f"Skill '{skill.name}' has no 'command' declared — cannot execute"
        )
    if skill.handler not in {"shell", "php", "node"}:
        raise HandlerError(
            f"Skill '{skill.name}' handler '{skill.handler}' is not a real-execution handler"
        )

    env = _build_env(env_allowlist)
    cwd_str = str(cwd.resolve())
    start = time.monotonic()

    try:
        completed = subprocess.run(
            skill.command,
            cwd=cwd_str,
            env=env,
            capture_output=True,
            text=True,
            timeout=skill.timeout_seconds,
            shell=False,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        duration_ms = int((time.monotonic() - start) * 1000)
        return ExecutionResult(
            skill_name=skill.name, handler=skill.handler,
            command=list(skill.command), cwd=cwd_str,
            exit_code=-1,
            stdout=(exc.stdout or "") if isinstance(exc.stdout, str) else "",
            stderr=(exc.stderr or "") if isinstance(exc.stderr, str) else "",
            duration_ms=duration_ms, status="timeout", timed_out=True,
            error=f"Timed out after {skill.timeout_seconds}s",
        )
    except FileNotFoundError as exc:
        duration_ms = int((time.monotonic() - start) * 1000)
        return ExecutionResult(
            skill_name=skill.name, handler=skill.handler,
            command=list(skill.command), cwd=cwd_str,
            exit_code=-1, stdout="", stderr="",
            duration_ms=duration_ms, status="error",
            error=f"Command not found: {exc.filename or skill.command[0]}",
        )

    duration_ms = int((time.monotonic() - start) * 1000)
    status = "success" if completed.returncode == 0 else "failure"
    return ExecutionResult(
        skill_name=skill.name, handler=skill.handler,
        command=list(skill.command), cwd=cwd_str,
        exit_code=completed.returncode,
        stdout=completed.stdout or "",
        stderr=completed.stderr or "",
        duration_ms=duration_ms, status=status,
    )
