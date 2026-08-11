# R2 completion review — road-to-inbox-harvest-2026-08-b-authoring-contract

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

- diff: `diff.patch` — the review scope (branch head d0c9d9e9b6812d59a7a89e8287bc4b89800aa28d, review
  artefacts excluded), scope hash `f5ec352a48061ea55adaafa99d39b6a512fa75732f6a5afa480c121e5303dd88`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- agents/roadmaps-progress.md
- agents/roadmaps/archive/road-to-inbox-harvest-2026-08-b-authoring-contract.md
- agents/roadmaps/road-to-inbox-harvest-2026-08-b-authoring-contract.md
- agents/roadmaps/road-to-inbox-harvest-2026-08-b.md
- dist/agent-src/skills/corpus-grounding/SKILL.md
- dist/agent-src/skills/design-tokens/SKILL.md
- dist/agent-src/skills/react-shadcn-ui/SKILL.md
- dist/agent-src/skills/rule-writing/SKILL.md
- dist/agent-src/skills/skill-writing/SKILL.md
- dist/agent-src/skills/systematic-debugging/SKILL.md
- dist/agent-src/skills/tailwind-engineer/SKILL.md
- docs/CLAIMS.md
- docs/guidelines/agent-infra/failure-signatures.md
- docs/proof.md
- internal/reports/exec-evidence-feasibility.json
- src/scripts/check_claims.ts
- src/scripts/lint_hedge_words.ts
- src/scripts/skill_linter.ts
- src/skills/corpus-grounding/SKILL.md
- src/skills/design-tokens/SKILL.md
- src/skills/react-shadcn-ui/SKILL.md
- src/skills/rule-writing/SKILL.md
- src/skills/skill-writing/SKILL.md
- src/skills/systematic-debugging/SKILL.md
- src/skills/tailwind-engineer/SKILL.md
- tests/scripts/check_claims.test.ts
- tests/scripts/lint_hedge_words.test.ts
- tests/scripts/skill_linter.test.ts

## Output format (contract §2.2)

Fill the findings table in `road-to-inbox-harvest-2026-08-b-authoring-contract.findings.md`:

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
**Honest-null:** 0 findings, scope f5ec352a48061ea55adaafa99d39b6a512fa75732f6a5afa480c121e5303dd88, reviewed <YYYY-MM-DD>
```
