# R2 completion review — drain-conformance-check-r2

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

- diff: `diff.patch` — the review scope (branch head d7a2e78667c95e7fb60128b91cfa56488f1bc849, review
  artefacts excluded), scope hash `e96df5a35425c4c4b8f0a2df1d5d5e2dae3aaee21d3124d16e09df051924054c`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/roadmaps/road-to-a-conformance-check-that-can-fail.md
- dist/install/conflict.js
- dist/install/conflict.js.map
- dist/install/preflight.js
- dist/install/preflight.js.map
- dist/install/recordedOwnership.js
- dist/install/recordedOwnership.js.map
- dist/install/txlog.js
- dist/install/txlog.js.map
- docs/contracts/conformance.md
- docs/contracts/gui-wizard.md
- src/install/conflict.ts
- src/install/preflight.ts
- src/install/recordedOwnership.ts
- src/install/txlog.ts
- src/install/types.ts
- src/scripts/_cli/cmd_conformance.ts
- src/server/routes/install.ts
- src/ui/wizard/state.ts
- tests/install/conflict.test.ts
- tests/install/preflight.test.ts
- tests/install/recordedOwnership.test.ts
- tests/scripts/_cli/cmd_conformance.test.ts

## Output format (contract §2.2)

Fill the findings table in `drain-conformance-check-r2.findings.md`:

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
**Honest-null:** 0 findings, scope e96df5a35425c4c4b8f0a2df1d5d5e2dae3aaee21d3124d16e09df051924054c, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
