#!/usr/bin/env python3
"""
Runtime Logger — structured logging for runtime execution.

Produces JSON-formatted log entries for:
- Execution flow (dispatched → started → completed)
- Tool access
- Errors and warnings
- Hook execution
"""

from __future__ import annotations

import json
import sys
import time
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional, TextIO


class LogLevel(str, Enum):
    """Log severity levels."""
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


@dataclass
class LogEntry:
    """Structured log entry."""
    level: LogLevel
    message: str
    skill_name: str
    timestamp: float
    context: Dict[str, Any]

    def to_dict(self) -> dict:
        result = {
            "level": self.level.value,
            "message": self.message,
            "skill": self.skill_name,
            "timestamp": self.timestamp,
        }
        if self.context:
            result["context"] = self.context
        return result

    def to_json(self) -> str:
        return json.dumps(self.to_dict())


class RuntimeLogger:
    """Structured logger for runtime execution."""

    def __init__(self, output: Optional[TextIO] = None, min_level: LogLevel = LogLevel.INFO) -> None:
        self._output = output or sys.stderr
        self._min_level = min_level
        self._entries: List[LogEntry] = []
        self._level_order = {
            LogLevel.DEBUG: 0,
            LogLevel.INFO: 1,
            LogLevel.WARNING: 2,
            LogLevel.ERROR: 3,
        }

    def _should_log(self, level: LogLevel) -> bool:
        return self._level_order[level] >= self._level_order[self._min_level]

    def _log(self, level: LogLevel, message: str, skill_name: str, **context: Any) -> LogEntry:
        entry = LogEntry(
            level=level,
            message=message,
            skill_name=skill_name,
            timestamp=time.time(),
            context=context,
        )
        self._entries.append(entry)
        if self._should_log(level):
            self._output.write(entry.to_json() + "\n")
        return entry

    def debug(self, message: str, skill_name: str, **context: Any) -> LogEntry:
        return self._log(LogLevel.DEBUG, message, skill_name, **context)

    def info(self, message: str, skill_name: str, **context: Any) -> LogEntry:
        return self._log(LogLevel.INFO, message, skill_name, **context)

    def warning(self, message: str, skill_name: str, **context: Any) -> LogEntry:
        return self._log(LogLevel.WARNING, message, skill_name, **context)

    def error(self, message: str, skill_name: str, **context: Any) -> LogEntry:
        return self._log(LogLevel.ERROR, message, skill_name, **context)

    def get_entries(self, level: Optional[LogLevel] = None) -> List[LogEntry]:
        if level is None:
            return list(self._entries)
        return [e for e in self._entries if e.level == level]

    @property
    def entry_count(self) -> int:
        return len(self._entries)

    @property
    def error_count(self) -> int:
        return sum(1 for e in self._entries if e.level == LogLevel.ERROR)

    @property
    def warning_count(self) -> int:
        return sum(1 for e in self._entries if e.level == LogLevel.WARNING)
