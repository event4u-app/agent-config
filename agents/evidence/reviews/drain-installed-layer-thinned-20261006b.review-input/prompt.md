# R2 completion review — drain-installed-layer-thinned-20261006b

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

- diff: `diff.patch` — the review scope (branch head 3f64ae273f835889812fe349d21690d056fc305c, review
  artefacts excluded), scope hash `0c5e6c3fe3f7f4fd7ed840d0c0adb13b3eba150098971cd8c1fdc6bcf549c937`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- agents/evidence/analysis/installed-layer-ceiling-measurement-2026-10-06.md
- agents/roadmaps/archive/road-to-a-rule-carrier-that-works-outside-the-repo.md
- agents/roadmaps/road-to-a-rule-carrier-that-works-outside-the-repo.md
- agents/roadmaps/road-to-an-installed-layer-that-is-thinned.md
- src/config/rule-law-ceilings.json
- src/scripts/lint_rule_law_section.ts
- tests/scripts/lint_rule_law_section.test.ts

## Output format (contract §2.2)

Fill the findings table in `drain-installed-layer-thinned-20261006b.findings.md`:

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
**Honest-null:** 0 findings, scope 0c5e6c3fe3f7f4fd7ed840d0c0adb13b3eba150098971cd8c1fdc6bcf549c937, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
