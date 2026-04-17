# End-to-End Integration + Tool Adapter Roadmap

## Problem

Phase 3 delivered runtime, tools, observability, feedback, and lifecycle as separate modules.
They don't talk to each other yet. No single execution path connects them.
Tool adapters return scaffold data — no real API calls yet.

## Goal

1. Create a **reference execution pipeline** that wires all components into one flow
2. **Harden tool adapters** in stages: read-only → observability → skill integration

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
- GitHub/Jira adapters return real data (read-only)

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

### PR 3: Feedback recording + lifecycle impact

Wire `feedback_collector.py` and `skill_lifecycle.py` into the pipeline so execution
outcomes are captured, classified, and affect health scores.

**Files:**
- Modified: `scripts/runtime_pipeline.py` (record feedback + update lifecycle after execution)
- Modified: `scripts/runtime_session.py` (add feedback collector to session)
- Modified: `scripts/skill_lifecycle.py` (integrate feedback data into health scoring)
- New: `scripts/feedback_persistence.py` (write/read feedback to JSON file)
- New: `tests/test_feedback_persistence.py`
- New: `tests/test_lifecycle_integration.py`
- New: Taskfile tasks: `runtime-execute`, `feedback-report`

**Acceptance:**
- Every pipeline execution records an outcome (success/failure/timeout/blocked)
- Outcomes persist to `agents/reports/feedback.json`
- Health score formula includes: status weight + linter issues + execution success rate
- Full E2E test: dispatch → execute → event → feedback → lifecycle score change

---

### PR 4: Tool adapters — read-only activation + auth

Replace scaffold adapters with controlled read-only integrations.

**Stage 4A — GitHub adapter:**
- Auth via `GITHUB_TOKEN` environment variable
- Real calls: `read_pr`, `list_files`, `read_file`
- Structured error responses (auth failure, rate limit, timeout)
- Configurable timeout

**Stage 4B — Jira adapter:**
- Auth via `JIRA_TOKEN` + `JIRA_URL` environment variables
- Real calls: `read_ticket`, `search_tickets`
- Structured error responses (auth failure, not found, timeout)

**Files:**
- Modified: `scripts/tool_adapters/github_adapter.py`
- Modified: `scripts/tool_adapters/jira_adapter.py`
- New: `scripts/tool_adapters/adapter_errors.py` (shared error types)
- New: `tests/test_github_adapter_real.py` (integration tests, skipped without token)
- New: `tests/test_jira_adapter_real.py` (integration tests, skipped without token)

**Acceptance:**
- Read-only calls work with real tokens
- Missing tokens → graceful fallback to scaffold data
- Every adapter call returns a stable response shape
- Timeout and rate-limit handling

---

### PR 5: Tool observability + skill integration

Make tool calls observable and wire selected skills to use adapters.

**Stage 5A — Tool observability:**
- Every tool call emits an audit event (following mandatory event schema from Roadmap 3)
- Tool results use a stable response shape (`ToolResult` with status, data, error)
- Audit events persist to `agents/reports/tool-audit.json`

**Stage 5B — Skill integration (1-2 reference skills):**
- `create-pr` skill uses GitHub adapter through runtime contracts
- No direct raw API calls where adapters exist

**Files:**
- Modified: `scripts/tool_adapters/base_adapter.py` (add audit event emission)
- Modified: selected SKILL.md files (add `allowed_tools` declarations)
- New: `tests/test_tool_observability.py`

**Acceptance:**
- `task tool-audit` shows real tool call data
- At least one skill uses an adapter through the runtime pipeline
- No adapter bugs mixed with skill bugs (isolated testing)

## Dependencies

- Phase 3 runtime, tools, observability, feedback, lifecycle modules (all present)
- PR 4/5 require environment tokens for integration tests

## Risk

- Over-engineering the pipeline before real usage data exists
- Mitigation: keep pipeline simple, add complexity only when real patterns emerge
- Mixing adapter bugs with skill bugs during integration
- Mitigation: adapters are hardened and tested (PR 4) before skill integration (PR 5)
