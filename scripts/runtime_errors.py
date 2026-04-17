#!/usr/bin/env python3
"""
Runtime Errors — structured error classification for runtime execution.

Provides:
- Error classification (categories, severity)
- Structured error output format
- Error aggregation for reporting
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from enum import Enum
from typing import List, Optional


class ErrorCategory(str, Enum):
    """Categories for runtime errors."""
    ENVIRONMENT = "environment"      # Missing binary, wrong version
    PERMISSION = "permission"        # Tool access denied, safety violation
    TIMEOUT = "timeout"              # Execution exceeded time limit
    HANDLER = "handler"              # Handler failed to start or crashed
    VALIDATION = "validation"        # Output did not match expectations
    CONFIGURATION = "configuration"  # Invalid skill configuration
    UNKNOWN = "unknown"              # Unclassifiable error


class ErrorSeverity(str, Enum):
    """Severity levels for runtime errors."""
    FATAL = "fatal"        # Execution cannot continue
    ERROR = "error"        # Execution failed but system is stable
    WARNING = "warning"    # Execution succeeded with concerns
    INFO = "info"          # Informational, no action needed


@dataclass
class RuntimeError:
    """Structured runtime error."""
    category: ErrorCategory
    severity: ErrorSeverity
    code: str
    message: str
    skill_name: str
    handler: Optional[str] = None
    detail: Optional[str] = None

    def to_dict(self) -> dict:
        return {k: v.value if isinstance(v, Enum) else v
                for k, v in asdict(self).items() if v is not None}


@dataclass
class ErrorReport:
    """Aggregated error report for a runtime session."""
    errors: List[RuntimeError]
    total_count: int = 0
    fatal_count: int = 0
    error_count: int = 0
    warning_count: int = 0

    def __post_init__(self) -> None:
        self.total_count = len(self.errors)
        self.fatal_count = sum(1 for e in self.errors if e.severity == ErrorSeverity.FATAL)
        self.error_count = sum(1 for e in self.errors if e.severity == ErrorSeverity.ERROR)
        self.warning_count = sum(1 for e in self.errors if e.severity == ErrorSeverity.WARNING)

    @property
    def has_fatal(self) -> bool:
        return self.fatal_count > 0

    @property
    def has_errors(self) -> bool:
        return self.error_count > 0 or self.fatal_count > 0

    def to_dict(self) -> dict:
        return {
            "total": self.total_count,
            "fatal": self.fatal_count,
            "errors": self.error_count,
            "warnings": self.warning_count,
            "items": [e.to_dict() for e in self.errors],
        }


def classify_error(exception: Exception, skill_name: str, handler: str = "unknown") -> RuntimeError:
    """Classify a Python exception into a structured RuntimeError."""
    exc_type = type(exception).__name__
    message = str(exception)

    if "timeout" in message.lower() or "timed out" in message.lower():
        return RuntimeError(
            category=ErrorCategory.TIMEOUT,
            severity=ErrorSeverity.ERROR,
            code="execution_timeout",
            message=f"Execution timed out: {message}",
            skill_name=skill_name,
            handler=handler,
        )

    if "permission" in message.lower() or "denied" in message.lower():
        return RuntimeError(
            category=ErrorCategory.PERMISSION,
            severity=ErrorSeverity.FATAL,
            code="permission_denied",
            message=f"Permission denied: {message}",
            skill_name=skill_name,
            handler=handler,
        )

    if "not found" in message.lower() or "no such file" in message.lower():
        return RuntimeError(
            category=ErrorCategory.ENVIRONMENT,
            severity=ErrorSeverity.FATAL,
            code="binary_not_found",
            message=f"Required binary not found: {message}",
            skill_name=skill_name,
            handler=handler,
        )

    return RuntimeError(
        category=ErrorCategory.UNKNOWN,
        severity=ErrorSeverity.ERROR,
        code=f"unclassified_{exc_type.lower()}",
        message=message,
        skill_name=skill_name,
        handler=handler,
        detail=exc_type,
    )
