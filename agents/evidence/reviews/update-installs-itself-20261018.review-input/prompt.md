# R2 completion review — update-installs-itself-20261018

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

- diff: `diff.patch` — the review scope (branch head 83b20d85f19e498b9d559dca6c60e046313e4bde, review
  artefacts excluded), scope hash `ae546c7cd57c202d591b53abb40513599812903c79e04dabdd5abf323984bba7`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/evidence/analysis/mid-session-swap-probe-2026-10-18.md
- agents/roadmaps/road-to-an-update-that-installs-itself-only-when-it-is-safe.md
- docs/getting-started.md
- src/scripts/_cli/cmd_update.ts
- src/scripts/_cli/cmd_upgrade.ts
- src/scripts/_cli/upgrade_unattended.ts
- src/scripts/_lib/pin_advice.ts
- src/scripts/_lib/unattended_gates.ts
- tests/lib/pin_advice.test.ts
- tests/scripts/_cli/upgrade_unattended.test.ts

## Output format (contract §2.2)

Fill the findings table in `update-installs-itself-20261018.findings.md`:

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
**Honest-null:** 0 findings, scope ae546c7cd57c202d591b53abb40513599812903c79e04dabdd5abf323984bba7, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
