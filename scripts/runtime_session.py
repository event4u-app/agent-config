#!/usr/bin/env python3
"""
Runtime Session — context container for a single pipeline execution.

Holds all shared runtime components (emitter, metrics, feedback, logger)
so they can be passed through the pipeline without global state.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from runtime_events import EventEmitter
from runtime_metrics import MetricsCollector
from runtime_logger import RuntimeLogger
from feedback_collector import FeedbackCollector


@dataclass
class RuntimeSession:
    """Session context holding all runtime components."""

    emitter: EventEmitter
    metrics: MetricsCollector
    feedback: FeedbackCollector
    logger: RuntimeLogger
    root: Path = field(default_factory=lambda: Path("."))

    @classmethod
    def create(cls, root: Optional[Path] = None) -> RuntimeSession:
        """Create a fresh session with all components initialized."""
        root = root or Path(".")
        emitter = EventEmitter()
        metrics = MetricsCollector()
        feedback = FeedbackCollector()
        logger = RuntimeLogger()
        return cls(
            emitter=emitter,
            metrics=metrics,
            feedback=feedback,
            logger=logger,
            root=root,
        )

    @property
    def event_count(self) -> int:
        """Total events emitted in this session."""
        return len(self.emitter.get_events())

    @property
    def outcome_count(self) -> int:
        """Total outcomes recorded in this session."""
        return self.feedback.count
