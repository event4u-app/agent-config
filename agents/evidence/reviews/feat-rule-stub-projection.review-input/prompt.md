# R2 completion review — feat-rule-stub-projection

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

- diff: `diff.patch` — the review scope (branch head 052a6e66eca0b464a20ab412e544df66a3c3a96a, review
  artefacts excluded), scope hash `dca78ab4a64e1e50d941db33cb64514e8213a657e0c493342e84c1d84d8a6259`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- .github/workflows/rule-backstops.yml
- Taskfile.yml
- agents/evidence/analysis/rule-stub-projection-phase0.md
- agents/roadmaps/road-to-rule-stub-projection.md
- agents/roadmaps/road-to-standing-context-40k.md
- src/config/gate-coverage.yml
- src/config/rule-stub-ceilings.json
- src/scripts/check_rule_stub_ceiling.ts
- taskfiles/ci-fast.yml

## Output format (contract §2.2)

Fill the findings table in `feat-rule-stub-projection.findings.md`:

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
**Honest-null:** 0 findings, scope dca78ab4a64e1e50d941db33cb64514e8213a657e0c493342e84c1d84d8a6259, reviewed <YYYY-MM-DD>
```
