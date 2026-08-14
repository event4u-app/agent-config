# R2 completion review — skill-catalogue-budget

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

- diff: `diff.patch` — the review scope (branch head 66b83ba40c27d94b8cb26a1337155b0d42d6caa6, review
  artefacts excluded), scope hash `be980d9f1f50ffd23f1089995303535b7edd930feaef711ea712058520f522d1`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/evidence/analysis/skill-catalogue-budget-codex.md
- agents/roadmaps-progress.md
- agents/roadmaps/road-to-skill-catalogue-budget.md
- agents/templates/.ai-council.yml.example
- src/scripts/ai_council/clients.ts
- src/scripts/ai_council/config.ts
- src/scripts/ai_council/orchestrator.ts
- src/scripts/ai_council/transport_resolver.ts
- src/scripts/ai_team/team_dispatch.ts
- src/scripts/capture_skill_catalogue.ts
- src/scripts/install.ts
- tests/scripts/ai_council/clients.test.ts
- tests/scripts/ai_council/config.test.ts
- tests/scripts/ai_council/orchestrator.test.ts
- tests/scripts/ai_team/team_dispatch.test.ts
- tests/scripts/catalogue_capture.test.ts
- tests/scripts/install/catalogue_budget_warning.test.ts

## Output format (contract §2.2)

Fill the findings table in `skill-catalogue-budget.findings.md`:

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
**Honest-null:** 0 findings, scope be980d9f1f50ffd23f1089995303535b7edd930feaef711ea712058520f522d1, reviewed <YYYY-MM-DD>
```
