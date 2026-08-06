# R2 completion review — feat-road-to-skill-ecosystem-authoring-discipline

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

- diff: `diff.patch` — the review scope (branch head f0ebea51b823bd50e979ccf6ba66660bec3eef83, review
  artefacts excluded), scope hash `277582b7c9f8b34802b0941330482838e57e6e5504fa0b233dbb99fa2a03908c`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/roadmaps-progress.md
- agents/roadmaps/road-to-skill-ecosystem-authoring-discipline.md
- agents/settings/contexts/rule-migration-inventory-2026-08.md
- dist/agent-src/commands/optimize/deep.md
- dist/agent-src/contexts/execution/mandated-lines.md
- dist/agent-src/rules/downstream-changes.md
- dist/agent-src/rules/think-before-action.md
- dist/agent-src/rules/token-budget-discipline.md
- dist/agent-src/skills/adversarial-review/SKILL.md
- dist/agent-src/skills/decision-review/SKILL.md
- dist/agent-src/skills/judge-artifact-completeness/SKILL.md
- dist/agent-src/skills/judge-bug-hunter/SKILL.md
- dist/agent-src/skills/judge-synthesis/SKILL.md
- dist/agent-src/skills/rule-writing/SKILL.md
- dist/agent-src/skills/skill-improvement-pipeline/SKILL.md
- dist/agent-src/skills/skill-reviewer/SKILL.md
- docs/contracts/adversarial-review-protocol.md
- docs/decisions/ADR-217-rich-class-band-measured-and-enforced.md
- docs/guidelines/agent-infra/artifact-drafting-protocol-mechanics.md
- src/agent-src/contexts/execution/mandated-lines.md
- src/domains/meta/optimize/deep/command.md
- src/rules/downstream-changes.md
- src/rules/think-before-action.md
- src/rules/token-budget-discipline.md
- src/scripts/lint_mandated_lines.ts
- src/scripts/lint_token_budget_discipline.ts
- src/scripts/report_imperative_density.ts
- src/skills/adversarial-review/SKILL.md
- src/skills/decision-review/SKILL.md
- src/skills/judge-artifact-completeness/SKILL.md
- src/skills/judge-bug-hunter/SKILL.md
- src/skills/judge-synthesis/SKILL.md
- src/skills/rule-writing/SKILL.md
- src/skills/skill-improvement-pipeline/SKILL.md
- src/skills/skill-reviewer/SKILL.md
- taskfiles/ci-fast.yml
- tests/scripts/lint_mandated_lines.test.ts

## Output format (contract §2.2)

Fill the findings table in `feat-road-to-skill-ecosystem-authoring-discipline.findings.md`:

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
**Honest-null:** 0 findings, scope 277582b7c9f8b34802b0941330482838e57e6e5504fa0b233dbb99fa2a03908c, reviewed <YYYY-MM-DD>
```
