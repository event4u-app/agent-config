"""Tests for runtime error classification."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from runtime_errors import (
    ErrorCategory,
    ErrorReport,
    ErrorSeverity,
    RuntimeError as RtError,
    classify_error,
)


def test_classify_timeout_error() -> None:
    err = classify_error(TimeoutError("Operation timed out"), "test-skill", "shell")
    assert err.category == ErrorCategory.TIMEOUT
    assert err.severity == ErrorSeverity.ERROR


def test_classify_permission_error() -> None:
    err = classify_error(PermissionError("Permission denied"), "test-skill", "shell")
    assert err.category == ErrorCategory.PERMISSION
    assert err.severity == ErrorSeverity.FATAL


def test_classify_file_not_found() -> None:
    err = classify_error(FileNotFoundError("No such file: /usr/bin/php"), "test-skill", "php")
    assert err.category == ErrorCategory.ENVIRONMENT
    assert err.severity == ErrorSeverity.FATAL


def test_classify_unknown_error() -> None:
    err = classify_error(RuntimeError("Something weird"), "test-skill")
    assert err.category == ErrorCategory.UNKNOWN
    assert err.severity == ErrorSeverity.ERROR


def test_error_report_counts() -> None:
    errors = [
        RtError(ErrorCategory.TIMEOUT, ErrorSeverity.FATAL, "t1", "msg", "skill1"),
        RtError(ErrorCategory.HANDLER, ErrorSeverity.ERROR, "h1", "msg", "skill1"),
        RtError(ErrorCategory.VALIDATION, ErrorSeverity.WARNING, "v1", "msg", "skill1"),
        RtError(ErrorCategory.ENVIRONMENT, ErrorSeverity.ERROR, "e1", "msg", "skill2"),
    ]
    report = ErrorReport(errors=errors)
    assert report.total_count == 4
    assert report.fatal_count == 1
    assert report.error_count == 2
    assert report.warning_count == 1
    assert report.has_fatal
    assert report.has_errors


def test_error_report_empty() -> None:
    report = ErrorReport(errors=[])
    assert report.total_count == 0
    assert not report.has_fatal
    assert not report.has_errors


def test_error_report_to_dict() -> None:
    errors = [
        RtError(ErrorCategory.TIMEOUT, ErrorSeverity.ERROR, "t1", "timeout msg", "skill1"),
    ]
    report = ErrorReport(errors=errors)
    d = report.to_dict()
    assert d["total"] == 1
    assert d["errors"] == 1
    assert len(d["items"]) == 1
    assert d["items"][0]["category"] == "timeout"


def test_runtime_error_to_dict() -> None:
    err = RtError(
        category=ErrorCategory.HANDLER,
        severity=ErrorSeverity.FATAL,
        code="handler_crash",
        message="Handler crashed",
        skill_name="test",
        handler="shell",
        detail="exit code 137",
    )
    d = err.to_dict()
    assert d["category"] == "handler"
    assert d["severity"] == "fatal"
    assert d["handler"] == "shell"
    assert d["detail"] == "exit code 137"


def test_runtime_error_to_dict_omits_none() -> None:
    err = RtError(
        category=ErrorCategory.UNKNOWN,
        severity=ErrorSeverity.INFO,
        code="info_only",
        message="Just info",
        skill_name="test",
    )
    d = err.to_dict()
    assert "handler" not in d
    assert "detail" not in d
