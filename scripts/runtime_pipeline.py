#!/usr/bin/env python3
"""
Runtime Pipeline — end-to-end execution flow connecting all runtime components.

Flow:
    Skill → Dispatcher (safety check)
        → Before-hooks (environment, handler validation)
            → Execute (produce proposal)
                → After-hooks (verification)
                    → Events emitted at each step
                        → Metrics updated (counters, timers)
                            → Feedback recorded (outcome, duration, errors)
                                → Lifecycle impact (health score)

Usage:
    python3 scripts/runtime_pipeline.py --skill SKILL_NAME [--root ROOT] [--format text|json]
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))

from runtime_registry import SkillRuntime, build_registry
from runtime_dispatcher import dispatch, DispatchResult
from runtime_execute import prepare_execution, ExecutionProposal
from runtime_hooks import RuntimeHookRegistry, HookChainResult, hook_check_handler
from runtime_events import EventEmitter, EventType, create_event
from runtime_metrics import MetricsCollector
from runtime_errors import classify_error, RuntimeError as RtError, ErrorCategory, ErrorSeverity
from runtime_session import RuntimeSession
from feedback_collector import FeedbackCollector, Outcome


@dataclass
class PipelineResult:
    """Complete result of a pipeline execution."""
    skill_name: str
    status: str = "pending"  # "success", "blocked", "hook_failure", "execution_error", "not_found"
    dispatch_result: Optional[DispatchResult] = None
    execution_proposal: Optional[ExecutionProposal] = None
    before_hooks: Optional[HookChainResult] = None
    after_hooks: Optional[HookChainResult] = None
    error: Optional[RtError] = None
    duration_ms: float = 0.0
    events_emitted: int = 0

    @property
    def is_success(self) -> bool:
        return self.status == "success"


def run_pipeline(
    skill_name: str,
    root: Path,
    session: Optional[RuntimeSession] = None,
) -> PipelineResult:
    """Execute the full pipeline for a skill.

    Returns a PipelineResult with all intermediate state for observability.
    """
    start_time = time.monotonic()
    if session is None:
        session = RuntimeSession.create(root)

    result = PipelineResult(skill_name=skill_name)
    emitter = session.emitter
    metrics = session.metrics
    feedback = session.feedback

    # --- Step 1: Dispatch ---
    metrics.dispatches.increment(skill_name)
    emitter.emit(create_event(EventType.SKILL_DISPATCHED, skill_name))
    result.events_emitted += 1

    registry = build_registry(root)
    dr = dispatch(skill_name, registry)
    result.dispatch_result = dr

    if not dr.request.is_ready:
        result.status = "blocked" if dr.request.status == "blocked" else "not_found"
        result.error = RtError(
            skill_name=skill_name,
            category=ErrorCategory.CONFIGURATION,
            severity=ErrorSeverity.WARNING,
            code="dispatch_blocked",
            message=dr.request.reason or f"Skill {skill_name} not dispatchable",
        )
        metrics.blocked.increment(skill_name)
        emitter.emit(create_event(EventType.ERROR_OCCURRED, skill_name,
                                  metadata={"reason": dr.request.reason}))
        result.events_emitted += 1
        result.duration_ms = (time.monotonic() - start_time) * 1000
        _record_feedback(feedback, result)
        return result

    # --- Step 2: Before-hooks ---
    emitter.emit(create_event(EventType.EXECUTION_STARTED, skill_name,
                              metadata={"type": dr.request.execution_type}))
    result.events_emitted += 1

    hook_registry = RuntimeHookRegistry()
    hook_registry.register_before(hook_check_handler)
    before_result = hook_registry.run_before(
        skill_name=skill_name,
        handler=dr.request.handler,
    )
    result.before_hooks = before_result

    if not before_result.all_passed:
        result.status = "hook_failure"
        first_err = next((r.error for r in before_result.results if r.error), None)
        result.error = first_err
        metrics.errors.increment(skill_name)
        emitter.emit(create_event(EventType.ERROR_OCCURRED, skill_name,
                                  metadata={"phase": "before_hooks"}))
        result.events_emitted += 1
        result.duration_ms = (time.monotonic() - start_time) * 1000
        _record_feedback(feedback, result)
        return result

    # --- Step 3: Execute (produce proposal) ---
    try:
        proposal = prepare_execution(skill_name, registry)
        result.execution_proposal = proposal
    except Exception as exc:
        result.status = "execution_error"
        result.error = classify_error(exc, skill_name)
        metrics.errors.increment(skill_name)
        emitter.emit(create_event(EventType.ERROR_OCCURRED, skill_name,
                                  metadata={"error": str(exc)}))
        result.events_emitted += 1
        result.duration_ms = (time.monotonic() - start_time) * 1000
        _record_feedback(feedback, result)
        return result

    # --- Step 4: After-hooks ---
    after_result = hook_registry.run_after(
        skill_name=skill_name,
        handler=dr.request.handler,
    )
    result.after_hooks = after_result

    # --- Step 5: Finalize ---
    result.status = "success"
    metrics.executions.increment(skill_name)
    metrics.execution_time.record((time.monotonic() - start_time) * 1000, skill_name)
    emitter.emit(create_event(EventType.EXECUTION_COMPLETED, skill_name,
                              metadata={"status": "success"}))
    result.events_emitted += 1
    result.duration_ms = (time.monotonic() - start_time) * 1000

    _record_feedback(feedback, result)
    return result


def _record_feedback(feedback: FeedbackCollector, result: PipelineResult) -> None:
    """Record pipeline outcome as feedback."""
    outcome_map = {
        "success": Outcome.SUCCESS,
        "blocked": Outcome.BLOCKED,
        "hook_failure": Outcome.FAILURE,
        "execution_error": Outcome.FAILURE,
        "not_found": Outcome.BLOCKED,
    }
    outcome = outcome_map.get(result.status, Outcome.FAILURE)
    error_msg = result.error.message if result.error else None
    feedback.record_outcome(
        skill_name=result.skill_name,
        outcome=outcome,
        duration_ms=result.duration_ms,
        error_codes=[result.error.category] if result.error else None,
        notes=error_msg,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Runtime Pipeline")
    parser.add_argument("--skill", required=True, help="Skill name to execute")
    parser.add_argument("--root", default=".", help="Project root")
    parser.add_argument("--format", choices=["text", "json"], default="text")
    args = parser.parse_args()

    root = Path(args.root)
    result = run_pipeline(args.skill, root)

    if args.format == "json":
        data = asdict(result)
        # Remove non-serializable fields
        data.pop("dispatch_result", None)
        data.pop("execution_proposal", None)
        data.pop("before_hooks", None)
        data.pop("after_hooks", None)
        data.pop("error", None)
        print(json.dumps(data, indent=2))
    else:
        icon = "✅" if result.is_success else "❌"
        print(f"{icon}  Pipeline: {result.skill_name}")
        print(f"   Status: {result.status}")
        print(f"   Duration: {result.duration_ms:.1f}ms")
        print(f"   Events: {result.events_emitted}")
        if result.error:
            print(f"   Error: {result.error.message}")

    return 0 if result.is_success else 1


if __name__ == "__main__":
    raise SystemExit(main())
