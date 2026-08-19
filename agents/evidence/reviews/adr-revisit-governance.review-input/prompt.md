# R2 completion review — adr-revisit-governance

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

- diff: `diff.patch` — the review scope (branch head 6ebae092658839b4d1103ae8536817a704be2c15, review
  artefacts excluded), scope hash `4278e40010bbcef8b08bc36e6afdc36578773c3b9cc8ce751caf69161f3ee673`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- .github/workflows/rule-backstops.yml
- agents/roadmaps/archive/INDEX.md
- agents/roadmaps/archive/index.json
- agents/roadmaps/archive/road-to-adr-revisit-governance.md
- dist/agent-src/commands/analyze/decision.md
- dist/agent-src/commands/optimize/project.md
- dist/agent-src/rules/decision-revisit-gate.md
- dist/agent-src/skills/adr-create/SKILL.md
- dist/agent-src/skills/decision-review/SKILL.md
- docs/contracts/adr-layout.md
- docs/decisions/ADR-035-model-capability-tiers.md
- docs/decisions/ADR-105-automatic-subagent-orchestration.md
- docs/decisions/ADR-216-restraint-reanchored-to-capacity.md
- docs/decisions/ADR-232-frontier-tier-reopened.md
- docs/decisions/INDEX.md
- docs/decisions/adr-reopen-sweep-2026-08.md
- src/domains/analysis-workbench/analyze/decision/command.md
- src/domains/meta/optimize/project/command.md
- src/rules/decision-revisit-gate.md
- src/scripts/adr/regenerate_index.ts
- src/scripts/adr_cite_check.ts
- src/scripts/check_adr_frontmatter.ts
- src/skills/adr-create/SKILL.md
- src/skills/decision-review/SKILL.md
- tests/scripts/adr_cite_check.test.ts
- tests/scripts/adr_regenerate_index.test.ts
- tests/scripts/check_adr_frontmatter.test.ts

## Output format (contract §2.2)

Fill the findings table in `adr-revisit-governance.findings.md`:

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
**Honest-null:** 0 findings, scope 4278e40010bbcef8b08bc36e6afdc36578773c3b9cc8ce751caf69161f3ee673, reviewed <YYYY-MM-DD>
```
