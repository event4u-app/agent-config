# Consumable Output + Feedback Governance Roadmap

> **Status: ✅ COMPLETED** (2026-04-17)

## Problem

- Observability exists but produces no visible output — no reports, no CI summaries, no dashboards
- Feedback collector generates suggestions but they have no governance target
- Metrics are collected in-memory only — nothing persists between runs
- The loop "failure → suggestion → improvement → better skill" is not closed
- **No defined questions** — data is collected without knowing what it should answer

## Goal

- Make observability **decision-enabling**, not just logging
- **Close the feedback loop**: suggestions flow into governance actions
- **Persist** metrics and feedback between runs
- Define **what questions** observability must answer before building reports

## Key questions observability must answer

These drive which data is collected, which reports exist, and which events are mandatory:

| Question | Data source | Report |
|---|---|---|
| Which skills fail most often? | `feedback.json` | Feedback summary |
| Which skills produce the most warnings? | Linter output | Health dashboard |
| Which execution types are stable? | Pipeline outcomes | Health dashboard |
| Which tool adapters cause the most errors? | `tool-audit.json` | Tool audit |
| Which skills should be deprecated? | Lifecycle scores + feedback | Lifecycle report |
| Is the overall system improving over time? | Trend data | Health dashboard |

## What this changes for the user

- `task report` generates a markdown health dashboard answering the questions above
- PR CI comments include skill metrics and quality summaries
- Feedback suggestions appear as actionable items (skill backlog, lifecycle flags)
- `task tool-audit` shows which tools were called, when, and by which skill

## Mandatory event schema

Every event emitted by the pipeline **must** follow this shape:

```json
{
  "timestamp": "ISO-8601",
  "event_type": "skill_dispatched | execution_completed | tool_accessed | error_occurred",
  "skill_name": "string",
  "execution_type": "manual | assisted | automated",
  "outcome": "success | failure | timeout | blocked",
  "duration_ms": "number | null",
  "metadata": {}
}
```

## Mandatory report artifacts

| Artifact | Schema | Written by | Consumed by |
|---|---|---|---|
| `agents/reports/metrics.json` | Counters + timers per skill | Pipeline | Report generator |
| `agents/reports/feedback.json` | Outcomes + suggestions | Feedback collector | Governance + reports |
| `agents/reports/tool-audit.json` | Tool call log | Tool adapters | Audit report |
| `agents/reports/health-dashboard.md` | Markdown summary | Report generator | User (CLI/CI) |

## Token cost awareness

All outputs in this roadmap are gated by `.agent-settings`:

| Output | Gated by | Default |
|---|---|---|
| Report generation | `observability_reports` | `false` |
| Report auto-read into context | `runtime_auto_read_reports` | `false` |
| Report line limit | `max_report_lines` | `30` |
| CI PR summaries | `ci_summary_enabled` | `false` |
| Feedback suggestions in chat | `feedback_suggestions_in_chat` | `false` |
| Feedback persistence | `feedback_collection` | `false` |

**Design rule:** Persist locally first. Only inject into agent context or CI when the user explicitly enables it.

## PR series

### PR 1: Persistence layer + event schema

Add file-based persistence with the mandatory event schema.

**Files:**
- New: `scripts/persistence.py` (read/write JSON to `agents/reports/`)
- New: `scripts/event_schema.py` (validate events against mandatory shape)
- New: `agents/reports/.gitkeep`
- Modified: `scripts/runtime_metrics.py` (add save/load)
- Modified: `scripts/feedback_collector.py` (add save/load)
- New: `tests/test_persistence.py`
- New: `tests/test_event_schema.py`

**Acceptance:**
- All events conform to the mandatory schema (validated at write time)
- Metrics, feedback, and tool audit data persist to JSON files
- Data loads correctly on next run (append, not overwrite)
- `.gitignore` excludes `agents/reports/*.json` (local data, not committed)

---

### PR 2: CLI reports — answering the key questions

Generate reports that directly answer the 6 key questions defined above.

**Files:**
- New: `scripts/report_generator.py`
- New Taskfile tasks: `report`, `tool-audit`, `feedback-summary`
- New: `tests/test_report_generator.py`

**Reports generated:**
- `agents/reports/health-dashboard.md` — answers: which skills fail, which are stable, trend direction
- `agents/reports/tool-audit.md` — answers: which adapters cause errors, call frequency
- `agents/reports/feedback-summary.md` — answers: top errors, improvement suggestions, deprecation candidates

**Acceptance:**
- `task report` generates all three reports
- Each report section maps to one of the 6 key questions
- Reports respect `max_report_lines` setting (truncate with "... truncated" marker)
- Agent only auto-reads reports when `runtime_auto_read_reports=true`
- Empty data produces "no data yet" message, not errors

---

### PR 3: CI integration — PR summaries

Generate observability summaries for CI (GitHub Actions).

**Files:**
- New: `scripts/ci_summary.py` (generate GitHub Actions job summary)
- Modified: `.github/workflows/` (add summary step after lint)

**Summary content:**
- Skill lint results (pass/warn/fail counts)
- Runtime-capable skills count by type
- Lifecycle health score distribution
- New/changed skill execution metadata

**Acceptance:**
- PR CI run produces a summary visible in GitHub Actions
- Summary only generated when `ci_summary_enabled=true` in settings
- Summary is concise (respects `max_report_lines`) and actionable
- Failed lint or health issues are highlighted

---

### PR 4: Feedback governance — suggestions → actions

Define where feedback suggestions go and how they become governance actions.

**Files:**
- New: `scripts/feedback_governance.py`
- New: `docs/guidelines/agent-infra/feedback-governance.md`
- New: `tests/test_feedback_governance.py`

**Governance targets:**

| Suggestion type | Target | Action |
|---|---|---|
| `fix_error` (≥3 occurrences) | Skill backlog | Create improvement note in skill's SKILL.md |
| `improve_timeout` | Skill metadata | Suggest timeout_seconds adjustment |
| `refactor` (>50% failure) | Lifecycle flag | Mark skill as `needs_review` |
| High-priority repeated | Upstream contribute | Flag for package contribution (with user consent) |

**Acceptance:**
- `task feedback-apply` reads suggestions and produces concrete action proposals
- Suggestions only shown in chat when `feedback_suggestions_in_chat=true`
- Actions are proposals only — never auto-applied without human confirmation
- Each action references the evidence (error counts, failure rates)
- Governance guideline documents the full flow

## Dependencies

- Roadmap 1 (E2E Integration) must be complete — persistence needs real pipeline data
- Roadmap 2 (Skill Activation) should be at least partially done — reports need tagged skills

## Risk

- Over-automating governance (suggestions become mandates)
- Mitigation: all actions are proposals, human review gate is mandatory
- Report fatigue (too many reports nobody reads)
- Mitigation: reports only generated on demand, each section answers a specific question
- Schema drift (events don't match expected shape)
- Mitigation: schema validation at write time, tests for every event type
