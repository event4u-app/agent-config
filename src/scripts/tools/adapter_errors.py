#!/usr/bin/env python3
"""
Shared error types for tool adapters.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class AdapterErrorType(str, Enum):
    """Categorized adapter errors."""
    AUTH_FAILURE = "auth_failure"
    NOT_FOUND = "not_found"
    RATE_LIMIT = "rate_limit"
    TIMEOUT = "timeout"
    NETWORK = "network"
    VALIDATION = "validation"
    UNKNOWN = "unknown"


@dataclass
class AdapterError:
    """Structured adapter error."""
    adapter: str
    action: str
    error_type: AdapterErrorType
    message: str
    status_code: Optional[int] = None
    retry_after: Optional[int] = None

    @property
    def is_retryable(self) -> bool:
        """Whether this error can be retried."""
        return self.error_type in (
            AdapterErrorType.RATE_LIMIT,
            AdapterErrorType.TIMEOUT,
            AdapterErrorType.NETWORK,
        )


def classify_http_error(adapter: str, action: str, status_code: int, message: str) -> AdapterError:
    """Classify an HTTP error into a structured AdapterError."""
    if status_code == 401 or status_code == 403:
        error_type = AdapterErrorType.AUTH_FAILURE
    elif status_code == 404:
        error_type = AdapterErrorType.NOT_FOUND
    elif status_code == 429:
        error_type = AdapterErrorType.RATE_LIMIT
    elif status_code >= 500:
        error_type = AdapterErrorType.NETWORK
    else:
        error_type = AdapterErrorType.UNKNOWN

    return AdapterError(
        adapter=adapter,
        action=action,
        error_type=error_type,
        message=message,
        status_code=status_code,
    )
