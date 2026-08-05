# R2 completion review — feat-road-to-zero-ceremony-settings

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

- diff: `diff.patch` — the review scope (branch head a03d21b5960c0e13b910c01d86cb5c4f99a4ad77, review
  artefacts excluded), scope hash `f7f09ca99ea397e7d12f3c3f9993b49423c768d3b9341aed3ca36d77b56aad92`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- .github/workflows/consistency.yml
- Taskfile.yml
- agents/roadmaps-progress.md
- agents/roadmaps/road-to-zero-ceremony-settings.md
- docs/contracts/settings-api.md
- docs/contracts/settings-classes.md
- package.json
- src/cli/registry.ts
- src/config/evaluator-budgets.json
- src/config/gate-coverage.yml
- src/scripts/_cli/cmd_settings_set.ts
- src/scripts/_dispatch.bash
- src/scripts/lint_settings_classes.ts
- src/server/routes/settings.ts
- src/shared/settingsClasses.ts
- src/ui/pages/SettingsPage.tsx
- taskfiles/ci-fast.yml
- tests/scripts/lint_settings_classes.test.ts
- tests/scripts/settings_set.test.ts
- tests/server/settings.write-rejects.test.ts
- tests/server/settings.write.test.ts
- tests/server/sharedWriteCheck.test.ts

## Output format (contract §2.2)

Fill the findings table in `feat-road-to-zero-ceremony-settings.findings.md`:

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
**Honest-null:** 0 findings, scope f7f09ca99ea397e7d12f3c3f9993b49423c768d3b9341aed3ca36d77b56aad92, reviewed <YYYY-MM-DD>
```
