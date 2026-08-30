# R2 completion review — drain-source-silence-cutover

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

- diff: `diff.patch` — the review scope (branch head 1393fde93bb92c6a441c3306b57adfcd736742d0, review
  artefacts excluded), scope hash `5d1b901782ce676ffca5b3e5bd47cc0bc0b569aacd739e89d5d2f40bc73ed913`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- CREDITS.md
- agents/evidence/reports/source-skip-paths-ledger.md
- agents/roadmaps/later/road-to-source-silence-cutover.md
- agents/roadmaps/road-to-source-silence-cutover.md
- agents/roadmaps/stubs/road-to-public-metadata-redaction.md
- docs/THIRD-PARTY-NOTICES.md
- package.json
- provenance/borrows.jsonl
- src/config/gate-violation-baselines.json
- src/scripts/_lib/source_shape.ts
- src/scripts/check_no_external_sources.ts
- src/scripts/cost/budget.mjs
- src/scripts/cost/track.mjs
- src/scripts/external_sources_denylist.json
- tests/fixtures/source-headers/compliant.md
- tests/fixtures/source-headers/internal-ref.md
- tests/fixtures/source-headers/leaking.md
- tests/scripts/source_header_narrowing.test.ts
- tests/scripts/source_shape.test.ts

## Output format (contract §2.2)

Fill the findings table in `drain-source-silence-cutover.findings.md`:

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
**Honest-null:** 0 findings, scope 5d1b901782ce676ffca5b3e5bd47cc0bc0b569aacd739e89d5d2f40bc73ed913, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
