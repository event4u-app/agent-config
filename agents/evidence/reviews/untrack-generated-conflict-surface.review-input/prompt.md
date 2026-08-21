# R2 completion review — untrack-generated-conflict-surface

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

- diff: `diff.patch` — the review scope (branch head daefc280094a633462b935117f56879b532e39f6, review
  artefacts excluded), scope hash `a81de63343e1a96a2f68e5e8515015c7a05e480c0ef894854bdc44ae4e0dd003`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- .gitignore
- agents/evidence/notes/drain-run-handoff.md
- agents/roadmaps-progress.md
- agents/roadmaps/archive/INDEX.md
- agents/roadmaps/archive/index.json
- agents/roadmaps/archive/road-to-generated-artifact-conflict-drawdown.md
- agents/roadmaps/archive/road-to-solution-minimalism.md
- agents/roadmaps/archive/step-12-closure-report.md
- agents/roadmaps/stubs/README.md
- agents/roadmaps/stubs/road-to-ci-native-release-live-label-path.md
- agents/roadmaps/stubs/road-to-gate-preauth-authorization.md
- agents/roadmaps/stubs/road-to-org-telemetry-enablement.md
- agents/roadmaps/stubs/road-to-ratchet-baseline-append-safety.md
- dist/agent-src/scripts/dashboard_mode.ts
- dist/agent-src/scripts/update_roadmap_progress.ts
- src/agent-src/scripts/dashboard_mode.ts
- src/agent-src/scripts/update_roadmap_progress.ts
- src/scripts/check_references.ts
- src/scripts/sync_pr_branch.ts
- taskfiles/content.yml
- tests/scripts/check_references.test.ts
- tests/scripts/sync_pr_branch.test.ts
- tests/scripts/update_roadmap_progress.test.ts

## Output format (contract §2.2)

Fill the findings table in `untrack-generated-conflict-surface.findings.md`:

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
**Honest-null:** 0 findings, scope a81de63343e1a96a2f68e5e8515015c7a05e480c0ef894854bdc44ae4e0dd003, reviewed <YYYY-MM-DD>
```
