# R2 completion review — ownership-unknown-arm

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

- diff: `diff.patch` — the review scope (branch head dfb4734348092cf12b235ea8b6c0db57641f0cc3, review
  artefacts excluded), scope hash `6878090180f624bb8ff45156818fd36b18437e00a34e979e4506f79167d18ccc`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/evidence/council/ownership-unknown-arm-20261017.md
- agents/evidence/council/ownership-unknown-arm-20261017.question.md
- agents/roadmaps/road-to-an-ownership-record-that-belongs-to-the-user.md
- dist/install/conflict.js
- dist/install/conflict.js.map
- dist/install/conflictTracker.js
- dist/install/conflictTracker.js.map
- dist/install/install.mjs
- dist/install/preflight.js
- dist/install/preflight.js.map
- dist/install/preserve.js
- dist/install/preserve.js.map
- dist/install/recordedOwnership.js
- dist/install/recordedOwnership.js.map
- src/install/conflict.ts
- src/install/conflictTracker.ts
- src/install/preflight.ts
- src/install/preserve.ts
- src/install/recordedOwnership.ts
- src/install/types.ts
- src/scripts/_cli/doctor_ownership_ledger.ts
- src/scripts/install.ts
- src/server/routes/install.ts
- tests/install/ownershipLedger.test.ts
- tests/install/ownership_parity.test.ts
- tests/scripts/install.preserve.test.ts

## Output format (contract §2.2)

Fill the findings table in `ownership-unknown-arm.findings.md`:

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
**Honest-null:** 0 findings, scope 6878090180f624bb8ff45156818fd36b18437e00a34e979e4506f79167d18ccc, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
