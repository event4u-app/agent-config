# Observability — Concrete PR Series

**Status: ✅ COMPLETE**

## Goal

Make the system measurable enough to support quality improvement and safe automation.

## Outcome after this series

The system should support:

- [x] structured execution events
- [x] aggregated metrics
- [x] lint/quality summaries
- [x] CI artifacts
- [x] optional dashboards later

---

# PR 1 — Structured event logging ✅

## Objective

Create a stable execution event format.

## Files to create

- `scripts/observability_events.py`
- `tests/test_observability_events.py`
- `.agent-src.uncompressed/guidelines/observability.md`

## Event fields

Suggested fields:
- timestamp
- artifact name
- artifact type
- execution type
- status
- duration_ms
- issue codes
- tool usage summary
- verification summary

## Acceptance criteria

- event schema exists
- tests cover serialization and required fields

---

# PR 2 — Runtime + linter event emission ✅

## Objective

Emit observability events from existing processes.

## Files to update

- `scripts/skill_linter.py`
- `scripts/runtime_execute.py`
- `Taskfile.yml`
- `tests/test_skill_linter.py`

## Features

Emit events for:
- lint run started/completed
- file pass/warn/fail
- runtime execution started/completed
- denied execution / denied tool usage

## Acceptance criteria

- lint and runtime can both emit structured events
- no sensitive data leakage in emitted payloads

---

# PR 3 — Metrics aggregation ✅

## Objective

Aggregate raw events into actionable metrics.

## Files to create

- `scripts/metrics_aggregate.py`
- `tests/test_metrics_aggregate.py`

## Output examples

- pass / warn / fail totals
- issue code frequency
- top failing skills
- runtime success rate
- average duration by skill

## Taskfile changes

Add:
- `task metrics:aggregate`
- `task metrics:report`

## Acceptance criteria

- aggregated metrics can be generated from event logs
- output is useful for CI and local review

---

# PR 4 — CI artifacts and markdown summaries ✅

## Objective

Make metrics visible in CI and reviews.

## Files to update

- `.github/workflows/skill-lint.yml`
- `.github/workflows/consistency.yml`
- optional: `scripts/metrics_summary.py`

## Changes

- upload metrics JSON artifact
- optionally upload markdown summary
- optionally print short summary in workflow logs

## Acceptance criteria

- CI stores metrics artifacts
- maintainers can inspect trend-relevant data without digging into raw logs

---

# PR 5 — Optional dashboard / visualization adapter ✅

## Objective

Prepare for Grafana/UI visibility later without coupling now.

## Files to create

- `docs/observability-dashboard.md`

## Scope

Do NOT build full UI yet unless clearly needed.
Just define:
- export format
- dashboard fields
- future integration points

## Acceptance criteria

- dashboard path is documented
- no premature UI complexity added

---

# Suggested sequencing notes

- start with logs/events, not dashboards
- keep observability file-based first
- integrate with CI before adding external storage
