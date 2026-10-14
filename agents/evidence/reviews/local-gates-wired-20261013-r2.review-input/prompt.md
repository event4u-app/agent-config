# R2 completion review — local-gates-wired-20261013-r2

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

- diff: `diff.patch` — the review scope (branch head c98d3ece479447512fd9b5f94acc048937093966, review
  artefacts excluded), scope hash `ee5aa6b9a4217d2e7f2704e6be3af25dd19a7a42ca181a94e5004aa2390a7242`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- .github/workflows/gate-canary.yml
- .github/workflows/rule-backstops.yml
- agents/evidence/analysis/local-only-gates-complete-reading.md
- agents/roadmaps/road-to-local-gates-wired-while-they-are-green.md
- agents/settings/contexts/structural/file-ownership-matrix.md
- docs/contracts/file-ownership-matrix.json
- docs/cookbook.md
- docs/role-experiences.md
- src/config/ci-local-parity.yml
- src/config/gate-reachability-exemptions.json
- src/config/gate-violation-baselines.json
- src/config/routing-coverage-seed.json
- src/scripts/check_knowledge_cards.ts
- src/scripts/lint_subagent_determinism.ts
- src/scripts/trigger_eval_grandfather.json
- tests/scripts/ci_local_parity_classes.test.ts

## Output format (contract §2.2)

Fill the findings table in `local-gates-wired-20261013-r2.findings.md`:

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
**Honest-null:** 0 findings, scope ee5aa6b9a4217d2e7f2704e6be3af25dd19a7a42ca181a94e5004aa2390a7242, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
