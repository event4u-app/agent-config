# R2 completion review — local-gates-wired-20261013

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

- diff: `diff.patch` — the review scope (branch head 41e406ef2b6fd230586b981ed82d8e9bcb151425, review
  artefacts excluded), scope hash `5bdcbab236b27850591a99701c981c69f845f44b5dad7ab88c2324b193e08a5a`
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
- src/scripts/check_knowledge_cards.ts
- src/scripts/lint_subagent_determinism.ts
- src/scripts/trigger_eval_grandfather.json

## Output format (contract §2.2)

Fill the findings table in `local-gates-wired-20261013.findings.md`:

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
**Honest-null:** 0 findings, scope 5bdcbab236b27850591a99701c981c69f845f44b5dad7ab88c2324b193e08a5a, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
