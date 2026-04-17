"""Tests for runtime observability — events, metrics, and logger."""

from __future__ import annotations

import io
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from runtime_events import EventEmitter, EventType, RuntimeEvent, create_event
from runtime_metrics import Counter, MetricsCollector, Timer
from runtime_logger import LogLevel, RuntimeLogger


# --- Event tests ---

def test_event_emitter_collects() -> None:
    emitter = EventEmitter()
    event = create_event(EventType.SKILL_DISPATCHED, "test-skill", handler="shell")
    emitter.emit(event)
    assert emitter.count == 1


def test_event_emitter_filters_by_type() -> None:
    emitter = EventEmitter()
    emitter.emit(create_event(EventType.SKILL_DISPATCHED, "s1"))
    emitter.emit(create_event(EventType.EXECUTION_STARTED, "s1"))
    emitter.emit(create_event(EventType.EXECUTION_COMPLETED, "s1"))
    assert len(emitter.get_events(EventType.SKILL_DISPATCHED)) == 1
    assert len(emitter.get_events(EventType.EXECUTION_STARTED)) == 1
    assert len(emitter.get_events()) == 3


def test_event_listener_called() -> None:
    emitter = EventEmitter()
    received = []
    emitter.on(EventType.ERROR_OCCURRED, lambda e: received.append(e))
    emitter.emit(create_event(EventType.ERROR_OCCURRED, "s1", error="test"))
    assert len(received) == 1


def test_event_listener_exception_ignored() -> None:
    emitter = EventEmitter()
    emitter.on(EventType.SKILL_DISPATCHED, lambda e: (_ for _ in ()).throw(ValueError("boom")))
    # Should not raise
    emitter.emit(create_event(EventType.SKILL_DISPATCHED, "s1"))
    assert emitter.count == 1


def test_event_to_dict() -> None:
    event = create_event(EventType.TOOL_ACCESSED, "s1", tool="github", action="read_pr")
    d = event.to_dict()
    assert d["type"] == "tool_accessed"
    assert d["skill"] == "s1"
    assert d["data"]["tool"] == "github"


def test_event_clear() -> None:
    emitter = EventEmitter()
    emitter.emit(create_event(EventType.SKILL_DISPATCHED, "s1"))
    emitter.clear()
    assert emitter.count == 0


# --- Metrics tests ---

def test_counter_increment() -> None:
    c = Counter("test")
    c.increment("a")
    c.increment("a")
    c.increment("b")
    assert c.get("a") == 2
    assert c.get("b") == 1
    assert c.total() == 3


def test_counter_default_label() -> None:
    c = Counter("test")
    c.increment()
    assert c.get() == 1


def test_timer_record() -> None:
    t = Timer("test")
    t.record(100.0, "a")
    t.record(200.0, "a")
    assert t.count("a") == 2
    assert t.avg("a") == 150.0
    assert t.min("a") == 100.0
    assert t.max("a") == 200.0


def test_timer_empty() -> None:
    t = Timer("test")
    assert t.avg("missing") == 0.0
    assert t.count("missing") == 0


def test_metrics_collector_summary() -> None:
    mc = MetricsCollector()
    mc.dispatches.increment("test-skill")
    mc.executions.increment("test-skill")
    mc.errors.increment("test-skill")
    summary = mc.summary()
    assert "Dispatches: 1" in summary
    assert "Executions: 1" in summary
    assert "Errors: 1" in summary


def test_metrics_collector_report() -> None:
    mc = MetricsCollector()
    mc.dispatches.increment("s1")
    report = mc.report()
    assert "dispatches" in report
    assert "executions" in report
    assert "errors" in report


# --- Logger tests ---

def test_logger_info() -> None:
    output = io.StringIO()
    logger = RuntimeLogger(output=output)
    logger.info("test message", "test-skill", handler="shell")
    assert logger.entry_count == 1
    line = output.getvalue().strip()
    d = json.loads(line)
    assert d["level"] == "info"
    assert d["skill"] == "test-skill"


def test_logger_filters_by_level() -> None:
    output = io.StringIO()
    logger = RuntimeLogger(output=output, min_level=LogLevel.WARNING)
    logger.debug("hidden", "s1")
    logger.info("hidden", "s1")
    logger.warning("visible", "s1")
    logger.error("visible", "s1")
    lines = [l for l in output.getvalue().strip().split("\n") if l]
    assert len(lines) == 2
    assert logger.entry_count == 4  # all collected internally


def test_logger_error_count() -> None:
    logger = RuntimeLogger(output=io.StringIO())
    logger.info("ok", "s1")
    logger.error("bad", "s1")
    logger.error("worse", "s1")
    assert logger.error_count == 2
    assert logger.warning_count == 0


def test_logger_get_entries_by_level() -> None:
    logger = RuntimeLogger(output=io.StringIO())
    logger.info("info", "s1")
    logger.warning("warn", "s1")
    logger.error("err", "s1")
    warnings = logger.get_entries(LogLevel.WARNING)
    assert len(warnings) == 1
    assert warnings[0].message == "warn"
