# R2 completion review — single-delivery

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

- diff: `diff.patch` — the review scope (branch head 8c7d62a6e8fbce84669917dc7733c8666c711e9c, review
  artefacts excluded), scope hash `3577b8ed9da3348d8772823639391762bd63af9a22cc58e6f1b98d2632a05c57`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/evidence/analysis/single-delivery-partition-census.md
- agents/roadmaps-progress.md
- agents/roadmaps/road-to-single-delivery.md
- docs/contracts/install-scopes.md
- docs/decisions/ADR-226-package-repo-keeps-both-rule-layers.md
- docs/decisions/ADR-235-one-artefact-one-layer.md
- docs/decisions/INDEX.md
- src/config/estate-count-budget.json
- src/scripts/_lib/scope_guard.sh
- src/scripts/check_single_delivery.ts
- src/scripts/condense.ts
- src/scripts/install.sh

## Output format (contract §2.2)

Fill the findings table in `single-delivery.findings.md`:

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
**Honest-null:** 0 findings, scope 3577b8ed9da3348d8772823639391762bd63af9a22cc58e6f1b98d2632a05c57, reviewed <YYYY-MM-DD>
```
