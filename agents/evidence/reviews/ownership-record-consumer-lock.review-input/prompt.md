# R2 completion review — ownership-record-consumer-lock

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

- diff: `diff.patch` — the review scope (branch head d99c735c6cfa6f6bd4f4959ab355f5f0ed5eb065, review
  artefacts excluded), scope hash `0bd760e1ccbd621e9ce545e0cbea6e882e2e4074b00fd3289770a2aad5e96c8d`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- README.md
- agents/roadmaps/archive/road-to-an-ownership-record-that-belongs-to-the-user.md
- agents/roadmaps/road-to-an-ownership-record-that-belongs-to-the-user.md
- dist/install/install.mjs
- dist/install/manifestFiles.js
- dist/install/manifestFiles.js.map
- docs/contracts/agents-layout.md
- docs/contracts/install-layout.md
- docs/contracts/installed-tools-lockfile.md
- src/install/manifestFiles.ts
- src/scripts/_cli/cmd_uninstall.ts
- src/scripts/_lib/neighbour_census.ts
- src/scripts/_lib/skill_origin.ts
- src/scripts/install.ts
- tests/install/ownership_ledger_real_install.test.ts
- tests/scripts/_cli/cmd_uninstall.test.ts
- tests/scripts/neighbour_census.test.ts
- tests/scripts/neighbour_route_origin.test.ts

## Output format (contract §2.2)

Fill the findings table in `ownership-record-consumer-lock.findings.md`:

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
**Honest-null:** 0 findings, scope 0bd760e1ccbd621e9ce545e0cbea6e882e2e4074b00fd3289770a2aad5e96c8d, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
