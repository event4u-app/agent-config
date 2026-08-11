# R2 completion review — dispatch-safety-phase2

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

- diff: `diff.patch` — the review scope (branch head d6905af2385948a7bb44dbdb3a9025834b91afb2, review
  artefacts excluded), scope hash `71e38946075bc95d678ab5d9e45f51885b5d6869147d8abadd4a30a6255d2b18`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/roadmaps-progress.md
- agents/roadmaps/road-to-inbox-harvest-2026-08-b-dispatch-safety.md
- dist/agent-src/templates/scripts/work_engine/hooks/builtin/confirmation.ts
- dist/agent-src/templates/scripts/work_engine/hooks/builtin/decision_gate.ts
- src/agent-src/templates/scripts/work_engine/hooks/builtin/confirmation.ts
- src/agent-src/templates/scripts/work_engine/hooks/builtin/decision_gate.ts
- src/cli/registry.ts
- src/scripts/_dispatch.bash
- src/scripts/hooks_status.ts
- src/scripts/schemas/command.schema.json
- src/scripts/schemas/skill.schema.json
- tests/scripts/hooks_status_pending.test.ts
- tests/scripts/requires_confirmation_contract.test.ts
- tests/scripts/work_engine/confirmation_exactly_once.test.ts
- tests/scripts/work_engine/hooks_builtin_decision_gate.test.ts

## Output format (contract §2.2)

Fill the findings table in `dispatch-safety-phase2.findings.md`:

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
**Honest-null:** 0 findings, scope 71e38946075bc95d678ab5d9e45f51885b5d6869147d8abadd4a30a6255d2b18, reviewed <YYYY-MM-DD>
```
