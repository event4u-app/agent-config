# R2 completion review — drain-delivery-for-every-host-4-4-close

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

- diff: `diff.patch` — the review scope (branch head 1d36c6ca56c5e5458a1cbc24accf5feb4b3e47ce, review
  artefacts excluded), scope hash `06569f65aa79374490c45e8627ff2456f19573a7148b35708879f1f58d6ddd24`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- .github/workflows/standing-payload-delta.yml
- agents/evidence/analysis/adr-evidence-census-2026-08.md
- agents/evidence/analysis/grace-ceiling-expiry-is-unenforced-2026-09-10.md
- agents/roadmaps/road-to-delivery-for-every-host.md
- agents/roadmaps/stubs/road-to-preamble-transfer-debt-221.md
- docs/decisions/ADR-273-the-grace-ceiling-expiry-was-never-enforced-and-the-date-is-deleted.md
- docs/decisions/INDEX.md
- src/config/preamble-payload-budget.json
- taskfiles/ci-fast.yml
- tests/scripts/check_preamble_payload_budget.test.ts

## Output format (contract §2.2)

Fill the findings table in `drain-delivery-for-every-host-4-4-close.findings.md`:

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
**Honest-null:** 0 findings, scope 06569f65aa79374490c45e8627ff2456f19573a7148b35708879f1f58d6ddd24, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
