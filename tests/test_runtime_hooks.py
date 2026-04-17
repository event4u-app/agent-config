"""Tests for runtime hooks and timeout enforcement."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from runtime_errors import ErrorCategory, ErrorSeverity, RuntimeError as RtError
from runtime_hooks import (
    HookResult,
    RuntimeHookRegistry,
    enforce_timeout,
    hook_check_handler,
)


def test_hook_registry_before_runs_all() -> None:
    registry = RuntimeHookRegistry()

    def hook_a(skill_name: str, **_) -> HookResult:
        return HookResult(hook_name="a", phase="before", success=True, duration_ms=0)

    def hook_b(skill_name: str, **_) -> HookResult:
        return HookResult(hook_name="b", phase="before", success=True, duration_ms=0)

    registry.register_before(hook_a)
    registry.register_before(hook_b)
    result = registry.run_before("test-skill")
    assert len(result.results) == 2
    assert result.all_passed


def test_hook_registry_before_stops_on_failure() -> None:
    registry = RuntimeHookRegistry()

    def fail_hook(skill_name: str, **_) -> HookResult:
        return HookResult(hook_name="fail", phase="before", success=False, duration_ms=0,
                          message="failed")

    def never_reached(skill_name: str, **_) -> HookResult:
        return HookResult(hook_name="never", phase="before", success=True, duration_ms=0)

    registry.register_before(fail_hook)
    registry.register_before(never_reached)
    result = registry.run_before("test-skill")
    assert len(result.results) == 1
    assert not result.all_passed


def test_hook_registry_after_runs_all_even_on_failure() -> None:
    registry = RuntimeHookRegistry()

    def fail_hook(skill_name: str, **_) -> HookResult:
        return HookResult(hook_name="fail", phase="after", success=False, duration_ms=0)

    def still_runs(skill_name: str, **_) -> HookResult:
        return HookResult(hook_name="still", phase="after", success=True, duration_ms=0)

    registry.register_after(fail_hook)
    registry.register_after(still_runs)
    result = registry.run_after("test-skill")
    assert len(result.results) == 2


def test_hook_exception_caught() -> None:
    registry = RuntimeHookRegistry()

    def bad_hook(skill_name: str, **_) -> HookResult:
        raise ValueError("boom")

    registry.register_before(bad_hook)
    result = registry.run_before("test-skill")
    assert len(result.results) == 1
    assert not result.results[0].success
    assert result.results[0].error is not None
    assert "boom" in result.results[0].message


def test_enforce_timeout_valid() -> None:
    error = enforce_timeout(30, "test")
    assert error is None


def test_enforce_timeout_zero() -> None:
    error = enforce_timeout(0, "test")
    assert error is not None
    assert error.category == ErrorCategory.CONFIGURATION


def test_enforce_timeout_negative() -> None:
    error = enforce_timeout(-1, "test")
    assert error is not None


def test_hook_check_handler_valid() -> None:
    result = hook_check_handler(skill_name="test", handler="shell")
    assert result.success
    assert result.error is None


def test_hook_check_handler_invalid() -> None:
    result = hook_check_handler(skill_name="test", handler="ruby")
    assert not result.success
    assert result.error is not None
    assert result.error.category == ErrorCategory.CONFIGURATION


def test_error_report_from_hook_chain() -> None:
    registry = RuntimeHookRegistry()

    def fail_hook(skill_name: str, **_) -> HookResult:
        return HookResult(
            hook_name="fail", phase="before", success=False, duration_ms=0,
            error=RtError(
                category=ErrorCategory.ENVIRONMENT,
                severity=ErrorSeverity.FATAL,
                code="test_error", message="test",
                skill_name=skill_name,
            ),
        )

    registry.register_before(fail_hook)
    result = registry.run_before("test")
    report = result.to_error_report("test")
    assert report.has_fatal
    assert report.fatal_count == 1
