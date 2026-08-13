# R2 completion review — feat-source-first-frontend

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

- diff: `diff.patch` — the review scope (branch head 14252809d1b1fc92e849f520b70b0113490fc27f, review
  artefacts excluded), scope hash `9ff18dd17eba429e1d1c69af6a85db242d73f2caa6cfe4cfa8fca7183aaf39c6`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/evidence/analysis/source-first-frontend-phase1.md
- agents/roadmaps-progress.md
- agents/roadmaps/road-to-source-first-frontend.md
- agents/settings/contexts/design-corpus-upstream-harvest.md
- dist/agent-src/rules/code-provenance.md
- dist/agent-src/rules/content-quoting-floor.md
- dist/agent-src/rules/design-fidelity.md
- dist/agent-src/skills/design-review/references/verification-automation.md
- dist/agent-src/skills/fe-design/SKILL.md
- docs/guidelines/design-fidelity-mechanics.md
- src/rules/code-provenance.md
- src/rules/content-quoting-floor.md
- src/rules/design-fidelity.md
- src/scripts/hooks/ui_route_nudge_hook.ts
- src/scripts/report_consultation_rate.ts
- src/skills/design-review/references/verification-automation.md
- src/skills/fe-design/SKILL.md
- tests/design-artifacts/eval-fixtures.md
- tests/scripts/consultation_rate.test.ts
- tests/scripts/design_fidelity_routing.test.ts
- tests/scripts/ui_route_nudge_artifact_read.test.ts

## Output format (contract §2.2)

Fill the findings table in `feat-source-first-frontend.findings.md`:

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
**Honest-null:** 0 findings, scope 9ff18dd17eba429e1d1c69af6a85db242d73f2caa6cfe4cfa8fca7183aaf39c6, reviewed <YYYY-MM-DD>
```
