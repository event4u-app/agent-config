# R2 completion review — feat-close-gate-reds-blockers

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

- diff: `diff.patch` — the review scope (branch head 6518a6a12a69bc640c70febcf36d176ae05b8992, review
  artefacts excluded), scope hash `6de6eb32b0b006cd5f748b998025a9f7e27931ecab984808c09621ac25921a45`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- .github/workflows/consistency.yml
- Taskfile.yml
- agents/roadmaps-progress.md
- agents/roadmaps/archive/road-to-august-program.md
- agents/roadmaps/archive/road-to-inbox-harvest-2026-08-b-release-integrity.md
- agents/roadmaps/archive/road-to-local-only-gate-reds.md
- agents/roadmaps/road-to-august-program.md
- agents/roadmaps/road-to-carrier-layer-convergence.md
- agents/roadmaps/road-to-design-system-onramp.md
- agents/roadmaps/road-to-inbox-harvest-2026-08-b-release-integrity.md
- agents/roadmaps/road-to-local-only-gate-reds.md
- agents/roadmaps/road-to-source-first-frontend.md
- agents/roadmaps/road-to-subagent-lifecycle-integrity.md
- agents/settings/contexts/carrier-divergence-109-vs-24.md
- docs/contracts/CHANGELOG-conventions.md
- docs/contracts/ci-green-floor.md
- docs/decisions/ADR-221-host-native-first-ladder.md
- docs/decisions/ADR-228-global-install-does-not-emit-paths.md
- docs/decisions/INDEX.md
- src/config/gate-coverage.yml
- src/config/gate-violation-baselines.json

## Output format (contract §2.2)

Fill the findings table in `feat-close-gate-reds-blockers.findings.md`:

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
**Honest-null:** 0 findings, scope 6de6eb32b0b006cd5f748b998025a9f7e27931ecab984808c09621ac25921a45, reviewed <YYYY-MM-DD>
```
