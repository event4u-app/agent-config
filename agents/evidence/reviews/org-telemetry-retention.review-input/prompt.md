# R2 completion review — org-telemetry-retention

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

- diff: `diff.patch` — the review scope (branch head dce6f6dc831c516ab2d12e2f2c5e95ef83bcf894, review
  artefacts excluded), scope hash `1b9820889d936755a4883916e62e8ceafb2079718ccb298bf20dcc8295e20511`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- SECURITY.md
- agents/roadmaps-progress.md
- agents/roadmaps/road-to-org-telemetry.md
- docs/contracts/settings-classes.md
- docs/decisions/ADR-233-org-pack-provenance-class.md
- docs/decisions/INDEX.md
- src/agent-src/templates/agent-settings.md
- src/agent-src/templates/scripts/telemetry/remote.ts
- src/agent-src/templates/scripts/telemetry/settings.ts
- src/scripts/hook_manifest.yaml
- src/scripts/hooks/concern_registry.ts
- src/scripts/hooks/telemetry_usage_hook.ts
- src/scripts/telemetry_disclosure_hook.ts
- src/shared/settingsConsent.ts
- tests/hooks/telemetry_usage_hook.test.ts
- tests/scripts/jit_ask_budget.test.ts
- tests/scripts/telemetry_disclosure_hook.test.ts
- tests/scripts/templates_telemetry_remote.test.ts

## Output format (contract §2.2)

Fill the findings table in `org-telemetry-retention.findings.md`:

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
**Honest-null:** 0 findings, scope 1b9820889d936755a4883916e62e8ceafb2079718ccb298bf20dcc8295e20511, reviewed <YYYY-MM-DD>
```
