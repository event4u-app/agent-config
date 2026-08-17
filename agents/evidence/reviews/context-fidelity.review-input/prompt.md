# R2 completion review — context-fidelity

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

- diff: `diff.patch` — the review scope (branch head fb49e4c767cf99b6736f34b7308b247fcff7dbff, review
  artefacts excluded), scope hash `cf7f987ace49a3748914cba75ebe2c5da69c1a5dadbd637d996dd4e5b40c895d`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- .github/workflows/skill-lint.yml
- Taskfile.yml
- agents/evidence/eval-findings/context-fidelity-cf02.md
- agents/evidence/eval-findings/context-fidelity-cf03.md
- agents/roadmaps-progress.md
- agents/roadmaps/road-to-context-fidelity.md
- docs/CLAIMS.md
- docs/proof.md
- src/config/gate-coverage.yml
- src/scripts/lint_skill_top_position.ts
- taskfiles/ci-fast.yml
- tests/scripts/lint_skill_top_position.test.ts

## Output format (contract §2.2)

Fill the findings table in `context-fidelity.findings.md`:

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
**Honest-null:** 0 findings, scope cf7f987ace49a3748914cba75ebe2c5da69c1a5dadbd637d996dd4e5b40c895d, reviewed <YYYY-MM-DD>
```
