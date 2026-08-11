# R2 completion review — council-integrity

You are a FRESH reviewer subagent. You have no implementation context and
you must not acquire any (blind-review pattern, plan-review-gates.md §5).

## Review mode

Senior-engineer review of the branch diff. Search grid — hunt for:

- errors
- inconsistent logic
- inefficiencies
- bug-producing patterns

## Rules

- Review only — write no code, fix nothing.
- Tool allowlist (contract §5): branch-scoped `git diff` + reads of
  branch-touched files only; no `git log` beyond the branch, no repo-wide
  grep, no reads of `agents/runtime/` or session artifacts.

## Inputs

- diff: `diff.patch` — the review scope (branch head 94f25c25d7911ef9fc177db21dba0e294e7e143a, review
  artefacts excluded), scope hash `ff803d2c135d255ffcd288c8eb9ade15d2c4927075f5d1c6aacb455023b63d39`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/roadmaps-progress.md
- agents/roadmaps/archive/road-to-inbox-harvest-2026-08-b-council-integrity.md
- agents/roadmaps/road-to-inbox-harvest-2026-08-b-council-integrity-followup.md
- agents/roadmaps/road-to-inbox-harvest-2026-08-b-council-integrity.md
- agents/roadmaps/road-to-inbox-harvest-2026-08-b.md
- src/scripts/_lib/env_kill_switch.ts
- src/scripts/ai_council/events_log.ts
- src/scripts/ai_council/orchestrator.ts
- src/scripts/ai_council/prompts.ts
- src/scripts/ai_team/review_gate.ts
- tests/scripts/ai_council/synthesis_check.test.ts

## Output format (contract §2.2)

Fill the findings table in `council-integrity.findings.md`:

```markdown
| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | critical | src/x.ts:42 | ... | open | |
```

- Severity ∈ {`critical`, `high`, `medium`, `low`}, rows sorted descending
  by severity (ties keep authoring order).
- Initial status of every finding: `open`.
- A row is LIVE wherever it appears — a code fence around it changes
  nothing. If you quote the template as an illustration, its Status cell
  must be exactly `example`, or the gate reads it as a real finding.
- 0 findings → replace the table with exactly this honest-null line
  (contract §2.3):

```markdown
**Honest-null:** 0 findings, scope ff803d2c135d255ffcd288c8eb9ade15d2c4927075f5d1c6aacb455023b63d39, reviewed <YYYY-MM-DD>
```
