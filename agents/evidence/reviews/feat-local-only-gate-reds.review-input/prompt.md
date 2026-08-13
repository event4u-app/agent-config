# R2 completion review — feat-local-only-gate-reds

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

- diff: `diff.patch` — the review scope (branch head 8ec2334a526572dd549b571f40bf9a24928dbd35, review
  artefacts excluded), scope hash `b751937c59402229f70e7fb9226eb7e4a143d66c62614969dff6e2d42cac9ffb`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/roadmaps-progress.md
- agents/roadmaps/road-to-always-loaded-corpus-scoping.md
- agents/roadmaps/road-to-local-only-gate-reds.md
- src/scripts/lint_rule_skill_pack_reach.ts

## Output format (contract §2.2)

Fill the findings table in `feat-local-only-gate-reds.findings.md`:

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
**Honest-null:** 0 findings, scope b751937c59402229f70e7fb9226eb7e4a143d66c62614969dff6e2d42cac9ffb, reviewed <YYYY-MM-DD>
```
