# End-to-End Integration Roadmap

## Problem

Phase 3 delivered runtime, tools, observability, feedback, and lifecycle as separate modules.
They don't talk to each other yet. No single execution path connects them.

## Goal

Create a **reference execution pipeline** that wires all components into one flow:

```
Skill (with execution block)
  → Dispatcher (resolve type, check safety)
    → Tool Adapter (real API calls, read-only first)
      → Events emitted at each step
        → Metrics updated (counters, timers)
          → Feedback recorded (outcome, duration, errors)
            → Lifecycle impact (health score adjustment)
```

## What this changes for the user

- Running `task runtime-execute --skill quality-fix` produces a full traced execution
- Every execution is observable: events, metrics, duration, outcome
- Failures feed back into skill health scores automatically
- Tool calls are audited and traceable

## PR series

### PR 1: Execution pipeline — connect dispatcher to execute + hooks

Wire `runtime_dispatcher.py` → `runtime_execute.py` → `runtime_hooks.py` into a single
`runtime_pipeline.py` that:
- Accepts a skill name
- Dispatches it (safety checks)
- Runs before-hooks (environment, handler validation)
- Produces execution proposal
- Runs after-hooks (verification checks)
- Returns structured result with timing

**Files:**
- New: `scripts/runtime_pipeline.py`
- New: `tests/test_runtime_pipeline.py`

**Acceptance:**
- Pipeline produces structured result for assisted and automated skills
- Manual skills are blocked with clear message
- Before-hook failure stops execution
- All steps are timed

---

### PR 2: Event + metrics emission from pipeline

Wire `runtime_events.py` and `runtime_metrics.py` into the pipeline so every execution
emits real events and updates real metrics.

**Files:**
- Modified: `scripts/runtime_pipeline.py` (emit events at each stage)
- New: `scripts/runtime_session.py` (session context: holds emitter + metrics + logger)
- New: `tests/test_runtime_session.py`

**Acceptance:**
- Pipeline emits: `skill_dispatched`, `execution_started`, `execution_completed`
- Tool calls emit `tool_accessed`
- Errors emit `error_occurred`
- Metrics collector has dispatch/execution/error counts after pipeline run
- Logger writes structured JSON for each event

---

### PR 3: Feedback recording from pipeline outcomes

Wire `feedback_collector.py` into the pipeline so execution outcomes are automatically
captured and classified.

**Files:**
- Modified: `scripts/runtime_pipeline.py` (record feedback after execution)
- Modified: `scripts/runtime_session.py` (add feedback collector to session)
- New: `scripts/feedback_persistence.py` (write/read feedback to JSON file)
- New: `tests/test_feedback_persistence.py`

**Acceptance:**
- Every pipeline execution records an outcome (success/failure/timeout/blocked)
- Outcomes persist to `agents/reports/feedback.json`
- `task feedback-report` reads persisted data and generates summary
- Repeated failures trigger improvement suggestions

---

### PR 4: Lifecycle impact from feedback data

Wire `skill_lifecycle.py` to consume feedback data, so health scores reflect real
execution outcomes — not just static metadata.

**Files:**
- Modified: `scripts/skill_lifecycle.py` (integrate feedback data into health scoring)
- Modified: `scripts/runtime_pipeline.py` (update lifecycle after feedback)
- New: `tests/test_lifecycle_integration.py`
- New: Taskfile tasks: `runtime-execute`, `feedback-report`

**Acceptance:**
- Health score formula includes: status weight + linter issues + execution success rate
- Skill with >50% failure rate gets health penalty
- `task lifecycle-health` shows scores that reflect real execution data
- Full E2E test: dispatch → execute → event → feedback → lifecycle score change

## Dependencies

- Phase 3 runtime, tools, observability, feedback, lifecycle modules (all present)
- No external dependencies

## Risk

- Over-engineering the pipeline before real usage data exists
- Mitigation: keep pipeline simple, add complexity only when real patterns emerge
