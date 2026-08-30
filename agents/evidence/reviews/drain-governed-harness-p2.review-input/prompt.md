# R2 completion review — drain-governed-harness-p2

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

- diff: `diff.patch` — the review scope (branch head 38146cea381ce1e2cd7f69a1c6e71cce91d9fd5a, review
  artefacts excluded), scope hash `c40baf8d4a87a972b63ee4866f2373b05cfa8c398e053db57b184b93571b336b`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/evidence/analysis/trigger-corpus-census-2026-08-30.md
- agents/evidence/analysis/trigger-corpus-holdout-2026-08-30.md
- agents/roadmaps/road-to-governed-harness-evolution.md
- dist/agent-src/skills/incident-commander/evals/triggers.json
- dist/agent-src/skills/logging-monitoring/evals/triggers.json
- dist/agent-src/skills/markitdown/evals/triggers.json
- dist/agent-src/skills/prompt-engineering-patterns/evals/triggers.json
- dist/agent-src/skills/security-audit/evals/triggers.json
- dist/agent-src/skills/threat-modeling/evals/triggers.json
- src/scripts/lint_skill_trigger_corpus.ts
- src/scripts/trigger_eval_grandfather.json
- src/skills/incident-commander/evals/triggers.json
- src/skills/logging-monitoring/evals/triggers.json
- src/skills/markitdown/evals/triggers.json
- src/skills/prompt-engineering-patterns/evals/triggers.json
- src/skills/security-audit/evals/triggers.json
- src/skills/threat-modeling/evals/triggers.json
- tests/scripts/lint_skill_trigger_corpus.test.ts

## Output format (contract §2.2)

Fill the findings table in `drain-governed-harness-p2.findings.md`:

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
**Honest-null:** 0 findings, scope c40baf8d4a87a972b63ee4866f2373b05cfa8c398e053db57b184b93571b336b, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
