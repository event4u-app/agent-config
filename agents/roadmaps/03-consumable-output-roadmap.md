# Consumable Output + Feedback Governance Roadmap

## Problem

- Observability exists but produces no visible output — no reports, no CI summaries, no dashboards
- Feedback collector generates suggestions but they have no governance target
- Metrics are collected in-memory only — nothing persists between runs
- The loop "failure → suggestion → improvement → better skill" is not closed

## Goal

- Make observability **visible**: CLI reports, CI PR summaries, markdown dashboards
- **Close the feedback loop**: suggestions flow into governance actions
- **Persist** metrics and feedback between runs
- Real tool adapters with at least read-only API calls

## What this changes for the user

- `task report` generates a markdown health dashboard
- PR CI comments include skill metrics and quality summaries
- Feedback suggestions appear as actionable items (skill backlog, lifecycle flags)
- `task tool-audit` shows which tools were called, when, and by which skill

## PR series

### PR 1: Persistence layer — store metrics, feedback, and audit data

Add file-based persistence so data survives between runs.

**Files:**
- New: `scripts/persistence.py` (read/write JSON to `agents/reports/`)
- New: `agents/reports/.gitkeep`
- Modified: `scripts/runtime_metrics.py` (add save/load)
- Modified: `scripts/feedback_collector.py` (add save/load)
- New: `tests/test_persistence.py`

**Acceptance:**
- Metrics, feedback, and tool audit data persist to JSON files
- Data loads correctly on next run (append, not overwrite)
- `.gitignore` excludes `agents/reports/*.json` (local data, not committed)

---

### PR 2: CLI reports — `task report` and `task tool-audit`

Generate human-readable markdown reports from persisted data.

**Files:**
- New: `scripts/report_generator.py`
- New Taskfile tasks: `report`, `tool-audit`, `feedback-summary`
- New: `tests/test_report_generator.py`

**Reports generated:**
- `agents/reports/health-dashboard.md` — skill health scores, lifecycle status, execution stats
- `agents/reports/tool-audit.md` — tool calls with timestamps, actions, outcomes
- `agents/reports/feedback-summary.md` — top errors, improvement suggestions, trends

**Acceptance:**
- `task report` generates all three reports
- Reports are readable and actionable
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
- Summary is concise (< 50 lines) and actionable
- Failed lint or health issues are highlighted

---

### PR 4: Feedback governance — suggestions → actions

Define where feedback suggestions go and how they become governance actions.

**Files:**
- New: `scripts/feedback_governance.py`
- New: `.augment.uncompressed/guidelines/agent-infra/feedback-governance.md`
- New: `tests/test_feedback_governance.py`

**Governance targets:**

| Suggestion type | Target | Action |
|---|---|---|
| `fix_error` (≥3 occurrences) | Skill backlog | Create improvement note in skill's SKILL.md |
| `improve_timeout` | Skill metadata | Suggest timeout_seconds adjustment |
| `refactor` (>50% failure) | Lifecycle flag | Mark skill as `needs_review` |
| High-priority repeated | Upstream contribute | Flag for agent-config package contribution |

**Acceptance:**
- `task feedback-apply` reads suggestions and produces concrete action proposals
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
- Mitigation: keep reports short, actionable, and only generated on demand
