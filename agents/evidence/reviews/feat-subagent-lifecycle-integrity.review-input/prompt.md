# R2 completion review — feat-subagent-lifecycle-integrity

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

- diff: `diff.patch` — the review scope (branch head 4d49029266a04d8d025e110be0a574553634acea, review
  artefacts excluded), scope hash `de440ba0d93ebaf2537518782922d87799e56aec7dbaf974bce274d30d6f8c00`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/roadmaps-progress.md
- agents/roadmaps/road-to-subagent-lifecycle-integrity.md
- docs/contracts/concern-activation-policy.md
- src/scripts/hook_manifest.yaml
- src/scripts/hooks/concern_registry.ts
- src/scripts/hooks/spawn_guard_shadow_hook.ts
- src/scripts/hooks/subagent_ledger_hook.ts
- src/scripts/hooks/turn_end_gate_hook.ts
- tests/hooks/spawn_guard_shadow.test.ts
- tests/scripts/turn_end_gate_hook.test.ts

## Output format (contract §2.2)

Fill the findings table in `feat-subagent-lifecycle-integrity.findings.md`:

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
**Honest-null:** 0 findings, scope de440ba0d93ebaf2537518782922d87799e56aec7dbaf974bce274d30d6f8c00, reviewed <YYYY-MM-DD>
```
