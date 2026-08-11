# R2 completion review — feat-inbox-harvest-b-ci-economy

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

- diff: `diff.patch` — the review scope (branch head 910f7c4e85886f194f214ceeafe06c2b479b154e, review
  artefacts excluded), scope hash `136ff91b84ce8d51d7e269182b8adbc1b034262fafb9203e4b698d9313b29bf7`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- .github/workflows/adoption-snapshot.yml
- .github/workflows/consumer-matrix.yml
- .github/workflows/cross-model-canary.yml
- .github/workflows/deploy-mcp-worker.yml
- .github/workflows/proof-demo.yml
- .github/workflows/publish-npm.yml
- .github/workflows/release-adjacent-health.yml
- .github/workflows/release.yml
- .github/workflows/rule-backstops.yml
- .github/workflows/self-review-gate.yml
- .github/workflows/site.yml
- .github/workflows/tests.yml
- .gitignore
- agents/roadmaps-progress.md
- agents/roadmaps/road-to-inbox-harvest-2026-08-b-ci-economy.md
- docs/contracts/ci-cost-budget.md
- docs/decisions/ADR-223-no-required-check-demotion-on-cost-grounds.md
- docs/decisions/INDEX.md
- docs/development.md
- package.json
- src/scripts/ci_time_ratio.ts
- taskfiles/ci-fast.yml
- tests/scripts/build_proof.test.ts
- tsconfig.scripts.json
- tsconfig.test.json

## Output format (contract §2.2)

Fill the findings table in `feat-inbox-harvest-b-ci-economy.findings.md`:

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
**Honest-null:** 0 findings, scope 136ff91b84ce8d51d7e269182b8adbc1b034262fafb9203e4b698d9313b29bf7, reviewed <YYYY-MM-DD>
```
